import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { generateDiscovery } from './discovery.mjs';
import { generateResponsiveClasses } from './responsive.mjs';
import { buildEditor } from './editor.mjs';
import { wordpressPlugin } from './wordpress.mjs';

const markerName = '.eightshift-bun-build';
const markerContents = 'eightshift-bun-build-v1\n';

async function rejectSymlinkPath(path, root) {
	const boundary = root && resolve(root);
	const location = boundary && relative(boundary, path);
	const withinRoot = boundary && (!location || (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`)));
	const parent = dirname(path);

	if (parent !== path && (!withinRoot || path !== boundary)) {
		await rejectSymlinkPath(parent, root);
	}

	try {
		if ((await lstat(path)).isSymbolicLink()) {
			throw new Error(`Symlink is not allowed: ${path}`);
		}
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}
}

async function inspectTree(directory) {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, item.name);
		const info = await lstat(path);

		if (info.isSymbolicLink()) {
			throw new Error(`Symlink is not allowed: ${path}`);
		}

		if (info.isDirectory()) {
			await inspectTree(path);
		} else if (!info.isFile()) {
			throw new Error(`Unsupported output type: ${path}`);
		}
	}
}

async function removeTree(directory) {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, item.name);
		const info = await lstat(path);

		if (info.isDirectory() && !info.isSymbolicLink()) {
			await removeTree(path);
		} else {
			await unlink(path);
		}
	}

	await rmdir(directory);
}

export async function clearBuildDirectory(directory, root) {
	await rejectSymlinkPath(resolve(directory), root);

	try {
		const info = await lstat(directory);
		if (!info.isDirectory() || info.isSymbolicLink()) {
			throw new Error(`Output must be a real directory: ${directory}`);
		}
		await inspectTree(directory);
		await removeTree(directory);
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}
}

async function assertOwned(directory) {
	let info;

	try {
		info = await lstat(directory);
	} catch (error) {
		if (error.code === 'ENOENT') {
			return false;
		}

		throw error;
	}

	if (!info.isDirectory() || info.isSymbolicLink()) {
		throw new Error(`Output must be a real directory: ${directory}`);
	}

	const marker = join(directory, markerName);
	let markerInfo;

	try {
		markerInfo = await lstat(marker);
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error(`Refusing to replace unowned output: ${directory}`);
		}

		throw error;
	}

	if (!markerInfo.isFile() || markerInfo.isSymbolicLink() || (await readFile(marker, 'utf8')) !== markerContents) {
		throw new Error(`Refusing to replace unowned output: ${directory}`);
	}

	await inspectTree(directory);

	return true;
}

/**
 * Build independent browser ESM entries into a staged directory.
 *
 * entries maps logical names to source paths relative to root. Each entry gets
 * its own directory, chunks and .asset.json, so dependencies include its lazy
 * graph without leaking dependencies from other entries. Callers must load the
 * entry as a module. discovery definitions generate a module at discovery.output
 * relative to the staging directory. responsive options are passed to
 * generateResponsiveClasses with outputs inside staging. css is an optional
 * async callback receiving { root, outdir, discovery, responsive }; it may emit
 * additional CSS/assets into staging. buildOptions can override target, format,
 * splitting, naming, plugins, loaders and defines. Entry points, output directory
 * and writing are controlled by this API to protect staged publication.
 *
 * editor optionally selects a synchronous classic entry with lazy ESM chunks.
 * Existing output is replaced only if it contains this API's ownership marker
 * and every build and callback succeeds. Output trees must not contain symlinks.
 * `direct: true` writes to a fresh output directory without staging or rollback.
 * Generated discovery and responsive files are included in the published tree.
 */
export async function build({ root = process.cwd(), outdir, entries, wpRoot, wordpress = true, discovery, responsive, css, editor, buildOptions = {}, direct = false } = {}) {
	root = resolve(root);

	if (typeof outdir !== 'string' || !outdir || !entries || typeof entries !== 'object' || Array.isArray(entries) || !Object.keys(entries).length) {
		throw new TypeError('outdir and at least one named entry are required');
	}

	outdir = resolve(root, outdir);
	const rootFromOutput = relative(outdir, root);

	if (!rootFromOutput || (!isAbsolute(rootFromOutput) && rootFromOutput !== '..' && !rootFromOutput.startsWith(`..${sep}`))) {
		throw new Error('outdir must not contain the project root');
	}

	await rejectSymlinkPath(outdir, root);
	await assertOwned(outdir);

	for (const [name, entry] of Object.entries(entries)) {
		if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name) || typeof entry !== 'string' || !entry) {
			throw new TypeError(`Invalid entry: ${name}`);
		}
	}

	if (editor && (!editor.entry || !Object.hasOwn(entries, editor.entry))) {
		throw new TypeError('editor.entry must name an entry');
	}

	if (css !== undefined && typeof css !== 'function') {
		throw new TypeError('css must be a function');
	}

	const parent = dirname(outdir);

	await mkdir(parent, { recursive: true });
	const stage = direct ? outdir : join(parent, `.${basename(outdir)}-stage-${randomUUID()}`);
	const backup = join(parent, `.${basename(outdir)}-backup-${randomUUID()}`);

	await mkdir(stage);
	let backedUp = false;
	let published = false;

	try {
		const insideStage = (path) => {
			if (typeof path !== 'string' || !path || isAbsolute(path)) {
				throw new TypeError('Generated output paths must be relative to staging');
			}

			const file = resolve(stage, path);
			const location = relative(stage, file);

			if (!location || location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location)) {
				throw new Error(`Output escapes staging: ${path}`);
			}

			return file;
		};
		let generatedDiscovery;

		if (discovery) {
			generatedDiscovery = insideStage(discovery.output);
			await generateDiscovery({ root, ...discovery, output: generatedDiscovery });
		}

		let generatedResponsive;

		if (responsive) {
			generatedResponsive = {
				frontend: insideStage(responsive.output?.frontend ?? 'responsive/frontend.txt'),
				editor: insideStage(responsive.output?.editor ?? 'responsive/editor.txt'),
			};
			await Promise.all(Object.values(generatedResponsive).map((file) => mkdir(dirname(file), { recursive: true })));
			generateResponsiveClasses({ ...responsive, projectDir: root, output: generatedResponsive });
		}

		if (css) {
			await css({ root, outdir: stage, discovery: generatedDiscovery, responsive: generatedResponsive });
		}

		await rejectSymlinkPath(stage, root);
		await inspectTree(stage);
		const manifest = {};

		for (const [name, entry] of Object.entries(entries)) {
			const directory = join(stage, name);
			const wp = wordpress ? wordpressPlugin({ projectRoot: root, wpRoot: wpRoot && resolve(root, wpRoot) }) : undefined;

			if (editor?.entry === name) {
				const { entry: _entry, ...editorOptions } = editor;
				const built = await buildEditor({ ...editorOptions, root, directory, entry, buildOptions, plugins: [...(buildOptions.plugins ?? []), ...(wp ? [wp.plugin] : [])] });

				await inspectTree(stage);
				const digest = createHash('sha256');

				for (const path of built.paths.map((path) => relative(directory, path).replaceAll('\\', '/')).sort()) {
					const bytes = await readFile(join(directory, path));

					digest
						.update(`${Buffer.byteLength(path)}:`)
						.update(path)
						.update(`${bytes.length}:`)
						.update(bytes);
				}

				const metadata = { dependencies: [...(wp?.dependencies ?? [])].sort(), version: digest.digest('hex') };

				await writeFile(join(directory, `${name}.asset.json`), `${JSON.stringify(metadata, null, 2)}\n`);
				manifest[name] = { entry: `${name}/${relative(directory, built.entry).replaceAll('\\', '/')}`, styles: [], ...metadata };
				continue;
			}

			const result = await Bun.build({
				target: 'browser',
				format: 'esm',
				splitting: true,
				naming: { entry: '[name]-[hash].[ext]', chunk: 'chunks/[name]-[hash].[ext]', asset: 'assets/[name]-[hash].[ext]' },
				...buildOptions,
				entrypoints: [resolve(root, entry)],
				outdir: directory,
				write: true,
				plugins: [...(buildOptions.plugins ?? []), ...(wp ? [wp.plugin] : [])],
			});

			if (!result.success) {
				throw new AggregateError(result.logs, `Bun build failed for ${name}`);
			}

			await rejectSymlinkPath(stage, root);
			await inspectTree(stage);
			const output = result.outputs.filter((item) => item.kind === 'entry-point');

			if (output.length !== 1) {
				throw new Error(`Expected one output for ${name}, got ${output.length}`);
			}

			const digest = createHash('sha256');
			const files = result.outputs.map((item) => ({ item, path: relative(directory, item.path).replaceAll('\\', '/') })).sort((a, b) => a.path.localeCompare(b.path));

			for (const { item, path } of files) {
				if (!path || path.startsWith('../') || isAbsolute(path)) {
					throw new Error(`Unexpected Bun output path: ${item.path}`);
				}

				const bytes = await readFile(item.path);

				digest
					.update(`${Buffer.byteLength(path)}:`)
					.update(path)
					.update(`${bytes.length}:`)
					.update(bytes);
			}

			const metadata = { dependencies: [...(wp?.dependencies ?? [])].sort(), version: digest.digest('hex') };

			await writeFile(join(directory, `${name}.asset.json`), `${JSON.stringify(metadata, null, 2)}\n`);
			manifest[name] = { entry: `${name}/${relative(directory, output[0].path).replaceAll('\\', '/')}`, styles: files.filter(({ path }) => path.endsWith('.css')).map(({ path }) => `${name}/${path}`), ...metadata };
		}

		await inspectTree(stage);
		await writeFile(join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
		await writeFile(join(stage, markerName), markerContents, { flag: 'wx' });
		if (direct) {
			published = true;
			return { outdir, entries: manifest };
		}

		await rejectSymlinkPath(outdir, root);

		if (await assertOwned(outdir)) {
			await rename(outdir, backup);
			backedUp = true;
		}

		try {
			await rename(stage, outdir);
			published = true;
		} catch (error) {
			if (backedUp) {
				await rename(backup, outdir);
				backedUp = false;
			}

			throw error;
		}

		if (backedUp) {
			try {
				await removeTree(backup);
			} catch (error) {
				console.warn(`Build published, but backup cleanup failed at ${backup}:`, error);
			}
		}

		return { outdir, entries: manifest };
	} finally {
		if (!published) {
			await removeTree(stage);
		}
	}
}

export { generateDiscovery, generateResponsiveClasses, wordpressPlugin };
