import { browserWatch, browserWatchCache } from './browser-watch-cache.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { defineBuild } from './index.mjs';
import { clearBuildDirectory } from './build.mjs';
import { generateThemeDiscovery, generateThemeImporters, themeDiscoveryPlugin } from './theme-discovery.mjs';
import { eightshiftCssEntries } from './eightshift-css.mjs';
import { preserveAssets } from './structured-publication.mjs';
import { packageFlatRelease, publishFlatRelease } from './flat-publication.mjs';
import { browserCssPlugin, browserCssRuntime, collectConventionalCss } from './browser-css.mjs';
import { editorWorkerPlugin } from './media.mjs';
import { allowPureJsxGrouping } from './plugin-capabilities.mjs';
import { processCss } from './css.mjs';
import { sourceSnapshot, quickCss, outputStamp, importSignature } from './watch-css.mjs';
import { classify, hotMarker, hotScript } from './hot-watch.mjs';
import { createTextAnalyzer, textPlugin } from './hot-text.mjs';
import { refreshMarker, refreshScript } from './auto-refresh.mjs';
import { buildWatchSsr } from './ssr-watch-cache.mjs';
import { prepareSharedFonts } from './shared-fonts.mjs';

/**
 * Define a conventional theme build. extraCss may be a hook or an array of
 * { files, output?, keys?, href? }; package files use the `package:` prefix.
 * Omitted output names use a content hash. Keys attach CSS to frontend importers.
 * Frontend/admin JS imports compile styles separately and load them before the
 * importing module; styles imported by lazy modules remain lazy.
 * Direct imports already in conventional CSS are not loaded twice.
 * SSR is built when conventional entries exist; ssr: false disables it.
 * optimizeImports controls Bun's package barrel optimization for browser builds.
 * UI Components is optimized by default; pass [] to disable the explicit default.
 * watch: false disables watching; an object overrides the safe watch defaults.
 * @param {object} [options]
 * @param {boolean} [options.removeUnreferencedStyles] Override entry CSS cleanup
 * for default publication; omitted enables it only with the default CSS compiler.
 */
