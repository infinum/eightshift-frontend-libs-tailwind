import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineThemeBuild } from '../../bun/theme-build.mjs';
import { build } from '../../bun/build.mjs';

const temporary = await mkdtemp(join(await realpath(tmpdir()), 'eightshift-theme-build-'));

async function removeFixture(directory) {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, item.name);

		if (item.isDirectory()) {
			await removeFixture(path);
		} else {
			await unlink(path);
		}
	}

	await rmdir(directory);
}

async function readStylesheetGraph(path, seen = new Set()) {
	if (seen.has(path)) {
		return '';
	}
	seen.add(path);
	const css = await readFile(path, 'utf8');
	let combined = css;
	for (const [, target] of css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)) {
		combined += await readStylesheetGraph(fileURLToPath(new URL(target, pathToFileURL(path))), seen);
	}
	return combined;
}

async function remapModuleImports(publicDir, publicPrefix) {
	const filePrefix = pathToFileURL(`${publicDir}/`).href;
	const escaped = publicPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(\\bfrom\\s*["']|\\bimport\\s*\\(\\s*["'])${escaped}`, 'g');
	for (const name of await readdir(publicDir, { recursive: true })) {
		if (!name.endsWith('.js')) continue;
		const path = join(publicDir, name);
		const source = await readFile(path, 'utf8');
		await writeFile(path, source.replace(pattern, (_, prefix) => `${prefix}${filePrefix}`));
	}
}

async function makeTheme(name, sharing = 'unified') {
	const root = join(temporary, 'wp-content', 'themes', name);
	const src = join(root, 'src');
	const ui = join(root, 'node_modules', '@eightshift', 'ui-components', 'dist');
	await mkdir(src, { recursive: true });
	await mkdir(join(ui, 'components', 'smart-image'), { recursive: true });
	await mkdir(join(ui, 'assets'), { recursive: true });
	const tailwind = join(root, 'node_modules', 'tailwindcss');
	await mkdir(tailwind, { recursive: true });
	await writeFile(join(tailwind, 'package.json'), JSON.stringify({ name: 'tailwindcss', exports: { '.': { style: './index.css' }, './index.css': './index.css' } }));
	await writeFile(join(tailwind, 'index.css'), '@theme { --spacing: 0.25rem; } @tailwind utilities;');
	await writeFile(join(root, 'package.json'), JSON.stringify({ name: `fixture-${name}`, type: 'module' }));
	await writeFile(join(ui, 'assets', 'image-analysis-worker-fixture.js'), 'self.onmessage = () => {};');
	await writeFile(
		join(ui, 'components', 'smart-image', 'smart-image.js'),
		'export function startWorker() { return new Worker(new URL(new URL("../../assets/image-analysis-worker-fixture.js", import.meta.url).href, "" + import.meta.url), { type: "module" }); }',
	);
	const workerImport = 'import { startWorker } from "../node_modules/@eightshift/ui-components/dist/components/smart-image/smart-image.js";';
	await writeFile(join(src, 'frontend.js'), `import "./frontend.css"; ${workerImport} globalThis.frontendFixture = { startWorker, version: process.env.VERSION }; globalThis.loadLazyFixture = () => import("./lazy.js"); globalThis.loadModuleFixture = () => import("./module.js");`);
	await writeFile(join(src, 'frontend.css'), '.static-css-proof { color: red; }');
	await writeFile(join(src, 'lazy.js'), 'import "./lazy.css"; export const lazy = true; export const loadNested = () => import("./nested.js");');
	await writeFile(join(src, 'lazy.css'), '.lazy-css-proof { color: green; }');
	await writeFile(join(src, 'nested.js'), 'import "./nested.css"; globalThis.nestedFixture = true;');
	await writeFile(join(src, 'nested.css'), '.nested-css-proof { color: purple; }');
	await writeFile(join(src, 'module.js'), 'import styles, { leaf } from "./component.module.css"; import imported from "./imported.module.css"; globalThis.moduleFixture = { classes: styles.leaf, named: leaf, imported: imported.shared, leaked: Object.hasOwn(styles, "shared"), utility: "px-4" };');
	await writeFile(join(src, 'base.module.css'), '.base { color: red; }');
	await writeFile(join(src, 'tokens.css'), '@theme { --spacing: 0.25rem; }');
	await writeFile(join(src, 'global.css'), '@import "./global-layer.css"; .global-import-proof { color: orange; background: url("./icon.svg?v=3#mark"); }');
	await writeFile(join(src, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
	await writeFile(join(src, 'global-layer.css'), '@import "./imported.module.css"; .global-nested-proof { color: pink; }');
	await writeFile(join(src, 'imported.module.css'), '.shared { color: yellow; }');
	await writeFile(join(src, 'component.module.css'), '@layer reset, theme, imported; @import "tailwindcss" layer(theme); @import url("./global.css?v=1#test"); @import "./imported.module.css" layer(imported); @reference "./tokens.css"; .parent { color: blue; } .leaf { composes: parent; composes: base from "./base.module.css"; @apply flex; }');
	await writeFile(join(src, 'admin.js'), `import "./admin.css"; ${workerImport} globalThis.adminFixture = { startWorker, version: process.env.VERSION }; globalThis.loadAdminLazyFixture = () => import("./admin-lazy.js");`);
	await writeFile(join(src, 'admin.css'), '.admin-css-proof { color: navy; }');
	await writeFile(join(src, 'admin-lazy.js'), 'import "./admin-lazy.css"; export const lazy = true;');
	await writeFile(join(src, 'admin-lazy.css'), '.admin-lazy-css-proof { color: teal; }');
	await writeFile(join(src, 'editor.js'), `${workerImport} globalThis.editorFixture = { startWorker, version: process.env.VERSION };`);

	const publicPrefix = `/wp-content/themes/${name}/public/`;
	const build = defineThemeBuild({
		root,
		publicPrefix,
		entries: { frontend: 'src/frontend.js', admin: 'src/admin.js', editor: 'src/editor.js' },
		editor: { entry: 'editor', sharing, scriptUrlIdentifier: 'customEditorUrl' },
		discovery: false,
		responsive: false,
		ssr: false,
		watch: false,
		css: async ({ stage }) => {
			const output = join(stage, 'css');
			await mkdir(output, { recursive: true });
			for (const surface of ['applicationBlocksFrontend', 'applicationBlocksEditor', 'applicationAdmin']) {
				await writeFile(join(output, `${surface}.css`), '.conventional-css-proof { display: block; }');
			}
		},
	});

	return { root, publicPrefix, build };
}

async function checkTailwindImports() {
	const root = join(temporary, 'wp-content', 'themes', 'tailwind-import');
	await mkdir(join(root, 'src'), { recursive: true });
	await writeFile(join(root, 'package.json'), '{"name":"tailwind-import-fixture"}');
	await writeFile(join(root, 'src', 'tailwind.css'), '@theme { --spacing: 0.25rem; }');
	await writeFile(join(root, 'src', 'part.css'), '@reference "./tailwind.css"; .tailwind-proof { @apply flex; }');
	await writeFile(join(root, 'src', 'utilities.css'), '@theme { --spacing: 0.25rem; } @tailwind utilities;');
	await writeFile(join(root, 'src', 'frontend.js'), 'import "./part.css"; import "./utilities.css"; globalThis.tailwindFixture = "px-4";');
	await writeFile(join(root, 'src', 'admin.js'), 'console.log("admin");');
	await writeFile(join(root, 'src', 'editor.js'), 'console.log("editor");');
	await defineThemeBuild({
		root,
		entries: { frontend: 'src/frontend.js', admin: 'src/admin.js', editor: 'src/editor.js' },
		editor: { entry: 'editor', sharing: 'unified' },
		discovery: false,
		responsive: false,
		ssr: false,
		watch: false,
		css: async ({ stage }) => {
			const output = join(stage, 'css');
			await mkdir(output, { recursive: true });
			for (const name of ['applicationBlocksFrontend', 'applicationBlocksEditor', 'applicationAdmin']) {
				await writeFile(join(output, `${name}.css`), '.base { display: block; }');
			}
		},
	}).build({ quiet: true });
	const publicDir = join(root, 'public');
	const cssFiles = (await readdir(publicDir, { recursive: true })).filter((name) => name.endsWith('.css'));
	const styles = (await Promise.all(cssFiles.map((name) => readFile(join(publicDir, name), 'utf8')))).join('\n');
	assert.match(styles, /\.tailwind-proof\s*\{[^}]*display\s*:\s*flex/);
	assert.match(styles, /\.px-4\s*\{[^}]*padding-inline/);
}

async function checkConventionalStyleDedup() {
	const root = join(temporary, 'wp-content', 'themes', 'conventional-css');
	await mkdir(join(root, 'src', 'Blocks', 'assets', 'styles'), { recursive: true });
	for (const name of ['card', 'modal']) {
		await mkdir(join(root, 'src', 'Blocks', 'components', name), { recursive: true });
	}
	await writeFile(join(root, 'package.json'), '{"name":"conventional-css-fixture"}');
	for (const surface of ['frontend', 'editor']) {
		await writeFile(join(root, `tailwind-${surface}.css`), `@source './es-tw-${surface}-classes.txt';`);
	}
	await writeFile(join(root, 'color-themes.css'), '.theme { display: block; }');
	for (const surface of ['frontend', 'editor', 'admin']) {
		const name = surface === 'admin' ? 'application-admin' : `application-blocks-${surface}`;
		await writeFile(join(root, 'src', 'Blocks', 'assets', 'styles', `${name}.css`), '.base { display: block; }');
	}
	await writeFile(join(root, 'src', 'Blocks', 'components', 'card', 'styles-frontend.css'), '@import "../../../shared.css"; @import "../../../conditional.css" screen and (min-width: 40rem); @reference "../../../reference.css"; .review-target { color: red; }');
	await writeFile(join(root, 'src', 'Blocks', 'components', 'card', 'manifest.json'), '{"responsive":true,"twClasses":"p-4"}');
	await writeFile(join(root, 'src', 'Blocks', 'components', 'modal', 'styles-frontend.css'), '.review-target { color: blue; } .duplicate-target { color: blue; }');
	await writeFile(join(root, 'src', 'shared.css'), '.duplicate-target { color: red; }');
	await writeFile(join(root, 'src', 'conditional.css'), '.conditional-import-proof { color: teal; }');
	await writeFile(join(root, 'src', 'reference.css'), '.reference-import-proof { color: purple; }');
	await writeFile(join(root, 'src', 'browser-utilities.css'), '@theme { --spacing: 0.25rem; --breakpoint-sm: 40rem; } @tailwind utilities;');
	await writeFile(join(root, 'src', 'frontend.js'), 'import classes from "./Blocks/components/card/styles-frontend.css"; import "./shared.css"; import "./conditional.css"; import "./reference.css"; import "./browser-utilities.css"; globalThis.dedupStyles = classes;');
	await writeFile(join(root, 'src', 'admin.js'), 'console.log("admin");');
	await writeFile(join(root, 'src', 'editor.js'), 'console.log("editor");');
	const { result } = await defineThemeBuild({
		root,
		entries: { frontend: 'src/frontend.js', admin: 'src/admin.js', editor: 'src/editor.js' },
		editor: { entry: 'editor', sharing: 'unified' },
		discovery: false,
		ssr: false,
		watch: false,
	}).build({ quiet: true });
	const publicDir = join(root, 'public');
	const manifest = JSON.parse(await readFile(join(publicDir, 'manifest.json'), 'utf8'));
	await remapModuleImports(publicDir, '/wp-content/themes/conventional-css/public/');
	const loadedStyles = globalThis.document.querySelectorAll('link[rel=stylesheet]');
	const loadedBefore = loadedStyles.length;
	await import(pathToFileURL(join(publicDir, result.entries.frontend.entry)).href);
	const importedCss = (await Promise.all(loadedStyles.slice(loadedBefore).map((link) => readFile(fileURLToPath(link.href), 'utf8')))).join('\n');
	assert.doesNotMatch(importedCss, /duplicate-target/, 'Unconditionally imported conventional styles must not load twice');
	assert.match(importedCss, /conditional-import-proof/, 'Conditional imports must not suppress an unconditional JS import');
	assert.match(importedCss, /reference-import-proof/, '@reference must not suppress a JS import');
	assert.deepEqual(globalThis.dedupStyles, {});
	const css = await readStylesheetGraph(join(publicDir, manifest['applicationBlocksFrontend.css'].split('/public/')[1]));
	const colors = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((match) => match[1].includes('.review-target')).map((match) => match[2].match(/color\s*:\s*(red|blue|#00f)/)?.[1]).filter(Boolean);
	assert.ok(colors.length > 0);
	assert.ok(['blue', '#00f'].includes(colors.at(-1)), `Auto-discovered CSS must retain its cascade: ${css}`);
	const importedStyles = (await Promise.all((await readdir(publicDir, { recursive: true })).filter((name) => name.split('/').at(-1).startsWith('browser-') && name.endsWith('.css')).map((name) => readFile(join(publicDir, name), 'utf8')))).join('\n');
	assert.match(importedStyles, /\.sm\\:p-4\b/, 'Imported Tailwind utilities must include generated responsive classes');
}

async function checkInvalidCssFailsSafely(mode) {
	const root = join(temporary, 'wp-content', 'themes', `invalid-css-${mode}`);
	await mkdir(join(root, 'src'), { recursive: true });
	await mkdir(join(root, 'public'));
	await writeFile(join(root, 'package.json'), '{"name":"invalid-css-fixture"}');
	await writeFile(join(root, 'public', 'sentinel.txt'), 'previous release');
	await writeFile(join(root, 'src', 'admin.js'), 'console.log("admin");');
	await writeFile(join(root, 'src', 'editor.js'), 'console.log("editor");');
	let createPlugins;
	if (mode === 'composition' || mode === 'cycle' || mode === 'css-cycle' || mode === 'tailwind-entry') {
		await writeFile(join(root, 'src', 'frontend.js'), 'import styles from "./a.module.css"; console.log(styles);');
		const a = mode === 'cycle' ? '.item { composes: present from "./b.module.css"; }' : mode === 'css-cycle' ? '@import "./b.module.css"; .item { color: red; }' : mode === 'tailwind-entry' ? '@import "tailwindcss" prefix(tw); .item { color: red; }' : '.item { composes: missing from "./b.module.css"; }';
		const b = mode === 'cycle' ? '.present { composes: item from "./a.module.css"; }' : mode === 'css-cycle' ? '@import "./a.module.css"; .present { color: blue; }' : '.present { color: red; }';
		await writeFile(join(root, 'src', 'a.module.css'), a);
		await writeFile(join(root, 'src', 'b.module.css'), b);
	} else {
		await writeFile(join(root, 'src', 'frontend.js'), 'import "./custom.css"; console.log("frontend");');
		await writeFile(join(root, 'src', 'custom.css'), '.custom { color: red; }');
		createPlugins = () => [{
			name: 'bypass-css-fixture',
			setup(builder) {
				builder.onResolve({ filter: /custom\.css$/ }, ({ path }) => ({ path, namespace: 'bypass-css' }));
				builder.onLoad({ filter: /.*/, namespace: 'bypass-css' }, () => ({ contents: '.custom { color: red; }', loader: 'css' }));
			},
		}];
	}
	const definition = defineThemeBuild({
		root,
		entries: { frontend: 'src/frontend.js', admin: 'src/admin.js', editor: 'src/editor.js' },
		editor: { entry: 'editor', sharing: 'unified' },
		discovery: false,
		responsive: false,
		ssr: false,
		watch: false,
		...(createPlugins && { createPlugins }),
		css: async ({ stage }) => {
			const output = join(stage, 'css');
			await mkdir(output, { recursive: true });
			for (const name of ['applicationBlocksFrontend', 'applicationBlocksEditor', 'applicationAdmin']) {
				await writeFile(join(output, `${name}.css`), '.base { display: block; }');
			}
		},
	});
	await assert.rejects(definition.build({ quiet: true }), mode === 'plugin' ? /Unexpected Bun CSS output for frontend/ : /Bundle failed|Bun build failed for frontend/);
	assert.equal(await readFile(join(root, 'public', 'sentinel.txt'), 'utf8'), 'previous release');
}

async function checkCustomSsrOutput() {
	const root = join(temporary, 'custom-ssr');
	await mkdir(root);
	await writeFile(join(root, 'entry.js'), 'console.log("browser");');
	for (const publish of [false, async () => {}]) {
		let state;
		await defineThemeBuild({
			root,
			publicPrefix: '/custom-ssr/',
			entries: { app: 'entry.js' },
			editor: false,
			css: false,
			responsive: false,
			discovery: false,
			publish,
			ssr: async (context) => {
				state = context;
				await mkdir(context.outdir, { recursive: true });
				await writeFile(join(context.outdir, 'ssr.js'), 'SSR output');
			},
		}).build({ quiet: true });
		assert.equal(state.root, root);
		assert.equal(state.mode, 'production');
		assert.ok(state.result.entries.app);
		assert.equal(state.outdir, join(root, 'public', '.build', 'ssr', 'production'));
		assert.equal(await readFile(join(state.outdir, 'ssr.js'), 'utf8'), 'SSR output');
	}
}

async function checkLowLevelBuild() {
	const root = join(temporary, 'low-level');
	await mkdir(root);
	await writeFile(join(root, 'entry.js'), 'import "./style.css"; console.log("loaded");');
	await writeFile(join(root, 'style.css'), '.low-level-css { color: red; }');
	const result = await build({ root, outdir: 'output', entries: { app: 'entry.js' }, wordpress: false });
	assert.equal(result.entries.app.styles.length, 1);
	assert.equal(result.entries.app.entryStyle, undefined);
	assert.match(await readFile(join(result.outdir, result.entries.app.styles[0]), 'utf8'), /low-level-css/);
}

async function checkExplicitExtraCss(mode = 'lazy') {
	const eager = mode === 'static';
	const name = `extra-css-${mode}`;
	const root = join(temporary, 'wp-content', 'themes', name);
	const scripts = join(root, 'src', 'Blocks', 'assets', 'scripts');
	const assetDir = join(root, 'src', 'Blocks', 'components', 'card', 'assets');
	await mkdir(scripts, { recursive: true });
	await mkdir(assetDir, { recursive: true });
	await writeFile(join(root, 'package.json'), '{"name":"extra-css-fixture","type":"module"}');
	await writeFile(join(root, 'src', 'vendor.css'), '.extra-css-proof { color: purple; }');
	await writeFile(join(assetDir, '..', 'manifest.json'), '{}');
	await writeFile(join(assetDir, 'index.js'), 'import classes from "../../../../vendor.css"; globalThis.cardClasses = classes; globalThis.cardLoaded = true;');
	const importHelper = "import { dynamicImport } from '@eightshift/frontend-libs-tailwind/scripts/helpers';";
	const contexts = [
		"const components = require.context('./../../components', true, /manifest\\.json$/);",
		"const custom = require.context('./../../custom', true, /manifest\\.json$/);",
	];
	await writeFile(join(scripts, 'application-blocks-frontend.js'), [
		importHelper,
		...contexts,
		...(mode === 'static' ? ['import "./../../components/card/assets/index.js";'] : []),
		...(mode === 'bypass' ? ['globalThis.bypassFixture = () => import("./../../components/card/assets/index.js");'] : []),
		'function load(importBasePath, directory) {',
		'  return import(/* webpackMode: "lazy" */ `./../../${importBasePath}/${directory}/assets/index.js`);',
		'}',
		'globalThis.loadFixtureCard = () => load("components", "card");',
		'globalThis.frontendReady();',
	].join('\n'));
	await writeFile(join(scripts, 'application-admin.js'), [
		importHelper,
		...contexts,
		"const componentAssets = require.context('./../../components', true, /assets-admin\\/index\\.js$/);",
		"const customAssets = require.context('./../../custom', true, /assets-admin\\/index\\.js$/);",
		'function load(assetContext, assetPath, importBasePath, directory) {',
		'  return import(/* webpackMode: "lazy" */ `./../../${importBasePath}/${directory}/assets-admin/index.js`);',
		'}',
	].join('\n'));
	await writeFile(join(root, 'src', 'editor.js'), 'console.log("editor");');
	const definition = defineThemeBuild({
		root,
		entries: { frontend: 'src/Blocks/assets/scripts/application-blocks-frontend.js', admin: 'src/Blocks/assets/scripts/application-admin.js', editor: 'src/editor.js' },
		editor: { entry: 'editor', sharing: 'unified', pureJsxGroups: { maxBytes: 4096 } },
		responsive: false,
		ssr: false,
		watch: false,
		extraCss: [{ files: ['src/vendor.css'], keys: ['components/card'], output: 'shared.css' }],
		css: async ({ stage }) => {
			const output = join(stage, 'css');
			await mkdir(output, { recursive: true });
			for (const name of ['applicationBlocksFrontend', 'applicationBlocksEditor', 'applicationAdmin']) {
				await writeFile(join(output, `${name}.css`), '.base { display: block; }');
			}
		},
	});
	const warnings = [];
	const originalWarn = console.warn;
	try {
		console.warn = (...values) => warnings.push(values.join(' '));
		await definition.build({ quiet: true });
	} finally {
		console.warn = originalWarn;
	}
	assert.doesNotMatch(warnings.join('\n'), /Pure JSX grouping disabled: custom plugins/);
	const publicDir = join(root, 'public');
	const manifest = JSON.parse(await readFile(join(publicDir, 'manifest.json'), 'utf8'));
	const publicPrefix = `/wp-content/themes/${name}/public/`;
	const filePrefix = pathToFileURL(`${publicDir}/`).href;
	for (const name of await readdir(publicDir, { recursive: true })) {
		if (name.endsWith('.js')) {
			const path = join(publicDir, name);
			const source = await readFile(path, 'utf8');
			await writeFile(path, source.replaceAll(publicPrefix, filePrefix));
		}
	}
	const entry = await readFile(join(publicDir, manifest['applicationBlocksFrontend.js'].split('/public/')[1]), 'utf8');
	const styles = [{ getAttribute: () => 'shared.css' }];
	let failNextStyle = mode === 'retry';
	const ready = new Promise((resolve) => { globalThis.frontendReady = resolve; });
	globalThis.document = {
		currentScript: { src: pathToFileURL(join(publicDir, manifest['applicationBlocksFrontend.js'].split('/public/')[1])).href },
		querySelector: () => null,
		querySelectorAll: () => styles,
		createElement() {
			const attributes = new Map();
			const link = { setAttribute: (key, value) => attributes.set(key, value), getAttribute: (key) => attributes.get(key), remove: () => styles.splice(styles.indexOf(link), 1) };
			return link;
		},
		head: {
			appendChild(link) {
				if (link.rel === 'stylesheet') {
					styles.push(link);
					queueMicrotask(() => {
						if (failNextStyle) {
							failNextStyle = false;
							link.onerror();
						} else {
							link.onload();
						}
					});
				}
			},
		},
	};
	new Function(entry)();
	let timeout;
	try {
		await Promise.race([ready, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Frontend bootstrap did not load')), 5000); })]);
	} finally {
		clearTimeout(timeout);
	}
	assert.equal(styles.length, 1 + Number(eager), 'Keyed CSS should load early only for eager imports');
	if (mode === 'bypass') await globalThis.bypassFixture();
	if (mode === 'retry') {
		await assert.rejects(globalThis.loadFixtureCard(), /Failed to load stylesheet/);
		assert.equal(styles.length, 1);
	}
	await globalThis.loadFixtureCard();
	assert.equal(globalThis.cardLoaded, true);
	assert.deepEqual(globalThis.cardClasses, {});
	assert.equal(styles.length, 2);
	const mainFile = join(publicDir, manifest['applicationBlocksFrontend.css'].split('/public/')[1]);
	const main = await readStylesheetGraph(mainFile);
	assert.doesNotMatch(await readFile(mainFile, 'utf8'), /@import/, 'An empty emitted bundle must not add CSS requests');
	const extra = await readFile(fileURLToPath(styles[1].href), 'utf8');
	assert.equal((`${main}\n${extra}`.match(/\.extra-css-proof/g) ?? []).length, 1);
}

try {
	await mkdir(join(temporary, 'wp-includes'), { recursive: true });
	await writeFile(join(temporary, 'wp-includes', 'version.php'), "<?php\n$wp_version = '7.0';\n");
	process.env.EIGHTSHIFT_WP_ROOT = temporary;
	for (const publicationLayout of ['flat', 'structured', undefined]) {
		assert.throws(() => defineThemeBuild({ root: temporary, publicationLayout }), /publicationLayout has been removed/);
	}
	const loadedStyles = [];
	globalThis.document = {
		baseURI: 'https://other.test/current/page/',
		querySelector: () => null,
		querySelectorAll: () => loadedStyles,
		createElement() {
			const attributes = new Map();
			return { setAttribute: (key, value) => attributes.set(key, value), getAttribute: (key) => attributes.get(key), remove() {} };
		},
		head: {
			appendChild(link) {
				if (link.rel === 'stylesheet') {
					loadedStyles.push(link);
					queueMicrotask(() => link.onload());
				}
			},
		},
	};
	globalThis.location = { href: 'https://example.test/current/page/' };
	globalThis.Worker = class {
		constructor(url) {
			this.url = url.href;
		}
	};
	globalThis.eightshiftEditorModules = { version: 1, complete() {} };

	const first = await makeTheme('first');
	const initial = await first.build.build({ quiet: true });
	const publicDir = join(first.root, 'public');
	await remapModuleImports(publicDir, first.publicPrefix);
	const manifest = JSON.parse(await readFile(join(publicDir, 'manifest.json'), 'utf8'));
	const mainStyle = join(publicDir, manifest['applicationBlocksFrontend.css'].split('/public/')[1]);
	const stylesheet = await readStylesheetGraph(mainStyle);
	assert.doesNotMatch(await readFile(mainStyle, 'utf8'), /@import/, 'Simple bundled CSS should not add stylesheet requests');
	assert.match(stylesheet, /conventional-css-proof/);
	assert.doesNotMatch(stylesheet, /(?:static|lazy)-css-proof/, 'JavaScript styles must remain separate from conventional CSS');
	const adminStyle = await readStylesheetGraph(join(publicDir, manifest['applicationAdmin.css'].split('/public/')[1]));
	assert.doesNotMatch(adminStyle, /admin-(?:lazy-)?css-proof/);
	await import(`${pathToFileURL(join(publicDir, initial.result.entries.frontend.entry)).href}?run=1`);
	const frontendStyles = (await Promise.all(loadedStyles.map((link) => readFile(fileURLToPath(link.href), 'utf8')))).join('\n');
	assert.match(frontendStyles, /static-css-proof/);
	assert.doesNotMatch(frontendStyles, /lazy-css-proof/, 'Lazy component CSS must not load before its import');
	await import(`${pathToFileURL(join(publicDir, initial.result.entries.admin.entry)).href}?run=1`);
	const browserStyles = (await Promise.all(loadedStyles.map((link) => readFile(fileURLToPath(link.href), 'utf8')))).join('\n');
	assert.match(browserStyles, /admin-css-proof/);
	assert.doesNotMatch(browserStyles, /admin-lazy-css-proof/);
	const lazy = await globalThis.loadLazyFixture();
	await globalThis.loadAdminLazyFixture();
	const lazyStyles = (await Promise.all(loadedStyles.map((link) => readFile(fileURLToPath(link.href), 'utf8')))).join('\n');
	assert.match(lazyStyles, /lazy-css-proof/);
	assert.doesNotMatch(lazyStyles, /nested-css-proof/);
	assert.match(lazyStyles, /admin-lazy-css-proof/);
	await lazy.loadNested();
	assert.equal(globalThis.nestedFixture, true);
	const nestedStyles = (await Promise.all(loadedStyles.map((link) => readFile(fileURLToPath(link.href), 'utf8')))).join('\n');
	assert.match(nestedStyles, /nested-css-proof/);
	await globalThis.loadModuleFixture();
	assert.equal(globalThis.moduleFixture.classes, globalThis.moduleFixture.named);
	assert.equal(globalThis.moduleFixture.leaked, false, 'Imported CSS module classes must not be exported by the parent');
	const moduleStyleFiles = new Set();
	const moduleStyles = (await Promise.all(loadedStyles.map((link) => readStylesheetGraph(fileURLToPath(link.href), moduleStyleFiles)))).join('\n');
	assert.match(moduleStyles, /@layer\s+reset\s*,\s*theme\s*,\s*imported\s*;\s*@import\s+["'][^"']+["']\s+layer\(theme\)/, 'Layer order must precede imported styles');
	assert.match(moduleStyles, /\.px-4\b/, 'Tailwind utilities must remain global');
	assert.match(moduleStyles, /@import\s+["'][^"']+["']\s+layer\(imported\)/, 'CSS import layer conditions must be preserved');
	assert.match(moduleStyles, /\?v=1#test/, 'CSS import query and fragment must be preserved');
	assert.match(moduleStyles, /\.global-import-proof\b/, 'Imported global CSS must remain global');
	assert.match(moduleStyles, /\.global-nested-proof\b/, 'Nested imported global CSS must remain global');
	const image = moduleStyles.match(/url\(["']?(\.\/[^"')]+\.svg\?v=3#mark)/)?.[1];
	assert.ok(image, 'CSS asset URL must preserve its query and fragment');
	const imageStylesheet = (await Promise.all([...moduleStyleFiles].map(async (path) => ({ path, css: await readFile(path, 'utf8') })))).find(({ css }) => css.includes(image));
	assert.ok(imageStylesheet, 'The image URL must belong to a published stylesheet');
	assert.match(await readFile(fileURLToPath(new URL(image, pathToFileURL(imageStylesheet.path))), 'utf8'), /<svg/);
	assert.doesNotMatch(moduleStyles, /\.shared\s*\{/, 'Nested CSS modules must not become global');
	assert.ok(moduleStyles.includes(`.${globalThis.moduleFixture.imported}`), 'Imported CSS module must retain its own scope');
	const moduleNames = globalThis.moduleFixture.classes.split(' ');
	assert.equal(moduleNames.length, 3);
	for (const name of moduleNames) assert.ok(moduleStyles.includes(`.${name}`), `CSS module selector missing: ${name}`);
	assert.match(moduleStyles, /display\s*:\s*flex/);
	await import(`${pathToFileURL(join(publicDir, manifest['applicationBlocksEditor.js'].split('/public/')[1])).href}?run=1`);
	const expectedWorker = `https://example.test${first.publicPrefix}editor/editor-assets/image-analysis-worker-fixture.js`;
	assert.equal(globalThis.frontendFixture.startWorker().url, expectedWorker);
	assert.equal(globalThis.adminFixture.startWorker().url, expectedWorker);
	const editorWorker = globalThis.editorFixture.startWorker().url;
	assert.equal(editorWorker, expectedWorker);
	await access(join(publicDir, 'editor/editor-assets/image-analysis-worker-fixture.js'));
	const firstVersion = globalThis.frontendFixture.version;
	assert.equal(globalThis.adminFixture.version, firstVersion);
	assert.equal(globalThis.editorFixture.version, firstVersion);

	const rebuilt = await first.build.build({ quiet: true });
	await remapModuleImports(publicDir, first.publicPrefix);
	await import(`${pathToFileURL(join(publicDir, rebuilt.result.entries.frontend.entry)).href}?run=2`);
	assert.equal(globalThis.frontendFixture.version, firstVersion);

	const second = await makeTheme('second');
	const other = await second.build.build({ quiet: true });
	await remapModuleImports(join(second.root, 'public'), second.publicPrefix);
	await import(pathToFileURL(join(second.root, 'public', other.result.entries.frontend.entry)).href);
	assert.notEqual(globalThis.frontendFixture.version, firstVersion);

	const structured = await makeTheme('structured', 'unified');
	const structuredResult = await structured.build.build({ quiet: true });
	const structuredPublic = join(structured.root, 'public');
	const structuredManifest = JSON.parse(await readFile(join(structuredPublic, 'manifest.json'), 'utf8'));
	await remapModuleImports(structuredPublic, structured.publicPrefix);
	const structuredStylesStart = loadedStyles.length;
	await import(pathToFileURL(join(structuredPublic, structuredResult.result.entries.frontend.entry)).href);
	const structuredWorker = `https://example.test${structured.publicPrefix}editor/editor-assets/image-analysis-worker-fixture.js`;
	assert.equal(globalThis.frontendFixture.startWorker().url, structuredWorker);
	await import(pathToFileURL(join(structuredPublic, structuredResult.result.entries.admin.entry)).href);
	assert.equal(globalThis.adminFixture.startWorker().url, structuredWorker);
	let structuredStyles = (await Promise.all(loadedStyles.slice(structuredStylesStart).map((link) => readStylesheetGraph(fileURLToPath(link.href))))).join('\n');
	assert.match(structuredStyles, /static-css-proof/);
	assert.doesNotMatch(structuredStyles, /lazy-css-proof/);
	await globalThis.loadLazyFixture();
	structuredStyles = (await Promise.all(loadedStyles.slice(structuredStylesStart).map((link) => readStylesheetGraph(fileURLToPath(link.href))))).join('\n');
	assert.match(structuredStyles, /lazy-css-proof/);
	await globalThis.loadModuleFixture();
	structuredStyles = (await Promise.all(loadedStyles.slice(structuredStylesStart).map((link) => readStylesheetGraph(fileURLToPath(link.href))))).join('\n');
	assert.ok(structuredStyles.includes(`.${globalThis.moduleFixture.imported}`));
	const structuredEditor = structuredManifest['applicationBlocksEditor.js'].slice(structured.publicPrefix.length);
	await import(pathToFileURL(join(structuredPublic, structuredEditor)).href);
	assert.equal(globalThis.editorFixture.startWorker().url, structuredWorker);
	await access(join(structuredPublic, 'editor', 'editor-assets', 'image-analysis-worker-fixture.js'));

	for (const sharing of ['independent', 'native']) {
		const classicStructured = await makeTheme(`structured-${sharing}`, sharing);
		await writeFile(join(classicStructured.root, 'src', 'editor-lazy.js'), 'export const value = "lazy editor loaded";');
		await writeFile(join(classicStructured.root, 'src', 'editor.js'), `${await readFile(join(classicStructured.root, 'src', 'editor.js'), 'utf8')}\nglobalThis.loadEditorFixture = () => import("./editor-lazy.js");`);
		await classicStructured.build.build({ quiet: true, sourcemaps: true });
		const classicPublic = join(classicStructured.root, 'public');
		const classicManifest = JSON.parse(await readFile(join(classicPublic, 'manifest.json'), 'utf8'));
		const classicPath = classicManifest['applicationBlocksEditor.js'].slice(classicStructured.publicPrefix.length);
		const classicScript = await readFile(join(classicPublic, classicPath), 'utf8');
		const sourceMap = classicScript.match(/\/\/# sourceMappingURL=([^\r\n]+)/)?.[1];
		assert.ok(sourceMap);
		await access(fileURLToPath(new URL(sourceMap, pathToFileURL(join(classicPublic, classicPath)))));
		globalThis.document.currentScript = { src: `https://example.test${classicManifest['applicationBlocksEditor.js']}` };
		new Function(classicScript)();
		globalThis.document.currentScript = { src: pathToFileURL(join(classicPublic, classicPath)).href };
		new Function(classicScript)();
		assert.equal((await globalThis.loadEditorFixture()).value, 'lazy editor loaded');
		assert.equal(globalThis.editorFixture.startWorker().url, `https://example.test${classicStructured.publicPrefix}editor/editor-assets/image-analysis-worker-fixture.js`);
	}

	const classic = await makeTheme('classic', 'independent');
	await classic.build.build({ quiet: true });
	const classicPublic = join(classic.root, 'public');
	const classicManifest = JSON.parse(await readFile(join(classicPublic, 'manifest.json'), 'utf8'));
	const classicEntry = await readFile(join(classicPublic, classicManifest['applicationBlocksEditor.js'].split('/public/')[1]), 'utf8');
	globalThis.document.currentScript = { src: `https://example.test${classic.publicPrefix}editor.js` };
	new Function(classicEntry)();
	assert.equal(globalThis.editorFixture.startWorker().url, `https://example.test${classic.publicPrefix}editor/editor-assets/image-analysis-worker-fixture.js`);

	await checkCustomSsrOutput();
	await checkLowLevelBuild();
	await checkInvalidCssFailsSafely('composition');
	await checkInvalidCssFailsSafely('cycle');
	await checkInvalidCssFailsSafely('css-cycle');
	await checkInvalidCssFailsSafely('tailwind-entry');
	await checkInvalidCssFailsSafely('plugin');
	await checkTailwindImports();
	await checkConventionalStyleDedup();
	await checkExplicitExtraCss();
	await checkExplicitExtraCss('static');
	await checkExplicitExtraCss('bypass');
	await checkExplicitExtraCss('retry');
} finally {
	await removeFixture(temporary);
}
