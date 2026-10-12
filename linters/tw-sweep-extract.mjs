// Class extraction for tw-sweep.
//
// Extraction yields GROUPS. A group is one class "source" (one manifest
// string, one PHP string literal, one class attribute) holding
// {className, start, end} tokens with absolute file offsets.

export const REGION_START = 'tw-sweep-classes-start';
export const REGION_END = 'tw-sweep-classes-end';

// Only tokens that look like utilities. Bare words (`group`, `tab`, `flex`)
// are skipped: they are mostly hooks, and the known ones are always canonical.
export function splitToTokens(value, valueAbsStart) {
	const tokens = [];

	for (const match of value.matchAll(/\S+/g)) {
		const className = match[0];

		if (!/[-:]/.test(className)) {
			continue;
		}

		tokens.push({ className, start: valueAbsStart + match.index, end: valueAbsStart + match.index + className.length });
	}

	return tokens;
}

function pushGroup(groups, kind, value, valueAbsStart) {
	const tokens = splitToTokens(value, valueAbsStart);

	if (tokens.length) {
		groups.push({ kind, tokens });
	}
}

// If a comment starts at `i`, returns the index of its last character;
// otherwise -1. Used outside strings so an apostrophe in a comment never
// opens one. `#[` is a PHP attribute, not a comment.
function commentEnd(content, i) {
	const two = content.slice(i, i + 2);

	if (two === '//' || (content[i] === '#' && content[i + 1] !== '[')) {
		const newline = content.indexOf('\n', i);

		return newline === -1 ? content.length - 1 : newline - 1;
	}

	if (two === '/*') {
		const close = content.indexOf('*/', i + 2);

		return close === -1 ? content.length - 1 : close + 1;
	}

	return -1;
}

function findClose(content, open) {
	const pairs = { '[': ']', '{': '}', '(': ')' };
	const stack = [pairs[content[open]]];
	let quote = null;

	for (let i = open + 1; i < content.length; i++) {
		const char = content[i];

		if (quote) {
			if (char === '\\') {
				i++;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}

		const skipTo = commentEnd(content, i);

		if (skipTo !== -1) {
			i = skipTo;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (pairs[char]) {
			stack.push(pairs[char]);
		} else if (char === stack[stack.length - 1]) {
			stack.pop();

			if (!stack.length) {
				return i;
			}
		}
	}

	return content.length;
}

// ---- manifest.json -------------------------------------------------------

function jsonStrings(content, from, to) {
	const out = [];
	const re = /"((?:[^"\\]|\\.)*)"(\s*:)?/g;

	re.lastIndex = from;

	for (let m; (m = re.exec(content)) && m.index < to;) {
		if (!m[2]) {
			out.push({ value: m[1], start: m.index + 1 });
		}
	}

	return out;
}

// String literal syntaxes. `decode(raw, i)` reads one character or escape at
// `i` of a raw literal body and returns [decoded, sourceLength]; `encode(text)`
// writes a class back so it decodes to `text`. PHP keeps unknown escapes as
// written (`'\_'` and `"\_"` are a backslash and `_`), so its encoders escape a
// backslash only where PHP would otherwise read an escape.
const JSON_STRING = {
	decode: (raw, i) => {
		if (raw[i] !== '\\') {
			return [raw[i], 1];
		}

		const length = raw[i + 1] === 'u' ? 6 : 2;

		return [JSON.parse(`"${raw.slice(i, i + length)}"`), length];
	},
	encode: (text) => JSON.stringify(text).slice(1, -1),
};

const PHP_SINGLE = {
	decode: (raw, i) => (raw[i] === '\\' && (raw[i + 1] === '\\' || raw[i + 1] === "'") ? [raw[i + 1], 2] : [raw[i], 1]),
	encode: (text) => text.replace(/'|\\(?=[\\']|$)/g, '\\$&'),
};

const PHP_DOUBLE_ESCAPES = { n: '\n', t: '\t', r: '\r', v: '\v', f: '\f', e: '\x1b', '\\': '\\', $: '$', '"': '"' };

