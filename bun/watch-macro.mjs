import { Linter } from 'eslint';

export function possibleMacro(source) {
	const pattern = /\b(?:with|assert)\s*(?:\{|\/)|macro:/u;

	if (!pattern.test(source)) {
		return false;
	}

	// Ignore actual comments, not comment-like text in strings or templates.
	const linter = new Linter();
	const messages = linter.verify(source, { languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } }, { allowInlineConfig: false });

	if (messages.some(({ fatal }) => fatal)) {
		return true;
	}

	const tokens = linter.getSourceCode().ast.tokens;

	return tokens.some((token, index) => token.value.includes('macro:') || (['with', 'assert'].includes(token.value) && tokens[index + 1]?.value === '{'));
}
