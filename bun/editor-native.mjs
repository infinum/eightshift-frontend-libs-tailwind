import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rmdir, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { supportsPureJsxGrouping } from './plugin-capabilities.mjs';

const removePassDirectory = async (directory) => {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const path = resolve(directory, item.name);

		if (item.isDirectory()) {
			await removePassDirectory(path);
		} else {
			await unlink(path);
		}
	}

	await rmdir(directory);
};

/** Build lazy targets together without replacing their native import namespaces. */
export async function buildNativeEditorChunks(options) {
	const directory = resolve(options.directory);
	await mkdir(dirname(directory), { recursive: true });
	// Some Bun versions write outdir despite write:false. Never expose discarded passes.
	const privateDirectory = resolve(dirname(directory), `.eightshift-native-${randomUUID()}`);
	await mkdir(privateDirectory);

	try {
		const result = await compileNativeEditorChunks({ ...options, directory: privateDirectory, scriptDirectory: directory });
		const mapPath = (path) => {
			const location = relative(privateDirectory, path);

			if (!location || isAbsolute(location) || location === '..' || location.startsWith(`..${sep}`)) {
				throw new Error(`Native editor output escapes its private directory: ${path}`);
			}

			return resolve(directory, location);
		};

		const outputs = [];
		const byPath = new Map();

		for (const output of result.outputs) {
			// Materialize before cleanup: a BuildArtifact may be backed by its emitted file.
			const bytes = await output.arrayBuffer();
			const artifact = new Blob([bytes], { type: output.type });
			Object.assign(artifact, { path: mapPath(output.path), kind: output.kind, loader: output.loader, hash: output.hash });
			outputs.push(artifact);
			byPath.set(output.path, artifact);
		}

		for (const [index, output] of result.outputs.entries()) {
			if (output.sourcemap) {
				const map = byPath.get(output.sourcemap.path);

				if (!map) {
					throw new Error('Missing native editor source map artifact');
				}

				outputs[index].sourcemap = map;
			}
		}

		const metafile = {
			...result.metafile,
			outputs: Object.fromEntries(Object.entries(result.metafile.outputs).map(([path, info]) => [mapPath(resolve(privateDirectory, path)), { ...info, imports: info.imports?.map((item) => ({ ...item, path: isAbsolute(item.path) && !item.external ? mapPath(item.path) : item.path })) }])),
		};

		return { ...result, outputs, metafile };
	} finally {
		await removePassDirectory(privateDirectory);
	}
}

