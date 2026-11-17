import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function removeFixture(directory) {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, item.name);
		if (item.isDirectory()) await removeFixture(path);
		else await unlink(path);
	}
	await rmdir(directory);
}

async function write(path, contents) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, contents);
}

async function packageFixture(root) {
	const pkg = join(root, 'node_modules', '@fixture', 'library');
	await write(join(pkg, 'package.json'), JSON.stringify({
		name: '@fixture/library',
		exports: {
			'./styles': './styles.css',
			'./lazy': './lazy.css',
			'./module': './component.module.css',
			'./js': './plain.js',
			'./conditional-js': { browser: './browser.js', default: './fallback.css' },
			'./conditional-css': { browser: './browser.css', default: './plain.js' },
			'./aliased-js': './fallback.css',
			'./node-only': { node: './node-only.css' },
		},
	}));
	await write(join(pkg, 'styles.css'), '.package-style-proof { color: red; }');
	await write(join(pkg, 'lazy.css'), '.package-lazy-proof { color: blue; }');
	await write(join(pkg, 'component.module.css'), '.badge { color: purple; }');
	await write(join(pkg, 'plain.js'), 'export const value = "normal-js";');
	await write(join(pkg, 'browser.js'), 'export const value = "browser-js";');
	await write(join(pkg, 'browser.css'), '.browser-style-proof { color: orange; }');
	await write(join(pkg, 'fallback.css'), '.wrong-style-proof { color: pink; }');
	await write(join(pkg, 'node-only.css'), '.node-only-proof { color: pink; }');
}

