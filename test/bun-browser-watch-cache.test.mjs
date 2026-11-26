import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { browserWatchCache } from '../bun/browser-watch-cache.mjs';

test('browser watch reuses a bundle only when the edited file is unrelated', async () => {
	const temp = await mkdtemp(resolve(tmpdir(), 'browser-watch-'));

	try {
		const root = await realpath(temp);
		const editor = (name) => resolve(root, 'src/Blocks/custom', name, 'components', `${name}-editor.js`);
		const dependency = editor('dependency');
		const dependencyAlias = resolve(root, 'dependency.js');
		const unrelated = editor('unused');
		const entryPath = resolve(root, 'entry.js');
		const built = resolve(root, 'built');
		const output = 'export const value = 1;';

		for (const path of [dependency, unrelated, entryPath, resolve(built, 'browser.js'), resolve(built, 'browser.asset.json')]) {
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, path.endsWith('.json') ? '{}' : output);
		}

		// Capture rejects direct editor inputs, but a dependency alias can point to one.
		await symlink(dependency, dependencyAlias);

		const options = { root, watchSession: new Map(), signature: () => 'test', report: () => {} };
		const initial = await browserWatchCache(options);
		const entry = { file: 'browser.js' };
		await initial.capture('browser', built, entry, { metafile: { inputs: { [entryPath]: {}, [dependencyAlias]: {} } } }, [{ path: 'browser.js', item: { size: output.length } }], entryPath, '/build/');

		const edit = async (path) => {
			await writeFile(path, 'export const value = 2;');
			return browserWatchCache({ ...options, changes: { paths: [path], structural: false, unknown: false } });
		};

		const reused = resolve(root, 'reused');
		assert.deepEqual(await (await edit(unrelated)).restore('browser', reused), entry);
		assert.equal(await readFile(resolve(reused, 'browser.js'), 'utf8'), output);

		const invalidated = resolve(root, 'invalidated');
		assert.equal(await (await edit(dependency)).restore('browser', invalidated), undefined);
		await assert.rejects(readFile(resolve(invalidated, 'browser.js')), { code: 'ENOENT' });
	} finally {
		await rm(temp, { recursive: true });
	}
});
