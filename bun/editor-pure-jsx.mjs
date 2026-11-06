import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path';
import { Linter } from 'eslint';

const linter = new Linter();
const inDependencies = (path) => path.split(sep).includes('node_modules');
const comparePaths = (a, b) => (a.path < b.path ? -1 : Number(a.path > b.path));

function parse(source) {
	let ast;
	const messages = linter.verify(
		source,
		[
			{
				languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
				plugins: {
					capture: {
						rules: {
							ast: {
								create: () => ({
									Program: (node) => {
										ast = node;
									},
								}),
							},
						},
					},
				},
				rules: { 'capture/ast': 'error' },
			},
		],
		{ filename: 'module.js' },
	);
	return messages.length ? undefined : ast;
}

function inspect(source) {
	const ast = parse(source);
	if (!ast) {
		return;
	}
	const factories = new Set();
	const locals = new Set();
	const names = [];
	const pure = (node) => {
		if (!node) {
			return false;
		}
		if (node.type === 'Literal') {
			return !node.regex && (node.value === null || ['string', 'number', 'boolean'].includes(typeof node.value));
		}
		if (node.type === 'UnaryExpression') {
			return ['+', '-', '!'].includes(node.operator) && node.argument.type === 'Literal' && pure(node.argument);
		}
		if (node.type === 'ArrayExpression') {
			return node.elements.every((element) => element === null || pure(element));
		}
		if (node.type === 'ObjectExpression') {
			return node.properties.every((property) => property.type === 'Property' && property.kind === 'init' && !property.method && !property.computed && !property.shorthand && pure(property.value));
		}
		return (
			node.type === 'CallExpression' &&
			!node.optional &&
			node.callee.type === 'Identifier' &&
			factories.has(node.callee.name) &&
			node.arguments.length >= 2 &&
			node.arguments.length <= 3 &&
			node.arguments[0].type === 'Literal' &&
			typeof node.arguments[0].value === 'string' &&
			node.arguments[1].type === 'ObjectExpression' &&
			(node.arguments.length === 2 || node.arguments[2].type === 'Literal') &&
			node.arguments.slice(1).every(pure)
		);
	};
	for (const node of ast.body) {
		if (node.type === 'ImportDeclaration') {
			if (node.source.value !== 'react/jsx-runtime' || !node.specifiers.length || node.attributes?.length) {
				return;
			}
			for (const specifier of node.specifiers) {
				if (specifier.type !== 'ImportSpecifier' || !['jsx', 'jsxs'].includes(specifier.imported.name) || factories.has(specifier.local.name) || locals.has(specifier.local.name)) {
					return;
				}
				factories.add(specifier.local.name);
			}
		} else if (node.type === 'VariableDeclaration') {
			for (const declaration of node.declarations) {
				if (declaration.id.type !== 'Identifier' || locals.has(declaration.id.name) || factories.has(declaration.id.name) || !pure(declaration.init)) {
					return;
				}
				locals.add(declaration.id.name);
			}
		} else if (node.type === 'ExportNamedDeclaration' && !node.source && !node.declaration) {
			for (const specifier of node.specifiers) {
				if (specifier.type !== 'ExportSpecifier' || !locals.has(specifier.local.name) || specifier.exported.type !== 'Identifier') {
					return;
				}
				names.push(specifier.exported.name);
			}
		} else {
			return;
		}
	}
	if (!factories.size || !names.length || new Set(names).size !== names.length) {
		return;
	}
	return { ast, names };
}

function combine({ source, ast }, index) {
	const prefix = `__eightshiftPure${index}_`;
	const edits = [];
	const names = [];
	const replace = (node, text) => edits.push({ start: node.range[0], end: node.range[1], text });
	const visit = (node) => {
		if (!node || typeof node !== 'object') {
			return;
		}
		if (node.type === 'ExportNamedDeclaration') {
			for (const specifier of node.specifiers) {
				names.push(`${prefix}${specifier.local.name} as ${specifier.exported.name}`);
			}
			replace(node, '');
			return;
		}
		if (node.type === 'ImportSpecifier') {
			replace(node, `${node.imported.name} as ${prefix}${node.local.name}`);
			return;
		}
		if (node.type === 'VariableDeclarator') {
			replace(node.id, `${prefix}${node.id.name}`);
			visit(node.init);
			return;
		}
		if (node.type === 'CallExpression') {
			replace(node.callee, `${prefix}${node.callee.name}`);
			node.arguments.forEach(visit);
			return;
		}
		for (const [key, value] of Object.entries(node)) {
			if (['parent', 'tokens', 'comments', 'loc', 'range'].includes(key)) {
				continue;
			}
			if (Array.isArray(value)) {
				value.forEach(visit);
			} else {
				visit(value);
			}
		}
	};
	visit(ast);
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
	}
	return `${source}\nexport { ${names.join(', ')} };\n`;
}

