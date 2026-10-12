import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const bin = resolve(import.meta.dirname, '../bin/tw-sweep.mjs');
const fixture = resolve(import.meta.dirname, 'fixtures/theme');

const run = (cwd, ...args) => {
	const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });

	return { code: result.status, out: result.stdout, err: result.stderr };
};

const reported = (out) =>
	out
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => line.replace(/:\d+:\d+/, '').replace(/\s+/g, ' '));

test('reports unknown and non-canonical classes from manifests, PHP calls, class attributes and regions, once each and outside comments', () => {
	const { code, out } = run(fixture);

	assert.equal(code, 1);
	assert.deepEqual(reported(out).sort(), [
		'src/Blocks/custom/card/card.php aspect-[5/3] → aspect-5/3',
		'src/Blocks/custom/card/card.php unknown text-lg',
		'src/Blocks/custom/card/card.php unknown text-xs',
		'src/Blocks/custom/card/card.php w-[16px] → w-4',
		'src/Blocks/custom/card/card.php w-[16px] → w-4',
		'src/Blocks/custom/card/card.php w-[16px] → w-4',
		'src/Blocks/custom/card/card.php w-[16px] → w-4',
		'src/Blocks/custom/card/manifest.json aspect-[5/3] → aspect-5/3',
		'src/Blocks/custom/card/manifest.json unknown text-sm',
		'src/Blocks/custom/card/manifest.json w-[16px] → w-4',
		'src/Plugins/Forms.php aspect-[5/3] → aspect-5/3',
		'src/Plugins/Forms.php h-[16px] → h-4',
		'src/Plugins/Forms.php unknown text-xl',
		'src/Plugins/Forms.php w-[16px] → w-4',
	]);
});

test('--write rewrites non-canonical classes, keeps unknown ones and still fails on them', () => {
	const dir = mkdtempSync(join(tmpdir(), 'tw-sweep-'));

	try {
		cpSync(fixture, dir, { recursive: true });

		const { code } = run(dir, '--write', '--entry', resolve(fixture, 'tailwind.css'));
		const php = readFileSync(join(dir, 'src/Blocks/custom/card/card.php'), 'utf8');
		const forms = readFileSync(join(dir, 'src/Plugins/Forms.php'), 'utf8');

		assert.equal(code, 1);
		assert.match(php, /'text-lg w-4'/);
		assert.match(php, /class="card__wrap aspect-5\/3"/);
		assert.match(forms, /\$single = \['aspect-5\/3'\];\n/);
		assert.match(forms, /\$wrapped = Helpers::getTwClasses\(\$attributes, \$manifest, 'h-4'\);\n\/\/ tw-sweep-classes-end/);
		assert.deepEqual(reported(run(dir, '--no-unknown', '--entry', resolve(fixture, 'tailwind.css')).out), []);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('an invalid ignore pattern is a usage error naming the pattern', () => {
	const dir = mkdtempSync(join(tmpdir(), 'tw-sweep-'));

	try {
		cpSync(fixture, dir, { recursive: true });
		writeFileSync(join(dir, 'tw-ignore.json'), '["^js-", "card__("]');

		const { code, err } = run(dir);

		assert.equal(code, 2);
		assert.match(err, /card__\(/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('a tailwind.css that does not import tailwindcss is not used as the entry', () => {
	const dir = mkdtempSync(join(tmpdir(), 'tw-sweep-'));

	try {
		cpSync(fixture, dir, { recursive: true });
		writeFileSync(join(dir, 'tailwind.css'), '@theme {\n\t--text-body-sm: 0.875rem;\n}\n');

		const { code, err } = run(dir);

		assert.equal(code, 2);
		assert.match(err, /imports 'tailwindcss'/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