export function defineThemeBuild(options = {}) {
	if (Object.hasOwn(options, 'publicationLayout')) {
		throw new TypeError('publicationLayout has been removed; theme builds use structured publication. Remove the option and migrate publication hooks to publicationRoot.');
	}

	const {
		root,
		wordpressVersion,
		publicPrefix: configuredPublicPrefix,
		buildSsr,
		createPlugins = () => [],
		frontendStyles = [],
		optimizeImports = ['@eightshift/ui-components'],
		sharedFonts = false,
		extraCss = async () => {},
		aliases = {},
		publication = async () => ({}),
		requireEditorWorker = false,
		media = {},
		watch = {},
		entries,
		editor,
		responsive = {},
		css,
		removeUnreferencedStyles = css === undefined,
		discovery,
		ssr,
		publish,
	} = options;

	if (options.scanExclusions !== undefined && (!Array.isArray(options.scanExclusions) || options.scanExclusions.some((pattern) => typeof pattern !== 'string' || !pattern.trim()))) {
		throw new TypeError('scanExclusions must be an array of non-empty glob strings');
	}

	if (typeof root !== 'string' || !root) {
		throw new TypeError('root must be a non-empty string');
	}

	if (wordpressVersion !== undefined && (typeof wordpressVersion !== 'string' || !/^\d+\.\d+(?:\.\d+)?$/.test(wordpressVersion) || Number(wordpressVersion.split('.')[0]) < 7)) {
		throw new TypeError('wordpressVersion must be a stable WordPress version 7.0 or newer');
	}

	if (typeof sharedFonts !== 'boolean' || (sharedFonts && publish !== undefined)) {
		throw new TypeError('sharedFonts must be a boolean and requires default theme publication');
	}

	if (typeof removeUnreferencedStyles !== 'boolean') {
		throw new TypeError('removeUnreferencedStyles must be a boolean');
	}

	if (Object.hasOwn(options, 'removeUnreferencedStyles') && publish !== undefined) {
		throw new TypeError('removeUnreferencedStyles requires default theme publication');
	}

	if (typeof createPlugins !== 'function') {
		throw new TypeError('createPlugins must be a function');
	}

	if (!Array.isArray(optimizeImports) || optimizeImports.some((name) => typeof name !== 'string' || !name.trim())) {
		throw new TypeError('optimizeImports must be an array of package names');
	}

	if (extraCss !== false && typeof extraCss !== 'function' && !Array.isArray(extraCss)) {
		throw new TypeError('extraCss must be false, a function, or an array');
	}

	if (watch !== false && (!watch || typeof watch !== 'object' || Array.isArray(watch))) {
		throw new TypeError('watch must be false or an object');
	}

	if (watch && watch.hotUpdates !== undefined && (typeof watch.hotUpdates !== 'boolean' || (watch.hotUpdates && (watch.autoRefresh || publish !== undefined)))) {
		throw new TypeError('watch.hotUpdates requires default publication and cannot be combined with autoRefresh');
	}

	if (watch && watch.autoRefresh !== undefined && (typeof watch.autoRefresh !== 'boolean' || (watch.autoRefresh && publish !== undefined))) {
		throw new TypeError('watch.autoRefresh must be a boolean and requires default publication when enabled');
	}

	for (const [name, value] of Object.entries({ css, discovery, ssr, publish })) {
		if (value !== undefined && value !== false && typeof value !== 'function') {
			throw new TypeError(`${name} must be false or a function`);
		}
	}

	if (buildSsr !== undefined && typeof buildSsr !== 'function') {
		throw new TypeError('buildSsr must be a function');
	}

	if (ssr !== undefined && buildSsr !== undefined) {
		throw new TypeError('Use either ssr or buildSsr, not both');
	}

	if (entries !== undefined && (!entries || typeof entries !== 'object' || Array.isArray(entries) || !Object.keys(entries).length)) {
		throw new TypeError('entries must contain named entrypoints');
	}

	if (editor !== undefined && editor !== false && (!editor || typeof editor !== 'object' || Array.isArray(editor))) {
		throw new TypeError('editor must be false or an object');
	}

	if (responsive !== false && (!responsive || typeof responsive !== 'object' || Array.isArray(responsive))) {
		throw new TypeError('responsive must be false or an object');
	}

	if (responsive === false && css === undefined) {
		throw new TypeError('Default CSS requires responsive generation; configure css or enable responsive');
	}

	if (publish === undefined && css === false) {
		throw new TypeError('Default publication requires CSS; configure publish or css');
	}

	if (publish === undefined && editor === false) {
		throw new TypeError('Default publication requires an editor; configure publish or editor');
	}

	if (publish === undefined && entries && (!entries.frontend || !entries.admin || !entries.editor || Object.keys(entries).length !== 3)) {
		throw new TypeError('Default publication requires frontend, admin, and editor entries');
	}

	if (publish === undefined && editor && editor.entry !== 'editor') {
		throw new TypeError('Default publication requires editor.entry to be editor');
	}

	if (!Array.isArray(frontendStyles)) {
		throw new TypeError('frontendStyles must be an array');
	}

	const cssDefinitions = Array.isArray(extraCss) ? extraCss : [];
	const cssNames = new Set();

	for (const item of cssDefinitions) {
		if (
			!item ||
			typeof item !== 'object' ||
			(item.output !== undefined && (typeof item.output !== 'string' || !/^[\w.-]+\.css$/.test(item.output) || item.output.startsWith('.'))) ||
			!Array.isArray(item.files) ||
			!item.files.length ||
			(item.keys !== undefined && (!Array.isArray(item.keys) || !item.keys.length || item.keys.some((key) => typeof key !== 'string' || !key))) ||
			(item.href !== undefined && (typeof item.href !== 'string' || !item.href))
		) {
			throw new TypeError('Invalid extraCss definition');
		}

		if (item.output && (cssNames.has(item.output) || ['applicationBlocksFrontend.css', 'applicationBlocksEditor.css', 'applicationAdmin.css'].includes(item.output))) {
			throw new TypeError(`Duplicate CSS output: ${item.output}`);
		}

		if (item.output) {
			cssNames.add(item.output);
		}
	}

	if (discovery !== undefined && (frontendStyles.length || cssDefinitions.some(({ keys }) => keys))) {
		throw new TypeError('frontend styles require default discovery');
	}

	if (!media || typeof media !== 'object' || Array.isArray(media) || Object.keys(media).some((key) => key !== 'editorWorker')) {
		throw new TypeError('Invalid media options');
	}

	if (media.editorWorker !== undefined && media.editorWorker !== false && typeof media.editorWorker !== 'function') {
		throw new TypeError('media.editorWorker must be false or a plugin factory');
	}

	const wpRoot = process.env.EIGHTSHIFT_WP_ROOT ? resolve(process.env.EIGHTSHIFT_WP_ROOT) : resolve(root, '../../..');
	const themePath = relative(wpRoot, resolve(root));
	let publicPath = configuredPublicPrefix ?? process.env.EIGHTSHIFT_PUBLIC_PREFIX;

	if (publicPath === undefined) {
		if (!themePath || themePath === '..' || themePath.startsWith(`..${sep}`) || isAbsolute(themePath)) {
			throw new Error('Theme must be inside the WordPress root unless publicPrefix is configured');
		}

		publicPath = `/${themePath.split(sep).join('/')}/public/`;
	}

	if (typeof publicPath !== 'string' || !publicPath.startsWith('/') || publicPath.startsWith('//') || !publicPath.endsWith('/') || publicPath.includes('\\') || /[?#\s\x00-\x1f]/.test(publicPath) || publicPath.split('/').some((part) => part === '.' || part === '..')) {
		throw new Error('publicPrefix must be a root-relative URL path ending in /');
	}

	let outdir;
	let editorWorker;
	let retainedStyles;
	const watchSources = ['src', 'build', 'eightshift.build.mjs', 'package.json', 'bun.lock', 'bun.lockb', 'bunfig.toml', 'tsconfig.json', 'jsconfig.json', 'tailwind.css', 'tailwind-editor.css', 'tailwind-frontend.css', 'color-themes.css'];
	const snapshotSources = [...new Set([...watchSources, ...(Array.isArray(watch.sources) ? watch.sources : [])])];
	const unsafeRoots = new Set(['', '..', 'public', 'eightshift', 'node_modules', 'vendor', 'vendor-prefixed', '.git', '.bun-pilot']);
	const safeSources = snapshotSources.every((name) => {
		if (typeof name !== 'string' || !name) {
			return false;
		}

		const path = relative(root, resolve(root, name));

		return !isAbsolute(path) && !unsafeRoots.has(path.split(sep)[0]);
	});
	const incremental =
		safeSources &&
		!watch.autoRefresh &&
		typeof options.extraCss !== 'function' &&
		Object.keys(options).every((key) => ['root', 'wordpressVersion', 'publicPrefix', 'watch', 'extraCss', 'scanExclusions'].includes(key)) &&
		Object.keys(watch).every((key) => ['hotUpdates', 'debounce', 'sources', 'autoRefresh'].includes(key));
	const hotKey = `eightshift:hot:${publicPath}`;
	let hot;
	const writeMarker = async (data) => {
		const target = resolve(root, 'public', hotMarker),
			pending = target + '.' + randomUUID();

		try {
			await writeFile(pending, data, { flag: 'wx' });
			await rename(pending, target);
		} finally {
			await unlink(pending).catch((e) => {
				if (e.code !== 'ENOENT') {
					throw e;
				}
			});
		}
	};

	const makePreset = async (context) => {
		const { sourcemaps, watchSession, changes } = context;
		hot =
			watchSession && (watch.hotUpdates || incremental)
				? {
						version: randomUUID(),
						plans: !sourcemaps && incremental ? new Map() : null,
						imports: new Map(),
						excluded: new Set(),
						records: new Map(),
						textAnalysis: new Map(),
						css: new Set(),
						enabled: !['createPlugins', 'css', 'discovery', 'publication', 'editor', 'entries', 'frontendStyles', 'buildSsr'].some((k) => Object.hasOwn(options, k)) && typeof options.extraCss !== 'function' && typeof ssr !== 'function' && typeof media.editorWorker !== 'function',
					}
				: undefined;

		if (hot?.enabled && hot.plans) {
			hot.sources = sourceSnapshot(root, snapshotSources);
		}

		const previous = hot && watchSession.get(hotKey);
		const analyzeText = watch.hotUpdates && hot?.enabled && !sourcemaps ? createTextAnalyzer(root, hot.textAnalysis, previous?.textAnalysis) : undefined;

		if (watch.hotUpdates && previous?.enabled && hot.enabled && !sourcemaps && changes?.paths.length && !changes.unknown && !changes.structural && changes.paths.every((path) => previous.records.has(path))) {
			const records = new Map();

			for (const path of changes.paths) {
				const analysis = await analyzeText(path).catch(() => null);

				if (!analysis) {
					break;
				}

				records.set(path, analysis.record);
			}

			const delta = classify(previous, { ...previous, records }, changes);

			if (delta?.text.length && (await readFile(resolve(root, 'public', hotMarker), 'utf8').catch(() => null)) === previous.marker) {
				const preview = { id: hot.version, expires: Date.now() + 60000, text: delta.text };
				hot.previewMarker = JSON.stringify({ ...JSON.parse(previous.marker), preview });
				await writeMarker(hot.previewMarker);
				context.rollbackPreview = async () => {
					if ((await readFile(resolve(root, 'public', hotMarker), 'utf8').catch(() => null)) === hot.previewMarker) {
						await writeMarker(previous.marker);
					}
				};
			}
		}

		const versionFile = resolve(wpRoot, 'wp-includes/version.php');
		const readOptional = async (file) => {
			try {
				return await readFile(file, 'utf8');
			} catch (error) {
				if (error.code === 'ENOENT') {
					return undefined;
				}

				throw error;
			}
		};

		const core = await readOptional(versionFile);
		let target;
		let source = versionFile;

		if (core !== undefined) {
			const matches = [...core.matchAll(/^\s*\$wp_version\s*=\s*(['"])([^'"\r\n]+)\1\s*;/gm)];

			if (matches.length !== 1) {
				throw new Error(`Cannot determine a stable WordPress version from ${source}; WordPress 7.0 or newer is required.`);
			}

			target = matches[0][2];
		} else {
			source = resolve(wpRoot, 'Dockerfile');
			const dockerfile = await readOptional(source);

			if (dockerfile !== undefined) {
				const images = [...dockerfile.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?([^\s]+)(?:\s+AS\s+\S+)?\s*(?:#.*)?$/gim)].map((match) => match[1]);
				const wordpressImages = images.filter((image) => /^(?:docker\.io\/)?(?:library\/)?wordpress(?::|@|$)/i.test(image));

				if (wordpressImages.length > 1) {
					throw new Error(`Ambiguous WordPress images in ${source}.`);
				}

				if (wordpressImages.length === 1) {
					const match = wordpressImages[0].match(/^(?:docker\.io\/)?(?:library\/)?wordpress:(\d+\.\d+(?:\.\d+)?)(?:-(?:php\d+\.\d+|apache|fpm|fpm-alpine|cli|cli-php\d+\.\d+)(?:-[a-z0-9.]+)*)?$/);

					if (!match) {
						throw new Error(`Cannot determine a pinned WordPress version from ${source}.`);
					}

					target = match[1];
				}
			}

			if (target === undefined) {
				source = resolve(wpRoot, 'setup.json');
				const setup = await readOptional(source);

				if (setup !== undefined) {
					let data;

					try {
						data = JSON.parse(setup);
					} catch (error) {
						throw new Error(`Cannot parse ${source}.`, { cause: error });
					}

					if (data && Object.hasOwn(data, 'core')) {
						target = data.core;
					}
				}
			}

			if (target === undefined) {
				source = 'wordpressVersion';
				target = wordpressVersion;
			}
		}

		if (target === undefined) {
			throw new Error('Cannot read WordPress version from installed core, setup.json, Dockerfile, or wordpressVersion.');
		}

		if (typeof target !== 'string' || !/^\d+\.\d+(?:\.\d+)?$/.test(target)) {
			throw new Error(`Cannot determine a stable WordPress version from ${source}; WordPress 7.0 or newer is required.`);
		}

		if (Number(target.split('.')[0]) < 7) {
			throw new Error(`WordPress 7.0 or newer is required; found ${target}.`);
		}

		editorWorker = undefined;
		retainedStyles = new Set();
		const extraCssByFile = new Map();
		const conventionalCss = new Map();
		const responsiveFiles = {};
		const publicDir = resolve(root, 'public');
		outdir = publish === undefined ? resolve(root, '.bun-pilot/theme-build') : resolve(publicDir, '.build');
		await clearBuildDirectory(outdir, root);
		const require = createRequire(resolve(root, 'package.json'));
		const names = ['componentManifests', 'customManifests', 'customBlocks', 'customHooks', 'customTransforms', 'customDeprecations', 'customOverrides', 'variationManifests', 'customVariationManifests', 'variationOverrides', 'componentAdminAssets', 'customAdminAssets'];
		const specs = [
			['componentManifests', 'components', /manifest\.json$/],
			['customManifests', 'custom', /manifest\.json$/],
			...['block', 'hooks', 'transforms', 'deprecations', 'overrides'].map((suffix, index) => [names[index + 2], 'custom', new RegExp(`-${suffix}.js$`)]),
			['componentAdminAssets', 'components', /assets-admin\/index\.js$/, 'lazy'],
			['customAdminAssets', 'custom', /assets-admin\/index\.js$/, 'lazy'],
		];
		const entryNames = {
			frontend: names.slice(0, 2),
			admin: [names[0], names[1], names[10], names[11]],
		};
		const surfaces = Object.fromEntries(Object.entries(entryNames).map(([entry, selected]) => [entry, specs.filter(([name]) => selected.includes(name)).map(([name, directory, pattern, mode]) => ({ name, directory: `src/Blocks/${directory}`, pattern, mode }))]));
		let frontendImporters;
		const manifestReplacements = [
			["require.context('./../../components', true, /manifest\\.json$/)", 'componentManifests'],
			["require.context('./../../custom', true, /manifest\\.json$/)", 'customManifests'],
		];
		let discoveryDir;
		const discoveryPlugin = {
			name: 'theme-discovery-setup',
			setup(builder) {
				themeDiscoveryPlugin({
					root,
					entries: [
						{
							path: 'src/Blocks/assets/scripts/application-blocks-frontend.js',
							module: resolve(discoveryDir, 'frontend.mjs'),
							imports: entryNames.frontend,
							importStatement: "import { dynamicImport } from '@eightshift/frontend-libs-tailwind/scripts/helpers';",
							prefix: frontendImporters,
							replacements: [
								...manifestReplacements,
								['return import(/* webpackMode: "lazy" */ `./../../${importBasePath}/${directory}/assets/index.js`);', 'const importer = bunFrontendImporters[`${importBasePath}/${directory}`]; if (!importer) return Promise.reject(new Error("Missing frontend asset")); return importer();'],
							],
							omitContexts: ({ directory, pattern }) => css === undefined && ['components', 'custom', 'wrapper'].some((group) => directory === resolve(root, 'src/Blocks', group)) && ['styles-frontend.css$', 'styles-frontend\\.css$'].includes(pattern.source) && !pattern.flags,
						},
						{
							path: 'src/Blocks/assets/scripts/application-admin.js',
							module: resolve(discoveryDir, 'admin.mjs'),
							imports: entryNames.admin,
							importStatement: "import { dynamicImport } from '@eightshift/frontend-libs-tailwind/scripts/helpers';",
							replacements: [
								...manifestReplacements,
								["require.context('./../../components', true, /assets-admin\\/index\\.js$/)", 'componentAdminAssets'],
								["require.context('./../../custom', true, /assets-admin\\/index\\.js$/)", 'customAdminAssets'],
								['return import(/* webpackMode: "lazy" */ `./../../${importBasePath}/${directory}/assets-admin/index.js`);', 'return assetContext(assetPath);'],
							],
							omitContexts: ({ directory, pattern }) => css === undefined && ['components', 'custom'].some((group) => directory === resolve(root, 'src/Blocks', group)) && ['styles-admin.css$', 'styles-admin\\.css$'].includes(pattern.source) && !pattern.flags,
						},
					],
				}).setup(builder);
			},
		};
		const pluginContext = {
			root,
			publicPrefix: publicPath,
			scriptUrlIdentifier: editor?.scriptUrlIdentifier ?? '__eightshiftEditorScriptUrl',
			setEditorWorker: (worker) => {
				editorWorker = worker;
			},
			getEditorWorker: () => editorWorker,
		};
		const callerPlugins = createPlugins(pluginContext);

		if (!Array.isArray(callerPlugins)) {
			throw new TypeError('createPlugins must return an array');
		}

		const workerFactory = media.editorWorker === undefined ? editorWorkerPlugin : media.editorWorker;
		const plugins = workerFactory ? [workerFactory(pluginContext), ...callerPlugins] : [...callerPlugins];

		if (hot?.plans) {
			// CSS read directly by a JS bundle (including text/file loaders) is not CSS-only.
			plugins.unshift(
				allowPureJsxGrouping({
					name: 'watch-css-inputs',
					setup(builder) {
						builder.onLoad({ filter: /\.css$/i, namespace: 'file' }, ({ path }) => {
							hot.excluded.add(path);
						});
					},
				}),
			);
		}

		if (publish === undefined) {
			plugins.push(
				browserCssPlugin({
					root,
					outdir,
					conventionalCss,
					extraCssByFile,
					responsiveFiles,
					retainedStyles,
					onCompile: hot?.plans
						? () => {
								hot.plans = null;
							}
						: undefined,
				}),
			);
		}

		if (watch.hotUpdates && hot?.enabled && !sourcemaps) {
			plugins.push(textPlugin(analyzeText, hotKey, hot.records));
		}

		if (discovery === undefined) {
			plugins.push(allowPureJsxGrouping(discoveryPlugin));
		} else if (discovery) {
			const plugin = await discovery(pluginContext);

			if (!plugin || typeof plugin.setup !== 'function') {
				throw new TypeError('discovery must return a Bun plugin');
			}

			plugins.push(plugin);
		}

		const browserEligible =
			watchSession &&
			!sourcemaps &&
			Object.keys(options).every((key) => ['root', 'wordpressVersion', 'publicPrefix', 'watch', 'extraCss', 'scanExclusions'].includes(key)) &&
			typeof options.extraCss !== 'function' &&
			Object.keys(watch).every((key) => ['debounce', 'hotUpdates', 'autoRefresh'].includes(key));
		const browserBundles = browserEligible
			? await browserWatchCache({
					root,
					changes,
					watchSession,
					wpRoot,
					signature: () => JSON.stringify([target, frontendImporters, [...conventionalCss].map(([surface, paths]) => [surface, [...paths].sort()]), [...extraCssByFile].map(([file, groups]) => [file, groups.map(({ href, files }) => [href, files.length])])]),
					isStaticCss: (name, file) => !/\.module\.css$/i.test(file) && (conventionalCss.get(name)?.has(file) || (name === 'frontend' && extraCssByFile.get(file)?.length === 1 && extraCssByFile.get(file)[0].files.length === 1)),
					report: (message) => {
						if (context.verbose) {
							console.log(`[eightshift-build] browser ${message}`);
						}
					},
				})
			: undefined;

		if (!browserEligible) {
			watchSession?.delete(browserWatch);
		}

		return {
			root,
			outdir,
			direct: true,
			wpRoot,
			entries: entries ?? { frontend: 'src/Blocks/assets/scripts/application-blocks-frontend.js', admin: 'src/Blocks/assets/scripts/application-admin.js', editor: 'src/Blocks/assets/scripts/application-blocks-editor.js' },
			responsive,
			editor: editor ?? {
				entry: 'editor',
				filename: 'applicationBlocksEditor.js',
				sharing: 'unified',
				discovery: {
					filter: /application-blocks-editor\.js$/,
					omitContexts: ({ pattern }) => ['styles-editor.css$', 'styles-editor\\.css$'].includes(pattern.source),
				},
			},
			css: async (context) => {
				const { outdir: stage, responsive: generated } = context;
				Object.assign(responsiveFiles, generated);

				if (css === undefined) {
					for (const surface of ['frontend', 'editor', 'admin']) {
						const name = surface === 'admin' ? 'applicationAdmin' : `applicationBlocks${surface === 'frontend' ? 'Frontend' : 'Editor'}`;

						const files = await eightshiftCssEntries({ projectDir: root, surface, responsiveFile: generated[surface], additionalScanExclusions: options.scanExclusions });

						if (hot?.enabled) {
							for (const entry of files) {
								hot.css.add(resolve(root, typeof entry === 'string' ? entry : entry.file));
							}
						}

						if (hot?.plans) {
							for (const entry of files) {
								const file = resolve(root, typeof entry === 'string' ? entry : entry.file);

								if (hot.sources?.has(file) && !hot.imports.has(file)) {
									hot.imports.set(file, await importSignature(file));
								}
							}
						}

						const capture = hot?.plans ? { entries: new Map() } : undefined;
						const reuse = capture && !changes?.unknown && !changes?.structural && changes?.paths.length && changes.paths.every((path) => previous?.records.has(path)) ? previous?.plans?.get(name)?.capture : undefined;
						const compiled = await processCss({ projectDir: root, files, capture, reuse, outputFile: resolve(stage, 'css', `${name}.css`), production: true });

						if (hot?.enabled && hot.plans) {
							hot.plans.set(name, { files, capture, dependencies: compiled.dependencies, generated: generated[surface], bytes: generated[surface] && (await readFile(generated[surface])) });
						}

						if (surface !== 'editor' && publish === undefined) {
							conventionalCss.set(surface, await collectConventionalCss({ root, files }));
						}
					}
				} else if (css) {
					await css({ ...context, stage, require });
				}

				if (typeof extraCss === 'function') {
					await extraCss({ root, stage, require });
				}

				const styles = [...frontendStyles];
				const outputNames = new Set(cssNames);

				for (const { output, files, keys, href } of cssDefinitions) {
					const resolveFile = (file) => {
						if (typeof file !== 'string' || !file) {
							throw new TypeError('Invalid extraCss file');
						}

						return file.startsWith('package:') ? require.resolve(file.slice(8)) : isAbsolute(file) ? file : resolve(root, file);
					};

					const temporary = resolve(stage, 'css', `.extra-${randomUUID()}.css`);
					const outputFile = output ? resolve(stage, 'css', output) : temporary;
					const resolvedFiles = files.map((entry) => (typeof entry === 'string' ? resolveFile(entry) : { ...entry, file: resolveFile(entry?.file) }));

					const extra = await processCss({ projectDir: root, outputFile, files: resolvedFiles, production: true });

					if (hot?.plans) {
						if (resolvedFiles.some((entry) => typeof entry !== 'string')) {
							hot.plans = null;
						}

						for (const file of extra.dependencies) {
							hot.excluded.add(await realpath(file));
						}
					}

					let name = output;

					if (!name) {
						const hash = createHash('sha256')
							.update(await readFile(temporary))
							.digest('hex')
							.slice(0, 20);

						name = `extra-${hash}.css`;

						if (outputNames.has(name)) {
							throw new Error(`Duplicate CSS output: ${name}`);
						}

						outputNames.add(name);
						await link(temporary, resolve(stage, 'css', name));
						await unlink(temporary);
					}

					retainedStyles.add(name);

					if (keys) {
						const group = { href: href ?? `../css/${name}`, files: resolvedFiles };
						styles.push({ keys, href: group.href });

						if (publish === undefined) {
							for (const entry of resolvedFiles) {
								const file = await realpath(typeof entry === 'string' ? entry : entry.file);
								const groups = extraCssByFile.get(file) ?? [];
								groups.push(group);
								extraCssByFile.set(file, groups);
							}
						}
					}
				}

				if (discovery === undefined) {
					frontendImporters = await generateThemeImporters({
						root,
						glob: 'src/Blocks/{components,custom}/**/assets/index.js',
						key: (file) => file.replace(/^src\/Blocks\//, '').replace(/\/assets\/index\.js$/, ''),
						styles,
						...(publish === undefined ? { styleRuntime: browserCssRuntime } : {}),
					});
					discoveryDir = resolve(stage, 'discovery');
					await generateThemeDiscovery({ root, outputDir: discoveryDir, surfaces });
				}
			},
			entryPublicPaths: Object.fromEntries(['frontend', 'admin'].filter((name) => entries === undefined || Object.hasOwn(entries, name)).map((name) => [name, `${publicPath}${name}/`])),
			buildOptions: {
				...(browserBundles && { [browserWatch]: browserBundles }),
				optimizeImports,
				minify: true,
				drop: ['console'],
				publicPath,
				naming: { entry: '[name]-[hash].[ext]', chunk: '[name]-[hash].[ext]', asset: '[name]-[hash].[ext]' },
				sourcemap: sourcemaps ? 'external' : 'none',
				loader: { '.js': 'jsx', '.svg': 'file' },
				define: { 'process.browser': 'true', 'process.env.NODE_ENV': '"production"', 'process.env.VERSION': JSON.stringify(createHash('sha256').update(publicPath).digest('hex').slice(0, 20)) },
				plugins,
			},
		};
	};

	const defaultPublish = async ({ result, verbose, quiet, watchSession, changes }) => {
		const editorScript = await readFile(resolve(outdir, result.entries.editor.entry), 'utf8');

		if (requireEditorWorker && !editorWorker) {
			throw new Error('Missing editor worker');
		}

		const ssrDir = resolve(outdir, 'ssr/production');
		const ssrNames = [];

		if (ssr !== false) {
			if (ssr || buildSsr) {
				await (ssr ?? buildSsr)({ root, mode: 'production', outdir: ssrDir });
			}

			for await (const file of new Bun.Glob('src/**/assets-ssr/ssr.{js,mjs}').scan({ cwd: root })) {
				const name = file.split('/').at(-3);

				if (ssrNames.includes(name)) {
					throw new Error(`Duplicate SSR entry: ${name}`);
				}

				ssrNames.push(name);
			}

			if (ssrNames.length && !ssr && !buildSsr) {
				const graph = await defaultSsr({ root, mode: 'production', watchSession, changes, quiet });

				if (hot?.plans) {
					if (!graph.cacheable || !graph.dependencies?.length) {
						hot.plans = null;
					} else {
						for (const file of graph.dependencies) {
							hot.excluded.add(file);
						}
					}
				}
			}

			if (!ssrNames.length && (ssr || buildSsr)) {
				throw new Error('No SSR entries found');
			}
		}

		for (const surface of ['frontend', 'admin']) {
			if (result.entries[surface].styles.length) {
				throw new Error(`Unexpected Bun CSS output for ${surface}; a custom plugin bypassed the theme CSS loader. Configure a compatible plugin or custom publication.`);
			}
		}

		const surfaces = { frontend: 'applicationBlocksFrontend', editor: 'applicationBlocksEditor', admin: 'applicationAdmin' };
		const flatDir = resolve(outdir, 'structured');
		await preserveAssets({
			outdir,
			flatDir,
			extraSources: editorWorker ? { [`editor/editor-assets/${basename(editorWorker)}`]: editorWorker } : {},
		});
		// Webpack exposed standalone images by basename, even when not imported by JS.
		const standaloneAssets = new Map();

		for await (const file of new Bun.Glob('src/Blocks/assets/images/**/*').scan({ cwd: root, onlyFiles: true })) {
			const name = basename(file);

			if (standaloneAssets.has(name)) {
				throw new Error(`Duplicate standalone asset: ${name}`);
			}

			standaloneAssets.set(name, resolve(root, file));
		}

		const refreshToken = watchSession && watch.autoRefresh ? randomUUID() : undefined;
		const entries = Object.entries(surfaces).map(([surface, name]) => {
			const entry = result.entries[surface];
			let script;

			if (surface === 'editor') {
				if (entry.format === 'module') {
					script = editorScript.replace(/^(import ["'])\.\//gm, `$1./${entry.entry.slice(0, entry.entry.lastIndexOf('/') + 1)}`);
				} else {
					const wrapper = '})(document.currentScript.src);\n';

					if (editorScript.split(wrapper).length !== 2) {
						throw new Error('Cannot relocate the classic editor script wrapper');
					}

					script = editorScript.replace(wrapper, () => `})(new URL(${JSON.stringify(entry.entry)}, document.currentScript.src).href);\n`);
					script = script.replace(/^(\/\/# sourceMappingURL=)([^\r\n]+)$/m, (_match, prefix, map) => `${prefix}${entry.entry.slice(0, entry.entry.lastIndexOf('/') + 1)}${map}`);
				}
			}

			if (verbose && !quiet) {
				console.log(`${surface}: ${entry.entry}; dependencies: ${entry.dependencies.join(', ') || 'none'}`);
			}

			return {
				name,
				entry: entry.entry,
				style: `css/${name}.css`,
				dependencies: entry.dependencies,
				...(script && { script }),
				...(watch.hotUpdates && hot && { scriptSuffix: hotScript(publicPath, hot.version, hotKey) }),
				...(refreshToken && { scriptSuffix: refreshScript(publicPath, refreshToken) }),
				...(entry.format === 'module' ? { format: entry.format, readiness: entry.readiness } : {}),
			};
		});
		const publicationResult = await publication({ root, outdir, result, publicationRoot: flatDir });
		const additions = publicationResult === undefined ? {} : publicationResult;

		if (!additions || typeof additions !== 'object' || Array.isArray(additions)) {
			throw new TypeError('publication must return an object or undefined');
		}

		if (additions.aliases !== undefined && (!additions.aliases || typeof additions.aliases !== 'object' || Array.isArray(additions.aliases))) {
			throw new TypeError('publication aliases must be a non-array object');
		}

		if (additions.extraFiles !== undefined && !Array.isArray(additions.extraFiles)) {
			throw new TypeError('publication extraFiles must be an array');
		}

		for (const key of Object.keys(additions.aliases ?? {})) {
			if (Object.hasOwn(aliases, key)) {
				throw new Error(`Duplicate publication alias: ${key}`);
			}
		}

		let fontAssets = { extraFiles: [], aliases: {} };

		if (sharedFonts) {
			if (additions.retain !== undefined && !Array.isArray(additions.retain)) {
				throw new TypeError('publication retain must be an array');
			}

			const additionalFiles = [...(additions.extraFiles ?? []), ...[...standaloneAssets].map(([destination, source]) => ({ source, destination }))];

			for (const name of additions.retain ?? []) {
				if (typeof name !== 'string' || !name || isAbsolute(name) || name.includes('\\') || name.includes('\0') || name.split('/').some((part) => !part || part === '.' || part === '..')) {
					throw new Error(`Invalid path: ${String(name)}`);
				}

				let source = resolve(root, 'public');

				for (const part of name.split('/')) {
					source = resolve(source, part);

					if ((await lstat(source)).isSymbolicLink()) {
						throw new Error(`Symlink in retained path: ${name}`);
					}
				}

				if (!(await lstat(source)).isFile()) {
					throw new Error(`Retained path must be an exact file: ${name}`);
				}

				additionalFiles.push({ source, destination: name });
			}

			fontAssets = await prepareSharedFonts({ root, flatDir, retainedStyles, additionalFiles });
		}

		if (sharedFonts && (Object.hasOwn(aliases, 'shared-fonts.json') || Object.hasOwn(additions.aliases ?? {}, 'shared-fonts.json'))) {
			throw new Error('shared-fonts.json is reserved when sharedFonts is enabled');
		}

		const { release, version, manifest } = await packageFlatRelease({
			extraFiles: [...fontAssets.extraFiles, ...(additions.extraFiles ?? [])],
			retain: additions.retain,
			previousPublic: resolve(root, 'public'),
			root: outdir,
			removeUnreferencedStyles,
			flatDir,
			entries,
			ssrDir,
			ssrNames,
			standaloneAssets,
			aliases: { ...aliases, ...additions.aliases, ...fontAssets.aliases },
		});

		const previousHot = hot && watchSession.get(hotKey);

		if (watch.hotUpdates && previousHot) {
			// Keep polling the last completed generation while the PHP cache synchronizes.
			await writeFile(resolve(release, hotMarker), hot.previewMarker ?? previousHot.marker, { flag: 'wx' });
		}

		const published = await publishFlatRelease({ root, wpRoot, release, manifest, version, publicPrefix: publicPath });
		await clearBuildDirectory(outdir, root);

		// Signal only after the public swap and PHP manifest synchronization succeed.
		if (hot) {
			const previous = previousHot;
			hot.styles = Object.fromEntries(entries.map(({ name }) => [name, published.manifest[name + '.css']]));
			hot.extra = JSON.stringify([...retainedStyles].sort());

			if (watch.hotUpdates) {
				const marker = { version: hot.version, parent: previous?.version ?? null, delta: classify(previous, hot, changes) };
				hot.marker = JSON.stringify(marker);
				await writeMarker(hot.marker);
			}

			if (
				hot.plans &&
				hot.enabled &&
				hot.imports.size &&
				!result.entries.editor.styles.length &&
				!(
					await Promise.all(
						entries.map(({ style }) =>
							lstat(resolve(root, 'public', style)).then(
								() => true,
								(e) => {
									if (e.code !== 'ENOENT') {
										throw e;
									}

									return false;
								},
							),
						),
					)
				).some(Boolean) &&
				[...retainedStyles].every((name) => /^extra-[a-f0-9]{20}\.css$/.test(name))
			) {
				hot.stamp = await outputStamp(root);
				hot.base = hot.version;
			}

			delete hot.previewMarker;
			watchSession.set(hotKey, hot);
		}

		if (refreshToken) {
			await writeFile(resolve(root, 'public', refreshMarker), JSON.stringify(refreshToken), { flag: 'wx' });
		}
	};

	const cacheDefaultSsr = publish === undefined && !['createPlugins', 'extraCss', 'css', 'discovery', 'publication'].some((name) => typeof options[name] === 'function') && typeof media.editorWorker !== 'function' && !['sources', 'ignored', 'ignore'].some((name) => Object.hasOwn(watch || {}, name));
	const defaultSsr = ({ root, mode, watchSession, changes, quiet }) => buildWatchSsr({ root, mode, changes, quiet, watchSession: cacheDefaultSsr ? watchSession : watchSession && hot?.plans ? new Map() : undefined, outdir: resolve(outdir, 'ssr', mode) });
	const customSsr = ssr ?? buildSsr;
	const definition = defineBuild({
		root,
		preset: makePreset,
		watchCss: async ({ watchSession, changes, sourcemaps }) => {
			const reused = !sourcemaps && (await quickCss({ root, changes, watchSources: snapshotSources, previous: watchSession.get(hotKey), prefix: publicPath, commit: (next) => watchSession.set(hotKey, next) }));

			if (reused) {
				watchSession.delete(browserWatch);
			}

			return reused;
		},
		ssr:
			publish !== undefined && ssr !== false
				? async (state) => {
						if (customSsr) {
							return customSsr({ ...state, mode: 'production', outdir: resolve(outdir, 'ssr', 'production') });
						}

						for await (const _file of new Bun.Glob('src/**/assets-ssr/ssr.{js,mjs}').scan({ cwd: root, onlyFiles: true })) {
							return defaultSsr({ root, mode: 'production', watchSession: state.watchSession, quiet: state.quiet });
						}
					}
				: undefined,
		publish: publish === undefined ? defaultPublish : publish || undefined,
		watch: {
			sources: watchSources,
			...(watch.hotUpdates && { debounce: 35 }),
			ignored: ['.git', '.bun-pilot', 'node_modules', 'vendor', 'vendor-prefixed', 'public'],
			...(watch || {}),
		},
	});

	if (watch === false) {
		definition.watch = () => {
			throw new Error('Watching is disabled');
		};
	}

	return definition;
}
