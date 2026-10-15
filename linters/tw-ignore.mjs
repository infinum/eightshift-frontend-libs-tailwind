import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TW_IGNORE_FILE = 'tw-ignore.json';

/**
 * Loads the project's Tailwind unknown-class ignore list: a JSON array of regex
 * source strings, shared by oxlint (`no-unknown-classes`) and `tw-sweep`.
 *
 * A missing file means "ignore nothing". An invalid file or pattern throws,
 * naming the offending entry, so a typo never silently disables the check.
 *
 * @param {string} [file] Path to the JSON file, relative to `cwd`.
 * @param {string} [cwd]  Base directory.
 * @returns {string[]} Regex source strings.
 */
export function loadTwIgnore(file = TW_IGNORE_FILE, cwd = process.cwd()) {
	const path = resolve(cwd, file);

	if (!existsSync(path)) {
		return [];
	}

	let patterns;

	try {
		patterns = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`${path}: invalid JSON (${error.message})`);
	}

	if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== 'string')) {
		throw new Error(`${path}: expected a JSON array of regex strings`);
	}

	for (const pattern of patterns) {
		try {
			new RegExp(pattern);
		} catch (error) {
			throw new Error(`${path}: invalid pattern ${JSON.stringify(pattern)} (${error.message})`);
		}
	}

	return patterns;
}
