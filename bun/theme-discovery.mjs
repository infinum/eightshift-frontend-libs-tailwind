import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { Linter } from 'eslint';
import { generateDiscovery } from './discovery.mjs';

/**
 * Generate caller-defined contexts for each surface. Returns absolute module
 * paths keyed by surface. Regenerate after adding or removing source files.
 */
export async function generateThemeDiscovery({ root, outputDir, surfaces }) {
	if (!root || !outputDir || !surfaces || typeof surfaces !== 'object') {
		throw new TypeError('Expected root, outputDir and surfaces');
	}

	const modules = {};

	for (const [surface, definitions] of Object.entries(surfaces)) {
		if (!/^[\w-]+$/.test(surface) || !Array.isArray(definitions)) {
			throw new TypeError('Invalid discovery surface');
		}

		const output = resolve(root, outputDir, `${surface}.mjs`);

		await generateDiscovery({ root, output, definitions });
		modules[surface] = output;
	}

	return modules;
}

/**
 * Build a static, lazy importer map from a caller-selected Bun glob. `key`
 * maps each root-relative file to its runtime lookup key. Styles are optional
 * { keys, href } groups, loaded once before the corresponding importer; failed
 * loads remove their link and can be retried. URLs resolve relative to the
 * generated JavaScript module, matching Bun's import.meta.url behavior.
 */
export async function generateThemeImporters({ root, glob, key, styles = [], styleRuntime }) {
	if (!root || typeof glob !== 'string' || typeof key !== 'function' || !Array.isArray(styles) || (styleRuntime !== undefined && (typeof styleRuntime !== 'string' || !styleRuntime))) {
		throw new TypeError('Expected root, glob, key and styles');
	}

	const entries = [];
	const keys = new Set();

	for await (const file of new Bun.Glob(glob).scan({ cwd: root, onlyFiles: true })) {
		const name = key(file);

		if (typeof name !== 'string' || keys.has(name)) {
			throw new TypeError(`Invalid or duplicate importer key: ${name}`);
		}

		keys.add(name);
		entries.push([name, resolve(root, file)]);
	}

	entries.sort(([a], [b]) => a.localeCompare(b));
	const styleByKey = new Map();

	for (const [index, style] of styles.entries()) {
		if (!style || !Array.isArray(style.keys) || typeof style.href !== 'string') {
			throw new TypeError('Invalid importer style');
		}

		for (const name of style.keys) {
			if (!keys.has(name) || styleByKey.has(name)) {
				throw new TypeError(`Unknown or duplicate styled importer: ${name}`);
			}

			styleByKey.set(name, index);
		}
	}

	const loaders = styles
		.map(({ href }, index) =>
			styleRuntime
				? `const loadStyle${index} = () => __eightshiftLoadStylesheet(new URL(${JSON.stringify(href)}, import.meta.url).href);`
				: `let stylePromise${index};
const loadStyle${index} = () => stylePromise${index} ??= new Promise((resolve, reject) => {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = new URL(${JSON.stringify(href)}, import.meta.url).href;
	link.onload = resolve;
	link.onerror = () => {
		link.remove();
		stylePromise${index} = undefined;
		reject(new Error('Failed to load stylesheet: ' + link.href));
	};
	document.head.appendChild(link);
});`,
		)
		.join('\n');
	const importers = entries.map(([name, path]) => {
		const importer = `() => import(${JSON.stringify(path)})`;
		const style = styleByKey.get(name);

		return `${JSON.stringify(name)}: ${style === undefined ? importer : `() => loadStyle${style}().then(${importer})`}`;
	});

	return `${styleRuntime && styles.length ? `import { loadStylesheet as __eightshiftLoadStylesheet } from ${JSON.stringify(styleRuntime)};\n` : ''}${loaders}\nconst bunFrontendImporters = {${importers.join(',')}};`;
}

