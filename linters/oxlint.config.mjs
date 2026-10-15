import { fileURLToPath } from 'node:url';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import { loadTwIgnore, TW_IGNORE_FILE } from './tw-ignore.mjs';

// Resolved here, not by name, so projects that depend only on this package
// load the plugin under isolated linkers (pnpm, bun --linker isolated).
const tailwindPlugin = fileURLToPath(import.meta.resolve('eslint-plugin-better-tailwindcss'));

const defaultIgnorePatterns = ['public/**', 'node_modules/**', 'vendor/**', 'vendor-prefixed/**', 'eightshift/**', 'coverage/**'];

/**
 * Eightshift oxlint config with Tailwind class checks.
 *
 * Usage in a project's `oxlint.config.ts`:
 *
 *   import { defineConfig } from 'oxlint';
 *   import { createOxlintConfig } from '@eightshift/frontend-libs-tailwind/linters/oxlint.config.mjs';
 *
 *   export default defineConfig(createOxlintConfig({ entryPoint: 'tailwind.css' }));
 *
 * Unknown-class exceptions live in `tw-ignore.json` (shared with `tw-sweep`).
 *
 * @param {object}   options
 * @param {string}   options.entryPoint               Tailwind CSS entry, relative to the config.
 * @param {string}   [options.ignoreFile]             Unknown-class ignore list (JSON array of regex strings).
 * @param {string[]} [options.ignorePatterns]         Extra paths to skip.
 * @param {object}   [options.rules]                  Rule overrides, merged last.
 * @returns {object} oxlint config.
 */
export function createOxlintConfig({ entryPoint, ignoreFile = TW_IGNORE_FILE, ignorePatterns = [], rules = {} }) {
	if (!entryPoint) {
		throw new Error('createOxlintConfig: `entryPoint` is required');
	}

	return {
		plugins: ['eslint', 'unicorn', 'oxc', 'react'],
		jsPlugins: [tailwindPlugin],
		settings: {
			'better-tailwindcss': {
				entryPoint,
				selectors: [...getDefaultSelectors(), { kind: 'attribute', name: '^.+ClassName$', match: [{ type: 'strings' }] }],
			},
		},
		ignorePatterns: [...defaultIgnorePatterns, ...ignorePatterns],
		rules: {
			'no-array-constructor': 'error',
			'no-constant-binary-expression': 'error',
			'no-implicit-coercion': 'error',
			'no-nested-ternary': 'error',
			'no-unused-expressions': 'error',
			'no-void': 'error',
			'no-param-reassign': 'warn',
			'react/rules-of-hooks': 'error',
			'react/exhaustive-deps': 'error',
			'react/react-in-jsx-scope': 'off',
			'react/self-closing-comp': 'warn',
			'better-tailwindcss/no-duplicate-classes': 'error',
			'better-tailwindcss/no-deprecated-classes': 'error',
			'better-tailwindcss/enforce-canonical-classes': 'error',
			'better-tailwindcss/no-unknown-classes': ['error', { ignore: loadTwIgnore(ignoreFile) }],
			'better-tailwindcss/no-conflicting-classes': 'error',
			...rules,
		},
	};
}
