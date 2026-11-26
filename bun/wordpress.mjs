import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { Linter } from 'eslint';
import { allowPureJsxGrouping } from './plugin-capabilities.mjs';

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

// WordPress 7.0 unwraps these entry points to their default export.
const defaultWordPressGlobals = new Set(['api-fetch', 'dom-ready', 'server-side-render']);

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

	// Stylesheets are assets, but JavaScript subpaths must not duplicate core singletons.
	const resource = name.split(/[?#]/, 1)[0];

	if (resource.includes('/') && /\.css$/i.test(resource)) {
		return;
	}

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
		return null;
	}

	const name = request.slice('@wordpress/'.length);
	let script;

	try {
		script = await readFile(resolve(root, 'wp-includes/js/dist', `${name}.js`), 'utf8');
	} catch (error) {
		if (error.code === 'ENOENT') {
			return null;
		}

		throw error;
	}

	const matches = [...script.matchAll(/__export\(index_exports, \{([\s\S]*?)\n\s*\}\);/g)];

	if (!matches.length && !/\bindex_exports\b/.test(script)) {
		// Core's generated PEG parser uses a single CommonJS factory, not an ESM export table.
		const commonJs = script.match(/var (require_[\w$]+) = __commonJS\(\{\s*"[^"\n]+"\(exports, module\) \{[\s\S]*?\bmodule\.exports\s*=\s*\{([^{}]*)\};\s*\}\s*\}\);\s*return \1\(\);\s*\}\)\(\);/);

		if (commonJs && [...script.matchAll(/\bmodule\s*(?:\.\s*exports|\[)/g)].length === 1 && !/\bexports\s*(?:\.|\[)/.test(script.replace(/\bmodule\.exports\b/g, ''))) {
			const names = commonJs[2]
				.trim()
				.replace(/,$/, '')
				.split(',')
				.map((entry) => entry.trim().match(/^([A-Za-z_$][\w$]*):\s*[A-Za-z_$][\w$]*$/)?.[1]);

			if (names.length && names.every((name) => name && name !== '__proto__') && new Set(names).size === names.length) {
				return { names, defaultGlobal: false };
			}
		}

		// Only these core entry points are known to have no public exports. Unknown
		// bundle formats must fail rather than silently erase their exported API.
		if (['base-styles', 'format-library', 'list-reusable-blocks'].includes(name) && !/return\s+(?:__toCommonJS\(|require_[\w$]+\(\);\s*\}\)\(\);)/.test(script)) {
			return { names: [], defaultGlobal: false };
		}

		throw new Error(`Cannot identify WordPress core exports for ${request}`);
	}

	if (matches.length !== 1 || !script.includes('return __toCommonJS(index_exports);')) {
		throw new Error(`Cannot identify WordPress core exports for ${request}`);
	}

	if (!matches[0][1].trim()) {
		return { names: [], defaultGlobal: false };
	}

	const names = matches[0][1]
		.trim()
		.split(/,\s*\n/)
		.map((entry) => entry.trim().match(/^([A-Za-z_$][\w$]*):\s*\(\)\s*=>\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/)?.[1]);

	if (!names.length || names.some((name) => !name) || new Set(names).size !== names.length) {
		throw new Error(`Cannot parse WordPress core exports for ${request}`);
	}

	const property = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
	const defaultGlobal = new RegExp(`\\bwp\\.${property}\\s*=\\s*wp\\.${property}\\.default\\s*;`).test(script);

	return { names, defaultGlobal };
}

async function importerExports(importer, request) {
	if (!isAbsolute(importer)) {
		throw new Error('Package-free discovery requires a readable source importer');
	}

	const source = await readFile(importer, 'utf8');
	const names = new Set();
	let found = false;
	const linter = new Linter();
	const messages = linter.verify(source, [
		{
			languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
			plugins: {
				discovery: {
					rules: {
						imports: {
							create() {
								return {
									ImportDeclaration(node) {
										if (node.source.value !== request) {
											return;
										}

										found = true;

										for (const specifier of node.specifiers) {
											if (specifier.type !== 'ImportSpecifier' || specifier.imported.name === 'default' || specifier.imported.value === 'default') {
												throw new Error(`Unsafe default or namespace import for ${request}; provide wpRoot or install the package`);
											}

											names.add(specifier.imported.name ?? specifier.imported.value);
										}
									},
									ExportNamedDeclaration(node) {
										if (node.source?.value !== request) {
											return;
										}

										found = true;

										for (const specifier of node.specifiers) {
											const name = specifier.local.name ?? specifier.local.value;

											if (name === 'default') {
												throw new Error(`Unsafe default re-export for ${request}; provide wpRoot or install the package`);
											}

											names.add(name);
										}
									},
									ExportAllDeclaration(node) {
										if (node.source.value === request) {
											throw new Error(`Unsafe wildcard re-export for ${request}; provide wpRoot or install the package`);
										}
									},
									ImportExpression(node) {
										if (node.source.value === request) {
											throw new Error(`Unsafe dynamic import for ${request}; provide wpRoot or install the package`);
										}
									},
									CallExpression(node) {
										if (node.callee.name === 'require' && node.arguments[0]?.value === request) {
											throw new Error(`Unsafe require for ${request}; provide wpRoot or install the package`);
										}
									},
								};
							},
						},
					},
				},
			},
			rules: { 'discovery/imports': 'error' },
		},
	]);

	if (messages.some((message) => message.fatal) || !found || [...names].some((name) => !/^[A-Za-z_$][\w$]*$/.test(name))) {
		throw new Error(`Cannot safely parse imports for ${request}; provide wpRoot or install the package`);
	}

	if (!names.size) {
		throw new Error(`Cannot infer exports for side-effect-only import ${request}; provide wpRoot or install the package`);
	}

	return [...names];
}

/** Create a fresh adapter for each Bun build. Paths must be absolute. */
export function wordpressPlugin({ projectRoot = process.cwd(), wpRoot } = {}) {
	if (!isAbsolute(projectRoot) || (wpRoot !== undefined && !isAbsolute(wpRoot))) {
		throw new Error('projectRoot and wpRoot must be absolute paths');
	}

	const projectRequire = createRequire(resolve(projectRoot, 'package.json'));
	const dependencies = new Set();
	const sideEffectDependencies = new Set();
	const modules = new Map();
	const handles = new Map();

	return {
		dependencies,
		getEmittedDependencies(metafile) {
			try {
				const data = typeof metafile === 'string' ? JSON.parse(metafile) : metafile;
				const outputs = Object.values(data?.outputs ?? {});

				if (!outputs.length) {
					return [...dependencies].sort();
				}

				// Empty adapters may be erased, but WordPress must still run their scripts.
				const emitted = new Set(sideEffectDependencies);

				for (const output of outputs) {
					if (!output?.inputs || typeof output.inputs !== 'object') {
						return [...dependencies].sort();
					}

					for (const [input, info] of Object.entries(output.inputs)) {
						if (!input.startsWith('wordpress-global:')) {
							continue;
						}

						if (typeof info?.bytesInOutput !== 'number') {
							return [...dependencies].sort();
						}

						if (!info.bytesInOutput) {
							continue;
						}

						const key = input.slice('wordpress-global:'.length);

						if (!handles.has(key)) {
							return [...dependencies].sort();
						}

						emitted.add(handles.get(key));
					}
				}

				return [...emitted].sort();
			} catch {
				return [...dependencies].sort();
			}
		},
		plugin: allowPureJsxGrouping({
			name: 'wordpress-globals',
			setup(build) {
				build.onResolve({ filter: /^(?:moment|jquery|lodash|lodash-es|@babel\/runtime\/regenerator|react|react-dom)(?:$|\/)|^@wordpress\/|react-refresh\/runtime/ }, async (args) => {
					const request = args.path;
					const external = externalFor(request);

					if (!external) {
						return;
					}

					const [global, handle, kind] = external;
					const require = isAbsolute(args.importer) ? createRequire(args.importer) : projectRequire;
					let entry;

					if (kind !== 'commonjs' && kind !== 'wordpress') {
						const importer = isAbsolute(args.importer) ? args.importer : resolve(projectRoot, '__wordpress_plugin__.mjs');

						entry = kind === 'react' ? require.resolve(request) : Bun.resolveSync(request, dirname(importer));
					}

					const key = JSON.stringify([request, entry || (kind === 'wordpress' ? args.importer : '')]);

					if (!modules.has(key)) {
						let names = [];
						let defaultGlobal = false;

						try {
							if (kind === 'wordpress') {
								const core = await coreExports(wpRoot, request);

								if (core) {
									({ names, defaultGlobal } = core);
								} else {
									const importer = isAbsolute(args.importer) ? args.importer : resolve(projectRoot, '__wordpress_plugin__.mjs');
									let packageEntry;

									try {
										packageEntry = Bun.resolveSync(request, dirname(importer));
									} catch (error) {
										if (!['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(error.code)) {
											throw error;
										}

										names = await importerExports(args.importer, request);
									}

									if (packageEntry) {
										const script = `const r = await Bun.build({ entrypoints: [process.argv[1]], target: 'browser', format: 'esm', write: false }); if (!r.success || r.outputs.length !== 1) { console.error(r.logs.join('\\n')); process.exit(1); } console.log(JSON.stringify(new Bun.Transpiler().scan(await r.outputs[0].text()).exports));`;
										const result = await execFileAsync(process.execPath, ['-e', script, packageEntry], { cwd: projectRoot, maxBuffer: 1024 * 1024 });
										names = JSON.parse(result.stdout);

										if (!Array.isArray(names) || !names.length || names.some((name) => typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) || new Set(names).size !== names.length) {
											throw new Error('Installed package exports cannot establish the core global mapping; provide wpRoot');
										}

										if (names.includes('default')) {
											if (!defaultWordPressGlobals.has(request.slice('@wordpress/'.length))) {
												throw new Error('Installed package default export has an unknown core global mapping; provide wpRoot');
											}

											defaultGlobal = true;
										}
									}
								}
							} else if (kind !== 'react' && kind !== 'commonjs') {
								const script = `const r = await Bun.build({ entrypoints: [process.argv[1]], target: 'browser', format: 'esm', write: false }); if (!r.success || r.outputs.length !== 1) { console.error(r.logs.join('\\n')); process.exit(1); } console.log(JSON.stringify(new Bun.Transpiler().scan(await r.outputs[0].text()).exports));`;
								const result = await execFileAsync(process.execPath, ['-e', script, entry], { cwd: projectRoot, maxBuffer: 1024 * 1024 });

								names = JSON.parse(result.stdout);
							}
						} catch (error) {
							throw new Error(`Cannot determine exports for ${request}: ${error.message}`);
						}

						if (kind === 'wordpress' && !names.length) {
							sideEffectDependencies.add(handle);
							modules.set(key, 'export {};');
							dependencies.add(handle);
							handles.set(key, handle);

							return { path: key, namespace: 'wordpress-global' };
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
									lines.push(kind === 'esm' || defaultGlobal ? 'export default value;' : 'export default value.default;');
								} else {
									lines.push(`const export${index} = value[${JSON.stringify(name)}];`, `export { export${index} as ${name} };`);
								}
							}
						}

						modules.set(key, lines.join('\n'));
					}

					dependencies.add(handle);
					handles.set(key, handle);

					return { path: key, namespace: 'wordpress-global' };
				});
				build.onLoad({ filter: /.*/, namespace: 'wordpress-global' }, (args) => ({ contents: modules.get(args.path), loader: 'js' }));
			},
		}),
	};
}
