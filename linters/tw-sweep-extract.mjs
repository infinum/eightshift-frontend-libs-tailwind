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

function extractManifest(content, groups) {
	// "twClasses": "a b", "twClassesEditor": "a b", ...
	for (const m of content.matchAll(/"(twClasses\w*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
		pushGroup(groups, 'manifest', m[2], m.index + m[0].length - m[2].length - 1);
	}

	// "twClasses": { "variant": ["a", "b"] } and "twClasses*": ["a", "b"]
	for (const m of content.matchAll(/"(twClasses\w*)"\s*:\s*([[{])/g)) {
		const open = m.index + m[0].length - 1;
		const close = findClose(content, open);

		for (const literal of jsonStrings(content, open + 1, close)) {
			pushGroup(groups, 'manifest', literal.value, literal.start);
		}
	}
}

// ---- PHP -------------------------------------------------------------------

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

		if (skipKeys && /^\s*(\]|=>)/.test(content.slice(re.lastIndex, re.lastIndex + 4))) {
			continue;
		}

		out.push({ value, start: m.index + 1 });
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

// helper name → number of leading arguments that are not classes.
const PHP_HELPERS = {
	tailwindClasses: 1, // (part, attributes, manifest, ...custom)
	getTwPart: 1, // (part, manifest, ...custom)
	getTwClasses: 0, // (attributes, manifest, ...custom)
	clsx: 0, // ([classes or 'class' => condition])
	classnames: 0,
};

// Static class attributes. Values containing PHP or format placeholders are
// built at runtime and skipped.
function extractClassAttributes(content, groups) {
	for (const m of content.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
		const value = m[1] ?? m[2];

		if (/<\?|\$|%|\{/.test(value)) {
			continue;
		}

		pushGroup(groups, 'class-attr', value, m.index + m[0].length - value.length - 1);
	}
}

function extractPhp(content, groups) {
	const helperRe = new RegExp(`\\b(${Object.keys(PHP_HELPERS).join('|')})\\s*\\(`, 'g');

	for (const m of content.matchAll(helperRe)) {
		const open = m.index + m[0].length - 1;
		const close = findClose(content, open);
		const args = callArgs(content, open, close).slice(PHP_HELPERS[m[1]]);
		// clsx keys are classes (`'is-open' => $open`); elsewhere keys are not.
		const skipKeys = m[1] !== 'clsx' && m[1] !== 'classnames';

		for (const arg of args) {
			for (const literal of phpStrings(content, arg.start, arg.end, { skipKeys })) {
				pushGroup(groups, 'php-call', literal.value, literal.start);
			}
		}
	}

	extractClassAttributes(content, groups);

	// Opt-in regions: every string literal that is not an array key is a class
	// source. For class maps no helper call wraps, e.g. Eightshift Forms
	// selectors returned from a filter.
	for (let from = content.indexOf(REGION_START); from !== -1;) {
		const endMarker = content.indexOf(REGION_END, from);
		const end = endMarker === -1 ? content.length : endMarker;
		const bodyStart = Math.min(content.indexOf('\n', from) + 1 || end, end);

		for (const literal of phpStrings(content, bodyStart, end, { skipKeys: true })) {
			pushGroup(groups, 'php-region', literal.value, literal.start);
		}

		from = content.indexOf(REGION_START, end);
	}
}

// ---- JS (files passed explicitly, e.g. by lint-staged) --------------------

function extractJs(content, groups) {
	for (const m of content.matchAll(/\b\w*[cC]lassName\s*[:=]\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
		pushGroup(groups, 'js-attr', m[2], m.index + m[0].length - m[2].length - 1);
	}
}

export function extractGroups(content, file) {
	const groups = [];

	if (file.endsWith('.json')) {
		extractManifest(content, groups);
	} else if (file.endsWith('.php')) {
		extractPhp(content, groups);
	} else if (file.endsWith('.html')) {
		extractClassAttributes(content, groups);
	} else if (/\.(m?js|jsx|tsx?)$/.test(file)) {
		extractJs(content, groups);
	}

	return groups;
}
