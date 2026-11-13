import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function removeFixture(directory) {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, item.name);
		if (item.isDirectory()) await removeFixture(path);
		else await unlink(path);
	}
	await rmdir(directory);
}

test('WordPress side-effect scripts retain their handles without requiring globals', async () => {
	const root = await mkdtemp(join(await realpath(tmpdir()), 'wordpress-side-effects-'));
	try {
		await mkdir(join(root, 'wp-includes/js/dist'), { recursive: true });
		await mkdir(join(root, 'node_modules'));
		await writeFile(join(root, 'wp-includes/js/dist/format-library.js'), '(function () { registerFormats(); })();');
		await writeFile(join(root, 'wp-includes/js/dist/data.js'), 'var index_exports = {};\n__export(index_exports, {\n select: () => select\n});\nreturn __toCommonJS(index_exports);');
		await writeFile(join(root, 'wp-includes/js/dist/broken.js'), 'var index_exports = {}; // unsupported export structure');
		await writeFile(join(root, 'entry.js'), 'import "@wordpress/format-library"; import { select } from "@wordpress/data"; globalThis.result = select();');
		for (const name of ['api-fetch', 'dom-ready', 'server-side-render', 'namespace-default']) {
			const property = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
			const unwrap = name !== 'namespace-default' ? `\nif (typeof wp.${property} === 'object' && wp.${property}.default) { wp.${property} = wp.${property}.default; }` : '';
			await writeFile(join(root, `wp-includes/js/dist/${name}.js`), `var index_exports = {};\n__export(index_exports, {\n default: () => implementation,\n helper: () => helper\n});\nreturn __toCommonJS(index_exports);${unwrap}`);
		}
		await writeFile(join(root, 'defaults.js'), 'import apiFetch from "@wordpress/api-fetch"; import domReady from "@wordpress/dom-ready"; import render, { helper } from "@wordpress/server-side-render"; import namespaced from "@wordpress/namespace-default"; globalThis.defaults = [apiFetch(), domReady(), render(), helper(), namespaced()];');
		await writeFile(join(root, 'absent.js'), 'import "@wordpress/absent";');
		await writeFile(join(root, 'bundled.js'), 'import "@wordpress/icons";');
		await writeFile(join(root, 'side-only.js'), 'import "@wordpress/format-library";');
		await writeFile(join(root, 'invalid.js'), 'import { missing } from "@wordpress/format-library"; console.log(missing);');
		await writeFile(join(root, 'broken.js'), 'import "@wordpress/broken";');
		const adapter = pathToFileURL(resolve(import.meta.dirname, '../bun/wordpress.mjs')).href;
		const script = `
import assert from 'node:assert/strict';
import { wordpressPlugin } from ${JSON.stringify(adapter)};
const root = ${JSON.stringify(root)};
for (const minify of [false, true]) {
 const wp = wordpressPlugin({ projectRoot: root, wpRoot: root });
 const result = await Bun.build({ entrypoints: [root + '/entry.js'], target: 'browser', format: 'esm', write: false, minify, metafile: true, plugins: [wp.plugin] });
 assert.equal(result.success, true);
 assert.deepEqual(wp.getEmittedDependencies(result.metafile), ['wp-data', 'wp-format-library']);
 assert.deepEqual(wp.getEmittedDependencies({ outputs: { 'empty.js': { inputs: {} } } }), ['wp-format-library']);
 globalThis.wp = { data: { select: () => 'ok' } };
 const code = await result.outputs[0].text();
 new Function(code)();
 assert.equal(globalThis.result, 'ok');
 delete globalThis.wp;
 assert.throws(() => new Function(code)(), /Missing WordPress global/);
}
const only = wordpressPlugin({ projectRoot: root, wpRoot: root });
const sideOnly = await Bun.build({ entrypoints: [root + '/side-only.js'], target: 'browser', format: 'esm', minify: true, write: false, metafile: true, plugins: [only.plugin] });
assert.equal(sideOnly.success, true);
assert.deepEqual(only.getEmittedDependencies(sideOnly.metafile), ['wp-format-library']);
new Function(await sideOnly.outputs[0].text())();
const defaults = wordpressPlugin({ projectRoot: root, wpRoot: root });
const built = await Bun.build({ entrypoints: [root + '/defaults.js'], target: 'browser', format: 'esm', write: false, metafile: true, plugins: [defaults.plugin] });
assert.equal(built.success, true);
globalThis.wp = { apiFetch: () => 'api', domReady: () => 'ready', serverSideRender: Object.assign(() => 'render', { helper: () => 'helper' }), namespaceDefault: { default: () => 'namespace' } };
new Function(await built.outputs[0].text())();
assert.deepEqual(globalThis.defaults, ['api', 'ready', 'render', 'helper', 'namespace']);
assert.deepEqual(defaults.getEmittedDependencies(built.metafile), ['wp-api-fetch', 'wp-dom-ready', 'wp-namespace-default', 'wp-server-side-render']);
delete globalThis.wp;
for (const entry of ['invalid', 'broken', 'absent', 'bundled']) {
 const wp = wordpressPlugin({ projectRoot: root, wpRoot: root });
 let failed = false;
 try { const result = await Bun.build({ entrypoints: [root + '/' + entry + '.js'], target: 'browser', format: 'esm', write: false, plugins: [wp.plugin] }); failed = !result.success; } catch { failed = true; }
 assert.equal(failed, true, entry + ' must fail');
}
`;
		const result = spawnSync('bun', ['--no-install', '--eval', script], { encoding: 'utf8', timeout: 30000 });
		assert.ifError(result.error);
		assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	} finally {
		await removeFixture(root);
	}
});
