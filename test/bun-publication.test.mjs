import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageRelease } from '../bun/release.mjs';
import { preserveAssets } from '../bun/structured-publication.mjs';
import { prepareSharedFonts } from '../bun/shared-fonts.mjs';

const temporary = async () => mkdtemp(join(await realpath(tmpdir()), 'eightshift-publication-'));

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

test('published nested stylesheets retain their relative asset URLs', async () => {
	const root = await temporary();

	try {
		const source = join(root, 'source');
		await mkdir(join(source, 'css', 'images'), { recursive: true });
		await writeFile(join(source, 'app.js'), 'console.log("app");');
		await writeFile(join(source, 'css', 'app.css'), '@import "./reset.css"; .logo { background: url("./images/logo.svg?v=1#icon"); }');
		await writeFile(join(source, 'css', 'reset.css'), '.reset { margin: 0; }');
		await writeFile(join(source, 'css', 'images', 'logo.svg'), '<svg></svg>');

		const { release, manifest } = await packageRelease({
			root: join(root, 'output'),
			files: [
				{ source: join(source, 'app.js'), destination: 'app.js' },
				{ source: join(source, 'css'), destination: 'css' },
			],
			entries: [{ name: 'app', entry: 'app.js', style: 'css/app.css', dependencies: [] }],
		});
		const publishedStyle = new URL(manifest['app.css'], 'https://example.test/public/');
		const css = await readFile(join(release, manifest['app.css']), 'utf8');
		const importUrl = new URL(css.match(/@import\s+["']([^"']+)/)[1], publishedStyle);
		const imageUrl = new URL(css.match(/url\(["']?([^"')]+)/)[1], publishedStyle);

		assert.equal(await readFile(join(release, importUrl.pathname.slice('/public/'.length)), 'utf8'), '.reset { margin: 0; }');
		assert.equal(await readFile(join(release, imageUrl.pathname.slice('/public/'.length)), 'utf8'), '<svg></svg>');
		assert.equal(imageUrl.search, '?v=1');
		assert.equal(imageUrl.hash, '#icon');
	} finally {
		await removeFixture(root);
	}
});

test('release omission cannot remove a bootstrap target', async () => {
	const root = await temporary();
	try {
		await writeFile(join(root, 'entry.js'), 'console.log("entry");');
		await writeFile(join(root, 'style.css'), '.example { color: red; }');
		await writeFile(join(root, 'unused.txt'), 'unused');
		const options = {
			root: join(root, 'output'),
			files: ['entry.js', 'style.css', 'unused.txt'].map((name) => ({ source: join(root, name), destination: name })),
			entries: [{ name: 'app', entry: 'entry.js', style: 'style.css', dependencies: [] }],
		};
		await assert.rejects(packageRelease({ ...options, omit: ['entry.js'] }), /Cannot omit a script bootstrap target/);
		const allowed = await packageRelease({ ...options, omit: ['unused.txt'] });
		assert.ok((await readdir(allowed.release)).includes('entry.js'));
		assert.ok(!(await readdir(allowed.release)).includes('unused.txt'));
		const custom = await packageRelease({ ...options, entries: [{ ...options.entries[0], script: 'console.log("standalone");' }], omit: ['entry.js'] });
		assert.ok(!(await readdir(custom.release)).includes('entry.js'));
	} finally {
		await removeFixture(root);
	}
});

test('structured stylesheet assets retain valid relative URLs', async () => {
	const root = await temporary();

	try {
		const output = join(root, 'output');
		const nested = join(output, 'frontend', 'chunks');
		await mkdir(join(nested, 'assets'), { recursive: true });
		await writeFile(join(nested, 'style.css'), '.a { background: url(./assets/a.svg?size=1#icon); }');
		await writeFile(join(nested, 'assets', 'a.svg'), '<svg></svg>');
		const flat = join(root, 'structured');
		await preserveAssets({ outdir: output, flatDir: flat, directories: ['frontend'] });
		const css = await readFile(join(flat, 'frontend/chunks/style.css'), 'utf8');
		const url = new URL(css.match(/url\(["']?([^"')]+)/)[1], 'https://example.test/public/frontend/chunks/style.css');

		assert.equal(await readFile(join(flat, url.pathname.slice('/public/'.length)), 'utf8'), '<svg></svg>');
		assert.equal(url.search, '?size=1');
		assert.equal(url.hash, '#icon');
	} finally {
		await removeFixture(root);
	}
});

test('shared font extraction preserves conditional faces in their original stylesheet', async () => {
	const root = await temporary();

	try {
		const assets = join(root, 'node_modules', '@eightshift', 'ui-components', 'dist', 'assets');
		const flat = join(root, 'build', 'flat');
		await mkdir(join(assets, 'fonts'), { recursive: true });
		await mkdir(flat, { recursive: true });
		await writeFile(join(root, 'package.json'), '{"name":"font-fixture"}');
		await writeFile(join(assets, '..', '..', 'package.json'), JSON.stringify({ name: '@eightshift/ui-components', exports: { './dist/assets/style.css': './dist/assets/style.css' } }));
		await writeFile(join(assets, 'style.css'), '');
		const font = Buffer.from('fixture font bytes');
		const hash = createHash('sha256').update(font).digest('hex');
		await writeFile(join(assets, 'fonts', 'fixture.woff2'), font);
		await writeFile(join(assets, 'fonts-manifest.json'), JSON.stringify({ version: 1, fonts: [{ hash, file: 'fonts/fixture.woff2' }], css: '' }));
		await writeFile(join(flat, 'font.woff2'), font);
		await writeFile(join(flat, 'app.css'), '@font-face { font-family: Standard; src: url("./font.woff2"); }\n@media (prefers-color-scheme: dark) { @font-face { font-family: Conditional; src: url("./font.woff2"); } }\n@supports (display: grid) { @font-face { font-family: Supported; src: url("./font.woff2"); } }');
		const lazyCss = '@font-face { font-family: Lazy; src: url("./font.woff2"); }';
		await writeFile(join(flat, 'lazy.css'), lazyCss);

		const retainedStyles = new Set(['lazy.css']);
		await prepareSharedFonts({ root, flatDir: flat, retainedStyles });
		const stylesheet = await readFile(join(flat, 'app.css'), 'utf8');
		const manifest = JSON.parse(await readFile(join(root, 'build', 'shared-fonts.json'), 'utf8'));

		assert.match(stylesheet, /@media\s*\(prefers-color-scheme: dark\)\s*\{\s*@font-face\s*\{[^}]*font-family:\s*Conditional/);
		assert.match(stylesheet, /@supports\s*\(display: grid\)\s*\{\s*@font-face\s*\{[^}]*font-family:\s*Supported/);
		assert.doesNotMatch(stylesheet, /font-family:\s*Standard/);
		assert.match(manifest.css, /font-family:\s*Standard/);
		assert.doesNotMatch(manifest.css, /font-family:\s*(Conditional|Supported|Lazy)/);
		assert.equal(await readFile(join(flat, 'lazy.css'), 'utf8'), lazyCss);

		await prepareSharedFonts({ root, flatDir: flat, retainedStyles });
		const conditionalOnly = JSON.parse(await readFile(join(root, 'build', 'shared-fonts.json'), 'utf8'));
		assert.equal(await readFile(join(flat, 'app.css'), 'utf8'), stylesheet);
		assert.deepEqual(conditionalOnly.fonts, []);
		assert.equal(conditionalOnly.css, '');
	} finally {
		await removeFixture(root);
	}
});
