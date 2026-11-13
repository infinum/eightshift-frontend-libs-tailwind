import { createHash, randomUUID } from 'node:crypto';
import { link, readFile, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { transform } from 'lightningcss';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { processCss } from './css.mjs';
import { allowPureJsxGrouping } from './plugin-capabilities.mjs';

export const browserCssRuntime = 'eightshift:browser-css-runtime';

/** Find stylesheet inputs that the conventional compiler emits unconditionally. */
export async function collectConventionalCss({ root, files }) {
	const included = new Set();
	const pending = await Promise.all(files.map((entry) => realpath(resolve(root, typeof entry === 'string' ? entry : entry.file))));

	while (pending.length) {
		const path = pending.pop();

		if (included.has(path)) {
			continue;
		}

		included.add(path);
		const tree = postcss.parse(await readFile(path, 'utf8'), { from: path });

		for (const rule of tree.nodes) {
			if (rule.type !== 'atrule' || rule.name.toLowerCase() !== 'import') {
				continue;
			}

			const nodes = valueParser(rule.params).nodes.filter((node) => node.type !== 'space' && node.type !== 'comment');

			if (nodes.length !== 1) {
				continue;
			}

			const node = nodes[0];
			const url =
				node.type === 'string'
					? node.value
					: node.type === 'function' && node.value.toLowerCase() === 'url'
						? valueParser
								.stringify(node.nodes)
								.trim()
								.replace(/^(['"])(.*)\1$/, '$2')
						: '';

			if (!url || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) {
				continue;
			}

			const pathname = url.split(/[?#]/, 1)[0];

			try {
				const target = await realpath(Bun.resolveSync(pathname === 'tailwindcss' ? 'tailwindcss/index.css' : pathname, dirname(path)));

				if (/\.css$/i.test(target) && !included.has(target)) {
					pending.push(target);
				}
			} catch {
				// The Tailwind compiler may resolve package-specific imports differently.
			}
		}
	}

	return included;
}

const runtimeSource = `
const registryKey = Symbol.for('eightshift.browser-css.v1');
const styles = globalThis[registryKey] ??= new Map();
export function loadStylesheet(href) {
	const url = new URL(href, globalThis.location.href).href;
	if (styles.has(url)) return styles.get(url);
	const pending = new Promise((resolve, reject) => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = url;
		link.onload = () => resolve();
		link.onerror = () => {
			link.remove();
			reject(new Error('Failed to load stylesheet: ' + url));
		};
		document.head.appendChild(link);
	}).catch((error) => {
		if (styles.get(url) === pending) styles.delete(url);
		throw error;
	});
	styles.set(url, pending);
	return pending;
}
`;

/** Compile JS-imported CSS and attach it to the module that imports it. */
export function browserCssPlugin({ root, outdir, conventionalCss, extraCssByFile, responsiveFiles, retainedStyles }) {
	const compiled = new Map();
	const compositions = new Map();
	const cssImports = new Map();

	return allowPureJsxGrouping({
		name: 'eightshift-browser-css',
		setup(builder) {
			const directory = resolve(builder.config.outdir ?? '');
			const surface = ['frontend', 'admin'].find((name) => directory === resolve(outdir, name));

			if (!surface) {
				return;
			}

			const compileFile = (path) => {
				const cacheKey = `${surface}\0${path}`;
				let pending = compiled.get(cacheKey);

				if (!pending) {
					pending = compileStylesheet({ root, outdir, path, isModule: /\.module\.css$/i.test(path), responsiveFile: responsiveFiles[surface], retainedStyles, compileFile, conventionalCss: conventionalCss.get(surface), cssImports });
					compiled.set(cacheKey, pending);
				}

				return pending;
			};

			builder.onResolve({ filter: /^eightshift:browser-css-runtime$/ }, () => ({ path: browserCssRuntime, namespace: 'eightshift-browser-css-runtime' }));
			builder.onLoad({ filter: /.*/, namespace: 'eightshift-browser-css-runtime' }, () => ({ contents: runtimeSource, loader: 'js' }));
			builder.onResolve({ filter: /\.css(?:[?#].*)?$/ }, async (args) => {
				if (!['import-statement', 'dynamic-import', 'require-call'].includes(args.kind) || !['file', 'eightshift-browser-css'].includes(args.namespace)) {
					return;
				}

				let file;

				try {
					file = await realpath(Bun.resolveSync(args.path, args.resolveDir));
				} catch (error) {
					if (error.code === 'ENOENT' || error.code === 'MODULE_NOT_FOUND') {
						return;
					}

					throw error;
				}

				if (args.kind === 'require-call') {
					throw new Error(`CSS imported through require() cannot be loaded before execution: ${args.path}`);
				}

				return { path: file, namespace: 'eightshift-browser-css' };
			});
			builder.onLoad({ filter: /.*/, namespace: 'eightshift-browser-css' }, async ({ path }) => {
				const isModule = /\.module\.css$/i.test(path);

				if (!isModule && conventionalCss.get(surface)?.has(path)) {
					return { contents: 'export default {};', loader: 'js' };
				}

				const groups = surface === 'frontend' && !isModule ? extraCssByFile.get(path) : undefined;

				if (groups?.length === 1 && groups[0].files.length === 1) {
					const href = groups[0].href;

					return { contents: `import { loadStylesheet } from ${JSON.stringify(browserCssRuntime)};\nawait loadStylesheet(new URL(${JSON.stringify(href)}, import.meta.url).href);\nexport default {};`, loader: 'js', resolveDir: dirname(path) };
				}

				const result = await compileFile(path);
				const imports = [];
				const dependencies = new Map();
				const mappings = result.exports ?? {};
				const targets = new Set();

				for (const item of Object.values(mappings)) {
					for (const reference of item.composes) {
						if (reference.type === 'dependency') {
							targets.add(await realpath(Bun.resolveSync(reference.specifier, dirname(path))));
						}
					}
				}

				compositions.set(path, targets);
				const pendingTargets = [...targets];
				const visited = new Set();

				while (pendingTargets.length) {
					const target = pendingTargets.pop();

					if (target === path) {
						throw new Error(`Circular CSS module composition in ${path}`);
					}

					if (visited.has(target)) {
						continue;
					}

					visited.add(target);
					pendingTargets.push(...(compositions.get(target) ?? []));
				}

				const byName = new Map(Object.entries(mappings).map(([key, value]) => [value.name, key]));
				const values = new Map();
				const expression = (key, visiting = new Set()) => {
					if (values.has(key)) {
						return values.get(key);
					}

					if (visiting.has(key)) {
						throw new Error(`Circular CSS module composition in ${path}: ${key}`);
					}

					const item = mappings[key];

					if (!item) {
						throw new Error(`Unknown CSS module composition in ${path}: ${key}`);
					}

					visiting.add(key);
					const parts = [JSON.stringify(item.name)];

					for (const reference of item.composes) {
						if (reference.type === 'dependency') {
							const key = `${reference.specifier}\0${reference.name}`;
							let variable = dependencies.get(key);

							if (!variable) {
								variable = `dependency${dependencies.size}`;
								dependencies.set(key, variable);
								imports.push(`import { ${JSON.stringify(reference.name)} as ${variable} } from ${JSON.stringify(reference.specifier)};`);
							}

							parts.push(variable);
						} else if (reference.type === 'local' && byName.has(reference.name)) {
							parts.push(expression(byName.get(reference.name), visiting));
						} else {
							parts.push(JSON.stringify(reference.name));
						}
					}

					visiting.delete(key);
					const value = parts.join(' + " " + ');
					values.set(key, value);

					return value;
				};

				const names = Object.keys(mappings);
				const declarations = names.map((name, index) => `const value${index} = ${expression(name)};`);
				const namedExports = names.flatMap((name, index) => (name === 'default' ? [] : [`export { value${index} as ${JSON.stringify(name)} };`]));
				const mapping = names.map((name, index) => `[${JSON.stringify(name)}]: value${index}`).join(',');
				const css = result.name ? `import { loadStylesheet } from ${JSON.stringify(browserCssRuntime)};\nawait loadStylesheet(new URL(${JSON.stringify(`../css/${result.name}`)}, import.meta.url).href);` : '';

				return { contents: [...imports, css, ...declarations, ...namedExports, `export default {${mapping}};`].join('\n'), loader: 'js', resolveDir: dirname(path) };
			});
		},
	});
}

async function prepareScopedImports({ path, compileFile, conventionalCss, cssImports }) {
	const tree = postcss.parse(await readFile(path, 'utf8'), { from: path });
	const rules = [];
	tree.walkAtRules('import', (rule) => {
		if (rule.parent !== tree) {
			throw new Error(`Nested CSS imports are not supported when preserving CSS module scope: ${path}`);
		}

		rules.push(rule);
	});
	const lastImport = rules.length ? tree.index(rules.at(-1)) : -1;
	const ordered = tree.nodes.filter((node, index) => rules.includes(node) || (index < lastImport && node.type === 'atrule' && node.name.toLowerCase() === 'layer' && !node.nodes));
	const imports = [];
	const targets = new Set();

	for (const rule of ordered) {
		if (rule.name.toLowerCase() === 'layer') {
			imports.push({ layer: rule.toString() });
			rule.remove();
			continue;
		}

		const parsed = valueParser(rule.params);
		const node = parsed.nodes.find((item) => item.type !== 'space' && item.type !== 'comment');
		const url =
			node?.type === 'string'
				? node.value
				: node?.type === 'function' && node.value.toLowerCase() === 'url'
					? valueParser
							.stringify(node.nodes)
							.trim()
							.replace(/^(['"])(.*)\1$/, '$2')
					: undefined;

		if (!url) {
			throw new Error(`Cannot resolve CSS import in ${path}: ${rule.params}`);
		}

		if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) {
			imports.push({ params: rule.params });
			rule.remove();
			continue;
		}

		const suffixIndex = url.search(/[?#]/);
		const pathname = suffixIndex < 0 ? url : url.slice(0, suffixIndex);
		const suffix = suffixIndex < 0 ? '' : url.slice(suffixIndex);

		if (parsed.nodes.some((item) => item.type === 'function' && ['source', 'prefix', 'theme'].includes(item.value.toLowerCase()))) {
			throw new Error(`Import the configured Tailwind entry separately and use @reference when a stylesheet imports CSS modules: ${path}`);
		}

		const specifier = pathname === 'tailwindcss' ? 'tailwindcss/index.css' : pathname;
		const target = await realpath(Bun.resolveSync(specifier, dirname(path)));

		if (!target.endsWith('.css')) {
			throw new Error(`CSS import must resolve to a stylesheet: ${url}`);
		}

		const skip = !/\.module\.css$/i.test(target) && conventionalCss?.has(target);

		if (!skip) {
			targets.add(target);
		}

		imports.push({ parsed, node, target, suffix, skip });
		rule.replaceWith(postcss.atRule({ name: 'reference', params: JSON.stringify(pathname) }));
	}

	cssImports.set(path, targets);
	const pending = [...targets];
	const visited = new Set();

	while (pending.length) {
		const target = pending.pop();

		if (target === path) {
			throw new Error(`Circular CSS import in ${path}`);
		}

		if (visited.has(target)) {
			continue;
		}

		visited.add(target);
		pending.push(...(cssImports.get(target) ?? []));
	}

	const statements = [];

	for (const item of imports) {
		if (item.layer) {
			statements.push(`${item.layer};`);
			continue;
		}

		if (item.params) {
			statements.push(`@import ${item.params};`);
			continue;
		}

		if (item.skip) {
			continue;
		}

		const result = await compileFile(item.target);

		if (!result.name) {
			continue;
		}

		const href = `./${result.name}${item.suffix}`;

		if (item.node.type === 'string') {
			item.node.value = href;
		} else {
			item.node.nodes = [{ type: 'string', quote: '"', value: href }];
		}

		statements.push(`@import ${item.parsed.toString()};`);
	}

	return { content: tree.toString(), imports: statements.length ? `${statements.join('\n')}\n` : '' };
}

async function compileStylesheet({ root, outdir, path, isModule, responsiveFile, retainedStyles, compileFile, conventionalCss, cssImports }) {
	const temporary = resolve(outdir, 'css', `.browser-${randomUUID()}.css`);

	try {
		let content;
		let imported = '';

		if (isModule) {
			const prepared = await prepareScopedImports({ path, compileFile, conventionalCss, cssImports });
			content = prepared.content;
			imported = prepared.imports;
		}

		const compile = (source) =>
			processCss({
				projectDir: root,
				outputFile: temporary,
				files: [
					{
						file: path,
						...(source === undefined ? {} : { content: source }),
						scan: 'auto',
						...(responsiveFile ? { scanFiles: [responsiveFile] } : {}),
						sources: [
							{ pattern: '.bun-pilot/**', negated: true },
							{ pattern: 'public/**', negated: true },
							{ pattern: 'es-tw-*-classes.txt', negated: true },
						],
					},
				],
				production: true,
			});
		const result = await compile(content);

		if (!isModule && result.dependencies.some((file) => /\.module\.css$/i.test(file))) {
			const prepared = await prepareScopedImports({ path, compileFile, conventionalCss, cssImports });
			imported = prepared.imports;
			await compile(prepared.content);
		}

		let bytes = await readFile(temporary);
		let exports;

		if (isModule) {
			let identity = relative(root, path).replaceAll('\\', '/');

			if (identity.startsWith('../') || isAbsolute(identity)) {
				const modules = identity.indexOf('/node_modules/');

				if (modules !== -1) {
					identity = identity.slice(modules + '/node_modules/'.length);
				}
			}

			const name = createHash('sha256').update(identity).update('\0').update(bytes).digest('hex').slice(0, 20);
			const result = transform({ filename: `${name}-${basename(path)}`, code: bytes, minify: true, cssModules: true });
			bytes = result.code;
			exports = result.exports;
		}

		if (imported) {
			bytes = Buffer.concat([Buffer.from(imported), bytes]);
		}

		if (!bytes.toString().trim()) {
			return { exports };
		}

		const hash = createHash('sha256').update(bytes).digest('hex');
		const name = `browser-${hash}.css`;
		const destination = resolve(outdir, 'css', name);
		await writeFileIfMissing(destination, bytes);
		retainedStyles.add(name);

		return { name, exports };
	} finally {
		try {
			await unlink(temporary);
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}
}

async function writeFileIfMissing(path, bytes) {
	const temporary = `${path}.${randomUUID()}`;

	try {
		await Bun.write(temporary, bytes);

		try {
			await link(temporary, path);
		} catch (error) {
			if (error.code !== 'EEXIST' || !(await readFile(path)).equals(bytes)) {
				throw error;
			}
		}
	} finally {
		try {
			await unlink(temporary);
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}
}