async function analyzeGraph({ result, metadata, directory, entries }) {
	const outputs = new Map(Object.entries(metadata.outputs).map(([path, info]) => [resolve(directory, path), info]));
	const artifacts = new Map(result.outputs.map((output) => [output.path, output]));
	const roots = [...outputs].filter(([, info]) => info.entryPoint && entries.has(resolve(info.entryPoint))).map(([path]) => path);
	if (roots.length !== entries.size) {
		throw new Error('Ambiguous initial editor roots');
	}
	const graph = new Map();
	const scanner = new Bun.Transpiler();
	for (const [path] of outputs) {
		if (!path.endsWith('.js')) {
			continue;
		}
		const artifact = artifacts.get(path);
		if (!artifact) {
			throw new Error('Missing native editor artifact');
		}
		const edges = [];
		for (const imported of scanner.scan(await artifact.text()).imports) {
			if (!imported.path.startsWith('.')) {
				continue;
			}
			const target = resolve(dirname(path), imported.path);
			if (!outputs.has(target) || !['import-statement', 'dynamic-import'].includes(imported.kind)) {
				throw new Error('Unknown native editor graph edge');
			}
			edges.push({ path: target, lazy: Number(imported.kind === 'dynamic-import') });
		}
		graph.set(path, edges);
	}
	const depths = new Map();
	const pending = roots.map((path) => ({ path, depth: 0 }));
	for (let index = 0; index < pending.length; index++) {
		const { path, depth } = pending[index];
		if ((depths.get(path) ?? Infinity) <= depth) {
			continue;
		}
		depths.set(path, depth);
		for (const edge of graph.get(path) ?? []) {
			pending.push({ path: edge.path, depth: depth + edge.lazy });
		}
	}
	const sourceDepths = new Map();
	for (const [path, info] of outputs) {
		for (const [source, input] of Object.entries(info.inputs ?? {})) {
			if (input.bytesInOutput > 0 && depths.has(path)) {
				const key = source.includes(':') ? source : resolve(source);
				sourceDepths.set(key, Math.min(sourceDepths.get(key) ?? Infinity, depths.get(path)));
			}
		}
	}
	return { outputs, depths, sourceDepths };
}