const PHP_DOUBLE = {
	decode: (raw, i) => (raw[i] === '\\' && Object.hasOwn(PHP_DOUBLE_ESCAPES, raw[i + 1] ?? '') ? [PHP_DOUBLE_ESCAPES[raw[i + 1]], 2] : [raw[i], 1]),
	encode: (text) => text.replace(/["$]|\\(?=[nrtvfe\\$"0-7xu]|$)/g, '\\$&'),
};

const JS_ESCAPES = { n: '\n', t: '\t', r: '\r', v: '\v', f: '\f', b: '\b', 0: '\0', '\n': '' };

// JS drops the backslash of unknown escapes (`'\_'` is `_`).
const jsString = (quote) => ({
	decode: (raw, i) => {
		if (raw[i] !== '\\') {
			return [raw[i], 1];
		}

		const next = raw[i + 1];

		if (next === 'x') {
			return [String.fromCharCode(parseInt(raw.slice(i + 2, i + 4), 16)), 4];
		}

		if (next === 'u') {
			const braced = raw[i + 2] === '{';
			const end = braced ? raw.indexOf('}', i) + 1 : i + 6;

			return [String.fromCodePoint(parseInt(raw.slice(i + (braced ? 3 : 2), braced ? end - 1 : end), 16)), end - i];
		}

		return [JS_ESCAPES[next] ?? next, 2];
	},
	encode: (text) => text.replace(new RegExp(`[\\\\${quote}]`, 'g'), '\\$&'),
});

// Splits a raw literal body (escapes intact) into tokens. Class names are
// decoded, so an escaped newline separates classes; offsets stay on the raw
// source, and `encode` lets `--write` re-escape the replacement.
function pushEscapedGroup(groups, kind, raw, rawStart, syntax) {
	const tokens = [];
	let current = null;

	const finish = () => {
		if (current && /[-:]/.test(current.className)) {
			tokens.push(current);
		}

		current = null;
	};

	for (let i = 0; i < raw.length;) {
		const [char, length] = syntax.decode(raw, i);

		if (/\s/.test(char)) {
			finish();
		} else {
			current ??= { className: '', start: rawStart + i, encode: syntax.encode };
			current.className += char;
			current.end = rawStart + i + length;
		}

		i += length;
	}

	finish();

	if (tokens.length) {
		groups.push({ kind, tokens });
	}
}

function extractManifest(content, groups) {
	// "twClasses": "a b", "twClassesEditor": "a b", ...
	for (const m of content.matchAll(/"(twClasses\w*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
		pushEscapedGroup(groups, 'manifest', m[2], m.index + m[0].length - m[2].length - 1, JSON_STRING);
	}

	// "twClasses": { "variant": ["a", "b"] } and "twClasses*": ["a", "b"]
	for (const m of content.matchAll(/"(twClasses\w*)"\s*:\s*([[{])/g)) {
		const open = m.index + m[0].length - 1;
		const close = findClose(content, open);

		for (const literal of jsonStrings(content, open + 1, close)) {
			pushEscapedGroup(groups, 'manifest', literal.value, literal.start, JSON_STRING);
		}
	}
}

// ---- PHP -------------------------------------------------------------------

// A literal alone in brackets that follow an expression is an index
// (`$map['key']`, `get()['key']`). After `(`, `,`, `=` or a keyword such as
// `return`, the brackets open an array value (`['w-[16px]']`).
function isArrayIndex(content, literalStart, literalEnd) {
	if (!/^\s*\]/.test(content.slice(literalEnd, literalEnd + 4))) {
		return false;
	}

	const before = content.slice(Math.max(0, literalStart - 64), literalStart).match(/(?:(\w+)|[\])}])\s*\[\s*$/);

	return Boolean(before) && !/^(return|yield|echo|print|case|and|or|xor|else)$/i.test(before[1] ?? '');
}

