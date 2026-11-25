import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, readdirSync } from 'node:fs';
import { lstat, readdir, readFile, mkdir, writeFile, rename, rm, link, unlink, realpath } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import postcss from 'postcss';
import { processCss } from './css.mjs';
import { hotMarker } from './hot-watch.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const optional = async (path) =>
	readFile(path).catch((error) => {
		if (error.code !== 'ENOENT') {
			throw error;
		}

		return null;
	});
export async function importSignature(file) {
	const imports = [];
	postcss.parse(await readFile(file, 'utf8'), { from: file }).walkAtRules((rule) => {
		if (rule.name.toLowerCase() !== 'apply') {
			imports.push(rule.toString());
		}
	});

	return JSON.stringify(imports);
}

export function outputStamp(root) {
	const rows = [];
	// Like sourceSnapshot, walk local metadata without a thread-pool round trip per entry.
	function visit(path) {
		const s = lstatSync(path, { bigint: true });

		if (s.isDirectory()) {
			for (const name of readdirSync(path)) {
				visit(resolve(path, name));
			}
		} else if (!s.isFile()) {
			throw Error('Unexpected watch output type');
		}

		rows.push(`${path}:${s.ino}:${s.ctimeNs}:${s.size}`);
	}

	visit(resolve(root, 'public'));

	try {
		visit(resolve(root, 'eightshift/manifests.json'));
	} catch (e) {
		if (e.code !== 'ENOENT') {
			throw e;
		}
	}

	return digest(rows.sort().join('\n'));
}

// Independent of event delivery: a recursive watch can miss a new directory's children.
export function sourceSnapshot(root, sources) {
	const rows = new Map();
	const visit = (path, optional) => {
		const st = lstatSync(path, { bigint: true, throwIfNoEntry: false });

		if (!st) {
			return optional;
		}

		const identity = `${st.dev}:${st.ino}:${st.mode}`;

		if (st.isDirectory()) {
			rows.set(path, { stamp: identity });

			return readdirSync(path).every((name) => visit(resolve(path, name), false));
		}

		if (!st.isFile() || st.nlink !== 1n) {
			return false;
		}

		rows.set(path, { stamp: `${identity}:${st.ctimeNs}:${st.size}`, dev: st.dev, ino: st.ino, mode: st.mode });

		return true;
	};

	try {
		return sources.every((name) => visit(resolve(root, name), true)) ? rows : null;
	} catch {
		return null;
	}
}

function sameTree(before, after, except) {
	return before && after && before.size === after.size && [...before].every(([path, entry]) => after.has(path) && (path === except || after.get(path).stamp === entry.stamp));
}

function atomicSources(root, watchSources, paths, target, before) {
	if (!before?.has(target) || !paths.includes(target) || paths.some((path) => path !== target && (before.has(path) || (path !== target + '.tmp' && path !== target + '.new')))) {
		return null;
	}

	const after = sourceSnapshot(root, watchSources);

	if (!sameTree(before, after, target)) {
		return null;
	}

	const old = before.get(target);
	const next = after.get(target);

	return old.ino !== undefined && next.ino !== undefined && old.dev === next.dev && old.mode === next.mode && old.ino !== next.ino ? after : null;
}

