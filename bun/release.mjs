import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function ensureDirectory(directory, root) {
	const location = root && relative(root, directory);
	const withinRoot = root && (!location || (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`)));
	const parent = dirname(directory);

	if (parent !== directory && (!withinRoot || directory !== root)) {
		await ensureDirectory(parent, root);
	}

	try {
		await mkdir(directory, { recursive: directory === root });
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}

	const info = await lstat(directory);

	if (!info.isDirectory() || info.isSymbolicLink()) {
		throw new Error(`Release path must be a real directory: ${directory}`);
	}
}

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
 * scripts and WordPress asset metadata. script supplies the entry wrapper code;
 * otherwise a dynamic-import bootstrap loads entry relative to the root script.
 * Unified editor scripts declare format: 'module', readiness: 'eightshift-editor-v1';
 * their static-import wrapper must be loaded by matching module-aware PHP integration.
 * aliases maps additional flat manifest keys to packaged paths.
 * Returns { release, version, manifest }. A failed staging directory is retained.
 * outputDirectory writes directly to an existing directory instead of staging.
 */
export async function packageRelease({ root, files, entries, aliases = {}, outputDirectory, omit = [], removeUnreferencedStyles = false }) {
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

		if (!contents.has(target) || !contents.get(target).length) {
			throw new Error(`Missing or empty entry for ${entry.name}`);
		}

		if (!contents.has(style)) {
			throw new Error(`Missing style for ${entry.name}`);
		}

		if (entry.script !== undefined && (typeof entry.script !== 'string' || !entry.script.trim())) {
			throw new TypeError(`Invalid script for ${entry.name}`);
		}

		if (entry.format !== undefined && entry.format !== 'module') {
			throw new TypeError(`Unsupported script format for ${entry.name}`);
		}

		if (entry.format === 'module' && (entry.readiness !== 'eightshift-editor-v1' || entry.script === undefined)) {
			throw new TypeError(`Module entry ${entry.name} requires an explicit script and readiness contract`);
		}

		if (entry.readiness !== undefined && entry.format !== 'module') {
			throw new TypeError(`Readiness requires a module entry: ${entry.name}`);
		}

		const script = entry.script ?? `(() => { const url = new URL(${JSON.stringify(target)}, document.currentScript.src); import(url.href).catch((error) => console.error(${JSON.stringify(`Failed to load ${entry.name}:`)}, error)); })();\n`;

		if (scripts.has(entry.name)) {
			throw new Error(`Duplicate entry: ${entry.name}`);
		}

		scripts.set(entry.name, { script, dependencies: entry.dependencies, ...(entry.format === 'module' ? { format: entry.format, readiness: entry.readiness } : {}) });
		const scriptName = `${entry.name}-${digest(script)}.js`;
		const styleBytes = contents.get(style);
		// Preserve the stylesheet's base directory for relative URLs and imports.
		const styleDirectory = style.slice(0, style.lastIndexOf('/') + 1);
		const styleName = `${styleDirectory}${entry.name}-${digest(styleBytes)}.css`;

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

	if (!Array.isArray(omit)) {
		throw new TypeError('omit must be an array');
	}

	for (const path of omit) {
		releasePath(path);

		if (entries.some((entry) => entry.script === undefined && entry.entry === path)) {
			throw new Error(`Cannot omit a script bootstrap target: ${path}`);
		}

		if (Object.values(manifest).includes(path)) {
			throw new Error(`Cannot omit manifest target: ${path}`);
		}

		if (!contents.delete(path)) {
			throw new Error(`Cannot omit missing release file: ${path}`);
		}
	}

	if (typeof removeUnreferencedStyles !== 'boolean') {
		throw new TypeError('removeUnreferencedStyles must be a boolean');
	}

	if (removeUnreferencedStyles) {
		// Only entry styles have a generated, same-directory hashed replacement.
		// Conservative name matching also retains ambiguous and absolute references.
		const referenceText = (bytes) =>
			bytes
				.toString()
				.replace(/\\(?:u\{([\da-f]+)\}|u([\da-f]{4})|x([\da-f]{2}))/gi, (match, point, unicode, hex) => {
					const code = Number.parseInt(point ?? unicode ?? hex, 16);

					return code <= 0x10ffff ? String.fromCodePoint(code) : match;
				})
				.replace(/\\([\da-f]{1,6})[ \t\r\n\f]?/gi, (match, hex) => {
					const code = Number.parseInt(hex, 16);

					return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
				})
				.replace(/\\([^\r\n])/g, '$1')
				.replace(/%([\da-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
		const texts = [...contents.values(), ...[...scripts.values()].map(({ script }) => script)].map(referenceText);

		for (const { style } of entries) {
			const name = style.slice(style.lastIndexOf('/') + 1);

			if (!Object.values(manifest).includes(style) && !texts.some((text) => text.includes(name))) {
				contents.delete(style);
			}
		}
	}

	const inventory = Object.fromEntries([...contents].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([path, bytes]) => [path, digest(bytes)]));
	const version = digest(JSON.stringify({ format: 1, inventory, scripts: [...scripts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)), manifest }));

	for (const [name, { script, dependencies, format, readiness }] of scripts) {
		add(manifest[`${name}.js`], Buffer.from(script));
		add(`${name}.asset.json`, Buffer.from(`${JSON.stringify({ dependencies, version, ...(format === 'module' ? { format, readiness } : {}) }, null, 2)}\n`));
	}

	add('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
	const parent = resolve(root);

	await ensureDirectory(parent, parent);
	const release = outputDirectory ? resolve(outputDirectory) : join(parent, `release-${randomUUID()}`, version);

	await ensureDirectory(release, parent);

	for (const [path, bytes] of contents) {
		const target = resolve(release, ...path.split('/'));

		if (relative(release, target).startsWith(`..${sep}`)) {
			throw new Error(`Invalid release path: ${path}`);
		}

		await ensureDirectory(dirname(target), parent);
		await writeFile(target, bytes, { flag: 'wx' });
	}

	return { release, version, manifest: { ...manifest } };
}
