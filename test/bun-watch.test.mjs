import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { basename, dirname, resolve, sep } from 'node:path';

if (typeof Bun !== 'undefined') {
	const { mock } = await import('bun:test');
	const originalExports = { ...await import('node:fs') };
	mock.module('node:fs', () => ({
		...fs,
		default: fs,
		lstatSync: (...args) => fs.lstatSync(...args),
		readdirSync: (...args) => fs.readdirSync(...args),
		statSync: (...args) => fs.statSync(...args),
		watch: (...args) => fs.watch(...args),
	}));
	after(() => mock.module('node:fs', () => originalExports));
}

const { watchBuild } = await import('../bun/watch.mjs');

function fixture(t, { onReadDirectory } = {}) {
	const root = resolve('watch-test-virtual-root');
	const nodes = new Map();
	const watchers = [];
	const handles = [];
	const errors = [];
	const originals = { lstatSync: fs.lstatSync, readdirSync: fs.readdirSync, statSync: fs.statSync, watch: fs.watch };
	let clock = 1;
	let inode = 1;

	const add = (name, directory) => {
		const path = resolve(root, name);
		const previous = nodes.get(path);
		const time = ++clock;
		nodes.set(path, { directory, dev: 1, ino: previous?.ino ?? inode++, mode: directory ? 0o40755 : 0o100644, size: directory ? 0 : time, mtimeMs: time, ctimeMs: time });

		if (!previous && path !== root) {
			const parent = nodes.get(dirname(path));
			assert.ok(parent?.directory, `Missing directory for ${path}`);
			parent.mtimeMs = time;
			parent.ctimeMs = time;
		}
	};
	const remove = (name) => {
		const path = resolve(root, name);
		for (const item of nodes.keys()) {
			if (item === path || item.startsWith(`${path}${sep}`)) nodes.delete(item);
		}
		const parent = nodes.get(dirname(path));
		if (parent) parent.mtimeMs = parent.ctimeMs = ++clock;
	};
	const isVirtual = (path) => typeof path === 'string' && (path === root || path.startsWith(`${root}${sep}`));
	const stat = (path) => {
		const node = nodes.get(path);
		if (!node) {
			const error = new Error(`ENOENT: ${path}`);
			error.code = 'ENOENT';
			throw error;
		}
		return { ...node, isDirectory: () => node.directory, isSymbolicLink: () => false };
	};

	add('.', true);
	fs.lstatSync = (path, ...args) => isVirtual(path) ? stat(path) : originals.lstatSync(path, ...args);
	fs.statSync = (path, ...args) => isVirtual(path) ? stat(path) : originals.statSync(path, ...args);
	fs.readdirSync = (path, ...args) => {
		if (!isVirtual(path)) return originals.readdirSync(path, ...args);
		onReadDirectory?.(path, watchers);
		if (!stat(path).isDirectory()) {
			const error = new Error(`ENOTDIR: ${path}`);
			error.code = 'ENOTDIR';
			throw error;
		}
		return [...nodes.keys()].filter((item) => item !== path && dirname(item) === path).map((item) => basename(item));
	};
	fs.watch = (path, options, callback) => {
		if (!isVirtual(path)) return originals.watch(path, options, callback);
		const watcher = new EventEmitter();
		Object.assign(watcher, { path, recursive: options.recursive, callback, closed: false });
		watcher.close = () => { watcher.closed = true; };
		watchers.push(watcher);
		return watcher;
	};
	syncBuiltinESMExports();

	t.after(async () => {
		try {
			for (const handle of handles) await handle.stop();
			assert.deepEqual(errors, []);
		} finally {
			Object.assign(fs, originals);
			syncBuiltinESMExports();
		}
	});

	return {
		root,
		dir: (name) => add(name, true),
		write: (name) => add(name, false),
		remove,
		start: (options) => {
			const handle = watchBuild({ projectDir: root, initial: false, debounce: 5, onError: (error) => errors.push(error), ...options });
			handles.push(handle);
			return handle;
		},
		watcher: (name, recursive) => {
			const active = watchers.filter((watcher) => !watcher.closed && watcher.path === resolve(root, name) && watcher.recursive === recursive);
			assert.equal(active.length, 1, `Expected an active watcher for ${name}, recursive=${recursive}`);
			return active[0];
		},
	};
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const waitFor = async (condition) => {
	for (let attempt = 0; attempt < 100 && !condition(); attempt++) await settle();
	assert.ok(condition(), 'Timed out waiting for build');
};

test('watchers are registered before their initial snapshot', (t) => {
	let watchedDuringScan = false;
	const f = fixture(t, {
		onReadDirectory: (path, watchers) => {
			watchedDuringScan ||= watchers.some((watcher) => watcher.path === path && watcher.recursive && !watcher.closed);
		},
	});
	f.dir('src');
	f.write('src/app.js');
	f.start({ sources: ['src'], build: () => {} });

	assert.equal(watchedDuringScan, true);
});

test('closes a registered watcher if its initial snapshot fails', (t) => {
	let watcher;
	const f = fixture(t, {
		onReadDirectory: (_path, watchers) => {
			watcher = watchers[0];
			throw new Error('snapshot failed');
		},
	});
	f.dir('src');

	assert.throws(() => f.start({ sources: ['src'], build: () => {} }), /snapshot failed/);
	assert.equal(watcher.closed, true);
});

test('null and undefined filenames rebuild changed files with debounce', async (t) => {
	const f = fixture(t);
	f.dir('src');
	f.write('src/app.js');
	let builds = 0;
	f.start({ sources: ['src'], build: () => { builds++; } });
	const watcher = f.watcher('src', true);

	f.write('src/app.js');
	watcher.callback('change', null);
	f.write('src/app.js');
	watcher.callback('change');
	await settle();
	assert.equal(builds, 1);

	f.write('src/app.js');
	watcher.callback('change', undefined);
	await settle();
	assert.equal(builds, 2);
});

test('nameless parent events refresh missing, created and removed source watchers', async (t) => {
	const f = fixture(t);
	let builds = 0;
	f.start({ sources: ['src/nested'], build: () => { builds++; } });
	const root = f.watcher('.', false);

	f.dir('src');
	root.callback('rename', null);
	assert.equal(root.closed, true);
	const parent = f.watcher('src', false);
	f.dir('src/nested');
	parent.callback('rename');
	const recursive = f.watcher('src/nested', true);
	await settle();
	assert.equal(builds, 1);

	f.write('src/nested/app.js');
	recursive.callback('change', 'app.js');
	await settle();
	assert.equal(builds, 2);

	f.remove('src/nested');
	parent.callback('rename', null);
	assert.equal(recursive.closed, true);
	await settle();
	assert.equal(builds, 3);
});

test('nameless ignored changes still refresh the watched parent', async (t) => {
	const f = fixture(t);
	f.dir('src');
	let builds = 0;
	f.start({ sources: ['src/generated/app.js'], ignored: ['src/generated'], build: () => { builds++; } });
	const parent = f.watcher('src', false);

	f.dir('src/generated');
	parent.callback('rename', null);
	assert.equal(parent.closed, true);
	f.watcher('src/generated', false);
	await settle();
	assert.equal(builds, 0);
});

test('named parent events still filter unrelated names and accept buffers', async (t) => {
	const f = fixture(t);
	f.dir('src');
	f.write('src/app.js');
	let builds = 0;
	f.start({ sources: ['src/app.js'], build: () => { builds++; } });
	const parent = f.watcher('src', false);

	parent.callback('change', 'other.js');
	await settle();
	assert.equal(builds, 0);
	parent.callback('change', Buffer.from('app.js'));
	await settle();
	assert.equal(builds, 1);
});

test('ignored paths and unrelated names do not rebuild or cause nameless output loops', async (t) => {
	const f = fixture(t);
	f.dir('src');
	f.dir('src/dist');
	f.dir('src/generated');
	f.write('src/app.js');
	let builds = 0;
	const generated = resolve(f.root, 'src/generated');
	const ignore = (path) => path === generated || path.startsWith(`${generated}${sep}`);
	f.start({
		sources: ['src'],
		ignored: ['src/dist'],
		ignore,
		initial: true,
		build: () => {
			builds++;
			f.write('src/dist/output.css');
			f.write('src/generated/output.js');
			f.watcher('src', true).callback('change', null);
		},
	});
	const recursive = f.watcher('src', true);
	const parent = f.watcher('.', false);
	await settle();
	assert.equal(builds, 1);

	f.write('src/dist/other.css');
	f.write('src/generated/other.js');
	recursive.callback('change', 'dist/other.css');
	recursive.callback('change', 'generated/other.js');
	parent.callback('change', 'unrelated');
	recursive.callback('change');
	await settle();
	assert.equal(builds, 1);

	f.write('src/app.js');
	recursive.callback('change', 'app.js');
	await settle();
	assert.equal(builds, 2);
});

test('ignore callback errors are reported without hiding other nameless changes', async (t) => {
	const f = fixture(t);
	f.dir('src');
	f.write('src/bad.js');
	f.write('src/good.js');
	const errors = [];
	let builds = 0;
	f.start({
		sources: ['src'],
		ignore: (path) => {
			if (path.endsWith('bad.js')) throw new Error('ignore failed');
			return false;
		},
		onError: (error) => errors.push(error.message),
		build: () => { builds++; },
	});
	const watcher = f.watcher('src', true);

	f.write('src/bad.js');
	f.write('src/good.js');
	watcher.callback('change', null);
	await settle();
	assert.deepEqual(errors, ['ignore failed']);
	assert.equal(builds, 1);
	watcher.callback('change', 'good.js');
	await settle();
	assert.equal(builds, 2);
});

test('nameless events during a build are debounced into one serial follow-up', async (t) => {
	const f = fixture(t);
	f.dir('src');
	f.write('src/app.js');
	let builds = 0;
	let active = 0;
	let maxActive = 0;
	let release;
	const first = new Promise((resolve) => { release = resolve; });
	f.start({
		sources: ['src'],
		build: async () => {
			builds++;
			active++;
			maxActive = Math.max(maxActive, active);
			if (builds === 1) await first;
			active--;
		},
	});
	const watcher = f.watcher('src', true);

	try {
		f.write('src/app.js');
		watcher.callback('change', null);
		await waitFor(() => builds === 1);
		f.write('src/app.js');
		watcher.callback('change');
		f.write('src/app.js');
		watcher.callback('change', null);
		await settle();
		assert.equal(builds, 1);
		release();
		await waitFor(() => builds === 2);
		await settle();
		assert.equal(builds, 2);
		assert.equal(maxActive, 1);
	} finally {
		release();
	}
});

test('nameless events preserve Bun macOS directory-event filtering', async (t) => {
	const platform = Object.getOwnPropertyDescriptor(process, 'platform');
	const bun = Object.getOwnPropertyDescriptor(globalThis, 'Bun');
	Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
	if (!bun) Object.defineProperty(globalThis, 'Bun', { value: {}, configurable: true });

	try {
		const f = fixture(t);
		f.dir('src');
		let builds = 0;
		f.start({ sources: ['src'], build: () => { builds++; } });
		const parent = f.watcher('.', false);
		const recursive = f.watcher('src', true);

		parent.callback('change', 'src');
		recursive.callback('change', 'src');
		await settle();
		assert.equal(builds, 0);

		f.write('src/app.js');
		recursive.callback('change', null);
		await settle();
		assert.equal(builds, 1);
		parent.callback('change', 'src');
		recursive.callback('change', 'src');
		await settle();
		assert.equal(builds, 1);
	} finally {
		Object.defineProperty(process, 'platform', platform);
		if (!bun) delete globalThis.Bun;
	}
});
