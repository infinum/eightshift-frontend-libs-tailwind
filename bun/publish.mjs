import { randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, open, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { dlopen, FFIType } from 'bun:ffi';

const exists = async (path) => {
	try {
		return await lstat(path);
	} catch (error) {
		if (error.code === 'ENOENT') {
			return null;
		}

		throw error;
	}
};
const pathName = (value) => {
	if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\') || value.includes('\0') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
		throw new Error(`Invalid manifest path: ${String(value)}`);
	}

	return value;
};
const inside = (parent, child) => {
	const path = relative(parent, child);

	return !path || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};

/**
 * Publish a packageRelease directory without deleting unrelated public files.
 * root is the theme root; publicDir defaults to root/public. publicPrefix is
 * the URL prefix including its trailing slash. manifest maps keys to paths in
 * release. Existing PHP manifest cache assets are updated under its flock;
 * missing caches are left alone. Returns { publicDir, manifest }.
 */
export async function publishRelease({ root, release, manifest, publicDir, publicPrefix }) {
	if (
		typeof root !== 'string' ||
		!root ||
		typeof release !== 'string' ||
		!release ||
		!manifest ||
		typeof manifest !== 'object' ||
		Array.isArray(manifest) ||
		typeof publicPrefix !== 'string' ||
		!publicPrefix.startsWith('/') ||
		publicPrefix.startsWith('//') ||
		!publicPrefix.endsWith('/') ||
		publicPrefix.split('/').includes('..')
	) {
		throw new TypeError('Expected root, release, manifest and an absolute publicPrefix ending in /');
	}

	root = resolve(root);
	release = resolve(release);
	publicDir = resolve(root, publicDir ?? 'public');

	if (inside(publicDir, release) || inside(release, publicDir) || publicDir === root || inside(publicDir, root)) {
		throw new Error('Release, root and public directory must be distinct');
	}

	const cachePath = join(root, 'eightshift/manifests.json');

	if (inside(publicDir, cachePath) || inside(release, cachePath)) {
		throw new Error('Cache must be outside publication and release directories');
	}

	const library = process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : process.platform === 'linux' ? 'libc.so.6' : null;

	if (!library) {
		throw new Error(`Publication locking is unsupported on ${process.platform}`);
	}

	const libc = dlopen(library, { flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } });
	const locks = [];
	const lock = async (path) => {
		const handle = await open(path, 'a');

		locks.push(handle);

		const deadline = Date.now() + 30000;
		while (libc.symbols.flock(handle.fd, 2 | 4) !== 0) {
			if (Date.now() >= deadline) {
				throw new Error(`Could not lock ${path} within 30 seconds`);
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	};
	const parent = dirname(publicDir);
	const stage = join(parent, `.public-stage-${randomUUID()}`);
	const backup = join(parent, `.public-backup-${randomUUID()}`);
	let staged = false;
	let backedUp = false;
	let published = false;
	let cacheTemporary;

	try {
		await mkdir(parent, { recursive: true });
		await lock(`${publicDir}.lock`);
		const releaseInfo = await lstat(release);

		if (!releaseInfo.isDirectory() || releaseInfo.isSymbolicLink()) {
			throw new Error('Release must be a directory');
		}

		const publicInfo = await exists(publicDir);

		if (publicInfo && (!publicInfo.isDirectory() || publicInfo.isSymbolicLink())) {
			throw new Error('Refusing to replace non-directory public path');
		}

		const publicManifest = Object.create(null);

		for (const [key, value] of Object.entries(manifest)) {
			pathName(key);
			pathName(value);
			publicManifest[key] = `${publicPrefix}${value}`;
		}

		// Include unaliased flat files, as the theme's legacy publisher did.
		for (const name of await readdir(release)) {
			const info = await lstat(join(release, name));

			if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) {
				throw new Error(`Unsupported release output: ${name}`);
			}

			if (info.isFile() && name !== 'manifest.json' && !Object.hasOwn(publicManifest, name)) {
				publicManifest[name] = `${publicPrefix}${name}`;
			}
		}

		for (const value of Object.values(manifest)) {
			let current = release;

			for (const part of value.split('/')) {
				current = join(current, part);
				const info = await lstat(current);

				if (info.isSymbolicLink()) {
					throw new Error(`Symlink in release path: ${value}`);
				}
			}

			if (!(await lstat(current)).isFile()) {
				throw new Error(`Manifest target is not a file: ${value}`);
			}
		}

		await mkdir(stage);
		staged = true;

		if (publicInfo) {
			await cp(publicDir, stage, { recursive: true, verbatimSymlinks: true });
		}

		// Never follow pre-existing symlinks when overlaying release files.
		const overlay = async (source, destination) => {
			for (const name of await readdir(source)) {
				const from = join(source, name);
				const to = join(destination, name);
				const info = await lstat(from);
				const old = await exists(to);

				if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) {
					throw new Error(`Unsupported release output: ${from}`);
				}

				if (old && (old.isSymbolicLink() || (info.isDirectory() ? !old.isDirectory() : !old.isFile()))) {
					throw new Error(`Publication path conflict: ${to}`);
				}

				if (info.isDirectory()) {
					await mkdir(to, { recursive: true });
					await overlay(from, to);
				} else {
					await cp(from, to);
				}
			}
		};

		await overlay(release, stage);
		const manifestPath = join(stage, 'manifest.json');
		const manifestInfo = await exists(manifestPath);

		if (manifestInfo && (!manifestInfo.isFile() || manifestInfo.isSymbolicLink())) {
			throw new Error('Publication manifest path conflict');
		}

		await writeFile(manifestPath, `${JSON.stringify(publicManifest, null, 2)}\n`);
		const cacheInfo = await exists(cachePath);
		let cacheData;

		if (cacheInfo) {
			if (!cacheInfo.isFile() || cacheInfo.isSymbolicLink()) {
				throw new Error('Manifest cache must be a regular file');
			}

			await lock(`${cachePath}.lock`);
			cacheData = JSON.parse(await readFile(cachePath, 'utf8'));

			if (!cacheData?.assets || Array.isArray(cacheData.assets) || typeof cacheData.assets !== 'object' || !cacheData.assets.assets || Array.isArray(cacheData.assets.assets) || typeof cacheData.assets.assets !== 'object') {
				throw new Error('Invalid manifest cache structure');
			}

			cacheData.assets.assets = publicManifest;
			cacheTemporary = `${cachePath}.${randomUUID()}`;
			await writeFile(cacheTemporary, JSON.stringify(cacheData), { flag: 'wx', mode: cacheInfo.mode });
		}

		if (publicInfo) {
			await rename(publicDir, backup);
			backedUp = true;
		}

		await rename(stage, publicDir);
		staged = false;
		published = true;

		if (cacheTemporary) {
			await rename(cacheTemporary, cachePath);
			cacheTemporary = undefined;
		}

		if (backedUp) {
			backedUp = false;
			await rm(backup, { recursive: true }).catch((error) => {
				console.error(`Could not remove publication backup ${backup}:`, error);
			});
		}

		return { publicDir, manifest: { ...publicManifest } };
	} catch (error) {
		if (published && (await exists(publicDir))) {
			await rename(publicDir, stage).then(() => {
				staged = true;
			});
		}

		if (backedUp) {
			await rename(backup, publicDir);
			backedUp = false;
		}

		throw error;
	} finally {
		try {
			if (cacheTemporary) {
				await unlink(cacheTemporary).catch((error) => {
					if (error.code !== 'ENOENT') {
						throw error;
					}
				});
			}

			if (staged) {
				await rm(stage, { recursive: true, force: true });
			}
		} finally {
			for (const handle of locks.reverse()) {
				libc.symbols.flock(handle.fd, 8);
				await handle.close();
			}

			libc.close();
		}
	}
}
