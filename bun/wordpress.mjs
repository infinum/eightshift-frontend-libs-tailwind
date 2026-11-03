import { createRequire } from 'node:module';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const externals = {
	moment: ['moment', 'moment', 'commonjs'],
	jquery: ['jQuery', 'jquery', 'commonjs'],
	lodash: ['lodash', 'lodash', 'commonjs'],
	'lodash-es': ['lodash', 'lodash', 'esm'],
	'@babel/runtime/regenerator': ['regeneratorRuntime', 'regenerator-runtime', 'commonjs'],
	react: ['React', 'react', 'react'],
	'react-dom': ['ReactDOM', 'react-dom', 'react'],
	'react-dom/client': ['ReactDOM', 'react-dom', 'react'],
	'react/jsx-runtime': ['ReactJSXRuntime', 'react-jsx-runtime', 'react'],
	'react/jsx-dev-runtime': ['ReactJSXRuntime', 'react-jsx-runtime', 'react'],
};

const bundledWordPressPackages = new Set(['admin-ui', 'dataviews', 'dataviews/wp', 'fields', 'global-styles-engine', 'global-styles-ui', 'grid', 'icons', 'interface', 'kebab-case', 'react-inert-value', 'style-runtime', 'sync', 'ui', 'undo-manager', 'views']);

function externalFor(request) {
	if (Object.hasOwn(externals, request)) {
		return externals[request];
	}

	if (/^(?:react|react-dom)\//.test(request) || request.includes('react-refresh/runtime')) {
		throw new Error(`Unsupported React external: ${request}`);
	}

	if (!request.startsWith('@wordpress/')) {
		return;
	}

	const name = request.slice('@wordpress/'.length);

	if (bundledWordPressPackages.has(name)) {
		return;
	}

	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
		throw new Error(`Unsupported WordPress external: ${request}`);
	}

	return [['wp', name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())], `wp-${name}`, 'wordpress'];
}

async function coreExports(root, request) {
	if (!root) {
		throw new Error(`WordPress root is required to discover exports for ${request}`);
	}

	const name = request.slice('@wordpress/'.length);
	const script = await readFile(resolve(root, 'wp-includes/js/dist', `${name}.js`), 'utf8');
	const matches = [...script.matchAll(/__export\(index_exports, \{([\s\S]*?)\n\s*\}\);/g)];

	if (matches.length !== 1 || !script.includes('return __toCommonJS(index_exports);')) {
		throw new Error(`Cannot identify WordPress core exports for ${request}`);
	}

	const names = matches[0][1]
		.trim()
		.split(/,\s*\n/)
		.map((entry) => entry.trim().match(/^([A-Za-z_$][\w$]*):\s*\(\)\s*=>\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/)?.[1]);

	if (!names.length || names.some((name) => !name) || new Set(names).size !== names.length) {
		throw new Error(`Cannot parse WordPress core exports for ${request}`);
	}

	return names;
}

/** Create a fresh adapter for each Bun build. Paths must be absolute. */
export function wordpressPlugin({ projectRoot = process.cwd(), wpRoot } = {}) {
	if (!isAbsolute(projectRoot) || (wpRoot !== undefined && !isAbsolute(wpRoot))) {
		throw new Error('projectRoot and wpRoot must be absolute paths');
	}

	const projectRequire = createRequire(resolve(projectRoot, 'package.json'));
	const dependencies = new Set();
	const modules = new Map();

	return {
		dependencies,
		plugin: {
			name: 'wordpress-globals',
			setup(build) {
				build.onResolve({ filter: /.*/ }, async (args) => {
					const request = args.path;
					const external = externalFor(request);

					if (!external) {
						return;
					}

					const [global, handle, kind] = external;
					const require = isAbsolute(args.importer) ? createRequire(args.importer) : projectRequire;
					let metadata;
					let entry;
					let fallback = false;

					if (kind === 'wordpress') {
						try {
							metadata = require(`${request}/package.json`);
						} catch (error) {
							if (error.code !== 'MODULE_NOT_FOUND' || !['@wordpress/plugins', '@wordpress/core-data'].includes(request)) {
								throw error;
							}

							fallback = true;
						}

						if (!fallback && metadata.wpScript !== true) {
							throw new Error(`Missing wpScript metadata: ${request}`);
						}
					}

					if (kind !== 'commonjs' && kind !== 'wordpress') {
						const importer = isAbsolute(args.importer) ? args.importer : resolve(projectRoot, '__wordpress_plugin__.mjs');

						entry = kind === 'react' ? require.resolve(request) : fileURLToPath(import.meta.resolve(request, pathToFileURL(importer).href));
					}

					const key = JSON.stringify([request, entry || '', fallback]);

					if (!modules.has(key)) {
						let names = [];

						try {
							if (kind === 'wordpress') {
								names = await coreExports(wpRoot, request);
							} else if (kind === 'react') {
								names = ['default', ...Object.keys(require(entry)).filter((name) => name !== 'default')];
							} else if (kind !== 'commonjs') {
								const script = `const r = await Bun.build({ entrypoints: [process.argv[1]], target: 'browser', format: 'esm', write: false }); if (!r.success || r.outputs.length !== 1) { console.error(r.logs.join('\\n')); process.exit(1); } console.log(JSON.stringify(new Bun.Transpiler().scan(await r.outputs[0].text()).exports));`;
								const result = await execFileAsync(process.execPath, ['-e', script, entry], { cwd: projectRoot, maxBuffer: 1024 * 1024 });

								names = JSON.parse(result.stdout);
							}
						} catch (error) {
							throw new Error(`Cannot determine exports for ${request}: ${error.message}`);
						}

						const path = Array.isArray(global) ? global : [global];
						const lines = [`const value = ${path.reduce((expression, part) => `${expression}?.[${JSON.stringify(part)}]`, 'globalThis')};`, `if (value == null) throw new Error(${JSON.stringify(`Missing WordPress global for ${request}`)});`];

						if (request === 'react/jsx-dev-runtime') {
							lines.push("if (typeof value.jsx !== 'function') throw new Error('Missing ReactJSXRuntime.jsx');", 'module.exports = { Fragment: value.Fragment, jsxDEV: (type, props, key) => value.jsx(type, props, key) };');
						} else if (kind === 'commonjs' || kind === 'react') {
							lines.push('module.exports = value;');
						} else {
							for (const [index, name] of names.entries()) {
								if (name === 'default') {
									lines.push(kind === 'esm' || metadata?.wpScriptDefaultExport === true ? 'export default value;' : 'export default value.default;');
								} else {
									lines.push(`const export${index} = value[${JSON.stringify(name)}];`, `export { export${index} as ${name} };`);
								}
							}
						}

						modules.set(key, lines.join('\n'));
					}

					dependencies.add(handle);

					return { path: key, namespace: 'wordpress-global' };
				});
				build.onLoad({ filter: /.*/, namespace: 'wordpress-global' }, (args) => ({ contents: modules.get(args.path), loader: 'js' }));
			},
		},
	};
}