async function checkTheme(root) {
	const { defineThemeBuild } = await import('../bun/theme-build.mjs');
	await packageFixture(root);
	await write(join(root, 'package.json'), '{"name":"css-regression-theme","type":"module"}');
	await write(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@design': ['./style.css'], '@design-parts/*': ['./src/styles/*.css'], '@fixture/library/aliased-js': ['./src/aliased.js'] } } }));
	await write(join(root, 'style.css'), '.tsconfig-style-proof { color: green; }');
	await write(join(root, 'src/styles/lazy.css'), '.tsconfig-lazy-proof { color: teal; }');
	await write(join(root, 'src/aliased.js'), 'export const value = "tsconfig-js";');
	await write(join(root, 'wp-includes/version.php'), "<?php\n$wp_version = '7.0';\n");
	await write(join(root, 'wp-includes/js/dist/data.js'), 'var index_exports = {};\n__export(index_exports, {\n select: () => select\n});\nreturn __toCommonJS(index_exports);');
	await write(join(root, 'node_modules/@wordpress/data/package.json'), '{"name":"@wordpress/data","exports":"./fallback.css"}');
	await write(join(root, 'node_modules/@wordpress/data/fallback.css'), '.wordpress-fallback { color: red; }');
	await write(join(root, 'src/frontend.js'), [
		'import "@fixture/library/styles?revision=2#theme";',
		'import "@eightshift/ui-components/styles-no-fonts";',
		'import "@design";',
		'import styles, { badge } from "@fixture/library/module";',
		'import { value } from "@fixture/library/js";',
		'import { value as aliased } from "@fixture/library/aliased-js";',
		'import { value as conditional } from "@fixture/library/conditional-js";',
		'import "@fixture/library/conditional-css";',
		'import { select } from "@wordpress/data";',
		'import { pluginValue } from "virtual:theme-plugin";',
		'globalThis.cssRegression = { styles, badge, value, aliased, conditional, wordpress: select(), pluginValue };',
		'globalThis.loadCssRegression = () => import("./lazy.js");',
	].join('\n'));
	await write(join(root, 'src/lazy.js'), 'import "@fixture/library/lazy"; import "@design-parts/lazy"; export const loaded = true;');
	await write(join(root, 'src/admin.js'), 'import "@fixture/library/styles"; globalThis.cssAdminLoaded = true;');
	await write(join(root, 'src/editor.js'), 'console.log("editor");');
	const prefix = '/fixture-css/public/';
	process.env.EIGHTSHIFT_WP_ROOT = root;
	const definition = defineThemeBuild({
		root,
		publicPrefix: prefix,
		entries: { frontend: 'src/frontend.js', admin: 'src/admin.js', editor: 'src/editor.js' },
		editor: { entry: 'editor', sharing: 'unified' },
		discovery: false,
		responsive: false,
		ssr: false,
		watch: false,
		createPlugins: () => [{
			name: 'fixture-plugin',
			setup(builder) {
				builder.onResolve({ filter: /^virtual:theme-plugin$/ }, () => ({ path: 'theme', namespace: 'fixture-plugin' }));
				builder.onLoad({ filter: /.*/, namespace: 'fixture-plugin' }, () => ({ contents: 'export const pluginValue = "plugin-js";', loader: 'js' }));
			},
		}],
		css: async ({ stage }) => {
			for (const name of ['applicationBlocksFrontend', 'applicationBlocksEditor', 'applicationAdmin']) {
				await write(join(stage, 'css', `${name}.css`), '.conventional-proof { display: block; }');
			}
		},
	});
	const built = await definition.build({ quiet: true });
	assert.ok(built.result.entries.frontend.dependencies.includes('wp-data'));
	const publicDir = join(root, 'public');
	const filePrefix = pathToFileURL(`${publicDir}/`).href;
	for (const name of await readdir(publicDir, { recursive: true })) {
		if (name.endsWith('.js')) {
			const path = join(publicDir, name);
			await writeFile(path, (await readFile(path, 'utf8')).replaceAll(prefix, filePrefix));
		}
	}
	const loaded = [];
	globalThis.location = { href: 'https://example.test/' };
	globalThis.wp = { data: { select: () => 'wordpress-js' } };
	globalThis.document = {
		createElement: () => ({ remove() {} }),
		head: { appendChild(link) { loaded.push(link); queueMicrotask(() => link.onload()); } },
	};
	await import(pathToFileURL(join(publicDir, built.result.entries.frontend.entry)).href);
	assert.equal(globalThis.cssRegression.value, 'normal-js');
	assert.equal(globalThis.cssRegression.aliased, 'tsconfig-js');
	assert.equal(globalThis.cssRegression.conditional, 'browser-js');
	assert.equal(globalThis.cssRegression.wordpress, 'wordpress-js');
	assert.equal(globalThis.cssRegression.pluginValue, 'plugin-js');
	assert.equal(globalThis.cssRegression.badge, globalThis.cssRegression.styles.badge);
	assert.ok(loaded.some((link) => link.href.endsWith('?revision=2#theme')));
	let css = (await Promise.all(loaded.map((link) => readFile(fileURLToPath(link.href), 'utf8')))).join('\n');
	assert.match(css, /package-style-proof/);
	assert.match(css, /tsconfig-style-proof/);
	assert.match(css, /--es-uic-/);
	assert.match(css, /browser-style-proof/);
	assert.doesNotMatch(css, /wrong-style-proof|package-lazy-proof|tsconfig-lazy-proof/);
	assert.ok(css.includes(`.${globalThis.cssRegression.badge}`));
	assert.equal((await globalThis.loadCssRegression()).loaded, true);
	css = (await Promise.all(loaded.map((link) => readFile(fileURLToPath(link.href), 'utf8')))).join('\n');
	assert.match(css, /package-lazy-proof/);
	assert.match(css, /tsconfig-lazy-proof/);
	await import(pathToFileURL(join(publicDir, built.result.entries.admin.entry)).href);
	assert.equal(globalThis.cssAdminLoaded, true);
}