/** Analyze native output, but rebuild original sources rather than editing emitted chunks. */
export async function createPureJsxGroups({ result, metadata, directory, entries, maxBytes }) {
	const { outputs, depths, sourceDepths } = await analyzeGraph({ result, metadata, directory, entries });
	const inputs = new Map(
		Object.entries(metadata.inputs)
			.filter(([path]) => !path.includes(':'))
			.map(([path, info]) => [resolve(path), info]),
	);
	const occurrences = new Map();
	for (const info of outputs.values()) {
		for (const [path, input] of Object.entries(info.inputs ?? {})) {
			if (input.bytesInOutput > 0) {
				const absolute = resolve(path);
				occurrences.set(absolute, (occurrences.get(absolute) ?? 0) + 1);
			}
		}
	}
	const candidates = [];
	for (const [output, info] of outputs) {
		if (info.entryPoint || !depths.has(output) || !Number.isFinite(info.bytes) || info.bytes > maxBytes) {
			continue;
		}
		const sources = Object.entries(info.inputs ?? {})
			.filter(([, input]) => input.bytesInOutput > 0)
			.map(([path]) => resolve(path));
		if (sources.length !== 1) {
			continue;
		}
		const [path] = sources;
		const input = inputs.get(path);
		if (!inDependencies(path) || !path.endsWith('.js') || occurrences.get(path) !== 1 || !input || input.bytes > maxBytes) {
			continue;
		}
		const imports = input.imports;
		if (!imports.length || imports.some((item) => item.original !== 'react/jsx-runtime' || item.kind !== 'import-statement' || item.external) || new Set(imports.map((item) => item.path)).size !== 1) {
			continue;
		}
		const source = await readFile(path, 'utf8');
		const bytes = Buffer.byteLength(source);
		const proof = bytes <= maxBytes && bytes === input.bytes && inspect(source);
		if (proof) {
			candidates.push({ path, source, bytes, ...proof, runtime: imports[0].path, depth: depths.get(output) });
		}
	}
	const buckets = new Map();
	for (const candidate of candidates.sort(comparePaths)) {
		const key = JSON.stringify([dirname(candidate.path), candidate.runtime, candidate.depth]);
		if (!buckets.has(key)) {
			buckets.set(key, []);
		}
		buckets.get(key).push(candidate);
	}
	const groups = [];
	for (const bucket of buckets.values()) {
		let members = [];
		let bytes = 0;
		let names = new Set();
		const flush = () => {
			if (members.length > 1) {
				const id = createHash('sha256')
					.update(members.map((member) => `${member.path}\0${member.source}`).join('\0'))
					.digest('hex')
					.slice(0, 20);
				groups.push({ members, bytes, path: resolve(dirname(members[0].path), `__eightshift-pure-${id}.js`) });
			}
			members = [];
			bytes = 0;
			names = new Set();
		};
		for (const member of bucket) {
			if (bytes + member.bytes > maxBytes || member.names.some((name) => names.has(name))) {
				flush();
			}
			members.push(member);
			bytes += member.bytes;
			member.names.forEach((name) => names.add(name));
		}
		flush();
	}
	const byPath = new Map(groups.flatMap((group) => group.members.map((member) => [member.path, { group, member }])));
	const byGroup = new Map(groups.map((group) => [group.path, group]));
	const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// Broad no-op hooks can disable Bun's import optimization for unrelated modules.
	const sourceFilter = new RegExp(`^(?:${[...byPath.keys()].map(escape).join('|')})$`);
	const importFilter = new RegExp(`(?:^|/)(?:${[...new Set([...byPath.keys()].map((path) => basename(path)))].map(escape).join('|')})$`);
	const consumerCache = new Map();
	async function namedOnly(importer, specifier) {
		// Audited discovery only transforms require.context files; those retain native facades.
		if (!isAbsolute(importer) || !importer.endsWith('.js')) {
			return false;
		}
		if (!consumerCache.has(importer)) {
			const source = await readFile(importer, 'utf8');
			consumerCache.set(importer, source.includes('require.context') ? undefined : parse(source));
		}
		const ast = consumerCache.get(importer);
		const references = ast?.body.filter((node) => node.source?.value === specifier) ?? [];
		return (
			references.length > 0 &&
			references.every(
				(node) =>
					!node.attributes?.length &&
					((node.type === 'ImportDeclaration' && node.specifiers.length > 0 && node.specifiers.every((item) => item.type === 'ImportSpecifier')) || (node.type === 'ExportNamedDeclaration' && node.specifiers.length > 0 && node.specifiers.every((item) => item.type === 'ExportSpecifier'))),
			)
		);
	}
	const plugin = {
		name: 'eightshift-bounded-pure-jsx',
		setup(builder) {
			builder.onResolve({ filter: /^eightshift-pure:/ }, ({ path }) => {
				const target = path.slice('eightshift-pure:'.length);
				if (byGroup.has(target)) {
					return { path: target, namespace: 'eightshift-pure' };
				}
			});
			builder.onResolve({ filter: importFilter }, async ({ path, importer, kind }) => {
				if (kind !== 'import-statement') {
					return;
				}
				const matches = inputs.get(importer)?.imports.filter((item) => item.original === path && item.kind === 'import-statement' && !item.external) ?? [];
				if (matches.length !== 1) {
					return;
				}
				const candidate = byPath.get(resolve(matches[0].path));
				if (candidate && (await namedOnly(importer, path))) {
					return { path: candidate.group.path, namespace: 'eightshift-pure' };
				}
			});
			builder.onLoad({ filter: sourceFilter }, async ({ path }) => {
				const candidate = byPath.get(path);
				if (!candidate) {
					return;
				}
				if ((await readFile(path, 'utf8')) !== candidate.member.source) {
					throw new Error('Pure JSX source changed during compilation');
				}
				return { contents: `export { ${candidate.member.names.join(', ')} } from ${JSON.stringify(`eightshift-pure:${candidate.group.path}`)};`, loader: 'js', resolveDir: dirname(path) };
			});
			builder.onLoad({ filter: /.*/, namespace: 'eightshift-pure' }, async ({ path }) => {
				const group = byGroup.get(path);
				for (const member of group.members) {
					if ((await readFile(member.path, 'utf8')) !== member.source) {
						throw new Error('Pure JSX source changed during compilation');
					}
				}
				return { contents: group.members.map(combine).join('\n'), loader: 'js', resolveDir: dirname(path) };
			});
		},
	};
	return {
		plugin,
		groups,
		async verify(nextMetadata, nextResult) {
			const next = await analyzeGraph({ result: nextResult, metadata: nextMetadata, directory, entries });
			for (const [source, depth] of next.sourceDepths) {
				if (!source.startsWith('eightshift-pure:') && !byPath.has(source) && depth < (sourceDepths.get(source) ?? Infinity)) {
					throw new Error(`Grouping would advance non-grouped source evaluation: ${source}`);
				}
			}
			for (const group of groups) {
				const input = nextMetadata.inputs?.[`eightshift-pure:${group.path}`];
				if (!input || !Array.isArray(input.imports) || !input.imports.length || input.imports.some((item) => item.original !== 'react/jsx-runtime' || item.path !== group.members[0].runtime || item.kind !== 'import-statement' || item.external)) {
					throw new Error('Pure JSX runtime resolution changed during compilation');
				}
			}
		},
		summary: { maxBytes, groups: groups.map((group) => ({ source: `eightshift-pure:${group.path}`, members: group.members.map((member) => member.path), bytes: group.bytes, depth: group.members[0].depth, runtime: group.members[0].runtime })) },
	};
}
