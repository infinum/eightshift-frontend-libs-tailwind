import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { allowPureJsxGrouping } from './plugin-capabilities.mjs';

/**
 * Adapt the published UI Components smart-image worker for flat theme releases.
 * Callbacks belong to one build and provide the worker to the publication step.
 * Unsupported upstream worker URL forms fail rather than producing a broken URL.
 */
export function editorWorkerPlugin({ setEditorWorker, getEditorWorker }) {
	if (typeof setEditorWorker !== 'function' || typeof getEditorWorker !== 'function') {
		throw new TypeError('Worker callbacks are required');
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

				const pattern = /new URL\("" \+ new URL\("(\.\.\/\.\.\/assets\/image-analysis-worker-[A-Za-z0-9_-]+\.js)", import\.meta\.url\)\.href \+ "", "" \+ import\.meta\.url\)/g;
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
				const base = '(typeof __eightshiftEditorScriptUrl !== "undefined" ? __eightshiftEditorScriptUrl : (() => { throw new Error("Smart-image worker requires the Eightshift editor script URL; override media.editorWorker for other bundles"); })())';

				return { contents: source.replace(pattern, `new URL(${JSON.stringify(`editor-assets/${basename(worker)}`)}, ${base})`), loader: 'js', resolveDir: dirname(path) };
			});
		},
	});
}