// Comment spans [start, end) in a PHP file. Outside `<?php … ?>` only HTML
// comments count. Inside, PHP comments outside strings count, and a `//` or `#`
// comment ends at the newline or at `?>`, as in PHP.
function phpCommentRanges(content) {
	const ranges = [];
	let inPhp = false;
	let quote = null;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

		if (!inPhp) {
			if (content.startsWith('<?', i)) {
				inPhp = true;
				i++;
			} else if (content.startsWith('<!--', i)) {
				const close = content.indexOf('-->', i + 4);
				const end = close === -1 ? content.length : close + 3;

				ranges.push([i, end]);
				i = end - 1;
			}
			continue;
		}

		if (quote) {
			if (char === '\\') {
				i++;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}

		if (content.startsWith('?>', i)) {
			inPhp = false;
			i++;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		const skipTo = commentEnd(content, i);

		if (skipTo === -1) {
			continue;
		}

		let end = skipTo + 1;

		if (!content.startsWith('/*', i)) {
			const tagClose = content.indexOf('?>', i);

			if (tagClose !== -1 && tagClose < end) {
				end = tagClose;
			}
		}

		ranges.push([i, end]);
		i = end - 1;
	}

	return ranges;
}

function htmlCommentRanges(content) {
	return [...content.matchAll(/<!--[\s\S]*?(?:-->|$)/g)].map((m) => [m.index, m.index + m[0].length]);
}

const inRanges = (ranges, offset) => ranges.some(([start, end]) => offset >= start && offset < end);

// PHP string literals in [from, to). Comments are skipped, because an
// apostrophe in one would otherwise open a string. Double-quoted strings with
// `$` are interpolated, so they are not static classes. With `skipKeys`,
// literals used as array keys or indexes are skipped.
function phpStrings(content, from, to, { skipKeys }) {
	const out = [];
	const re = /\/\/[^\n]*|#(?!\[)[^\n]*|\/\*[\s\S]*?\*\/|'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;

	re.lastIndex = from;

	for (let m; (m = re.exec(content)) && m.index < to;) {
		if (m[1] === undefined && m[2] === undefined) {
			continue;
		}

		const value = m[1] ?? m[2];

		if (m[2] !== undefined && value.includes('$')) {
			continue;
		}

		if (skipKeys && (/^\s*=>/.test(content.slice(re.lastIndex, re.lastIndex + 4)) || isArrayIndex(content, m.index, re.lastIndex))) {
			continue;
		}

		// Comparison operands (`$type === 'layout-grid'`) are values, not classes.
		if (/(===|!==|==|!=|<>)\s*$/.test(content.slice(Math.max(0, m.index - 8), m.index)) || /^\s*(===|!==|==|!=|<>)/.test(content.slice(re.lastIndex, re.lastIndex + 8))) {
			continue;
		}

		out.push({ value, start: m.index + 1, syntax: m[1] === undefined ? PHP_DOUBLE : PHP_SINGLE });
	}

	return out;
}

// Splits call arguments at top-level commas: [{start, end}] (end exclusive).
function callArgs(content, open, close) {
	const args = [];
	let start = open + 1;
	let quote = null;
	let depth = 0;

	for (let i = open + 1; i < close; i++) {
		const char = content[i];

		if (quote) {
			if (char === '\\') {
				i++;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}

		const skipTo = commentEnd(content, i);

		if (skipTo !== -1) {
			i = skipTo;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if ('([{'.includes(char)) {
			depth++;
		} else if (')]}'.includes(char)) {
			depth--;
		} else if (char === ',' && depth === 0) {
			args.push({ start, end: i });
			start = i + 1;
		}
	}

	args.push({ start, end: close });

	return args;
}

// Parenthesised spans inside [from, to): nested calls and groupings. Their
// literals belong to another function (`Helpers::selector($c, '', 'is-on')`),
// not to the helper being scanned.
function nestedParenRanges(content, from, to) {
	const ranges = [];
	let quote = null;

	for (let i = from; i < to; i++) {
		const char = content[i];

		if (quote) {
			if (char === '\\') {
				i++;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}

		const skipTo = commentEnd(content, i);

		if (skipTo !== -1) {
			i = skipTo;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '(') {
			const close = findClose(content, i);

			ranges.push([i, close]);
			i = close;
		}
	}

	return ranges;
}

// helper name → number of leading arguments that are not classes.
const PHP_HELPERS = {
	tailwindClasses: 1, // (part, attributes, manifest, ...custom)
	getTwPart: 1, // (part, manifest, ...custom)
	getTwClasses: 0, // (attributes, manifest, ...custom)
	clsx: 0, // ([classes or 'class' => condition])
	classnames: 0,
};

// Static class attributes outside comments. Values containing PHP or format
// placeholders are built at runtime and skipped.
function extractClassAttributes(content, groups, comments) {
	for (const m of content.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
		if (inRanges(comments, m.index)) {
			continue;
		}

		const value = m[1] ?? m[2];

		if (/<\?|\$|%|\{/.test(value)) {
			continue;
		}

		pushGroup(groups, 'class-attr', value, m.index + m[0].length - value.length - 1);
	}
}

function extractPhp(content, groups) {
	const comments = phpCommentRanges(content);
	// Only the Eightshift helpers: `Helpers::name(` or an unqualified `name(`.
	// Same-named methods on other classes (`FormsHelper::getTwPart`) differ.
	const helperRe = new RegExp(`(?:\\bHelpers::|(?<![\\w$>:]))(${Object.keys(PHP_HELPERS).join('|')})\\s*\\(`, 'g');

	for (const m of content.matchAll(helperRe)) {
		if (inRanges(comments, m.index)) {
			continue;
		}

		const open = m.index + m[0].length - 1;
		const close = findClose(content, open);
		const args = callArgs(content, open, close).slice(PHP_HELPERS[m[1]]);
		// clsx keys are classes (`'is-open' => $open`); elsewhere keys are not.
		const skipKeys = m[1] !== 'clsx' && m[1] !== 'classnames';

		for (const arg of args) {
			const nested = nestedParenRanges(content, arg.start, arg.end);

			for (const literal of phpStrings(content, arg.start, arg.end, { skipKeys })) {
				if (nested.some(([open, close]) => literal.start > open && literal.start < close)) {
					continue;
				}

				pushEscapedGroup(groups, 'php-call', literal.value, literal.start, literal.syntax);
			}
		}
	}

	extractClassAttributes(content, groups, comments);

	// Opt-in regions: every string literal that is not an array key is a class
	// source. For class maps no helper call wraps, e.g. Eightshift Forms
	// selectors returned from a filter.
	for (let from = content.indexOf(REGION_START); from !== -1;) {
		const endMarker = content.indexOf(REGION_END, from);
		const end = endMarker === -1 ? content.length : endMarker;
		const bodyStart = Math.min(content.indexOf('\n', from) + 1 || end, end);

		for (const literal of phpStrings(content, bodyStart, end, { skipKeys: true })) {
			pushEscapedGroup(groups, 'php-region', literal.value, literal.start, literal.syntax);
		}

		from = content.indexOf(REGION_START, end);
	}
}

// ---- JS (files passed explicitly, e.g. by lint-staged) --------------------

function extractJs(content, groups) {
	for (const m of content.matchAll(/\b\w*[cC]lassName\s*[:=]\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
		pushEscapedGroup(groups, 'js-attr', m[2], m.index + m[0].length - m[2].length - 1, jsString(m[1]));
	}
}

// A literal can match more than one source, e.g. a helper call inside a marked
// region. The first source to claim a character range keeps it, so each class
// is reported once and `--write` edits it once.
function dropOverlappingTokens(groups, contentLength) {
	const claimed = new Uint8Array(contentLength);
	const kept = [];

	for (const group of groups) {
		const tokens = group.tokens.filter(({ start, end }) => {
			if (claimed.subarray(start, end).includes(1)) {
				return false;
			}

			claimed.fill(1, start, end);

			return true;
		});

		if (tokens.length) {
			kept.push({ ...group, tokens });
		}
	}

	return kept;
}

export function extractGroups(content, file) {
	const groups = [];

	if (file.endsWith('.json')) {
		extractManifest(content, groups);
	} else if (file.endsWith('.php')) {
		extractPhp(content, groups);
	} else if (file.endsWith('.html')) {
		extractClassAttributes(content, groups, htmlCommentRanges(content));
	} else if (/\.(m?js|jsx|tsx?)$/.test(file)) {
		extractJs(content, groups);
	}

	return dropOverlappingTokens(groups, content.length);
}
