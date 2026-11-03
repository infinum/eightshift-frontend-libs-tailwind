import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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

	const chunks = new Map();
	const lazyImports = editorLazyImports({ ...lazy, root, chunks, chunkDir, scriptUrlIdentifier });
	const discoveryPlugin = discovery ? eightshiftDiscovery({ ...discovery, root, outputDir: inside(discovery.outputDir ?? 'discovery'), transformSource: (source, path) => lazyImports.transformSource(discovery.transformSource ? discovery.transformSource(source, path) : source, path) }) : undefined;
	const options = { target: 'browser', ...buildOptions, sourcemap: 'none', entrypoints: [resolve(root, entry)], format: 'iife', splitting: false, write: false, plugins: [...(discoveryPlugin ? [discoveryPlugin] : []), ...plugins, lazyImports.plugin] };
	const paths = [];
	const compile = async (target, format) => {
		const result = await Bun.build({ ...options, entrypoints: [target], format });

		if (!result.success) {
			throw new AggregateError(result.logs, `Editor build failed: ${target}`);
		}

		if (result.outputs.length !== 1 || result.outputs[0].kind !== 'entry-point') {
			throw new Error(`Unexpected editor assets: ${target}`);
		}

		return result.outputs[0].text();
	};
	const write = async (path, source) => {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, source);
		paths.push(path);
	};
	const source = await compile(resolve(root, entry), 'iife');

	await write(entryOutput, `((${scriptUrlIdentifier}) => {\n${source}\n})(document.currentScript.src);\n`);

	for (const [target, name] of chunks) {
		const output = inside(`${chunkDir}/${name}`);
		let entryPath = relative(dirname(output), entryOutput).split(sep).join('/');

		if (!entryPath.startsWith('.')) {
			entryPath = `./${entryPath}`;
		}

		const chunk = await compile(target, 'esm');

		await write(output, `const ${scriptUrlIdentifier} = new URL(${JSON.stringify(entryPath)}, import.meta.url).href;\n${chunk}`);
	}

	return { entry: entryOutput, paths };
}
