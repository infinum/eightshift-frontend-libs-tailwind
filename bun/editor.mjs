import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { eightshiftDiscovery, editorLazyImports } from './eightshift-discovery.mjs';

/**
 * Build a synchronous classic entry and lazy ESM chunks. Discovery, when
 * supplied, is composed with lazy rewriting so both can process one file.
 * Other onLoad plugins that consume the same file must compose the rewrite.
 * Editor output must not require extracted CSS or other emitted assets.
 */
export async function buildEditor({ root, directory, entry, buildOptions = {}, plugins = [], chunkDir = 'editor-chunks', filename = 'editor.js', scriptUrlIdentifier = '__eightshiftEditorScriptUrl', discovery, lazy = {} }) {
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

	const chunks = new Map();
	const lazyImports = editorLazyImports({ ...lazy, root, chunks, chunkDir, scriptUrlIdentifier });
	const discoveryPlugin = discovery ? eightshiftDiscovery({ ...discovery, root, outputDir: inside(discovery.outputDir ?? 'discovery'), transformSource: (source, path) => lazyImports.transformSource(discovery.transformSource ? discovery.transformSource(source, path) : source, path) }) : undefined;
	const sourcemap = buildOptions.sourcemap === 'external';
	const options = {
		target: 'browser',
		...buildOptions,
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
	const entryBuild = await compile(resolve(root, entry), 'iife');
	const entryMap = `${basename(entryOutput)}.map`;
	await write(entryOutput, `((${scriptUrlIdentifier}) => {\n${entryBuild.source}\n})(document.currentScript.src);\n${entryBuild.map ? `//# sourceMappingURL=${entryMap}\n` : ''}`);
	if (entryBuild.map) {
		await write(`${entryOutput}.map`, JSON.stringify(entryBuild.map));
	}

	for (const [target, name] of chunks) {
		const output = inside(`${chunkDir}/${name}`);
		let entryPath = relative(dirname(output), entryOutput).split(sep).join('/');

		if (!entryPath.startsWith('.')) {
			entryPath = `./${entryPath}`;
		}

		const chunk = await compile(target, 'esm');
		await write(output, `const ${scriptUrlIdentifier} = new URL(${JSON.stringify(entryPath)}, import.meta.url).href;\n${chunk.source}${chunk.map ? `\n//# sourceMappingURL=${basename(output)}.map\n` : ''}`);
		if (chunk.map) {
			await write(`${output}.map`, JSON.stringify(chunk.map));
		}
	}

	return { entry: entryOutput, paths };
}
