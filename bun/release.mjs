import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const digest = (value) => createHash('sha256').update(value).digest('hex');

const releasePath = (value) => {
	if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || isAbsolute(value) || value.split('/').some((part) => !part || part === '.' || part === '..')) {
		throw new Error(`Invalid release path: ${String(value)}`);
	}

	return value;
};

/**
 * Package a WordPress release without modifying or deleting existing releases.
 *
 * files: [{ source, destination }] copies files or directory trees.
 * entries: [{ name, entry, style, dependencies, script? }] generates the root
 * scripts and WordPress asset metadata. script supplies synchronous editor code;
 * otherwise a dynamic-import bootstrap loads entry relative to the root script.
 * aliases maps additional flat manifest keys to packaged paths.
 * Returns { release, version, manifest }. A failed staging directory is retained.
 */
export async function packageRelease({ root, files, entries, aliases = {} }) {
	if (typeof root !== 'string' || !root || !Array.isArray(files) || !Array.isArray(entries) || !entries.length || !aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
		throw new TypeError('Expected root, files, entries and optional aliases');
	}

	const contents = new Map();
	const add = (path, bytes) => {
		releasePath(path);

		if (contents.has(path)) {
			throw new Error(`Duplicate release path: ${path}`);
		}

		contents.set(path, bytes);
	};
	const collect = async (source, destination) => {
		const info = await lstat(source);

		if (info.isSymbolicLink()) {
			throw new Error(`Symlinks are not supported: ${source}`);
		}

		if (info.isDirectory()) {
			for (const name of (await readdir(source)).sort()) {
				await collect(join(source, name), `${destination}/${name}`);
			}
		} else if (info.isFile()) {
			const bytes = await readFile(source);

			add(destination, bytes);
		} else {
			throw new Error(`Unsupported release file: ${source}`);
		}
	};

	for (const file of files) {
		if (!file || typeof file.source !== 'string' || !file.source) {
			throw new TypeError('Each file requires a source and destination');
		}

		await collect(resolve(file.source), releasePath(file.destination));
	}

	const manifest = Object.create(null);
	const setManifest = (key, value) => {
		releasePath(key);
		releasePath(value);

		if (Object.hasOwn(manifest, key)) {
			throw new Error(`Duplicate manifest key: ${key}`);
		}

		manifest[key] = value;
	};
	const scripts = new Map();

	for (const entry of entries) {
		if (!entry || typeof entry.name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(entry.name) || !Array.isArray(entry.dependencies) || entry.dependencies.some((dependency) => typeof dependency !== 'string' || !dependency)) {
			throw new TypeError('Invalid release entry');
		}

		const target = releasePath(entry.entry);
		const style = releasePath(entry.style);

		if (!contents.has(target) || !contents.has(style) || !contents.get(target).length || !contents.get(style).length) {
			throw new Error(`Missing or empty entry or style for ${entry.name}`);
		}

		if (entry.script !== undefined && (typeof entry.script !== 'string' || !entry.script.trim())) {
			throw new TypeError(`Invalid script for ${entry.name}`);
		}

		const script = entry.script ?? `(() => { const url = new URL(${JSON.stringify(target)}, document.currentScript.src); import(url.href).catch((error) => console.error(${JSON.stringify(`Failed to load ${entry.name}:`)}, error)); })();\n`;

		if (scripts.has(entry.name)) {
			throw new Error(`Duplicate entry: ${entry.name}`);
		}

		scripts.set(entry.name, { script, dependencies: entry.dependencies });
		const scriptName = `${entry.name}-${digest(script)}.js`;
		const styleBytes = contents.get(style);
		const styleName = `${entry.name}-${digest(styleBytes)}.css`;

		if (contents.has(scriptName)) {
			throw new Error(`Duplicate release path: ${scriptName}`);
		}

		if (contents.has(styleName)) {
			throw new Error(`Duplicate release path: ${styleName}`);
		}

		add(styleName, styleBytes);
		setManifest(`${entry.name}.js`, scriptName);
		setManifest(`${entry.name}.css`, styleName);
		setManifest(`${entry.name}.asset.json`, `${entry.name}.asset.json`);
		setManifest(`${entry.name}.json`, `${entry.name}.asset.json`);
	}

	for (const [key, value] of Object.entries(aliases)) {
		if (!contents.has(value)) {
			throw new Error(`Missing manifest target: ${value}`);
		}

		setManifest(key, value);
	}

	const inventory = Object.fromEntries([...contents].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([path, bytes]) => [path, digest(bytes)]));
	const version = digest(JSON.stringify({ format: 1, inventory, scripts: [...scripts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)), manifest }));

	for (const [name, { script, dependencies }] of scripts) {
		add(manifest[`${name}.js`], Buffer.from(script));
		add(`${name}.asset.json`, Buffer.from(`${JSON.stringify({ dependencies, version }, null, 2)}\n`));
	}

	add('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
	const parent = resolve(root);

	await mkdir(parent, { recursive: true });
	const stage = join(parent, `release-${randomUUID()}`);

	await mkdir(stage);
	const release = join(stage, version);

	await mkdir(release);

	for (const [path, bytes] of contents) {
		const target = resolve(release, ...path.split('/'));

		if (relative(release, target).startsWith(`..${sep}`)) {
			throw new Error(`Invalid release path: ${path}`);
		}

		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, bytes, { flag: 'wx' });
	}

	return { release, version, manifest: { ...manifest } };
}
