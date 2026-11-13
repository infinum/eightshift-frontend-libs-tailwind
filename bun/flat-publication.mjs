import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { packageRelease } from './release.mjs';

const pathName = (value) => {
	if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\') || value.includes('\0') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
		throw new Error(`Invalid path: ${String(value)}`);
	}

	return value;
};

/** Package prepared files, optional SSR files and standalone assets. */
export async function packageFlatRelease({ root, flatDir, entries, ssrDir, ssrNames = [], standaloneAssets = new Map(), aliases = {}, extraFiles = [], retain = [], previousPublic, outputDirectory, removeIntermediates = false, removeUnreferencedStyles = false }) {
	if (!Array.isArray(extraFiles) || !Array.isArray(retain) || (retain.length && !previousPublic)) {
		throw new TypeError('extraFiles and retain must be arrays; retention requires previousPublic');
	}

	const files = [...extraFiles];

	for (const name of retain) {
		pathName(name);
		let source = resolve(previousPublic);

		for (const part of name.split('/')) {
			source = resolve(source, part);

			if ((await lstat(source)).isSymbolicLink()) {
				throw new Error(`Symlink in retained path: ${name}`);
			}
		}

		if (!(await lstat(source)).isFile()) {
			throw new Error(`Retained path must be an exact file: ${name}`);
		}

		files.push({ source, destination: name });
	}

	for (const name of await readdir(flatDir)) {
		files.push({ source: resolve(flatDir, name), destination: name });
	}

	const extraAliases = {};

	for (const name of [...ssrNames].sort()) {
		pathName(name);

		if (name.includes('/')) {
			throw new Error(`Invalid SSR name: ${name}`);
		}

		files.push({ source: resolve(ssrDir, `${name}.js`), destination: `ssr/${name}.js` });
		extraAliases[`ssr/${name}.js`] = `ssr/${name}.js`;
	}

	for (const [name, source] of standaloneAssets) {
		pathName(name);
		files.push({ source, destination: name });
		extraAliases[name] = name;
	}

	const omitted = removeIntermediates ? entries.flatMap((entry) => [entry.style, ...(entry.script !== undefined ? [entry.entry] : [])]) : [];

	for (const entry of entries) {
		if (entry.script === undefined && omitted.includes(entry.entry)) {
			throw new Error(`Cannot omit a script bootstrap target: ${entry.entry}`);
		}
	}

	return packageRelease({ root, files, entries, aliases: { ...extraAliases, ...aliases }, outputDirectory, omit: [...new Set(omitted)], removeUnreferencedStyles });
}

/** Publish a prepared release and synchronize an existing PHP asset cache.
 * Staged publication restores the previous public directory on cache failure.
 * Direct publication writes in public and does not roll back. Missing caches are ignored.
 */
