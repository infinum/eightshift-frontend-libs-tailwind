import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';

/** Extract verified UI Components font faces before stylesheet hashes are calculated. */
export async function prepareSharedFonts({ root, flatDir }) {
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

	const faces = new Set();
	const fonts = new Map();
	const updated = [];
	for (const name of (await readdir(flatDir)).filter((name) => name.endsWith('.css')).sort()) {
		const file = resolve(flatDir, name);
		const tree = postcss.parse(await readFile(file, 'utf8'), { from: file });
		const candidates = [];
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
			if (!sources.length) continue;
			const resolved = [];
			for (const source of sources) {
				if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(source.url) || /[?#]/.test(source.url)) break;
				const path = resolve(flatDir, source.url);
				const rel = relative(flatDir, path);
				if (isAbsolute(rel) || rel.startsWith('..') || !/\.woff2$/.test(path)) break;
				const hash = createHash('sha256')
					.update(await readFile(path))
					.digest('hex');
				if (!hashes.has(hash)) break;
				resolved.push({ ...source, path, hash, file: `fonts/${hash}${extname(path)}` });
			}
			// Leave mixed or unrelated font declarations entirely unchanged.
			if (resolved.length !== sources.length) continue;
			for (const source of resolved) {
				source.node.nodes = [{ type: 'string', quote: '"', value: `./${source.file}` }];
				fonts.set(source.file, { hash: source.hash, file: source.file, source: source.path });
			}
			for (const source of resolved) source.decl.value = source.parsed.toString();
			faces.add(face.toString());
			face.remove();
		}
		updated.push([file, tree.toString()]);
	}

	if (!faces.size) throw new Error('Shared fonts enabled but no verified UI Components font faces were found.');
	const output = resolve(flatDir, '../shared-fonts.json');
	await writeFile(output, JSON.stringify({ version: 1, fonts: [...fonts.values()].map(({ hash, file }) => ({ hash, file })), css: [...faces].join('\n') }, null, 2));
	for (const [file, css] of updated) await writeFile(file, css);
	return {
		extraFiles: [{ source: output, destination: basename(output) }, ...[...fonts.values()].map(({ source, file }) => ({ source, destination: file }))],
		aliases: { 'shared-fonts.json': 'shared-fonts.json' },
	};
}
