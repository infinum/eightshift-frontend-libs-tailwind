import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { parseJsx } from './editor-pure-jsx.mjs';

// Only direct intrinsic descendants of a returned tree. Don't descend into
// expressions, custom components, render props, raw-text elements or attributes.
function slots(ast) {
	const found = [];
	const visit = (node) => {
		if (node?.type !== 'JSXElement' || !/^(?:div|span|p|section|article|strong|em|small|h[1-6]|li|ul|ol|header|footer|main)$/.test(node.openingElement.name.name)) {
			return;
		}

		for (const child of node.children) {
			if (child.type === 'JSXText' && /^[ -~]+$/.test(child.raw) && child.raw.trim() && !child.raw.includes('&')) {
				found.push(child);
			} else {
				visit(child);
			}
		}
	};

	for (const item of ast?.body ?? []) {
		const declarations = item.type === 'ExportNamedDeclaration' && item.declaration?.declarations;

		for (const decl of declarations || []) {
			if (!/Editor$/.test(decl.id.name) || decl.init?.type !== 'ArrowFunctionExpression') {
				continue;
			}

			const body = decl.init.body;
			visit(body.type === 'BlockStatement' ? body.body.findLast((n) => n.type === 'ReturnStatement')?.argument : body);
		}
	}

	return found;
}

export function createTextAnalyzer(root, current, previous) {
	return async (path) => {
		const file = relative(root, path);

		if (!/^src\/Blocks\/custom\/([^/]+)\/components\/\1-editor\.js$/.test(file)) {
			return;
		}

		const source = await readFile(path, 'utf8');
		const cached = current.get(file) ?? previous?.get(file);
		const entry = cached?.source === source ? cached : { source, analysis: analyzeSource(file, source) };
		current.set(file, entry);

		return entry.analysis;
	};
}

function analyzeSource(file, source) {
	if (!source.includes('</') || source.includes('EightshiftWatchText') || source.includes('@jsx')) {
		return;
	}

	const nodes = slots(parseJsx(source));

	if (!nodes.length) {
		return;
	}

	const parts = [],
		values = [];
	let offset = 0;

	for (const node of nodes) {
		parts.push(source.slice(offset, node.range[0]));
		values.push(node.raw);
		offset = node.range[1];
	}

	parts.push(source.slice(offset));

	return { parts, record: { file, shape: createHash('sha256').update(JSON.stringify(parts)).digest('hex'), values } };
}

export function textPlugin(analyzeText, key, records) {
	return {
		name: 'watch-editor-text',
		setup(build) {
			build.onLoad({ filter: /-editor\.js$/, namespace: 'file' }, async ({ path }) => {
				const analysis = await analyzeText(path);

				if (!analysis) {
					return;
				}

				const { parts, record } = analysis;
				records.set(path, record);
				let contents = record.values.map((value, index) => `${parts[index]}<EightshiftWatchText id=${JSON.stringify(record.file + ':' + index)}>${value}</EightshiftWatchText>`).join('');
				contents +=
					parts.at(-1) +
					`\nfunction EightshiftWatchText({id,children}) {const state=globalThis[${JSON.stringify(key)}]??=( {values:new Map(),events:new EventTarget()} ); const snapshot=()=>state.values.get(id)??children;return globalThis.wp.element.useSyncExternalStore(cb=>{state.events.addEventListener('text',cb);return ()=>state.events.removeEventListener('text',cb)},snapshot,snapshot);}`;

				return { contents, loader: 'jsx' };
			});
		},
	};
}
