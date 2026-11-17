import linterConfig from './linters/base.config.mjs';

const sourceRules = linterConfig.find((config) => config.rules?.['padding-line-between-statements']).rules;

export default [
	...linterConfig,
	{
		ignores: ['test/**', 'package/**'],
	},
	{
		files: ['**/*.{js,jsx,mjs}'],
		rules: {
			curly: ['error', 'all'],
			'padding-line-between-statements': [
				...sourceRules['padding-line-between-statements'],
				{
					blankLine: 'always',
					prev: 'block-like',
					next: '*',
				},
			],
		},
	},
];