async function checkResolution(root) {
	const { browserCssPlugin } = await import('../bun/browser-css.mjs');
	await packageFixture(root);
	await write(join(root, 'package.json'), '{"name":"css-resolver-fixture"}');
	await write(join(root, 'local.css'), '.local { color: red; }');
	await write(join(root, 'entry.js'), 'import "@fixture/library/styles"; import "./local.css"; import { value } from "virtual:later"; globalThis.result = value;');
	const outdir = join(root, 'out');
	let handled = false;
	const later = {
		name: 'later-plugin',
		setup(builder) {
			builder.onResolve({ filter: /^virtual:later$/ }, () => { handled = true; return { path: 'later', namespace: 'later' }; });
			builder.onLoad({ filter: /.*/, namespace: 'later' }, () => ({ contents: 'export const value = "handled";', loader: 'js' }));
		},
	};
	const plugin = () => browserCssPlugin({ root, outdir, conventionalCss: new Map(), extraCssByFile: new Map(), responsiveFiles: {}, retainedStyles: new Set() });
	const result = await Bun.build({
		entrypoints: [join(root, 'entry.js')],
		outdir: join(outdir, 'frontend'),
		target: 'browser',
		format: 'esm',
		write: false,
		external: ['@fixture/library/*', './local.css'],
		plugins: [plugin(), later],
	});
	assert.equal(result.success, true, result.logs.map(String).join('\n'));
	assert.equal(handled, true);
	const output = await result.outputs[0].text();
	assert.match(output, /@fixture\/library\/styles/);
	assert.doesNotMatch(output, /loadStylesheet/);
	const baseline = await Bun.build({
		entrypoints: [join(root, 'entry.js')], outdir: join(outdir, 'frontend'), target: 'browser', format: 'esm', write: false,
		external: ['@fixture/library/*', './local.css'], plugins: [later],
	});
	assert.deepEqual(await Promise.all(result.outputs.map((item) => item.text())), await Promise.all(baseline.outputs.map((item) => item.text())));
	await write(join(root, 'tsconfig-special.json'), JSON.stringify({ compilerOptions: { paths: { '@custom-css': ['./local.css'] } } }));
	await write(join(root, 'custom-tsconfig.js'), 'import "@custom-css";');
	const customTsconfig = await Bun.build({
		entrypoints: [join(root, 'custom-tsconfig.js')], outdir: join(outdir, 'frontend'), target: 'browser', format: 'esm', write: false,
		tsconfig: join(root, 'tsconfig-special.json'), plugins: [plugin()],
	});
	assert.equal(customTsconfig.success, true, customTsconfig.logs.map(String).join('\n'));
	assert.match(await customTsconfig.outputs[0].text(), /loadStylesheet/);
	const virtual = {
		name: 'virtual-entry',
		setup(builder) {
			builder.onResolve({ filter: /^virtual-entry$/ }, () => ({ path: 'virtual-entry', namespace: 'virtual-entry' }));
			builder.onLoad({ filter: /.*/, namespace: 'virtual-entry' }, () => ({ contents: 'import "@eightshift/ui-components/styles-no-fonts";', loader: 'js', resolveDir: root }));
		},
	};
	const virtualBuild = await Bun.build({ entrypoints: ['virtual-entry'], outdir: join(outdir, 'frontend'), target: 'browser', write: false, plugins: [virtual, plugin()] });
	assert.equal(virtualBuild.success, true, virtualBuild.logs.map(String).join('\n'));
	assert.match(await virtualBuild.outputs[0].text(), /loadStylesheet/);
	const errorsFrom = async (entry) => {
		try {
			const result = await Bun.build({ entrypoints: [join(root, entry)], outdir: join(outdir, 'frontend'), target: 'browser', write: false, plugins: [plugin()] });
			assert.equal(result.success, false);
			return result.logs.map(String).join('\n');
		} catch (error) {
			if (error instanceof assert.AssertionError) throw error;
			return [error, ...(error.errors ?? [])].map(String).join('\n');
		}
	};
	await write(join(root, 'unresolved.js'), 'import "@missing/not-installed";');
	assert.match(await errorsFrom('unresolved.js'), /@missing\/not-installed/);
	await write(join(root, 'required.js'), 'require("@fixture/library/styles");');
	assert.match(await errorsFrom('required.js'), /CSS imported through require\(\)/);
	assert.match(Bun.resolveSync('@fixture/library/node-only', root), /node-only\.css$/);
	await write(join(root, 'node-only.js'), 'import "@fixture/library/node-only";');
	assert.match(await errorsFrom('node-only.js'), /@fixture\/library\/node-only/);
}

