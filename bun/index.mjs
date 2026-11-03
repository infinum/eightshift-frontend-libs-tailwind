import { resolve } from 'node:path';
import { buildPreset, createPreset } from './preset.mjs';
import { watchBuild } from './watch.mjs';

/**
 * Define a reusable build. `preset` may be an object or a function of the
 * invocation context. `ssr` and `publish` run after the browser build, in that
 * order; neither is included in the browser build's atomic publication.
 * Watch options are passed to watchBuild, with root and build controlled here.
 */
export function defineBuild({ root = process.cwd(), preset, ssr, publish, watch = {} } = {}) {
	if (typeof root !== 'string' || !root) {
		throw new TypeError('root must be a non-empty string');
	}

	if (!preset || (typeof preset !== 'object' && typeof preset !== 'function') || Array.isArray(preset)) {
		throw new TypeError('preset must be an object or function');
	}

	if (ssr !== undefined && typeof ssr !== 'function') {
		throw new TypeError('ssr must be a function');
	}

	if (publish !== undefined && typeof publish !== 'function') {
		throw new TypeError('publish must be a function');
	}

	if (!watch || typeof watch !== 'object' || Array.isArray(watch)) {
		throw new TypeError('watch must be an object');
	}

	root = resolve(root);
	let active;
	const run = async (options = {}) => {
		if (active) {
			throw new Error('A build is already running');
		}

		active = (async () => {
			const context = { ...options, root };
			const configured = typeof preset === 'function' ? await preset(context) : preset;
			const result = await buildPreset({ ...configured, root });
			const state = { ...context, result };

			if (ssr) {
				state.ssr = await ssr(state);
			}

			if (publish) {
				state.publication = await publish(state);
			}

			return state;
		})();

		try {
			return await active;
		} finally {
			active = undefined;
		}
	};

	return {
		build: run,
		watch: (options = {}) => watchBuild({ sources: ['.'], ...watch, projectDir: root, build: () => run(options) }),
	};
}

export { buildPreset, createPreset } from './preset.mjs';
export { build } from './build.mjs';
export { watchBuild } from './watch.mjs';
export { packageRelease } from './release.mjs';
