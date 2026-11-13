import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { eightshiftDiscovery, editorLazyImports } from './eightshift-discovery.mjs';
import { buildNativeEditorChunks } from './editor-native.mjs';

/**
 * Build classic registration with lazy ESM modules, or a unified ESM graph. Discovery, when
 * supplied, is composed with lazy rewriting so both can process one file.
 * Other onLoad plugins that consume the same file must compose the rewrite.
 * Editor output must not require extracted CSS or other emitted assets.
 * sharing: 'native' compiles lazy targets as one ESM graph, separate from
 * synchronous registration. 'unified' includes registration in the ESM graph
 * and requires module-aware PHP readiness integration. The default is independent.
 */
export async function buildEditor({ root, directory, entry, buildOptions = {}, plugins = [], chunkDir = 'editor-chunks', filename = 'editor.js', scriptUrlIdentifier = '__eightshiftEditorScriptUrl', discovery, lazy = {}, sharedPackages, sharing = 'independent', pureJsxGroups = false }) {
	if (!['independent', 'native', 'unified'].includes(sharing)) {
		throw new TypeError('editor.sharing must be "independent", "native" or "unified"');
	}

	if (pureJsxGroups !== false && (!pureJsxGroups || typeof pureJsxGroups !== 'object' || Array.isArray(pureJsxGroups) || Object.keys(pureJsxGroups).some((key) => key !== 'maxBytes') || !Number.isSafeInteger(pureJsxGroups.maxBytes) || pureJsxGroups.maxBytes < 1 || pureJsxGroups.maxBytes > 65536)) {
		throw new TypeError('editor.pureJsxGroups must be false or { maxBytes: integer between 1 and 65536 }');
	}

	if (pureJsxGroups && sharing !== 'unified') {
		throw new TypeError('editor.pureJsxGroups requires unified sharing');
	}

	if (sharedPackages !== undefined) {
		throw new TypeError('editor.sharedPackages was removed; use native or unified sharing after checking their initialization and readiness requirements');
	}

	const inside = (path) => {
		if (typeof path !== 'string' || !path || isAbsolute(path)) {
			throw new TypeError('Editor output paths must be relative');
		}

		const output = resolve(directory, path);
		const location = relative(directory, output);

		if (!location || location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location)) {
			throw new Error(`Editor output escapes entry directory: ${path}`);
		}

		return output;
	};

	if (filename.includes('/') || filename.includes('\\')) {
		throw new TypeError('Editor filename must be a basename');
	}

	const entryOutput = inside(filename);
	const chunkOutput = inside(chunkDir);

	if (relative(chunkOutput, entryOutput) === '' || (!relative(chunkOutput, entryOutput).startsWith(`..${sep}`) && relative(chunkOutput, entryOutput) !== '..')) {
		throw new Error('Editor entry cannot be inside its chunk directory');
	}

	if (buildOptions.sourcemap !== undefined && !['none', 'external'].includes(buildOptions.sourcemap)) {
		throw new TypeError('Editor sourcemap must be "none" or "external"');
	}

	if (sharing === 'unified') {
		if (!/^[$A-Z_a-z][$\w]*$/.test(scriptUrlIdentifier)) {
			throw new TypeError('Invalid editor script URL identifier');
		}

		if (Object.keys(lazy).length) {
			throw new TypeError('Unified editor sharing uses native imports and cannot apply lazy import rewriting');
		}

		const target = resolve(root, entry);
		const nativeDiscovery = discovery ? eightshiftDiscovery({ ...discovery, root, outputDir: inside(discovery.outputDir ?? 'discovery') }) : undefined;
		const {
			names,
			outputs,
			pureJsxGroups: grouping,
		} = await buildNativeEditorChunks({
			pureJsxGroups,
			chunks: new Map([[target, 'entry']]),
			directory: chunkOutput,
			entryOutput,
			scriptUrlIdentifier,
			buildOptions: { ...buildOptions, loader: { ...buildOptions.loader, '.svg': 'text' }, sourcemap: buildOptions.sourcemap ?? 'none' },
			plugins: [...(nativeDiscovery ? [nativeDiscovery] : []), ...plugins],
		});
		const paths = [];
		await mkdir(chunkOutput, { recursive: true });

		for (const output of outputs) {
			let contents = Buffer.from(await output.arrayBuffer());

			if (output.sourcemap) {
				contents = Buffer.from(`${await output.text()}\n//# sourceMappingURL=${basename(output.sourcemap.path)}\n`);
			}

			await writeFile(output.path, contents);
			paths.push(output.path);
		}

		let imported = relative(dirname(entryOutput), resolve(chunkOutput, names.get(target)))
			.split(sep)
			.join('/');

		if (!imported.startsWith('.')) {
			imported = `./${imported}`;
		}

		const source = `import ${JSON.stringify(imported)};\nconst readiness = globalThis.eightshiftEditorModules;\nif (readiness?.version !== 1 || typeof readiness.complete !== 'function') throw new Error('Unified editor requires the Eightshift module readiness integration');\nreadiness.complete(import.meta.url);\n`;
		await writeFile(entryOutput, source);
		paths.push(entryOutput);

		return { entry: entryOutput, paths, format: 'module', readiness: 'eightshift-editor-v1', ...(grouping ? { pureJsxGroups: grouping } : {}) };
	}

	const chunks = new Map();
	const lazyImports = editorLazyImports({ ...lazy, root, chunks, chunkDir, scriptUrlIdentifier, versioned: sharing !== 'native' });
	const discoveryPlugin = discovery ? eightshiftDiscovery({ ...discovery, root, outputDir: inside(discovery.outputDir ?? 'discovery'), transformSource: (source, path) => lazyImports.transformSource(discovery.transformSource ? discovery.transformSource(source, path) : source, path) }) : undefined;
	const sourcemap = buildOptions.sourcemap === 'external';
	const options = {
		target: 'browser',
		...buildOptions,
		...(sharing === 'native' ? { minChunkSize: undefined } : {}),
		loader: { ...buildOptions.loader, '.svg': 'text' },
		sourcemap: sourcemap ? 'external' : 'none',
		entrypoints: [resolve(root, entry)],
		format: 'iife',
		splitting: false,
		write: false,
		plugins: [...(discoveryPlugin ? [discoveryPlugin] : []), ...plugins, lazyImports.plugin],
	};
	const paths = [];
	const compile = async (target, format) => {
		const result = await Bun.build({ ...options, entrypoints: [target], format });

		if (!result.success) {
			throw new AggregateError(result.logs, `Editor build failed: ${target}`);
		}

		const entries = result.outputs.filter((output) => output.kind === 'entry-point');
		const maps = result.outputs.filter((output) => output.kind === 'sourcemap');

		if (entries.length !== 1 || maps.length !== (sourcemap ? 1 : 0) || result.outputs.length !== entries.length + maps.length) {
			throw new Error(`Unexpected editor assets: ${target}`);
		}

		const map = sourcemap ? JSON.parse(await maps[0].text()) : undefined;

		if (map) {
			map.mappings = `;${map.mappings}`;
		}

		return { source: await entries[0].text(), map };
	};

	const write = async (path, source) => {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, source);
		paths.push(path);
	};

	let entryBuild = await compile(resolve(root, entry), 'iife');
	const entryMap = `${basename(entryOutput)}.map`;

	if (sharing === 'native') {
		if (chunks.size) {
			const nativeDiscovery = discovery ? eightshiftDiscovery({ ...discovery, root, outputDir: inside(discovery.outputDir ?? 'discovery') }) : undefined;
			const { names, outputs } = await buildNativeEditorChunks({
				chunks,
				directory: chunkOutput,
				entryOutput,
				scriptUrlIdentifier,
				buildOptions: { ...buildOptions, loader: options.loader, sourcemap: options.sourcemap },
				plugins: [...(nativeDiscovery ? [nativeDiscovery] : []), ...plugins],
			});

			for (const [target, name] of names) {
				chunks.set(target, name);
			}

			// Compile against final URLs rather than rewriting code after source-map generation.
			entryBuild = await compile(resolve(root, entry), 'iife');

			if (chunks.size !== names.size) {
				throw new Error('Editor lazy entries changed during native compilation');
			}

			for (const output of outputs) {
				if (output.sourcemap) {
					await write(output.path, `${await output.text()}\n//# sourceMappingURL=${basename(output.sourcemap.path)}\n`);
				} else {
					await write(output.path, Buffer.from(await output.arrayBuffer()));
				}
			}
		}

		await write(entryOutput, `((${scriptUrlIdentifier}) => {\n${entryBuild.source}\n})(document.currentScript.src);\n${entryBuild.map ? `//# sourceMappingURL=${entryMap}\n` : ''}`);

		if (entryBuild.map) {
			await write(`${entryOutput}.map`, JSON.stringify(entryBuild.map));
		}

		return { entry: entryOutput, paths };
	}

	const lazyPaths = [];

	for (const [target, name] of chunks) {
		const output = inside(`${chunkDir}/${name}`);
		let entryPath = relative(dirname(output), entryOutput).split(sep).join('/');

		if (!entryPath.startsWith('.')) {
			entryPath = `./${entryPath}`;
		}

		const chunk = await compile(target, 'esm');
		await write(output, `const ${scriptUrlIdentifier} = new URL(${JSON.stringify(entryPath)}, import.meta.url).href;\n${chunk.source}${chunk.map ? `\n//# sourceMappingURL=${basename(output)}.map\n` : ''}`);
		lazyPaths.push(output);

		if (chunk.map) {
			await write(`${output}.map`, JSON.stringify(chunk.map));
		}
	}

	const digest = createHash('sha256').update(entryBuild.source);
	const contents = new Map();

	for (const path of lazyPaths.sort()) {
		const source = await readFile(path, 'utf8');
		contents.set(path, source);
		digest.update(path.slice(directory.length)).update('\0').update(source).update('\0');
	}

	const version = digest.digest('hex').slice(0, 20);
	const withVersion = (source) => source.replaceAll('?v=00000000000000000000', `?v=${version}`);

	for (const [path, source] of contents) {
		await writeFile(path, withVersion(source));
	}

	await write(entryOutput, `((${scriptUrlIdentifier}) => {\n${withVersion(entryBuild.source)}\n})(document.currentScript.src);\n${entryBuild.map ? `//# sourceMappingURL=${entryMap}\n` : ''}`);

	if (entryBuild.map) {
		await write(`${entryOutput}.map`, JSON.stringify(entryBuild.map));
	}

	return { entry: entryOutput, paths };
}
