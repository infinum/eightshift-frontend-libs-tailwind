import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, relative, sep } from 'node:path';
import { generateDiscovery } from './discovery.mjs';
import { allowPureJsxGrouping } from './plugin-capabilities.mjs';

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

				if (!source.includes('require.context')) {
					return;
				}

				const pattern = /require\.context\(\s*(['"])([^'"\n]+)\1\s*,\s*(true|false)\s*,\s*\/(?!\*)(?!\/)((?:\\.|[^/\n])+)\/([dgimsuvy]*)\s*(?:,\s*(['"])(sync|lazy)\6\s*)?\)/g;
				const matches = [...source.matchAll(pattern)];

				if (!matches.length) {
					throw new Error(`Unsupported require.context in ${path}`);
				}

				const definitions = [];
				let contents = '';
				let offset = 0;

				for (const match of matches) {
					const [, , directory, recursive, expression, flags, , webpackMode] = match;

					if (recursive !== 'true') {
						throw new Error(`Nonrecursive require.context is unsupported in ${path}`);
					}

					const context = { path, directory, pattern: new RegExp(expression, flags), mode: webpackMode || 'sync' };
					const name = `context${definitions.length}`;

					contents += source.slice(offset, match.index);

					if (omitContexts(context)) {
						contents += 'Object.assign(() => ({}), { keys: () => [] })';
					} else {
						definitions.push({ name, directory: resolve(dirname(path), directory), pattern: context.pattern, mode: lazyContexts(context) ? 'lazy' : context.mode });
						contents += name;
					}

					offset = match.index + match[0].length;
				}

				contents += source.slice(offset);

				if (contents.includes('require.context')) {
					throw new Error(`Unsupported require.context remains in ${path}`);
				}

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
	const transformSource = (source, path) =>
		!include(path)
			? source
			: source.replace(/import\(\s*(?:\/\*[\s\S]*?\*\/\s*)?(['"])(\.[^'"\n]+)\1\s*\)/g, (_match, _quote, specifier) => {
					const target = require.resolve(resolve(dirname(path), specifier));
					const name = chunks.get(target) ?? `${createHash('sha256').update(relative(root, target)).digest('hex').slice(0, 20)}.js`;

					chunks.set(target, name);
					const version = versioned ? '?v=00000000000000000000' : '';

					return `import(new URL(${JSON.stringify(`${chunkDir}/${name}${version}`)}, ${scriptUrlIdentifier}).href)`;
				});
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
