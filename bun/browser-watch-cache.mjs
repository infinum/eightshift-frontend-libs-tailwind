import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { init, parse } from 'es-module-lexer';
import { possibleMacro } from './watch-macro.mjs';

// Private preset transport; never passed to Bun or serialized in the manifest.
export const browserWatch = Symbol('browser watch bundles');
const limit = 32 * 1024 * 1024;
const editorPath = /^src\/Blocks\/custom\/([^/]+)\/components\/\1-editor\.js$/;

async function changedFiles(root, changes) {
	if (changes?.unknown !== false || changes.structural !== false || !changes.paths?.length) {
		return;
	}

	const files = new Set();

	for (const path of changes.paths) {
		if (!editorPath.test(relative(root, path).replaceAll('\\', '/')) || (await realpath(path)) !== path) {
			return;
		}

		const info = await stat(path, { bigint: true });

		if (!info.isFile() || info.nlink !== 1n) {
			return;
		}

		files.add(`${info.dev}:${info.ino}`);
	}

	return files;
}

export async function browserWatchCache({ root, changes, watchSession, signature, isStaticCss, wpRoot, report }) {
	const previous = watchSession.get(browserWatch);
	const next = new Map();
	watchSession.set(browserWatch, next);
	const changed = await changedFiles(root, changes).catch(() => undefined);
	const observed = new Set();

	return {
		observer: {
			name: 'watch-browser-inputs',
			setup(builder) {
				observed.clear();

				for (const namespace of ['file', 'wordpress-global', 'eightshift-browser-css']) {
					builder.onLoad({ filter: /.*/, namespace }, ({ path }) => {
						observed.add(namespace === 'file' ? path : `${namespace}:${path}`);
					});
				}
			},
		},
		async restore(name, directory) {
			const record = previous?.get(name);

			if (!changed || !record || record.signature !== signature() || [...changed].some((id) => record.inputs.has(id))) {
				return;
			}

			for (const [path, bytes] of record.files) {
				const target = resolve(directory, path);
				await mkdir(dirname(target), { recursive: true });
				await writeFile(target, bytes, { flag: 'wx' });
			}

			next.set(name, record);
			report(`${name}: reused`);

			return structuredClone(record.entry);
		},
		async capture(name, directory, entry, result, files, entryPath, publicPath) {
			try {
				const metadata = typeof result.metafile === 'string' ? JSON.parse(result.metafile) : result.metafile;
				const inputs = new Set();
				const foundEntry = Object.keys(metadata.inputs).some((input) => resolve(input) === entryPath);

				if (!publicPath) {
					throw new Error('unknown public path');
				}

				const inspected = new Set();

				for (const input of new Set([...observed, ...Object.keys(metadata.inputs)])) {
					// Nontrivial WP wrappers may read another compiler graph. Browser CSS,
					// workers, hot text and eager contexts can write outside this entry.
					if (input.startsWith('wordpress-global:')) {
						const [request, resolvedEntry] = JSON.parse(input.slice('wordpress-global:'.length));

						if (['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(request)) {
							// The wrapper forwards a WordPress global; resolution does not execute React.
							const status = await stat(resolvedEntry, { bigint: true });
							inputs.add(`${status.dev}:${status.ino}`);
							continue;
						}

						if (/^@wordpress\/[a-z0-9-]+$/.test(request)) {
							const core = await stat(resolve(wpRoot, 'wp-includes/js/dist', `${request.slice(11)}.js`), { bigint: true });
							inputs.add(`${core.dev}:${core.ino}`);
							continue;
						}

						if (!['moment', 'jquery', 'lodash', '@babel/runtime/regenerator'].includes(request)) {
							throw new Error(`indirect WordPress inputs: ${request}`);
						}

						continue;
					}

					if (input.startsWith('eightshift-browser-css:') && isStaticCss(name, input.slice('eightshift-browser-css:'.length))) {
						continue;
					}

					if (input === 'eightshift-browser-css-runtime:eightshift:browser-css-runtime') {
						continue;
					}

					if (
						input.includes(':') ||
						editorPath.test(relative(root, resolve(input)).replaceAll('\\', '/')) ||
						/(?:smart-image\.js|\.css)$/i.test(input) ||
						(input.endsWith('.contexts.mjs') && resolve(input) !== resolve(root, '.bun-pilot/theme-build/discovery', `${entryPath.split('/').pop()}.contexts.mjs`))
					) {
						throw new Error(`indirect input or plugin side effect: ${input}`);
					}

					const path = resolve(input);

					if (inspected.has(path)) {
						continue;
					}

					inspected.add(path);

					// Macros can read arbitrary files outside the reported import graph.
					// Reject import attributes (including commented forms) rather than
					// attempting to interpret their type or evaluate compile-time code.
					if (/\.[cm]?[jt]sx?$/i.test(path) && possibleMacro(await readFile(path, 'utf8'))) {
						throw new Error(`possible compile-time import: ${relative(root, path)}`);
					}

					const status = await stat(path, { bigint: true });
					inputs.add(`${status.dev}:${status.ino}`);
				}

				if (!foundEntry || files.reduce((size, { item }) => size + item.size, 0) > limit) {
					throw new Error('unverified or oversized bundle');
				}

				const bytes = await Promise.all([...files.map(({ path }) => path), `${name}.asset.json`].map(async (path) => [path, await readFile(resolve(directory, path))]));
				await init;
				const modules = new Set(files.filter(({ path }) => path.endsWith('.js')).map(({ path }) => publicPath + path));

				for (const [path, content] of bytes) {
					if (path.endsWith('.js') && parse(content.toString())[0].some((edge) => edge.d !== -2 && !modules.has(edge.n))) {
						throw new Error('unverified emitted import');
					}
				}

				next.set(name, { signature: signature(), inputs, files: bytes, entry: structuredClone(entry) });
				report(`${name}: rebuilt and cached`);
			} catch (error) {
				report(`${name}: rebuilt, not cached (${error.message})`);
			}
		},
	};
}
