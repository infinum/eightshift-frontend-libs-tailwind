import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateDiscovery } from '../bun/discovery.mjs';
import { eightshiftDiscovery, editorLazyImports } from '../bun/eightshift-discovery.mjs';

async function clean(directory) {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, item.name);
		if (item.isDirectory()) await clean(path);
		else await unlink(path);
	}
	await rmdir(directory);
}

test('context names cannot shadow generated runtime constructors', async () => {
	const root = await mkdtemp(join(await realpath(tmpdir()), 'discovery-names-'));
	try {
		for (const name of ['Map', 'Promise', 'Error']) {
			await assert.rejects(generateDiscovery({ root, output: 'context.mjs', definitions: [{ name, directory: 'items', pattern: /./, mode: 'lazy' }] }), /Invalid or duplicate discovery definition/);
		}
		await generateDiscovery({ root, output: 'context.mjs', definitions: [{ name: 'items', directory: 'items', pattern: /./, mode: 'lazy' }] });
		const { items } = await import(new URL(`file://${join(root, 'context.mjs')}`));
		assert.deepEqual(items.keys(), []);
		await assert.rejects(items('./missing.js'), { code: 'MODULE_NOT_FOUND' });
	} finally {
		await clean(root);
	}
});

test('discovery rewrites calls, preserves context bindings and ignores non-code text', async () => {
	const root = await mkdtemp(join(await realpath(tmpdir()), 'discovery-calls-'));
	try {
		await mkdir(join(root, 'items'));
		await writeFile(join(root, 'items', 'a.json'), '{"value":1}');
		await writeFile(join(root, 'lazy.js'), 'export const value = 1;');
		const path = join(root, 'entry.js');
		let load;
		eightshiftDiscovery({ root, outputDir: 'generated' }).setup({ onLoad(_options, handler) { load = handler; } });
		const inert = `// require.context('./missing', true, /x/)
const text = "import('./missing.js') require.context";
const template = \`import('./also-missing.js')\`;
const regex = /import\\('missing'\\)/;
const jsx = <div>require.context import('./missing.js')</div>;`;
		await writeFile(path, inert);
		assert.equal(await load({ path }), undefined);
		const chunks = new Map();
		const lazy = editorLazyImports({ root, chunks });
		assert.equal(lazy.transformSource(inert, path), inert);
		assert.equal(chunks.size, 0);
		await writeFile(path, `${inert}\nconst context0 = require /* gap */ . context('./items', true, /\\.json$/);\nconst context1 = 1;`);
		const transformed = await load({ path });
		assert.match(transformed.contents, /const context0 = context2;/);
		assert.ok(transformed.contents.includes(inert));
		const generated = transformed.contents.match(/^import .* from ("[^"]+");/)[1];
		assert.match(await readFile(JSON.parse(generated), 'utf8'), /context2/);
		const source = `${inert}\nconst value = import /* gap */ ('./lazy.js');\nconst nested = \`result: \${import('./lazy.js')}\`;`;
		const rewritten = lazy.transformSource(source, path);
		assert.ok(rewritten.includes(inert));
		assert.equal(chunks.size, 1);
		assert.equal((rewritten.match(/import\(new URL/g) ?? []).length, 2);
		await writeFile(path, 'const value = require.context(directory, true, /x/);');
		await assert.rejects(load({ path }), /Unsupported require.context/);
	} finally {
		await clean(root);
	}
});
