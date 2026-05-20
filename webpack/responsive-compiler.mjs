/**
 * Webpack plugin that scans all `manifest.json` files inside a project and
 * emits two class lists (`es-tw-frontend-classes.txt`, `es-tw-editor-classes.txt`)
 * that Tailwind v4 can pick up via `@source`.
 *
 * Classes are collected from `twClasses` (frontend) and `twClasses` +
 * `twClassesEditor` + `twClassesEditorOnly` (editor). Any classes nested under
 * an object with `responsive: true` are expanded into all configured
 * breakpoint variants (`{bp}:cls` and `max-{bp}:cls`).
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DEFAULT_BREAKPOINTS = ['sm', 'md'];
const DEFAULT_MANIFEST_GLOB = 'src/**/manifest.json';
const FRONTEND_CLASS_KEYS = new Set(['twClasses']);
const EDITOR_CLASS_KEYS = new Set(['twClasses', 'twClassesEditor', 'twClassesEditorOnly']);

const isResponsiveToken = (token, breakpoints) =>
	breakpoints.some((bp) => token.startsWith(`${bp}:`) || token.startsWith(`max-${bp}:`));

const addClasses = (value, breakpoints, output, isResponsive = false) => {
	if (!value) {
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item) => addClasses(item, breakpoints, output, isResponsive));
		return;
	}

	if (typeof value === 'object') {
		const nextResponsive = isResponsive || value.responsive === true;

		Object.entries(value).forEach(([key, item]) => {
			if (key !== 'responsive') {
				addClasses(item, breakpoints, output, nextResponsive);
			}
		});

		return;
	}

	if (typeof value !== 'string') {
		return;
	}

	value
		.split(/\s+/)
		.filter(Boolean)
		.forEach((token) => {
			if (isResponsiveToken(token, breakpoints)) {
				output.add(token);
				return;
			}

			if (isResponsive) {
				breakpoints.forEach((bp) => {
					output.add(`${bp}:${token}`);
					output.add(`max-${bp}:${token}`);
				});
			}
		});
};

const collectTailwindClasses = (value, allowedKeys, breakpoints, output) => {
	if (!value || typeof value !== 'object') {
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item) => collectTailwindClasses(item, allowedKeys, breakpoints, output));
		return;
	}

	Object.entries(value).forEach(([key, item]) => {
		if (allowedKeys.has(key)) {
			addClasses(item, breakpoints, output, value.responsive === true);
			return;
		}

		collectTailwindClasses(item, allowedKeys, breakpoints, output);
	});
};

const processManifest = (jsonPath, breakpoints) => {
	const content = fs.readFileSync(jsonPath, 'utf-8');
	const json = JSON.parse(content);
	const frontend = new Set();
	const editor = new Set();

	collectTailwindClasses(json, FRONTEND_CLASS_KEYS, breakpoints, frontend);
	collectTailwindClasses(json, EDITOR_CLASS_KEYS, breakpoints, editor);

	return { frontend, editor };
};

const runPreprocess = ({ projectDir, breakpoints, manifestGlob, outputFrontend, outputEditor }) => {
	const matches = glob.sync(manifestGlob, { cwd: projectDir, absolute: true });

	const frontend = new Set();
	const editor = new Set();

	matches.forEach((filePath) => {
		const result = processManifest(filePath, breakpoints);
		result.frontend.forEach((cls) => frontend.add(cls));
		result.editor.forEach((cls) => editor.add(cls));
	});

	fs.writeFileSync(outputFrontend, [...frontend].join(' '));
	fs.writeFileSync(outputEditor, [...editor].join(' '));
};

/**
 * Factory returning a webpack plugin that regenerates Tailwind class source
 * files before each build and on every manifest change in watch mode.
 *
 * @param {object} options
 * @param {string} options.projectDir Absolute path to the project root.
 * @param {string[]} [options.breakpoints] Tailwind breakpoint prefixes to expand. Defaults to `['sm', 'md']`.
 * @param {string} [options.manifestGlob] Glob (relative to `projectDir`) used to find manifests. Defaults to `src/**\/manifest.json`.
 * @param {{ frontend?: string, editor?: string }} [options.output] Override absolute output paths.
 */
export const esTwResponsiveCompiler = ({
	projectDir,
	breakpoints = DEFAULT_BREAKPOINTS,
	manifestGlob = DEFAULT_MANIFEST_GLOB,
	output = {},
} = {}) => {
	if (!projectDir) {
		throw new Error('esTwResponsiveCompiler: `projectDir` is required.');
	}

	const config = {
		projectDir,
		breakpoints,
		manifestGlob,
		outputFrontend: output.frontend ?? path.resolve(projectDir, 'es-tw-frontend-classes.txt'),
		outputEditor: output.editor ?? path.resolve(projectDir, 'es-tw-editor-classes.txt'),
	};

	const run = (label) => {
		console.log(`🔄 ${label}`);
		try {
			runPreprocess(config);
			console.log('✅ Done!');
		} catch (error) {
			console.error('❌ Failed. ', error);
		}
	};

	return {
		apply(compiler) {
			compiler.hooks.beforeRun.tap('EsTwResponsiveCompiler', () => {
				run('Generating Tailwind manifest class sources');
			});

			compiler.hooks.watchRun.tapAsync('EsTwResponsiveCompiler', ({ modifiedFiles }, callback) => {
				const manifestChanged = modifiedFiles && [...modifiedFiles].some((file) => file.includes('manifest.json'));

				if (manifestChanged) {
					run('A manifest was modified, re-running Tailwind manifest class generation');
				}

				callback();
			});
		},
	};
};