async function transformEagerContexts(source, path, root, output, omitContexts) {
	const calls = [];
	const identifiers = new Set();
	const messages = new Linter().verify(
		source,
		[
			{
				languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
				linterOptions: { noInlineConfig: true },
				plugins: {
					capture: {
						rules: {
							contexts: {
								create: () => ({
									Identifier: (node) => identifiers.add(node.name),
									CallExpression: (node) => {
										const context = node.arguments[0];

										if (
											node.callee.type === 'Identifier' &&
											node.callee.name === 'dynamicImport' &&
											!node.optional &&
											node.arguments.length === 1 &&
											context?.type === 'CallExpression' &&
											context.callee.type === 'MemberExpression' &&
											!context.callee.computed &&
											context.callee.object.name === 'require' &&
											context.callee.property.name === 'context'
										) {
											calls.push({ node, context });
										}
									},
								}),
							},
						},
					},
				},
				rules: { 'capture/contexts': 'error' },
			},
		],
		{ filename: 'module.js' },
	);
	const fatal = messages.find((message) => message.fatal);

	if (fatal) {
		throw new Error(`Cannot parse ${path}: ${fatal.message}`);
	}

	const definitions = [];
	const replacements = [];

	for (const { node, context } of calls) {
		const [directory, recursive, pattern, mode] = context.arguments;

		if (
			context.optional ||
			context.arguments.length < 3 ||
			context.arguments.length > 4 ||
			directory?.type !== 'Literal' ||
			typeof directory.value !== 'string' ||
			recursive?.type !== 'Literal' ||
			recursive.value !== true ||
			!pattern?.regex ||
			(mode && (mode.type !== 'Literal' || mode.value !== 'sync'))
		) {
			throw new Error(`Unsupported eager require.context in ${path}`);
		}

		const definition = { directory: resolve(dirname(path), directory.value), pattern: new RegExp(pattern.regex.pattern, pattern.regex.flags) };
		let replacement = 'void 0';

		if (!omitContexts?.({ ...definition, path })) {
			let index = definitions.length;
			let name = `eagerContext${index}`;

			while (identifiers.has(name)) {
				name = `eagerContext${++index}`;
			}

			identifiers.add(name);
			definitions.push({ ...definition, name });
			replacement = `${name}.keys().forEach(${name})`;
		}

		replacements.push({ start: node.start, end: node.end, replacement });
	}

	for (const { start, end, replacement } of replacements.sort((a, b) => b.start - a.start)) {
		source = source.slice(0, start) + replacement + source.slice(end);
	}

	if (definitions.length) {
		await generateDiscovery({ root, output, definitions });
		source = `import { ${definitions.map(({ name }) => name).join(', ')} } from ${JSON.stringify(output)};\n${source}`;
	}

	return source;
}

/**
 * Transform only explicitly selected entry paths. Each entry specifies
 * { path, module, imports, importStatement, replacements, prefix, remove }.
 * Replacements are [literal, replacement] pairs and must occur exactly once.
 * `remove` is an optional array of RegExps. Remaining eager dynamicImport
 * contexts are generated; `omitContexts` selects separately handled styles.
 * Other webpack discovery is rejected. `prefix` can contain the importer map.
 */
export function themeDiscoveryPlugin({ root, entries }) {
	if (!root || !Array.isArray(entries)) {
		throw new TypeError('Expected root and entries');
	}

	const byPath = new Map();

	for (const entry of entries) {
		if (!entry.path || !entry.module || !Array.isArray(entry.imports) || typeof entry.importStatement !== 'string' || !Array.isArray(entry.replacements) || (entry.remove && !Array.isArray(entry.remove))) {
			throw new TypeError('Invalid discovery entry');
		}

		const path = resolve(root, entry.path);

		if (byPath.has(path)) {
			throw new TypeError(`Duplicate discovery entry: ${path}`);
		}

		byPath.set(path, entry);
	}

	const replaceOnce = (source, original, replacement) => {
		if (typeof original !== 'string' || !original || typeof replacement !== 'string' || source.split(original).length !== 2) {
			throw new Error(`Source changed; cannot replace: ${original}`);
		}

		return source.replace(original, () => replacement);
	};

	return {
		name: 'theme-discovery',
		setup(builder) {
			builder.onLoad({ filter: /\.[cm]?jsx?$/ }, async ({ path }) => {
				const entry = byPath.get(path);

				if (!entry) {
					return;
				}

				let source = await readFile(path, 'utf8');

				source = replaceOnce(source, entry.importStatement, `import { ${entry.imports.join(', ')} } from ${JSON.stringify(resolve(root, entry.module))};\n${entry.prefix || ''}`);

				for (const [original, replacement] of entry.replacements) {
					source = replaceOnce(source, original, replacement);
				}

				for (const pattern of entry.remove || []) {
					if (!(pattern instanceof RegExp)) {
						throw new TypeError('Removal patterns must be RegExp');
					}

					source = source.replace(pattern, '');
				}

				source = await transformEagerContexts(source, path, root, resolve(dirname(resolve(root, entry.module)), `${basename(path)}.contexts.mjs`), entry.omitContexts);

				if (source.includes('require.context') || source.includes('dynamicImport(')) {
					throw new Error(`Unsupported discovery remains in ${path}`);
				}

				return { contents: source, loader: 'jsx', resolveDir: dirname(path) };
			});
		},
	};
}
