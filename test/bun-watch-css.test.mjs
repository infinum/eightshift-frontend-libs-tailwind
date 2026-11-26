import assert from 'node:assert/strict';
import { renameSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { defineBuild } from '../bun/index.mjs';
import { importSignature, outputStamp, quickCss, sourceSnapshot } from '../bun/watch-css.mjs';

for (const timing of ['before the stamp check', 'after the stamp check']) {
	test(`a CSS edit falls back to a full build when public output disappears ${timing}`, async (t) => {
		const root = await mkdtemp(join(tmpdir(), 'watch-css-'));
		t.after(() => rm(root, { recursive: true, force: true }));
		const target = join(root, 'src', 'style.css');
		const entry = join(root, 'src', 'entry.js');
		const publicDir = join(root, 'public');
		const watchSources = ['src'];
		await mkdir(join(root, 'src'));
		await mkdir(publicDir);
		await writeFile(join(publicDir, 'manifest.json'), '{}');
		await writeFile(target, '.fixture { display: block; }');
		await writeFile(entry, 'export const fixture = true;');
		const stamp = outputStamp(root);
		assert.ok(stamp);
		const previous = {
			stamp,
			imports: new Map([[target, await importSignature(target)]]),
			sources: sourceSnapshot(root, watchSources),
			excluded: new Set(),
			css: new Set([target]),
		};

		const removePublic = () => renameSync(publicDir, join(root, 'removed-public'));
		if (timing === 'before the stamp check') {
			removePublic();
		} else {
			// This lookup runs after the first stamp check, before staging reads the manifest.
			previous.imports.get = (file) => {
				removePublic();
				return Map.prototype.get.call(previous.imports, file);
			};
		}

		await writeFile(target, '.fixture { display: grid; }');
		const changes = { paths: [target] };
		const builder = defineBuild({
			root,
			preset: (context) => {
				assert.equal(context.changes, changes);
				return { entries: { fixture: entry }, outdir: 'output', wordpress: false };
			},
			watchCss: (context) => quickCss({ root, changes: context.changes, watchSources, previous, commit: () => assert.fail('Missing outputs must not be committed') }),
		});
		assert.ok((await builder.build({ quiet: true }, new Map(), changes)).result);
	});
}
