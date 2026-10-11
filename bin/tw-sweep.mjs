#!/usr/bin/env node
// bin/tw-sweep.mjs
// Project-wide Tailwind class check for sources oxlint cannot read:
// block manifests and PHP. Reports classes the design system does not know
// (unknown) and classes with a canonical spelling (non-canonical), using
// @tailwindcss/node against the project's own Tailwind entry.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import process from 'node:process';
import { glob } from 'glob';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { extractGroups, REGION_START, REGION_END } from '../linters/tw-sweep-extract.mjs';
import { loadTwIgnore, TW_IGNORE_FILE } from '../linters/tw-ignore.mjs';

const EXIT_OK = 0;
const EXIT_VIOLATIONS = 1;
const EXIT_USAGE = 2;

function parseArgs(argv) {
	const opts = {
		files: [],
		include: null,
		exclude: null,
		entry: null,
		ignoreFile: TW_IGNORE_FILE,
		unknown: true,
		write: false,
		rootFontSize: 16,
		help: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];

		if (a === '--entry') opts.entry = argv[++i];
		else if (a === '--include') opts.include = argv[++i].split(',').map((s) => s.trim());
		else if (a === '--exclude') opts.exclude = argv[++i].split(',').map((s) => s.trim());
		else if (a === '--ignore-file') opts.ignoreFile = argv[++i];
		else if (a === '--no-unknown') opts.unknown = false;
		else if (a === '--root-font-size') opts.rootFontSize = Number(argv[++i]);
		else if (a === '--write') opts.write = true;
		else if (a === '--check') opts.write = false;
		else if (a === '-h' || a === '--help') opts.help = true;
		else if (a.startsWith('--')) {
			console.error(`Unknown flag: ${a}`);
			process.exit(EXIT_USAGE);
		} else {
			opts.files.push(a);
		}
	}

	return opts;
}

function printHelp() {
	console.log(`tw-sweep — find unknown and non-canonical Tailwind classes in manifests and PHP

Usage:
  tw-sweep [flags] [file...]

Flags:
  --entry <path>           Tailwind CSS entry (default: ./tailwind.css, tailwind-frontend.css
                           or tailwind-editor.css, searched upward, then wp-content/themes/*).
  --include <glob,...>     Globs to scan (default: src/Blocks/**/manifest.json, src/**/*.php).
  --exclude <glob,...>     Extra globs to skip (always skipped: public, node_modules, vendor*).
  --ignore-file <path>     Unknown-class ignore list, a JSON array of regex strings
                           (default: ./${TW_IGNORE_FILE}; shared with the oxlint config).
  --no-unknown             Only report non-canonical classes.
  --root-font-size <px>    For canonicalization (default: 16).
  --write                  Rewrite non-canonical classes in place. Unknown classes are
                           only reported.
  --check                  Report only (default).
  -h, --help               This help.

Sources: manifest twClasses* strings; PHP class="…" attributes; string arguments of
tailwindClasses/getTwPart (after the part name), getTwClasses, clsx and classnames;
and every non-key string literal between // ${REGION_START} and // ${REGION_END}.
Values that contain PHP, $ interpolation or % placeholders are skipped.

Exit codes: 0 clean, 1 violations, 2 usage error.
`);
}

function findDefaultEntry(cwd) {
	const candidates = ['tailwind.css', 'tailwind-frontend.css', 'tailwind-editor.css'];

	for (let dir = cwd; ; dir = resolve(dir, '..')) {
		for (const name of candidates) {
			if (existsSync(resolve(dir, name))) return resolve(dir, name);
		}

		const wpThemes = resolve(dir, 'wp-content/themes');

		if (existsSync(wpThemes)) {
			for (const theme of readdirSync(wpThemes)) {
				for (const name of candidates) {
					if (existsSync(resolve(wpThemes, theme, name))) return resolve(wpThemes, theme, name);
				}
			}
		}

		if (resolve(dir, '..') === dir) return null;
	}
}

