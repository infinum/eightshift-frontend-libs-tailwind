#!/usr/bin/env node
// bin/tw-sweep.mjs
// Project-wide scan for non-canonical Tailwind CSS class names using
// @tailwindcss/node's canonicalizeCandidates API. Sibling of the
// tailwindcss LSP's "suggestCanonicalClasses" lint; this one runs over
// every matching file in the project, not just open buffers.
//
// Generic by design: --preset picks the class-extraction rules
// (default "eightshift" matches @eightshift/frontend-libs-tailwind
// manifests and PHP helpers). Canonicalization itself is preset-free.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { glob } from "glob";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";

const EXIT_OK = 0;
const EXIT_VIOLATIONS = 1;
const EXIT_USAGE = 2;

function parseArgs(argv) {
	const opts = {
		files: [],
		include: null,
		exclude: null,
		preset: "eightshift",
		entry: null,
		write: false,
		check: false,
		rootFontSize: 16,
		help: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--entry") opts.entry = argv[++i];
		else if (a === "--include") opts.include = argv[++i].split(",").map((s) => s.trim());
		else if (a === "--exclude") opts.exclude = argv[++i].split(",").map((s) => s.trim());
		else if (a === "--preset") opts.preset = argv[++i];
		else if (a === "--root-font-size") opts.rootFontSize = Number(argv[++i]);
		else if (a === "--write") opts.write = true;
		else if (a === "--check") opts.check = true;
		else if (a === "-h" || a === "--help") opts.help = true;
		else if (a.startsWith("--")) {
			console.error(`Unknown flag: ${a}`);
			process.exit(EXIT_USAGE);
		} else {
			opts.files.push(a);
		}
	}
	opts.check = opts.check || (!opts.write);
	return opts;
}

function printHelp() {
	console.log(`tw-sweep — find non-canonical Tailwind classes project-wide

Usage:
  tw-sweep [flags] [file...]

Flags:
  --entry <path>           Path to the Tailwind CSS entry (default: ./tailwind.css
                           or wp-content/themes/*/tailwind.css, searched upward
                           from cwd).
  --include <glob,...>     Comma-separated globs to scan (default: see below).
  --exclude <glob,...>     Comma-separated globs to skip.
  --preset <name>          Class-extraction preset (default: eightshift).
  --root-font-size <px>    For canonicalization (default: 16).
  --write                  Rewrite files in place with canonical classes.
  --check                  Report only, exit 1 on any violation (default).
  -h, --help               This help.

Default includes (Eightshift preset): src/Blocks/**/manifest.json, src/**/*.php
Default excludes: public/**, node_modules/**, vendor/**, vendor-prefixed/**

Exit codes:
  0  no violations
  1  violations found
  2  usage error
`);
}

// ---- Preset: class extraction ------------------------------------------
//
// Extraction yields GROUPS. Each group corresponds to one "source" of
// classes (one attribute, one array element, one function-call argument),
// because @tailwindcss/node's canonicalizeCandidates drops unknown
// classes from a batch — so we must canonicalize per source, not per
// file. Each group has its own list of {className, start, end} tokens
// with absolute file offsets.

const PRESETS = {
	eightshift: () => [
		// Flat string: "twClasses": "a b c"  (also twClassesEditor, twClassesEditorOnly)
		{
			kind: "flat",
			re: /"(twClasses\w*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
			wrapper: 2,
		},
		// Object: "twClasses": { "variant": ["a", "b"], ... }
		// Inner captures each quoted string within the block.
		{
			kind: "object",
			re: /"twClasses"\s*:\s*\{([\s\S]*?)\n[ \t]*\}/g,
			inner: /"((?:[^"\\]|\\.)*)"/g,
		},
		// Array: "twClassesEditor": ["a", "bg-[#ff0000]"]
		{
			kind: "array",
			re: /"(twClasses\w*)"\s*:\s*\[((?:"(?:[^"\\]|\\.)*"|[^\]"])*)\]/g,
			inner: /"((?:[^"\\]|\\.)*)"/g,
		},
		// PHP helpers — single class per match.
		{ kind: "php-call", re: /tailwindClasses\([\s\S]*?'((?:[^'\\]|\\.)*)'/g, single: 1 },
		{ kind: "php-call", re: /getTwClasses\([^)]*?'((?:[^'\\]|\\.)*)'\)/g, single: 1 },
		{ kind: "php-call", re: /getTwPart\([^)]*?'((?:[^'\\]|\\.)*)'\)/g, single: 1 },
		// Generic JS/JSX class attributes
		{ kind: "js-attr", re: /className:\s*["']([^"']*)["']/g, single: 1 },
		{ kind: "js-attr", re: /\w+ClassName:\s*["']([^"']*)["']/g, single: 1 },
	],
};