async function checkAssets(root) {
	const { processCss } = await import('../bun/css.mjs');
	const postcss = (await import('postcss')).default;
	const valueParser = (await import('postcss-value-parser')).default;
	await write(join(root, 'plain.png'), 'plain-image');
	await write(join(root, 'my image.png'), 'space-image');
	await write(join(root, 'literal%20.png'), 'percent-image');
	await write(join(root, 'hash#image.png'), 'hash-image');
	const source = String.raw`
.plain { background-image: url(./plain.png?size=2#mark); }
.escaped { background-image: url(./my\ image.png?size=2#mark); }
.hex { background-image: url(./my\20 image.png); }
.longhex { background-image: url("./my\000020image.png"); }
.percent { background-image: url(./my%20image.png); }
.escaped-percent { background-image: url(./my\25 20image.png); }
.encoded-percent { background-image: url(./literal%2520.png); }
.encoded-hash { background-image: url(./hash%23image.png?x=1#frag); }
.images { background-image: image-set("./my\20 image.png" 1x, url(./plain.png) 2x); }
.external { background-image: url(\68 ttps://example.test/icon.png), url(\/static/icon.png), url(\23 icon); }
`;
	await write(join(root, 'input.css'), source);
	const output = join(root, 'output', 'app.css');
	const result = await processCss({ projectDir: root, files: ['input.css'], outputFile: output });
	const tree = postcss.parse(await readFile(output, 'utf8'));
	const urls = new Map();
	tree.walkRules((rule) => rule.walkDecls((decl) => {
		const found = [];
		valueParser(decl.value).walk((node) => {
			if (node.type === 'function' && node.value === 'url') {
				found.push(node.nodes[0].value);
				return false;
			}
			if (node.type === 'string') found.push(node.value);
		});
		urls.set(rule.selector, found);
	}));
	for (const [selector, expected] of Object.entries({
		'.plain': 'plain-image', '.escaped': 'space-image', '.hex': 'space-image', '.longhex': 'space-image',
		'.percent': 'space-image', '.escaped-percent': 'space-image', '.encoded-percent': 'percent-image', '.encoded-hash': 'hash-image',
	})) {
		const href = urls.get(selector)?.[0];
		assert.ok(href, `Missing URL for ${selector}`);
		assert.equal(await readFile(fileURLToPath(new URL(href, pathToFileURL(output))), 'utf8'), expected);
	}
	assert.deepEqual(urls.get('.images').length, 2);
	assert.equal(await readFile(fileURLToPath(new URL(urls.get('.images')[0], pathToFileURL(output))), 'utf8'), 'space-image');
	for (const selector of ['.plain', '.escaped']) assert.match(urls.get(selector)[0], /\?size=2#mark$/);
	assert.match(urls.get('.encoded-hash')[0], /\?x=1#frag$/);
	assert.equal(urls.get('.external').length, 3);
	for (const name of ['plain.png', 'my image.png', 'literal%20.png', 'hash#image.png']) assert.ok(result.dependencies.includes(join(root, name)));
	await write(join(root, 'invalid.css'), '.invalid { background: url(./bad%ZZ.png); }');
	await assert.rejects(processCss({ projectDir: root, files: ['invalid.css'], outputFile: output }), /Invalid percent encoding in CSS asset URL/);
}

const checks = { theme: checkTheme, resolution: checkResolution, assets: checkAssets };

if (process.versions.bun && Object.hasOwn(checks, process.argv[2])) {
	const root = resolve('test', `.bun-css-regressions-${randomUUID()}`);
	await mkdir(root);
	try {
		await checks[process.argv[2]](root);
	} finally {
		await removeFixture(root);
	}
} else {
	for (const name of Object.keys(checks)) {
		test(`Bun CSS regression: ${name}`, () => {
			const result = spawnSync('bun', ['--no-install', fileURLToPath(import.meta.url), name], { encoding: 'utf8', timeout: 120000 });
			assert.ifError(result.error);
			assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
		});
	}
}
