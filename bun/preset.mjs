import { isAbsolute, relative, resolve, sep } from 'node:path';
import { build } from './build.mjs';
import { processEightshiftCss } from './eightshift-css.mjs';

const checkOptions = (value, keys, label) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new TypeError(`${label} must be an object`);
	}

	for (const key of Object.keys(value)) {
		if (!keys.includes(key)) {
			throw new TypeError(`Unknown ${label} option: ${key}`);
		}
	}
};

const feature = (value, keys, label) => {
	if (value === undefined || value === false) {
		return undefined;
	}

	checkOptions(value, keys, label);

	return { ...value };
};

/**
 * Create build options for a project. No layout or entrypoints are assumed.
 * discovery and responsive are disabled unless configured. CSS is disabled
 * unless configured as a callback or an array of Eightshift surface options.
 * Set wordpress: false to bundle dependencies instead of externalizing them.
 * Configure Bun target, format, naming and splitting via buildOptions.
 * Entry points, staging output and write mode are controlled by build.
 * editor: { entry, filename, chunkDir, scriptUrlIdentifier, discovery, lazy }
 * makes the named entry a synchronous classic script with lazy ESM chunks.
 * discovery configures eightshiftDiscovery; lazy configures editorLazyImports.
 * Both are opt-in, and all filenames and discovery behavior are overridable.
 */
export function createPreset(options = {}) {
	checkOptions(options, ['root', 'outdir', 'entries', 'wpRoot', 'wordpress', 'discovery', 'responsive', 'css', 'editor', 'buildOptions', 'direct'], 'preset');
	const { root = process.cwd(), outdir, entries, wpRoot, wordpress = true, buildOptions = {}, direct = false } = options;

	if (typeof root !== 'string' || !root || typeof outdir !== 'string' || !outdir) {
		throw new TypeError('root and outdir must be non-empty strings');
	}

	if (!entries || typeof entries !== 'object' || Array.isArray(entries) || !Object.keys(entries).length) {
		throw new TypeError('entries must contain named entrypoints');
	}

	if (typeof wordpress !== 'boolean') {
		throw new TypeError('wordpress must be a boolean');
	}

	if (wpRoot !== undefined && (typeof wpRoot !== 'string' || !wpRoot)) {
		throw new TypeError('wpRoot must be a non-empty string');
	}

	if (!buildOptions || typeof buildOptions !== 'object' || Array.isArray(buildOptions)) {
		throw new TypeError('buildOptions must be an object');
	}

	for (const key of ['entrypoints', 'outdir', 'write']) {
		if (Object.hasOwn(buildOptions, key)) {
			throw new TypeError(`buildOptions.${key} is controlled by build`);
		}
	}

	const editor = feature(options.editor, ['entry', 'chunkDir', 'filename', 'scriptUrlIdentifier', 'discovery', 'lazy'], 'editor');
	const discovery = feature(options.discovery, ['output', 'definitions'], 'discovery');
	const responsive = feature(options.responsive, ['breakpoints', 'manifestGlob', 'output'], 'responsive');

	if (responsive?.output !== undefined) {
		checkOptions(responsive.output, ['frontend', 'editor'], 'responsive.output');
	}

	let css;

	if (options.css !== undefined && options.css !== false) {
		if (typeof options.css === 'function') {
			css = options.css;
		} else {
			if (!Array.isArray(options.css)) {
				throw new TypeError('css must be false, a function, or an array of surfaces');
			}

			const surfaces = options.css.map((surface) => {
				checkOptions(surface, ['surface', 'outputFile', 'production', 'browsers', 'blocksDir', 'manifestGlob', 'tailwindFile', 'colorThemesFile', 'applicationFile', 'groups', 'scanExclusions', 'responsiveSource', 'responsiveFile'], 'css surface');

				if (!['frontend', 'editor', 'admin'].includes(surface.surface) || typeof surface.outputFile !== 'string' || !surface.outputFile || isAbsolute(surface.outputFile)) {
					throw new TypeError('Each CSS surface requires a valid surface and relative outputFile');
				}

				return { ...surface };
			});

			css = async ({ root: projectDir, outdir: stage, responsive: generated }) => {
				for (const { outputFile, ...surface } of surfaces) {
					const output = resolve(stage, outputFile);
					const location = relative(stage, output);

					if (!location || location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location)) {
						throw new Error(`CSS output escapes staging: ${outputFile}`);
					}

					await processEightshiftCss({ ...surface, projectDir, outputFile: output, responsiveFile: surface.responsiveFile ?? generated?.[surface.surface] });
				}
			};
		}
	}

	return { root, outdir, entries: { ...entries }, wpRoot, wordpress, discovery, responsive, css, editor, direct, buildOptions: { ...buildOptions } };
}

/** Build and atomically publish a configured preset. */
export async function buildPreset(options) {
	return build(createPreset(options));
}
