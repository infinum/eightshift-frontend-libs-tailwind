import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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

	if (watch.ignore !== undefined && typeof watch.ignore !== 'function') {
		throw new TypeError('watch.ignore must be a function');
	}

	const validateOptions = (options) => {
		if (Object.hasOwn(options, 'timings')) {
			throw new Error('The timings option is no longer supported');
		}
		if (options.quiet && options.verbose) {
			throw new Error('quiet and verbose cannot be combined');
		}
	};

	root = resolve(root);
	let active;
	const outputs = new Set();
	const run = async (options = {}) => {
		validateOptions(options);
		if (active) {
			throw new Error('A build is already running');
		}

		const started = performance.now();
		const report = (message, detail = false) => {
			if (!options.quiet && (!detail || options.verbose)) {
				console.log(`[eightshift-build] ${message}`);
			}
		};

		active = (async () => {
			report('Starting build…');
			report('Preparing build…', true);
			const context = { ...options, root };
			const configured = typeof preset === 'function' ? await preset(context) : preset;
			outputs.clear();
			const output = typeof configured?.outdir === 'string' && configured.outdir ? resolve(root, configured.outdir) : undefined;
			if (output) {
				const rootFromOutput = relative(output, root);
				if (!rootFromOutput || (!isAbsolute(rootFromOutput) && rootFromOutput !== '..' && !rootFromOutput.startsWith(`..${sep}`))) {
					throw new Error('outdir must not contain the project root');
				}
				outputs.add(output);
			}
			report('Building browser assets…');
			const result = await buildPreset({ ...configured, root });
			const state = { ...context, result };

			if (ssr) {
				report('Building SSR assets…');
				state.ssr = await ssr(state);
			}

			if (publish) {
				report('Running publication…');
				state.publication = await publish(state);
			}

			report(`Build completed in ${((performance.now() - started) / 1000).toFixed(2)}s.`);
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
		watch: (options = {}) => {
			validateOptions(options);
			if ((ssr || publish) && watch.sources === undefined && !watch.ignored?.length) {
				throw new Error('Watch builds with ssr or publish callbacks require explicit watch.sources or watch.ignored');
			}

			return watchBuild({
				sources: ['.'],
				...watch,
				projectDir: root,
				ignore: (path) => {
					if (watch.ignore?.(path)) {
						return true;
					}
					for (const output of outputs) {
						const location = relative(output, path);
						if (!location || (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`))) {
							return true;
						}
						const sibling = relative(dirname(output), path).split(sep)[0];
						if (sibling.startsWith(`.${basename(output)}-stage-`) || sibling.startsWith(`.${basename(output)}-backup-`)) {
							return true;
						}
					}
					return false;
				},
				build: async () => {
					while (active) {
						await active.catch(() => {});
					}
					return run(options);
				},
			});
		},
	};
}

export { buildPreset, createPreset } from './preset.mjs';
export { build } from './build.mjs';
export { watchBuild } from './watch.mjs';
export { packageRelease } from './release.mjs';