export async function quickCss({ root, changes, watchSources, previous, prefix, commit }) {
	if (!previous?.stamp || !changes?.paths.length || changes.unknown) {
		return false;
	}

	const targets = changes.paths.filter((path) => previous.imports.has(path));
	if (targets.length !== 1) return false;
	const [target] = targets;
	const sources = changes.structural ? atomicSources(root, watchSources, changes.paths, target, previous.sources) : sourceSnapshot(root, watchSources);

	if (changes.structural ? !sources : changes.paths.some((path) => path !== target) || !sameTree(previous.sources, sources, target)) {
		return false;
	}

	if (previous.excluded.has(await realpath(target)) || !previous.css.has(target)) {
		return false;
	}

	const pub = resolve(root, 'public'),
		markerPath = resolve(pub, hotMarker),
		manifestPath = resolve(pub, 'manifest.json'),
		cachePath = resolve(root, 'eightshift/manifests.json');
	const verify = async () => {
		if (outputStamp(root) !== previous.stamp || (previous.marker && (await readFile(markerPath, 'utf8')) !== previous.marker)) {
			throw Error('CSS publication refused: outputs no longer match this watch session');
		}
	};

	await verify();

	if ((await importSignature(target)) !== previous.imports.get(target)) {
		return false;
	}

	const stage = resolve(root, '.bun-pilot', `css-${randomUUID()}`);
	await mkdir(stage, { recursive: true });

	try {
		const oldManifest = await readFile(manifestPath);
		const manifest = JSON.parse(oldManifest);
		const styles = { ...previous.styles };
		const plans = new Map();
		const newFiles = [],
			oldFiles = [];

		for (const [name, plan] of previous.plans) {
			const generated = resolve(stage, `${name}.txt`);

			if (plan.bytes) {
				await writeFile(generated, plan.bytes);
			}

			const files = plan.files.map((entry) => (!entry.scanFiles ? entry : { ...entry, scanFiles: entry.scanFiles.map((file) => (file === plan.generated ? generated : file)) }));
			const outputFile = resolve(stage, name + '.css');
			const start = performance.now();
			const capture = { entries: new Map(), existingAssets: true };
			const result = await processCss({ projectDir: root, files, outputFile, capture, reuse: plan.capture, production: true });

			if (process.env.EIGHTSHIFT_WATCH_TIMINGS) {
				console.info(`[watch-css] ${name}: ${Math.round(performance.now() - start)}ms`);
			}

			const sidecars = (snapshot) => [...new Set([...snapshot.entries.values()].flatMap((entry) => [...entry.assetsToRestore.keys()]))].sort();
			if (JSON.stringify(sidecars(capture)) !== JSON.stringify(sidecars(plan.capture))) return false;
			const deps = result.dependencies.map((file) => (file === generated ? plan.generated : file));

			if (deps.length !== plan.dependencies.length || deps.some((file) => !plan.dependencies.includes(file))) {
				return false;
			}

			plans.set(name, { ...plan, capture });
			const next = `${prefix}css/${name}-${digest(await readFile(outputFile))}.css`,
				old = styles[name];

			if (next !== old) {
				newFiles.push([outputFile, resolve(pub, 'css', basename(next))]);
				oldFiles.push(resolve(pub, 'css', basename(old)));
				styles[name] = manifest[name + '.css'] = next;
			}
		}

		const publicationStart = performance.now();

		// A changed asset graph needs the full packager's retention and collision rules.
		for (const file of await readdir(stage)) {
			if ([...previous.plans.keys()].some((name) => file === name + '.txt' || file === name + '.css')) {
				continue;
			}

			const old = await optional(resolve(pub, 'css', file));

			if (!old?.equals(await readFile(resolve(stage, file)))) {
				return false;
			}
		}

		await verify();

		if (!sameTree(sources, sourceSnapshot(root, watchSources))) {
			return false;
		}

		if (!newFiles.length) {
			commit({ ...previous, plans, sources });

			return true;
		}

		const version = randomUUID(),
			marker =
				previous.marker &&
				JSON.stringify({
					version,
					parent: previous.version,
					base: previous.base,
					styles,
					delta: {
						text: [],
						styles: Object.keys(styles)
							.filter((k) => styles[k] !== previous.styles[k])
							.map((k) => [previous.styles[k], styles[k]]),
					},
				});
		const cache = await optional(cachePath);
		const replacements = [];
		async function stageBytes(path, bytes) {
			const old = await readFile(path);
			const tmp = resolve(stage, randomUUID());
			const backup = resolve(stage, randomUUID());
			await writeFile(tmp, bytes, { mode: (await lstat(path)).mode & 0o777 });
			await writeFile(backup, old, { mode: (await lstat(path)).mode & 0o777 });
			replacements.push({ path, tmp, backup });
		}

		for (const name of Object.keys(styles)) {
			const path = resolve(pub, name + '.asset.json');
			const data = JSON.parse(await readFile(path));
			data.version = digest(previous.base + JSON.stringify(styles));
			await stageBytes(path, JSON.stringify(data, null, 2) + '\n');
		}

		await stageBytes(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

		if (cache) {
			const data = JSON.parse(cache);
			data.assets.assets = manifest;
			await stageBytes(cachePath, JSON.stringify(data));
		}

		if (marker) await stageBytes(markerPath, marker);
		await verify();
		const undo = [];

		try {
			for (const [src, dest] of newFiles) {
				await link(src, dest);
				undo.push(() => unlink(dest));
				// Dropping the staging link changes ctime; do it before recording the next generation.
				await unlink(src);
			}

			for (const { path, tmp, backup } of replacements) {
				await rename(tmp, path);
				undo.push(() => rename(backup, path));
			}
		} catch (error) {
			for (const rollback of undo.reverse()) {
				await rollback();
			}

			throw error;
		}

		if (process.env.EIGHTSHIFT_WATCH_TIMINGS) {
			console.info(`[watch-css] publication: ${Math.round(performance.now() - publicationStart)}ms`);
		}

		for (const file of oldFiles) {
			await unlink(file);
		}

		commit({ ...previous, plans, sources, styles, marker, version, stamp: outputStamp(root) });

		return true;
	} finally {
		await rm(stage, { recursive: true, force: true });
	}
}
