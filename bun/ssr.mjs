import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

/** Discover SSR entries by their block/component directory name. */
export async function discoverSsrEntries({ root, pattern = 'src/**/assets-ssr/ssr.{js,mjs}' }) {
	if (typeof root !== 'string' || !root || typeof pattern !== 'string' || !pattern) {
		throw new TypeError('Expected root and a valid SSR glob pattern');
	}

	const entries = new Map();

	for await (const file of new Bun.Glob(pattern).scan({ cwd: resolve(root), onlyFiles: true })) {
		const name = basename(dirname(dirname(file)));

		if (entries.has(name)) {
			throw new Error(`Duplicate SSR entry name: ${name}`);
		}

		entries.set(name, resolve(root, file));
	}

	if (!entries.size) {
		throw new Error('No SSR entries found.');
	}

	return new Map([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

/** Treat CSS imports as source text, matching the theme SSR build. */
export function ssrCssAsText() {
	return {
		name: 'css-as-source',
		setup(build) {
			build.onLoad({ filter: /\.css$/ }, async ({ path }) => ({ contents: await readFile(path, 'utf8'), loader: 'text' }));
		},
	};
}

/**
 * Build discovered SSR entries as individual Node CJS bundles. Paths are
 * relative to root unless absolute. Caller plugins run before the CSS plugin;
 * pass cssAsText: false to disable it. write: false returns in-memory outputs.
 */
export async function buildSsr({ root, outdir, pattern, mode = 'development', plugins = [], cssAsText = true, write = true }) {
	if (typeof root !== 'string' || !root || typeof outdir !== 'string' || !outdir || !['development', 'production'].includes(mode) || !Array.isArray(plugins) || typeof cssAsText !== 'boolean' || typeof write !== 'boolean') {
		throw new TypeError('Invalid SSR build options');
	}

	const directory = resolve(root, outdir);
	const entries = await discoverSsrEntries({ root, pattern });
	const outputs = [];

	for (const [name, entrypoint] of entries) {
		const result = await Bun.build({
			entrypoints: [entrypoint],
			outdir: directory,
			write: false,
			naming: `${name}.js`,
			target: 'node',
			format: 'cjs',
			splitting: false,
			minify: mode === 'production',
			sourcemap: 'none',
			loader: { '.js': 'jsx' },
			define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
			plugins: [...plugins, ...(cssAsText ? [ssrCssAsText()] : [])],
		});

		if (!result.success) {
			throw new AggregateError(result.logs, `SSR build failed: ${name}`);
		}

		if (result.outputs.length !== 1 || result.outputs[0].kind !== 'entry-point') {
			throw new Error(`Unexpected SSR output count or kind for ${name}: ${result.outputs.length}`);
		}

		outputs.push({ name, entrypoint, path: resolve(directory, `${name}.js`), output: result.outputs[0], logs: result.logs });
	}

	if (write) {
		await mkdir(directory, { recursive: true });

		for (const { path, output } of outputs) {
			await writeFile(path, await output.arrayBuffer());
		}
	}

	return { entries, outputs };
}
