import { Linter } from 'eslint';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, relative, sep } from 'node:path';
import { generateDiscovery } from './discovery.mjs';
import { allowPureJsxGrouping } from './plugin-capabilities.mjs';

const linter = new Linter();

function executableCalls(source, path) {
	const contexts = [];
	const imports = [];
	const identifiers = new Set();
	const messages = linter.verify(
		source,
		[
			{
				languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
				linterOptions: { noInlineConfig: true },
				plugins: {
					capture: {
						rules: {
							calls: {
								create: () => ({
									Identifier: (node) => identifiers.add(node.name),
									CallExpression: (node) => {
										const callee = node.callee;

										if (callee.type === 'MemberExpression' && !callee.computed && callee.object.type === 'Identifier' && callee.object.name === 'require' && callee.property.name === 'context') {
											contexts.push(node);
										}
									},
									ImportExpression: (node) => imports.push(node),
								}),
							},
						},
					},
				},
				rules: { 'capture/calls': 'error' },
			},
		],
		{ filename: 'module.js' },
	);
	const fatal = messages.find((message) => message.fatal);

	if (fatal) {
		throw new Error(`Cannot parse ${path}: ${fatal.message}`);
	}

	return { contexts: contexts.sort((a, b) => a.start - b.start), imports, identifiers };
}

/**
 * Migrate literal webpack require.context calls in selected source files.
 * Generated modules live in outputDir and must be regenerated on rebuild.
 * Set lazyContexts to match contexts whose callers expect promises, and
 * omitContexts to match contexts handled separately (for example CSS).
 * Template-literal imports and nonliteral require.context calls are not rewritten.
 */
export function eightshiftDiscovery({ root, outputDir, filter = /\.[cm]?jsx?$/, lazyContexts = () => false, omitContexts = () => false, transformSource } = {}) {
	if (!root || !outputDir) {
		throw new TypeError('root and outputDir are required');
	}

	outputDir = resolve(root, outputDir);
	root = realpathSync(root);

	const plugin = {
		name: 'eightshift-discovery',
		setup(builder) {
			builder.onLoad({ filter }, async ({ path }) => {
				if (!path.startsWith(`${root}${sep}`)) {
					return;
				}

				const source = await readFile(path, 'utf8');

				if (!source.includes('require') || !source.includes('context')) {
					return;
				}

				const { contexts: matches, identifiers } = executableCalls(source, path);

				if (!matches.length) {
					return;
				}

				const definitions = [];
				let contents = '';
				let offset = 0;

				for (const match of matches) {
					const [directoryNode, recursiveNode, patternNode, modeNode] = match.arguments;

					if (
						match.optional ||
						match.arguments.length < 3 ||
						match.arguments.length > 4 ||
						directoryNode?.type !== 'Literal' ||
						typeof directoryNode.value !== 'string' ||
						recursiveNode?.type !== 'Literal' ||
						typeof recursiveNode.value !== 'boolean' ||
						!patternNode?.regex ||
						(modeNode && (modeNode.type !== 'Literal' || !['sync', 'lazy'].includes(modeNode.value)))
					) {
						throw new Error(`Unsupported require.context in ${path}`);
					}

					if (!recursiveNode.value) {
						throw new Error(`Nonrecursive require.context is unsupported in ${path}`);
					}

					const directory = directoryNode.value;
					const context = { path, directory, pattern: new RegExp(patternNode.regex.pattern, patternNode.regex.flags), mode: modeNode?.value ?? 'sync' };
					let index = definitions.length;
					let name = `context${index}`;

					while (identifiers.has(name)) {
						name = `context${++index}`;
					}

					identifiers.add(name);

					contents += source.slice(offset, match.start);

					if (omitContexts(context)) {
						contents += 'Object.assign(() => ({}), { keys: () => [] })';
					} else {
						definitions.push({ name, directory: resolve(dirname(path), directory), pattern: context.pattern, mode: lazyContexts(context) ? 'lazy' : context.mode });
						contents += name;
					}

					offset = match.end;
				}

				contents += source.slice(offset);

				if (definitions.length) {
					const id = createHash('sha256').update(relative(root, path)).digest('hex').slice(0, 20);
					const output = resolve(outputDir, `${id}.mjs`);

					await generateDiscovery({ root, output, definitions });
					contents = `import { ${definitions.map(({ name }) => name).join(', ')} } from ${JSON.stringify(output)};\n${contents}`;
				}

				contents = transformSource ? transformSource(contents, path) : contents;

				return { contents, loader: 'jsx', resolveDir: dirname(path) };
			});
		},
	};

	return transformSource ? plugin : allowPureJsxGrouping(plugin);
}

/** Rewrite literal relative dynamic imports for a synchronous IIFE editor build.
 * Build collected targets as ESM entries, then wrap the IIFE in a function
 * receiving scriptUrlIdentifier from currentScript.src. Chunk URLs are relative
 * to that script. The caller owns chunk output/builds.
 * Pass transformSource to eightshiftDiscovery to compose both onLoad hooks.
 * Existing chunks Map names are reused. Set versioned: false when those names
 * already contain content hashes, as in native editor sharing.
 */
export function editorLazyImports({ root, chunks, chunkDir = 'editor-chunks', scriptUrlIdentifier = '__eightshiftEditorScriptUrl', filter = /\.[cm]?jsx?$/, include = (path) => !path.split(sep).includes('node_modules'), versioned = true } = {}) {
	if (!root || !(chunks instanceof Map) || !/^[$A-Z_a-z][$\w]*$/.test(scriptUrlIdentifier)) {
		throw new TypeError('Expected root, chunks Map and valid script URL identifier');
	}

	root = realpathSync(resolve(root));
	const require = createRequire(import.meta.url);
	const transformSource = (source, path) => {
		if (!include(path) || !source.includes('import')) {
			return source;
		}

		const { imports } = executableCalls(source, path);
		let contents = source;

		for (const node of imports.sort((a, b) => b.start - a.start)) {
			if (node.source.type !== 'Literal' || typeof node.source.value !== 'string' || !node.source.value.startsWith('.') || node.options) {
				continue;
			}

			const target = require.resolve(resolve(dirname(path), node.source.value));
			const name = chunks.get(target) ?? `${createHash('sha256').update(relative(root, target)).digest('hex').slice(0, 20)}.js`;
			chunks.set(target, name);
			const version = versioned ? '?v=00000000000000000000' : '';
			const replacement = `import(new URL(${JSON.stringify(`${chunkDir}/${name}${version}`)}, ${scriptUrlIdentifier}).href)`;
			contents = contents.slice(0, node.start) + replacement + contents.slice(node.end);
		}

		return contents;
	};

	const plugin = {
		name: 'eightshift-editor-lazy-imports',
		setup(builder) {
			builder.onLoad({ filter }, async ({ path }) => {
				if (!path.startsWith(`${root}${sep}`)) {
					return;
				}

				const source = await readFile(path, 'utf8');
				const contents = transformSource(source, path);

				if (contents !== source) {
					return { contents, loader: 'jsx', resolveDir: dirname(path) };
				}
			});
		},
	};

	return { plugin, transformSource };
}
