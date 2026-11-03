import { createHash, randomUUID } from 'node:crypto';
import { link, readFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { defineBuild } from './index.mjs';
import { generateThemeDiscovery, generateThemeImporters, themeDiscoveryPlugin } from './theme-discovery.mjs';
import { processEightshiftCss } from './eightshift-css.mjs';
import { flattenAssets, packageFlatRelease, publishFlatRelease } from './flat-publication.mjs';
import { editorWorkerPlugin } from './media.mjs';
import { processCss } from './css.mjs';
import { buildSsr as buildDefaultSsr } from './ssr.mjs';

/**
 * Define a conventional theme build. extraCss may be a hook or an array of
 * { files, output?, keys?, href? }; package files use the `package:` prefix.
 * Omitted output names use a content hash. Keys attach CSS to frontend importers.
 * SSR is built when conventional entries exist; ssr: false disables it.
 * watch: false disables watching; an object overrides the safe watch defaults.
 */
export function defineThemeBuild({ root, buildSsr, createPlugins = () => [], frontendStyles = [], extraCss = async () => {}, aliases = {}, requireEditorWorker = false, media = {}, watch = {}, entries, editor, responsive = {}, css, discovery, ssr, publish } = {}) {
	if (typeof root !== 'string' || !root) {
		throw new TypeError('root must be a non-empty string');
	}

	if (typeof createPlugins !== 'function') {
		throw new TypeError('createPlugins must be a function');
	}

	if (extraCss !== false && typeof extraCss !== 'function' && !Array.isArray(extraCss)) {
		throw new TypeError('extraCss must be false, a function, or an array');
	}

	if (watch !== false && (!watch || typeof watch !== 'object' || Array.isArray(watch))) {
		throw new TypeError('watch must be false or an object');
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
	let outdir;
	let editorWorker;
	const makePreset = async ({ sourcemaps }) => {
		editorWorker = undefined;
		outdir = resolve(root, '.bun-pilot', `library-release-build-${randomUUID()}`);
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
							remove: [/dynamicImport\(require\.context\([^\n]+\)\);/g],
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
							remove: [/dynamicImport\(require\.context\([^\n]+\)\);/g],
						},
					],
				}).setup(builder);
			},
		};
		const pluginContext = {
			root,
			setEditorWorker: (worker) => {
				editorWorker = worker;
			},
			getEditorWorker: () => editorWorker,
		};
		const plugins = createPlugins(pluginContext);

		if (!Array.isArray(plugins)) {
			throw new TypeError('createPlugins must return an array');
		}

		const workerFactory = media.editorWorker === undefined ? editorWorkerPlugin : media.editorWorker;

		if (workerFactory) {
			plugins.push(workerFactory(pluginContext));
		}

		if (discovery === undefined) {
			plugins.push(discoveryPlugin);
		} else if (discovery) {
			const plugin = await discovery(pluginContext);

			if (!plugin || typeof plugin.setup !== 'function') {
				throw new TypeError('discovery must return a Bun plugin');
			}

			plugins.push(plugin);
		}

		return {
			root,
			outdir,
			wpRoot,
			entries: entries ?? { frontend: 'src/Blocks/assets/scripts/application-blocks-frontend.js', admin: 'src/Blocks/assets/scripts/application-admin.js', editor: 'src/Blocks/assets/scripts/application-blocks-editor.js' },
			responsive,
			editor: editor ?? {
				entry: 'editor',
				filename: 'applicationBlocksEditor.js',
				discovery: {
					filter: /application-blocks-editor\.js$/,
					omitContexts: ({ pattern }) => pattern.source === 'styles-editor.css$',
				},
			},
			css: async (context) => {
				const { outdir: stage, responsive: generated } = context;

				if (css === undefined) {
					for (const surface of ['frontend', 'editor', 'admin']) {
						const name = surface === 'admin' ? 'applicationAdmin' : `applicationBlocks${surface === 'frontend' ? 'Frontend' : 'Editor'}`;

						await processEightshiftCss({ projectDir: root, surface, responsiveFile: generated[surface], outputFile: resolve(stage, 'css', `${name}.css`), production: true });
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

					await processCss({ projectDir: root, outputFile, files: files.map((entry) => (typeof entry === 'string' ? resolveFile(entry) : { ...entry, file: resolveFile(entry?.file) })), production: true });
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

					if (keys) {
						styles.push({ keys, href: href ?? `../css/${name}` });
					}
				}

				if (discovery === undefined) {
					frontendImporters = await generateThemeImporters({
						root,
						glob: 'src/Blocks/{components,custom}/**/assets/index.js',
						key: (file) => file.replace(/^src\/Blocks\//, '').replace(/\/assets\/index\.js$/, ''),
						styles,
					});
					discoveryDir = resolve(stage, 'discovery');
					await generateThemeDiscovery({ root, outputDir: discoveryDir, surfaces });
				}
			},
			buildOptions: {
				minify: true,
				sourcemap: sourcemaps ? 'external' : 'none',
				loader: { '.js': 'jsx', '.svg': 'file' },
				define: { 'process.browser': 'true', 'process.env.NODE_ENV': '"production"', 'process.env.VERSION': '"library-release"' },
				plugins,
			},
		};
	};
	const defaultPublish = async ({ result }) => {
		const editorScript = await readFile(resolve(outdir, result.entries.editor.entry), 'utf8');

		if (requireEditorWorker && !editorWorker) {
			throw new Error('Missing editor worker');
		}

		const ssrDir = resolve(root, '.bun-pilot/ssr/production');
		const ssrNames = [];

		if (ssr !== false) {
			if (ssr || buildSsr) {
				await (ssr ?? buildSsr)({ root, mode: 'production' });
			}

			for await (const file of new Bun.Glob('src/**/assets-ssr/ssr.{js,mjs}').scan({ cwd: root })) {
				const name = file.split('/').at(-3);

				if (ssrNames.includes(name)) {
					throw new Error(`Duplicate SSR entry: ${name}`);
				}

				ssrNames.push(name);
			}

			if (ssrNames.length && !ssr && !buildSsr) {
				await defaultSsr({ root, mode: 'production' });
			}

			if (!ssrNames.length && (ssr || buildSsr)) {
				throw new Error('No SSR entries found');
			}
		}

		const surfaces = { frontend: 'applicationBlocksFrontend', editor: 'applicationBlocksEditor', admin: 'applicationAdmin' };
		const flatDir = resolve(outdir, 'flat');
		const { rewrite } = await flattenAssets({
			outdir,
			flatDir,
			extraSources: editorWorker ? { [`editor/editor-assets/${basename(editorWorker)}`]: editorWorker } : {},
			editorEntry: result.entries.editor.entry,
			editorScript,
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

		const entries = Object.entries(surfaces).map(([surface, name]) => {
			const entry = result.entries[surface];
			const script = surface === 'editor' ? rewrite(editorScript, entry.entry) : undefined;

			console.log(`${surface}: ${entry.entry}; dependencies: ${entry.dependencies.join(', ') || 'none'}`);

			return { name, entry: surface === 'editor' ? 'editor-entry.js' : basename(entry.entry), style: `${name}.css`, dependencies: entry.dependencies, ...(script && { script }) };
		});
		const { release, version, manifest } = await packageFlatRelease({
			root: resolve(root, '.bun-pilot'),
			flatDir,
			entries,
			ssrDir,
			ssrNames,
			standaloneAssets,
			aliases,
		});

		await publishFlatRelease({ root, wpRoot, release, manifest, version });
	};
	const defaultSsr = ({ root, mode }) => buildDefaultSsr({ root, mode, outdir: resolve(root, '.bun-pilot/ssr', mode) });
	const customSsr = ssr ?? buildSsr;
	const definition = defineBuild({
		root,
		preset: makePreset,
		ssr:
			publish !== undefined && ssr !== false
				? async (state) => {
						if (customSsr) {
							return customSsr({ ...state, mode: 'production' });
						}

						for await (const _file of new Bun.Glob('src/**/assets-ssr/ssr.{js,mjs}').scan({ cwd: root, onlyFiles: true })) {
							return defaultSsr({ root, mode: 'production' });
						}
					}
				: undefined,
		publish: publish === undefined ? defaultPublish : publish || undefined,
		watch: { sources: ['src', 'build', 'eightshift.build.mjs', 'package.json', 'bun.lock', 'tailwind.css', 'tailwind-editor.css', 'tailwind-frontend.css', 'color-themes.css'], ignored: ['.git', '.bun-pilot', 'node_modules', 'vendor', 'vendor-prefixed', 'public'], ...(watch || {}) },
	});

	if (watch === false) {
		definition.watch = () => {
			throw new Error('Watching is disabled');
		};
	}

	return definition;
}
