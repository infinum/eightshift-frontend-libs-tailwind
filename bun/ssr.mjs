import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';

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
 * Build discovered SSR entries as standalone Node CJS bundles in one compilation.
 * Caller plugins retain sequential compilations and run before the CSS plugin.
 * Paths are relative to root unless absolute; cssAsText: false disables the CSS
 * plugin. write: false returns in-memory outputs without touching the output tree.
 */
export async function buildSsr({ root, outdir, pattern, mode = 'development', plugins = [], cssAsText = true, write = true }) {
	if (typeof root !== 'string' || !root || typeof outdir !== 'string' || !outdir || !['development', 'production'].includes(mode) || !Array.isArray(plugins) || typeof cssAsText !== 'boolean' || typeof write !== 'boolean') {
		throw new TypeError('Invalid SSR build options');
	}

	const directory = resolve(root, outdir);
	const entries = await discoverSsrEntries({ root, pattern });
	const outputs = [];

	// Caller plugins may keep per-build state, so retain their sequential lifecycle.
	const groups = plugins.length ? [...entries].map((entry) => new Map([entry])) : [entries];

	for (const group of groups) {
		const result = await Bun.build({
			entrypoints: [...group.values()],
			root: resolve(root),
			// Omitting outdir is essential: Bun can write files despite write: false.
			write: false,
			naming: '[dir]/[name].[ext]',
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
			throw new AggregateError(result.logs, `SSR build failed: ${[...group.keys()].join(', ')}`);
		}

		if (result.outputs.length !== group.size || result.outputs.some((output) => output.kind !== 'entry-point')) {
			throw new Error(`Unexpected SSR output count or kind: ${result.outputs.length}`);
		}

		for (const [name, entrypoint] of group) {
			const expected = relative(resolve(root), entrypoint).replace(/\.m?js$/, '.js');
			const output = result.outputs.find((item) => resolve(root, item.path) === resolve(root, expected));

			if (!output) {
				throw new Error(`Missing SSR output: ${name}`);
			}

			outputs.push({ name, entrypoint, path: resolve(directory, `${name}.js`), output, logs: result.logs });
		}
	}

	if (write) {
		await mkdir(directory, { recursive: true });

		for (const { path, output } of outputs) {
			await writeFile(path, await output.arrayBuffer());
		}
	}

	return { entries, outputs };
}