function splitToTokens(value, valueAbsStart) {
	const tokens = [];
	let cursor = 0;
	while (cursor < value.length) {
		while (cursor < value.length && /\s/.test(value[cursor])) cursor++;
		if (cursor >= value.length) break;
		const start = cursor;
		while (cursor < value.length && !/\s/.test(value[cursor])) cursor++;
		const cls = value.slice(start, cursor);
		if (!/[-:]/.test(cls)) continue; // skip non-Tailwind-looking tokens
		tokens.push({
			className: cls,
			start: valueAbsStart + start,
			end: valueAbsStart + cursor,
		});
	}
	return tokens;
}

function findValueOffset(matchObj, value) {
	// Absolute offset of `value` within `matchObj[0]`. matchObj[0] is the
	// full match, value is one of its capture groups. Use indexOf to
	// find the value's position within the match string.
	const idx = matchObj[0].indexOf(value);
	return idx === -1 ? matchObj.index : matchObj.index + idx;
}

function extractGroups(content, patternSet) {
	const groups = [];
	for (const p of patternSet) {
		if (p.kind === "flat") {
			p.re.lastIndex = 0;
			for (let m; (m = p.re.exec(content)); ) {
				const value = m[p.wrapper];
				const valueAbsStart = findValueOffset(m, value);
				const tokens = splitToTokens(value, valueAbsStart);
				if (tokens.length) groups.push({ kind: "flat", tokens });
			}
		} else if (p.kind === "object") {
			// Per outer match: one group, all inner class strings combined
			// (still canonicalized as one source).
			p.re.lastIndex = 0;
			for (let m; (m = p.re.exec(content)); ) {
				const block = m[1];
				const blockAbsStart = findValueOffset(m, block);
				p.inner.lastIndex = 0;
				const innerTokens = [];
				for (let im; (im = p.inner.exec(block)); ) {
					const v = im[1];
					const vAbsStart = blockAbsStart + im.index + im[0].indexOf(v);
					innerTokens.push(...splitToTokens(v, vAbsStart));
				}
				if (innerTokens.length) groups.push({ kind: "object", tokens: innerTokens });
			}
		} else if (p.kind === "array") {
			// Per array element: one group, one canonicalize call. This
			// matters because the design system drops unknowns from
			// batches — per-element keeps alignment intact.
			p.re.lastIndex = 0;
			for (let m; (m = p.re.exec(content)); ) {
				const arr = m[2];
				const arrAbsStart = findValueOffset(m, arr);
				p.inner.lastIndex = 0;
				for (let im; (im = p.inner.exec(arr)); ) {
					const v = im[1];
					const vAbsStart = arrAbsStart + im.index + im[0].indexOf(v);
					const tokens = splitToTokens(v, vAbsStart);
					if (tokens.length) groups.push({ kind: "array-elem", tokens });
				}
			}
		} else if (p.single !== undefined) {
			p.re.lastIndex = 0;
			for (let m; (m = p.re.exec(content)); ) {
				const value = m[p.single];
				const valueAbsStart = findValueOffset(m, value);
				const tokens = splitToTokens(value, valueAbsStart);
				if (tokens.length) groups.push({ kind: p.kind, tokens });
			}
		}
	}
	return groups;
}

function offsetToLineCol(content, offset) {
	let line = 0;
	let lastNl = -1;
	for (let i = 0; i < offset && i < content.length; i++) {
		if (content.charCodeAt(i) === 10) {
			line++;
			lastNl = i;
		}
	}
	return { line: line + 1, col: offset - lastNl };
}

// ---- Entry resolution ---------------------------------------------------

function findDefaultEntry(cwd) {
	const candidates = [
		"tailwind.css",
		"tailwind-frontend.css",
		"tailwind-editor.css",
	];
	const seen = new Set();
	const stack = [cwd];
	while (stack.length) {
		const dir = stack.pop();
		if (seen.has(dir)) continue;
		seen.add(dir);
		for (const name of candidates) {
			const p = resolve(dir, name);
			if (existsSync(p)) return p;
		}
		// WordPress theme fallback.
		const wpThemes = resolve(dir, "wp-content/themes");
		if (existsSync(wpThemes)) {
			try {
				for (const t of readdirSync(wpThemes)) {
					for (const name of candidates) {
						const p = resolve(wpThemes, t, name);
						if (existsSync(p)) return p;
					}
				}
			} catch (_) {
				/* ignore */
			}
		}
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		stack.push(parent);
	}
	return null;
}

