import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
export async function generateThemeImporters({ root, glob, key, styles = [] }) {
	if (!root || typeof glob !== 'string' || typeof key !== 'function' || !Array.isArray(styles)) {
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
		.map(
			({ href }, index) =>
				`let stylePromise${index};
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

	return `${loaders}\nconst bunFrontendImporters = {${importers.join(',')}};`;
}

/**
 * Transform only explicitly selected entry paths. Each entry specifies
 * { path, module, imports, importStatement, replacements, prefix, remove }.
 * Replacements are [literal, replacement] pairs and must occur exactly once.
 * `remove` is an optional array of RegExps; remaining webpack discovery is
 * rejected. `prefix` can contain the generated importer map.
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

				if (source.includes('require.context') || source.includes('dynamicImport(')) {
					throw new Error(`Unsupported discovery remains in ${path}`);
				}

				return { contents: source, loader: 'jsx', resolveDir: dirname(path) };
			});
		},
	};
}
