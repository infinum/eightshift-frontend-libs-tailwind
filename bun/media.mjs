import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { allowPureJsxGrouping } from './plugin-capabilities.mjs';

/**
 * Adapt the published UI Components smart-image worker for structured theme releases.
 * Callbacks belong to one build and provide the worker to the publication step.
 * Unsupported upstream worker URL forms fail rather than producing a broken URL.
 */
export function editorWorkerPlugin({ setEditorWorker, getEditorWorker, scriptUrlIdentifier = '__eightshiftEditorScriptUrl', publicPrefix }) {
	if (typeof setEditorWorker !== 'function' || typeof getEditorWorker !== 'function') {
		throw new TypeError('Worker callbacks are required');
	}

	if (typeof scriptUrlIdentifier !== 'string' || !/^[$A-Z_a-z][$\w]*$/.test(scriptUrlIdentifier)) {
		throw new TypeError('Invalid editor script URL identifier');
	}

	if (publicPrefix !== undefined && (typeof publicPrefix !== 'string' || !publicPrefix)) {
		throw new TypeError('publicPrefix must be a non-empty string');
	}

	return allowPureJsxGrouping({
		name: 'eightshift-editor-worker-url',
		setup(builder) {
			builder.onLoad({ filter: /[/\\]smart-image[/\\]smart-image\.js$/ }, async ({ path }) => {
				if (!/[/\\]@eightshift[/\\]ui-components[/\\]/.test(path)) {
					return;
				}

				const source = await readFile(path, 'utf8');

				if (!source.includes('image-analysis-worker')) {
					return;
				}

				const pattern = /new URL\((?:"" \+ )?new URL\("(\.\.\/\.\.\/assets\/image-analysis-worker-[A-Za-z0-9_-]+\.js)", import\.meta\.url\)\.href(?: \+ "")?, "" \+ import\.meta\.url\)/g;
				const matches = [...source.matchAll(pattern)];

				if (matches.length !== 1) {
					throw new Error(`Unsupported smart-image worker URL in ${path}; configure media.editorWorker to override`);
				}

				const worker = resolve(dirname(path), matches[0][1]);
				const previous = getEditorWorker();

				if (previous && (basename(previous) !== basename(worker) || !(await readFile(previous)).equals(await readFile(worker)))) {
					throw new Error('Conflicting smart-image workers');
				}

				setEditorWorker(worker);
				const editorPath = `editor-assets/${basename(worker)}`;
				const publicPath = `editor/${editorPath}`;
				const url = publicPrefix
					? `new URL(${JSON.stringify(`${publicPrefix}${publicPath}`)}, globalThis.location.href)`
					: `(typeof ${scriptUrlIdentifier} !== "undefined" ? new URL(${JSON.stringify(editorPath)}, ${scriptUrlIdentifier}) : (() => { throw new Error("Smart-image worker requires a publicPrefix outside the editor"); })())`;

				return { contents: source.replace(pattern, url), loader: 'js', resolveDir: dirname(path) };
			});
		},
	});
}
