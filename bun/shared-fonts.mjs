import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { unescapeCss } from './css-url.mjs';

/** Extract verified UI Components font faces before stylesheet hashes are calculated.
 * additionalFiles maps other assets that the caller will package alongside flatDir.
 */
export async function prepareSharedFonts({ root, flatDir, retainedStyles = new Set(), additionalFiles = [] }) {
	if (
		!Array.isArray(additionalFiles) ||
		additionalFiles.some(
			(file) =>
				!file ||
				typeof file.source !== 'string' ||
				!file.source ||
				typeof file.destination !== 'string' ||
				!file.destination ||
				isAbsolute(file.destination) ||
				file.destination.includes('\\') ||
				file.destination.includes('\0') ||
				file.destination.split('/').some((part) => !part || part === '.' || part === '..'),
		)
	) {
		throw new TypeError('additionalFiles must contain valid source and destination paths');
	}

	const require = createRequire(resolve(root, 'package.json'));
	const assets = dirname(require.resolve('@eightshift/ui-components/dist/assets/style.css'));
	const manifest = JSON.parse(await readFile(resolve(assets, 'fonts-manifest.json'), 'utf8'));

	if (manifest.version !== 1 || !Array.isArray(manifest.fonts) || !manifest.fonts.length || typeof manifest.css !== 'string') {
		throw new Error('Invalid UI Components font manifest; rebuild UI Components with shared-font support.');
	}

	const hashes = new Set();

	for (const font of manifest.fonts) {
		if (!font || !/^[a-f0-9]{64}$/.test(font.hash) || typeof font.file !== 'string' || !/^fonts\/[\w.-]+\.woff2$/.test(font.file)) {
			throw new Error('Invalid shared font asset descriptor.');
		}

		const bytes = await readFile(resolve(assets, font.file));

		if (createHash('sha256').update(bytes).digest('hex') !== font.hash) {
			throw new Error(`Shared font integrity mismatch: ${font.file}`);
		}

		hashes.add(font.hash);
	}

	const readAsset = async (path, optional = false) => {
		let originalError;

		try {
			return { path, bytes: await readFile(path) };
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}

			originalError = error;
		}

		const name = relative(flatDir, path).split(sep).join('/');

		for (const { source, destination } of additionalFiles) {
			if (name !== destination && !name.startsWith(`${destination}/`)) {
				continue;
			}

			const parts = name === destination ? [] : name.slice(destination.length + 1).split('/');
			let candidate = resolve(source);

			try {
				let info = await lstat(candidate);
				let complete = true;

				for (const part of parts) {
					if (info.isSymbolicLink()) {
						throw new Error(`Symlinks are not supported: ${candidate}`);
					}

					if (!info.isDirectory()) {
						complete = false;
						break;
					}

					candidate = resolve(candidate, part);
					info = await lstat(candidate);
				}

				if (info.isSymbolicLink()) {
					throw new Error(`Symlinks are not supported: ${candidate}`);
				}

				if (complete && info.isFile()) {
					return { path: candidate, bytes: await readFile(candidate) };
				}
			} catch (error) {
				if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
					throw error;
				}
			}
		}

		if (!optional) {
			throw originalError;
		}
	};

	const faces = new Set();
	let matched = false;
	const fonts = new Map();
	const updated = [];

	for (const name of (await readdir(flatDir, { recursive: true })).filter((name) => name.endsWith('.css')).sort()) {
		const file = resolve(flatDir, name);
		const tree = postcss.parse(await readFile(file, 'utf8'), { from: file });
		const candidates = [];
		let changed = false;
		tree.walkAtRules('font-face', (face) => candidates.push(face));

		for (const face of candidates) {
			const sources = [];
			face.walkDecls('src', (decl) => {
				const parsed = valueParser(decl.value);
				parsed.walk((node) => {
					if (node.type === 'function' && node.value.toLowerCase() === 'url') {
						sources.push({
							node,
							parsed,
							decl,
							url: valueParser
								.stringify(node.nodes)
								.trim()
								.replace(/^(['"])(.*)\1$/, '$2'),
						});
					}
				});
			});

			if (!sources.length) {
				continue;
			}

			const resolved = [];

			for (const source of sources) {
				const url = unescapeCss(source.url);

				if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url) || /[?#]/.test(url)) {
					break;
				}

				let pathname;

				try {
					pathname = decodeURIComponent(url);
				} catch (cause) {
					throw new Error(`Invalid percent encoding in shared font URL ${JSON.stringify(url)} in ${file}`, { cause });
				}

				const path = resolve(dirname(file), pathname);
				const rel = relative(flatDir, path);

				if (isAbsolute(rel) || rel.startsWith('..') || !/\.woff2$/.test(path)) {
					break;
				}

				const asset = await readAsset(path);
				const hash = createHash('sha256').update(asset.bytes).digest('hex');

				if (!hashes.has(hash)) {
					break;
				}

				resolved.push({ ...source, path: asset.path, hash, file: `fonts/${hash}${extname(path)}` });
			}

			// Leave mixed or unrelated font declarations entirely unchanged.
			if (resolved.length !== sources.length) {
				continue;
			}

			matched = true;

			// PHP accepts only plain font-face rules; retain all nested contexts.
			if (face.parent !== tree || retainedStyles.has(name) || retainedStyles.has(basename(name))) {
				continue;
			}

			for (const source of resolved) {
				source.node.nodes = [{ type: 'string', quote: '"', value: `./${source.file}` }];
				fonts.set(source.file, { hash: source.hash, file: source.file, source: source.path });
			}

			for (const source of resolved) {
				source.decl.value = source.parsed.toString();
			}

			faces.add(face.toString());
			face.remove();
			changed = true;
		}

		if (changed) {
			updated.push([file, tree.toString()]);
		}
	}

	if (!matched) {
		throw new Error('Shared fonts enabled but no verified UI Components font faces were found.');
	}

	const extraFonts = [];

	for (const { hash, file, source } of fonts.values()) {
		const existing = await readAsset(resolve(flatDir, file), true);

		if (existing && createHash('sha256').update(existing.bytes).digest('hex') !== hash) {
			throw new Error(`Duplicate release path: ${file}`);
		}

		if (!existing) {
			extraFonts.push({ source, destination: file });
		}
	}

	const output = resolve(flatDir, '../shared-fonts.json');
	await writeFile(output, JSON.stringify({ version: 1, fonts: [...fonts.values()].map(({ hash, file }) => ({ hash, file })), css: [...faces].join('\n') }, null, 2));

	for (const [file, css] of updated) {
		await writeFile(file, css);
	}

	return {
		extraFiles: [{ source: output, destination: basename(output) }, ...extraFonts],
		aliases: { 'shared-fonts.json': 'shared-fonts.json' },
	};
}