export async function publishFlatRelease({ root, wpRoot, release, manifest, version, direct = false, publicPrefix }) {
	root = resolve(root);
	wpRoot = resolve(wpRoot);
	release = resolve(release);
	const publicDir = resolve(root, 'public');
	const within = (parent, child) => {
		const path = relative(parent, child);

		return !path || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
	};

	if ((!direct && (within(publicDir, release) || within(release, publicDir) || within(release, root))) || (direct && release !== publicDir)) {
		throw new Error('Release, root and public directory must be distinct');
	}

	if (publicPrefix === undefined) {
		const themePath = relative(wpRoot, root);

		if (!themePath || themePath === '..' || themePath.startsWith(`..${sep}`) || isAbsolute(themePath)) {
			throw new Error('Theme must be inside the WordPress root unless publicPrefix is configured');
		}

		publicPrefix = `/${themePath.split(sep).join('/')}/public/`;
	}

	if (typeof publicPrefix !== 'string' || !publicPrefix.startsWith('/') || publicPrefix.startsWith('//') || !publicPrefix.endsWith('/') || publicPrefix.includes('\\') || /[?#\s\x00-\x1f]/.test(publicPrefix) || publicPrefix.split('/').some((part) => part === '.' || part === '..')) {
		throw new Error('publicPrefix must be a root-relative URL path ending in /');
	}

	const info = await lstat(release);

	if (!info.isDirectory() || info.isSymbolicLink()) {
		throw new Error('Release must be a directory');
	}

	const result = { ...manifest };

	for (const [key, value] of Object.entries(result)) {
		pathName(key);
		pathName(value);
		let current = release;

		for (const part of value.split('/')) {
			current = resolve(current, part);
			const entry = await lstat(current);

			if (entry.isSymbolicLink()) {
				throw new Error(`Symlink in release path: ${value}`);
			}
		}

		if (!(await lstat(current)).isFile()) {
			throw new Error(`Manifest target is not a file: ${value}`);
		}
	}

	for (const name of await readdir(release)) {
		const entry = await lstat(resolve(release, name));

		if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) {
			throw new Error(`Unsupported release output: ${name}`);
		}

		if (entry.isFile() && name !== 'manifest.json' && name !== 'ssr' && !(direct && name === '.build') && !Object.hasOwn(result, name)) {
			result[name] = name;
		}
	}

	const publicManifest = Object.fromEntries(Object.entries(result).map(([key, value]) => [key, `${publicPrefix}${value}`]));

	await writeFile(resolve(release, 'manifest.json'), `${JSON.stringify(publicManifest, null, 2)}\n`);
	const backup = resolve(root, `.public-previous-${randomUUID()}`);
	let hadPublic = false;

	if (!direct) {
		try {
			const publicInfo = await lstat(publicDir);

			if (!publicInfo.isDirectory() || publicInfo.isSymbolicLink()) {
				throw new Error('Refusing to replace non-directory public path');
			}

			await rename(publicDir, backup);
			hadPublic = true;
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}

	try {
		if (!direct) {
			await rename(release, publicDir);
		}

		const cachePath = resolve(root, 'eightshift/manifests.json');
		let cacheExists = false;

		try {
			const cacheInfo = await lstat(cachePath);

			if (!cacheInfo.isFile() || cacheInfo.isSymbolicLink()) {
				throw new Error(`Manifest cache must be a regular file: ${cachePath}`);
			}

			cacheExists = true;
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}

		if (cacheExists) {
			let temporary;

			try {
				const cacheInfo = await lstat(cachePath);

				if (!cacheInfo.isFile() || cacheInfo.isSymbolicLink()) {
					throw new Error(`Manifest cache must be a regular file: ${cachePath}`);
				}

				const data = JSON.parse(await readFile(cachePath, 'utf8'));

				if (!data?.assets || Array.isArray(data.assets) || typeof data.assets !== 'object' || !data.assets.assets || Array.isArray(data.assets.assets) || typeof data.assets.assets !== 'object') {
					throw new Error('Invalid manifest cache structure');
				}

				data.assets.assets = publicManifest;
				temporary = `${cachePath}.${randomUUID()}`;
				await writeFile(temporary, JSON.stringify(data), { flag: 'wx', mode: cacheInfo.mode & 0o7777 });
				await chmod(temporary, cacheInfo.mode & 0o7777);
				await rename(temporary, cachePath);
				temporary = undefined;
			} finally {
				if (temporary) {
					await unlink(temporary).catch((error) => {
						if (error.code !== 'ENOENT') {
							throw error;
						}
					});
				}
			}
		}
	} catch (error) {
		if (direct) {
			throw error;
		}

		try {
			await rename(publicDir, release);
		} catch (rollbackError) {
			if (rollbackError.code !== 'ENOENT') {
				throw rollbackError;
			}
		}

		if (hadPublic) {
			await rename(backup, publicDir);
		}

		throw error;
	}

	const removeTree = async (path) => {
		const entry = await lstat(path);

		if (entry.isDirectory() && !entry.isSymbolicLink()) {
			for (const name of await readdir(path)) {
				await removeTree(resolve(path, name));
			}

			await rmdir(path);
		} else {
			await unlink(path);
		}
	};

	if (hadPublic) {
		try {
			await removeTree(backup);
		} catch (error) {
			console.warn(`Build published, but backup cleanup failed at ${backup}:`, error);
		}
	}

	return { publicDir, manifest: publicManifest, version };
}