function offsetToLineCol(content, offset) {
	const before = content.slice(0, offset);
	const line = before.split('\n').length;

	return { line, col: offset - before.lastIndexOf('\n') };
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		return EXIT_OK;
	}

	const cwd = process.cwd();
	const entryPath = args.entry ? resolve(cwd, args.entry) : findDefaultEntry(cwd);

	if (!entryPath || !existsSync(entryPath)) {
		console.error(entryPath ? `Entry CSS not found: ${entryPath}` : 'Could not locate a Tailwind CSS entry. Pass --entry <path>.');
		return EXIT_USAGE;
	}

	let ignore;

	try {
		ignore = loadTwIgnore(args.ignoreFile, cwd).map((pattern) => new RegExp(pattern));
	} catch (error) {
		console.error(error.message);
		return EXIT_USAGE;
	}

	let files;

	if (args.files.length) {
		files = args.files.map((f) => resolve(cwd, f));
	} else {
		const includes = args.include ?? ['src/Blocks/**/manifest.json', 'src/**/*.php'];
		const excludes = ['public/**', 'node_modules/**', 'vendor/**', 'vendor-prefixed/**', ...(args.exclude ?? [])];
		const found = new Set();

		for (const pattern of includes) {
			for (const m of await glob(pattern, { cwd, ignore: excludes, absolute: true })) found.add(m);
		}

		files = [...found].sort();
	}

	if (files.length === 0) {
		process.stderr.write('No files matched.\n');
		return EXIT_OK;
	}

	const ds = await __unstable__loadDesignSystem(await readFile(entryPath, 'utf8'), { base: resolve(entryPath, '..') });
	const verdicts = new Map();

	// One class at a time: batches drop unknown classes and merge pairs
	// (top-0 bottom-0 → inset-y-0), which would break token alignment.
	const judge = (className) => {
		if (!verdicts.has(className)) {
			if (ignore.some((re) => re.test(className))) {
				verdicts.set(className, { ok: true });
			} else if (ds.candidatesToCss([className])[0] === null) {
				verdicts.set(className, { unknown: true });
			} else {
				const [canonical] = ds.canonicalizeCandidates([className], { rem: args.rootFontSize });
				verdicts.set(className, canonical && canonical !== className ? { canonical } : { ok: true });
			}
		}

		return verdicts.get(className);
	};

	let unknownCount = 0;
	let canonicalCount = 0;

	for (const file of files) {
		const content = await readFile(file, 'utf8');
		const rel = relative(cwd, file);
		const replacements = [];

		for (const group of extractGroups(content, file)) {
			for (const token of group.tokens) {
				const verdict = judge(token.className);
				const { line, col } = offsetToLineCol(content, token.start);

				if (verdict.unknown && args.unknown) {
					console.log(`${rel}:${line}:${col}  unknown  ${token.className}`);
					unknownCount++;
				} else if (verdict.canonical) {
					console.log(`${rel}:${line}:${col}  ${token.className}  →  ${verdict.canonical}`);
					replacements.push({ ...token, canonical: verdict.canonical });
					canonicalCount++;
				}
			}
		}

		if (args.write && replacements.length) {
			let next = content;

			for (const r of replacements.sort((a, b) => b.start - a.start)) {
				next = next.slice(0, r.start) + r.canonical + next.slice(r.end);
			}

			await writeFile(file, next, 'utf8');
		}
	}

	if (unknownCount + canonicalCount === 0) {
		return EXIT_OK;
	}

	console.error(`\n${unknownCount} unknown, ${canonicalCount} non-canonical class(es)${args.write ? ' (non-canonical rewritten)' : ''}.`);

	return unknownCount > 0 || !args.write ? EXIT_VIOLATIONS : EXIT_OK;
}

main().then(
	(code) => process.exit(code),
	(err) => {
		console.error(err && err.stack ? err.stack : String(err));
		process.exit(EXIT_USAGE);
	},
);
