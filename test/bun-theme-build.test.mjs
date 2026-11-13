import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

test('theme builds preserve imported styles, worker URLs and isolated stable store IDs', () => {
	const fixture = resolve(import.meta.dirname, 'fixtures/theme-build-regressions.mjs');
	const result = spawnSync('bun', [fixture], { encoding: 'utf8', timeout: 120000 });

	assert.ifError(result.error);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