// ---- Main ---------------------------------------------------------------

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return EXIT_OK;
	}
	const cwd = process.cwd();

	const entryPath = args.entry
		? resolve(cwd, args.entry)
		: findDefaultEntry(cwd);
	if (!entryPath) {
		console.error("Could not locate a Tailwind CSS entry. Pass --entry <path>.");
		return EXIT_USAGE;
	}
	if (!existsSync(entryPath)) {
		console.error(`Entry CSS not found: ${entryPath}`);
		return EXIT_USAGE;
	}

	const presetName = args.preset;
	if (!PRESETS[presetName]) {
		console.error(
			`Unknown preset "${presetName}". Available: ${Object.keys(PRESETS).join(", ")}`,
		);
		return EXIT_USAGE;
	}
	const patternSet = PRESETS[presetName]();

	let files;
	if (args.files.length) {
		files = args.files.map((f) => resolve(cwd, f));
	} else {
		const includes = args.include ?? [
			"src/Blocks/**/manifest.json",
			"src/**/*.php",
		];
		const excludes = [
			"public/**",
			"node_modules/**",
			"vendor/**",
			"vendor-prefixed/**",
			...(args.exclude ?? []),
		];
		const found = new Set();
		for (const pattern of includes) {
			const matches = await glob(pattern, { cwd, ignore: excludes, absolute: true });
			for (const m of matches) found.add(m);
		}
		files = Array.from(found).sort();
	}

	if (files.length === 0) {
		process.stderr.write("No files matched.\n");
		return EXIT_OK;
	}

	const cssContent = await readFile(entryPath, "utf8");
	const ds = await __unstable__loadDesignSystem(cssContent, {
		base: resolve(entryPath, ".."),
	});

	let total = 0;
	const fileReplacements = new Map();

	for (const file of files) {
		const content = await readFile(file, "utf8");
		const groups = extractGroups(content, patternSet);
		if (groups.length === 0) continue;
		const reps = [];
		for (const group of groups) {
			// @tailwindcss/node's canonicalizeCandidates dedupes its input
			// and returns one canonical per unique class. To preserve
			// alignment with potentially-duplicate className tokens (e.g.
			// the same utility used in multiple options), build a
			// unique-input array plus a per-original index map, then
			// expand the canonical array back to the original length.
			const inputClasses = group.tokens.map((t) => t.className);
			const dedup = [];
			const originalToDedup = new Array(inputClasses.length);
			const seen = new Map();
			for (let i = 0; i < inputClasses.length; i++) {
				const c = inputClasses[i];
				let di = seen.get(c);
				if (di === undefined) {
					di = dedup.length;
					dedup.push(c);
					seen.set(c, di);
				}
				originalToDedup[i] = di;
			}
			const canonicalDedup = ds.canonicalizeCandidates(dedup, {
				rem: args.rootFontSize,
			});
			for (let i = 0; i < group.tokens.length; i++) {
				const canon = canonicalDedup[originalToDedup[i]];
				if (canon && canon !== group.tokens[i].className) {
					const loc = offsetToLineCol(content, group.tokens[i].start);
					const rel = relative(cwd, file);
					console.log(
						`${rel}:${loc.line}:${loc.col}  ${group.tokens[i].className}  →  ${canon}`,
					);
					reps.push({
						start: group.tokens[i].start,
						end: group.tokens[i].end,
						canonical: canon,
					});
					total++;
				}
			}
		}
		if (args.write && reps.length) {
			reps.sort((a, b) => b.start - a.start);
			let next = content;
			for (const r of reps) {
				next = next.slice(0, r.start) + r.canonical + next.slice(r.end);
			}
			fileReplacements.set(file, next);
		}
	}

	if (args.write) {
		for (const [file, content] of fileReplacements) {
			await writeFile(file, content, "utf8");
		}
	}

	if (total > 0) {
		console.error(
			`\n${total} non-canonical class(es) found${args.write ? " (--write applied)" : ""}.`,
		);
		return EXIT_VIOLATIONS;
	}
	return EXIT_OK;
}

main().then(
	(code) => process.exit(code),
	(err) => {
		console.error(err && err.stack ? err.stack : String(err));
		process.exit(EXIT_USAGE);
	},
);
