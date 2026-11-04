import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { dlopen, FFIType } from 'bun:ffi';
import { packageRelease } from './release.mjs';

const pathName = (value) => {
	if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\') || value.includes('\0') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
		throw new Error(`Invalid path: ${String(value)}`);
	}

	return value;
};

/** Collect build outputs and flatten them, rewriting relative JS, CSS and map references.
 * sources maps output-relative paths to source files. Returns the rewrite function.
 */
export async function flattenAssets({ outdir, flatDir, directories = ['frontend', 'editor', 'admin', 'css'], extraSources = {}, editorEntry, editorScript }) {
	const sources = new Map();
	const collect = async (directory, prefix) => {
		for (const item of await readdir(directory, { withFileTypes: true })) {
			const path = `${prefix}/${item.name}`;

			if (item.isDirectory()) {
				await collect(resolve(directory, item.name), path);
			} else if (item.isFile()) {
				sources.set(path, resolve(directory, item.name));
			} else {
				throw new Error(`Unsupported build output: ${path}`);
			}
		}
	};

	for (const directory of directories) {
		await collect(resolve(outdir, pathName(directory)), directory);
	}

	for (const [path, source] of Object.entries(extraSources)) {
		sources.set(pathName(path), source);
	}

	const outputNames = new Map();

	for (const path of sources.keys()) {
		const name = basename(path);

		if (outputNames.has(name)) {
			const previous = outputNames.get(name);

			if (/\.(?:js|css|map)$/.test(name) || !(await readFile(sources.get(path))).equals(await readFile(sources.get(previous)))) {
				throw new Error(`Flat output collision: ${path} and ${previous}`);
			}

			continue;
		}

		outputNames.set(name, path);
	}

	const targetsByName = new Map();
	for (const target of sources.keys()) {
		const name = basename(target);
		const targets = targetsByName.get(name) ?? [];
		targets.push(target);
		targetsByName.set(name, targets);
	}
	const unusualTargets = [...targetsByName].filter(([name]) => !/^[\w.@+-]+$/.test(name)).flatMap(([, targets]) => targets);
	const rewrite = (input, path) => {
		let source = input;
		const candidates = new Set(unusualTargets);

		for (const match of input.matchAll(/[/'"=]([\w.@+-]+)/g)) {
			for (const target of targetsByName.get(match[1]) ?? []) {
				candidates.add(target);
			}
		}

		for (const target of candidates) {
			const reference = posix.relative(posix.dirname(path), target);

			if (!reference) {
				continue;
			}

			const variants = [reference];

			if (!reference.startsWith('.')) {
				variants.push(`./${reference}`);
			}

			if (target.startsWith('editor/editor-assets/')) {
				variants.push(target.slice('editor/'.length));
			}

			for (const value of variants) {
				for (const quote of ['"', "'"]) {
					source = source.replaceAll(`${quote}${value}${quote}`, `${quote}./${basename(target)}${quote}`);
				}

				source = source.replaceAll(`sourceMappingURL=${value}`, `sourceMappingURL=./${basename(target)}`);
			}
		}

		return source;
	};

	await mkdir(flatDir);

	for (const [path, source] of sources) {
		const name = basename(path);

		if (path === editorEntry || outputNames.get(name) !== path) {
			continue;
		}

		let content = await readFile(source);

		if (/\.(?:js|css|map)$/.test(name)) {
			content = Buffer.from(rewrite(content.toString(), path));
		}

		await writeFile(resolve(flatDir, name), content, { flag: 'wx' });
	}

	if (editorEntry !== undefined) {
		await writeFile(resolve(flatDir, 'editor-entry.js'), rewrite(editorScript, editorEntry), { flag: 'wx' });
	}

	return { sources, rewrite };
}

/** Package flattened files, optional SSR files and standalone assets. */
export async function packageFlatRelease({ root, flatDir, entries, ssrDir, ssrNames = [], standaloneAssets = new Map(), aliases = {}, outputDirectory }) {
	const files = [];

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

	return packageRelease({ root, files, entries, aliases: { ...extraAliases, ...aliases }, outputDirectory });
}

/** Publish a flat release and synchronize an existing PHP asset cache.
 * Staged publication restores the previous public directory on cache failure.
 * Direct publication writes in public and does not roll back. Missing caches are ignored.
 */
export async function publishFlatRelease({ root, wpRoot, release, manifest, version, direct = false }) {
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

	const themePath = relative(wpRoot, root);

	if (themePath === '..' || themePath.startsWith(`..${sep}`) || isAbsolute(themePath)) {
		throw new Error('Theme must be inside the WordPress root');
	}

	const publicPrefix = `/${themePath.split(sep).join('/')}/public/`;

	if (publicPrefix.includes('/../') || publicPrefix.startsWith('//')) {
		throw new Error('Theme must be inside the WordPress root');
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

		if (name !== 'manifest.json' && name !== 'ssr' && !(direct && name === '.build') && !Object.hasOwn(result, name)) {
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
			const library = process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : process.platform === 'linux' ? 'libc.so.6' : null;

			if (!library) {
				throw new Error(`Manifest cache locking is unsupported on ${process.platform}`);
			}

			const libc = dlopen(library, { flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } });
			let lock,
				locked = false,
				temporary;

			try {
				lock = await open(`${cachePath}.lock`, 'a');

				if (libc.symbols.flock(lock.fd, 2) !== 0) {
					throw new Error('Could not lock the manifest cache');
				}

				locked = true;
				const data = JSON.parse(await readFile(cachePath, 'utf8'));

				if (!data?.assets || Array.isArray(data.assets) || typeof data.assets !== 'object' || !data.assets.assets || Array.isArray(data.assets.assets) || typeof data.assets.assets !== 'object') {
					throw new Error('Invalid manifest cache structure');
				}

				data.assets.assets = publicManifest;
				temporary = `${cachePath}.${randomUUID()}`;
				await writeFile(temporary, JSON.stringify(data), { flag: 'wx' });
				await rename(temporary, cachePath);
				temporary = undefined;
			} finally {
				try {
					if (temporary) {
						await unlink(temporary).catch((error) => {
							if (error.code !== 'ENOENT') {
								throw error;
							}
						});
					}
				} finally {
					if (locked) {
						libc.symbols.flock(lock.fd, 8);
					}

					try {
						if (lock) {
							await lock.close();
						}
					} finally {
						libc.close();
					}
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
		await removeTree(backup);
	}

	return { publicDir, manifest: publicManifest, version };
}
