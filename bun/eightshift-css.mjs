import { resolve } from 'node:path';
import { glob } from 'glob';
import { processCss } from './css.mjs';

/**
 * Build the ordered CSS inputs used by migrated Eightshift v3 themes.
 * All paths and glob patterns are relative to projectDir unless absolute.
 * Override paths, groups, manifestGlob or scan exclusions for another layout.
 * responsiveFile replaces the generated @source in the Tailwind entry.
 */
export async function eightshiftCssEntries({
	projectDir,
	surface,
	responsiveFile,
	blocksDir = 'src/Blocks',
	manifestGlob = 'src/**/manifest.json',
	tailwindFile = `tailwind-${surface}.css`,
	colorThemesFile = 'color-themes.css',
	applicationFile = surface === 'admin' ? `${blocksDir}/assets/styles/application-admin.css` : `${blocksDir}/assets/styles/application-blocks-${surface}.css`,
	groups = surface === 'admin' ? ['components', 'custom'] : ['components', 'custom', 'wrapper'],
	scanExclusions = ['.bun-pilot/**', 'es-tw-*-classes.txt'],
	responsiveSource = `@source './es-tw-${surface}-classes.txt';`,
} = {}) {
	if (!projectDir || !['frontend', 'editor', 'admin'].includes(surface)) {
		throw new TypeError('projectDir and a valid CSS surface are required');
	}

	const root = resolve(projectDir);
	const styles = [];

	for (const group of groups) {
		const matches = await glob(`**/*styles-${surface}.css`, { cwd: resolve(root, blocksDir, group), absolute: true, nodir: true, follow: false });

		styles.push(...matches.sort());
	}

	if (surface === 'admin') {
		return [applicationFile, ...styles];
	}

	if (!responsiveFile) {
		throw new TypeError('responsiveFile is required for frontend and editor CSS');
	}

	const manifests = (await glob(manifestGlob, { cwd: root, absolute: true, nodir: true, follow: false })).sort();

	return [
		{
			file: tailwindFile,
			scan: true,
			removeSources: responsiveSource ? [responsiveSource] : [],
			sources: scanExclusions.map((pattern) => ({ pattern, negated: true })),
			scanFiles: [responsiveFile, ...manifests],
		},
		colorThemesFile,
		applicationFile,
		...styles,
	];
}

/** Compile one surface. Options accepted by eightshiftCssEntries are forwarded. */
export async function processEightshiftCss({ outputFile, production = false, browsers, ...options } = {}) {
	const files = await eightshiftCssEntries(options);

	return processCss({ projectDir: options.projectDir, outputFile, files, production, browsers });
}