async function compileNativeEditorChunks({ chunks, directory, scriptDirectory, entryOutput, scriptUrlIdentifier, buildOptions, plugins, pureJsxGroups = false }) {
	let entryPath = relative(scriptDirectory, entryOutput).split(sep).join('/');

	if (!entryPath.startsWith('.')) {
		entryPath = `./${entryPath}`;
	}

	const options = {
		target: 'browser',
		...buildOptions,
		entrypoints: [...chunks.keys()],
		outdir: directory,
		format: 'esm',
		splitting: true,
		write: false,
		metafile: true,
		publicPath: '',
		naming: { entry: 'editor-lazy-[name]-[hash].[ext]', chunk: 'editor-shared-[hash].[ext]', asset: 'editor-asset-[hash].[ext]' },
		banner: `const ${scriptUrlIdentifier} = new URL(${JSON.stringify(entryPath)}, import.meta.url).href;\n${buildOptions.banner ?? ''}`,
		plugins,
	};
	let result = await Bun.build(options);

	if (!result.success) {
		throw new AggregateError(result.logs, 'Native editor sharing build failed');
	}

	const readMetadata = (build) => {
		let metadata;

		try {
			metadata = typeof build.metafile === 'string' ? JSON.parse(build.metafile) : build.metafile;

			if (!metadata?.outputs || typeof metadata.outputs !== 'object') {
				throw new Error('Missing output metadata');
			}
		} catch (cause) {
			throw new Error('Cannot map native editor entries: Bun returned unreadable build metadata', { cause });
		}

		if (!metadata.inputs || typeof metadata.inputs !== 'object') {
			throw new Error('Cannot verify native editor dynamic imports: missing input metadata');
		}

		for (const [source, info] of Object.entries(metadata.inputs)) {
			if (!Array.isArray(info?.imports)) {
				throw new Error(`Cannot verify native editor dynamic imports in ${source}`);
			}

			// Inlined dynamic imports can return plain objects or broken self-import helpers.
			for (const imported of info.imports) {
				if (imported.kind === 'dynamic-import' && !imported.external) {
					throw new Error(`Native editor sharing cannot preserve an inlined dynamic import in ${source}: ${imported.original ?? imported.path}`);
				}
			}
		}

		return metadata;
	};

	let metadata = readMetadata(result);
	let grouping;

	if (pureJsxGroups) {
		let reason;

		if (options.sourcemap && options.sourcemap !== 'none') {
			reason = 'source maps require original ungrouped sources';
		} else if (plugins.some((plugin) => !supportsPureJsxGrouping(plugin))) {
			reason = 'custom plugins/transforms are not supported';
		} else if (buildOptions.alias && Object.keys(buildOptions.alias).length) {
			reason = 'custom resolution aliases are not supported';
		} else if (buildOptions.define?.['process.env.NODE_ENV'] !== '"production"') {
			reason = 'only the standard production JSX runtime is supported';
		}

		if (!reason) {
			try {
				const { createPureJsxGroups } = await import('./editor-pure-jsx.mjs');
				const plan = await createPureJsxGroups({ result, metadata, directory, entries: chunks, maxBytes: pureJsxGroups.maxBytes });
				grouping = plan.summary;

				if (plan.groups.length) {
					const grouped = await Bun.build({ ...options, plugins: [plan.plugin, ...plugins] });

					if (!grouped.success) {
						throw new AggregateError(grouped.logs, 'Grouped native editor compilation failed');
					}

					const groupedMetadata = readMetadata(grouped);
					await plan.verify(groupedMetadata, grouped);
					result = grouped;
					metadata = groupedMetadata;
				}
			} catch (error) {
				reason = error.message;
			}
		}

		if (reason) {
			console.warn(`[eightshift] Pure JSX grouping disabled: ${reason}. Using the ungrouped native build.`);
			grouping = { maxBytes: pureJsxGroups.maxBytes, groups: [], disabled: reason };
		}
	}

	const outputPaths = new Set();

	for (const output of result.outputs) {
		const location = relative(directory, output.path);

		if (!location || isAbsolute(location) || location === '..' || location.startsWith(`..${sep}`)) {
			throw new Error(`Native editor output escapes its directory: ${output.path}`);
		}

		if (!['entry-point', 'chunk', 'sourcemap'].includes(output.kind) || !/\.js(?:\.map)?$/.test(location)) {
			throw new Error(`Unexpected native editor asset: ${output.path}`);
		}

		if (outputPaths.has(output.path)) {
			throw new Error(`Duplicate native editor output: ${output.path}`);
		}

		outputPaths.add(output.path);
	}

	const names = new Map();
	const entries = new Set();

	for (const [file, info] of Object.entries(metadata.outputs)) {
		if (!info.entryPoint) {
			continue;
		}

		const target = resolve(info.entryPoint);

		if (!chunks.has(target)) {
			continue;
		}

		const output = resolve(directory, file);

		if (!outputPaths.has(output) || entries.has(output)) {
			throw new Error(`Missing or ambiguous native editor entry: ${target}`);
		}

		entries.add(output);
		names.set(target, relative(directory, output).split(sep).join('/'));
	}

	if (names.size !== chunks.size) {
		throw new Error(`Expected ${chunks.size} native editor entries, found ${names.size}`);
	}

	return { names, outputs: result.outputs, metafile: metadata, ...(grouping ? { pureJsxGroups: grouping } : {}) };
}
