module.exports = {
	parser: '@babel/eslint-parser',
	plugins: [
		"@babel",
	],
	ignorePatterns: [
		'node_modules/*',
		'vendor/*',
		'tests/*',
	],
	globals: {
		wp: true,
	},
	rules: {
		'jsx-a11y/no-autofocus': 0,
		'react/no-children-prop': 0,
		'react-hooks/rules-of-hooks': 0,
		'react/display-name': 0,
		'max-len': [
			'error',
			{
				code: 180,
				tabWidth: 4,
				ignoreComments: true,
			}
		],
		'padding-line-between-statements': 0,
	}
};
