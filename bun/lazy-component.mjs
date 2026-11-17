import { Linter } from 'eslint';
import { readFile } from 'node:fs/promises';

const sources = new Set(['@eightshift/frontend-libs-tailwind/scripts', '@eightshift/frontend-libs-tailwind/scripts/helpers']);

export function transformLazyComponents(source) {
	if (!source.includes('lazyComponent')) {
		return source;
	}

	const edits = [];
	let unsupportedNamespace = false;
	const linter = new Linter();
	const messages = linter.verify(source, [
		{
			languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
			plugins: {
				lazy: {
					rules: {
						paths: {
							create(context) {
								return {
									ImportDeclaration(node) {
										if (!sources.has(node.source.value)) {
											return;
										}

										for (const variable of context.sourceCode.getDeclaredVariables(node)) {
											const specifier = variable.defs[0]?.node;

											if (specifier?.type === 'ImportNamespaceSpecifier') {
												for (const reference of variable.references) {
													const member = reference.identifier.parent;
													const call = member?.parent;

													if (member?.type === 'MemberExpression' && (member.property.name === 'lazyComponent' || member.property.value === 'lazyComponent') && call?.type === 'CallExpression' && call.callee === member && typeof call.arguments[0]?.value === 'string') {
														unsupportedNamespace = true;
													}
												}
											}

											if (specifier?.type !== 'ImportSpecifier' || specifier.imported.name !== 'lazyComponent') {
												continue;
											}

											for (const reference of variable.references) {
												const call = reference.identifier.parent;
												const argument = call?.arguments?.[0];

												if (call?.type === 'CallExpression' && call.callee === reference.identifier && argument?.type === 'Literal' && typeof argument.value === 'string') {
													edits.push({ start: argument.range[0], end: argument.range[1] });
												}
											}
										}
									},
								};
							},
						},
					},
				},
			},
			rules: { 'lazy/paths': 'error' },
		},
	]);

	if (unsupportedNamespace) {
		throw new Error('lazyComponent literal paths require a direct named import; namespace calls must use () => import("./component").');
	}

	if (messages.some((message) => message.fatal)) {
		throw new Error('lazyComponent source parsing failed; use a portable loader function for non-JavaScript sources.');
	}

	for (const { start, end } of edits.sort((a, b) => b.start - a.start)) {
		source = `${source.slice(0, start)}()=>import(${source.slice(start, end)})${source.slice(end)}`;
	}

	return source;
}

// Wrap existing loaders rather than claiming their files ahead of them.
export function lazyComponentPlugins(plugins = [], { transformSource = (source) => source, sourcemap } = {}) {
	const transform = (source, path) => {
		const rewritten = transformLazyComponents(source);

		if (rewritten !== source && sourcemap && sourcemap !== 'none') {
			throw new Error(`lazyComponent literal paths do not support source maps (${path}); use () => import("./component") or disable source maps.`);
		}

		return transformSource(rewritten, path);
	};

	return [
		...plugins.map((plugin) => ({
			...plugin,
			setup(builder) {
				return plugin.setup(
					new Proxy(builder, {
						get(target, key) {
							if (key !== 'onLoad') {
								return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
							}

							return (options, callback) =>
								target.onLoad(options, async (args) => {
									const result = await callback(args);

									if (!result || !['js', 'jsx'].includes(result.loader) || typeof result.contents !== 'string') {
										return result;
									}

									return { ...result, contents: transform(result.contents, args.path) };
								});
						},
					}),
				);
			},
		})),
		{
			name: 'eightshift-lazy-component',
			setup(builder) {
				builder.onLoad({ filter: /\.[cm]?jsx?$/, namespace: 'file' }, async ({ path }) => ({ contents: transform(await readFile(path, 'utf8'), path), loader: 'jsx' }));
			},
		},
	];
}
