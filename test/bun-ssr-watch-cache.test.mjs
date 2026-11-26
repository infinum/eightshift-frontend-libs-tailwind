import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildWatchSsr } from '../bun/ssr-watch-cache.mjs';

test('SSR watch rebuilds when a logging macro reads an edited file outside the import graph', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'ssr-watch-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const entry = join(root, 'src/example/assets-ssr');
	const data = join(root, 'src/data.txt');
	const outdir = join(root, 'output');
	await mkdir(entry, { recursive: true });
	await writeFile(join(entry, 'ssr.js'), 'import { value } from "./macro.js" with { type: "macro" }; export default value();');
	await writeFile(join(entry, 'macro.js'), 'import { readFileSync } from "node:fs"; export function value() { console.log("Reading SSR macro input"); return readFileSync("src/data.txt", "utf8"); }');
	await writeFile(data, 'initial-macro-value');

	const options = { root, outdir, mode: 'development', watchSession: new Map() };
	await buildWatchSsr(options);
	assert.match(await readFile(join(outdir, 'example.js'), 'utf8'), /initial-macro-value/);

	await writeFile(data, 'updated-macro-value');
	await buildWatchSsr({ ...options, changes: { paths: [data] } });
	const output = await readFile(join(outdir, 'example.js'), 'utf8');
	assert.match(output, /updated-macro-value/);
	assert.doesNotMatch(output, /initial-macro-value/);
});
