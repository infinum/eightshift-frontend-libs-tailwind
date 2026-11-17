import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import stylelint from 'stylelint';

const require = createRequire(import.meta.url);
const base = require('../linters/stylelint.config.js');

test('Tailwind utility nesting and apply do not trigger standard CSS syntax errors', async () => {
	const code = `
@utility example {
	&:hover {
		@apply flex;
	}

	@supports (display: grid) {
		display: grid;
	}
}
`;
	const result = await stylelint.lint({
		code,
		codeFilename: 'example.css',
		config: { ...base, rules: { ...base.rules, 'at-rule-no-unknown': null } },
	});
	const relevantRules = new Set(['at-rule-prelude-no-invalid', 'nesting-selector-no-missing-scoping-root', 'no-invalid-position-declaration']);
	const warnings = result.results[0].warnings.filter(({ rule }) => relevantRules.has(rule));

	assert.deepEqual(warnings, []);
});
