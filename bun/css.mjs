import { Features, loadModule, Polyfills } from '@tailwindcss/node';
import fs from 'node:fs';
import { Scanner } from '@tailwindcss/oxide';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { delimiter, dirname, extname, relative, resolve } from 'node:path';
import browserslist from 'browserslist';
import enhancedResolve from 'enhanced-resolve';
import { browserslistToTargets, transform } from 'lightningcss';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { unescapeCss } from './css-url.mjs';

const require = createRequire(import.meta.url);
// Use the compiler shipped with our Tailwind Node adapter.
const tailwindRequire = createRequire(require.resolve('@tailwindcss/node'));
const { compile } = tailwindRequire('tailwindcss');
const { CachedInputFileSystem, ResolverFactory } = enhancedResolve;

/**
 * Compile ordered stylesheets to one CSS file.
 * Paths are relative to projectDir unless absolute. Each files entry is a path
 * or { file, content, scan, sources, scanFiles, removeSources }; content can
 * replace the source text, while file remains the base for relative imports.
 * scan enables candidate scanning, or 'auto' scans only when utilities are requested.
 * sources extends detected sources, scanFiles adds explicit candidate files,
 * and removeSources removes matching @source rules regardless of quote style.
 * Assets are copied beside outputFile with content-hashed names.
 */
export async function processCss({ projectDir, outputFile, files, production = false, browsers = '>= 0.25%', capture, reuse }) {
	if (!projectDir || !outputFile || !Array.isArray(files) || files.length === 0) {
		throw new Error('processCss requires projectDir, outputFile and a non-empty files array.');
	}

	const root = resolve(projectDir);
	const output = resolve(root, outputFile);
	const outdir = dirname(output);

	await mkdir(outdir, { recursive: true });

	const assetReferences = new Map();
	const assetPrefix = `eightshift-asset:${randomUUID()}:`;
	const rewriteAssets = async (css, base, compiled = false) => {
		const tree = postcss.parse(css);
		const pending = [];

		tree.walkDecls((declaration) => {
			const value = valueParser(declaration.value);
			const assets = [];

			const rewriteUrl = (node) => {
				const reference = compiled ? assetReferences.get(node.value) : undefined;
				const rawUrl = reference?.url ?? node.value;
				const url = unescapeCss(rawUrl);
				const assetBase = reference?.base ?? base;

				if (!url || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) {
					return;
				}

				if (!compiled) {
					const token = `${assetPrefix}${assetReferences.size}`;
					assetReferences.set(token, { url: rawUrl, base });
					node.value = token;

					return;
				}

				assets.push(
					(async () => {
						const suffixIndex = url.search(/[?#]/);
						const encodedPathname = suffixIndex < 0 ? url : url.slice(0, suffixIndex);
						const suffix = suffixIndex < 0 ? '' : url.slice(suffixIndex);
						let pathname;

						try {
							pathname = decodeURIComponent(encodedPathname);
						} catch (cause) {
							throw new Error(`Invalid percent encoding in CSS asset URL ${JSON.stringify(url)} relative to ${assetBase}`, { cause });
						}

						let asset = resolve(assetBase, pathname);
						let content;

						try {
							content = await readFile(asset);
						} catch (error) {
							if (error.code !== 'ENOENT' || pathname.startsWith('.')) {
								throw error;
							}

							asset = require.resolve(pathname, { paths: [assetBase] });
							content = await readFile(asset);
						}

						const name = `${createHash('sha256').update(content).digest('hex').slice(0, 20)}${extname(asset)}`;

						await writeFile(resolve(outdir, name), content);
						node.type = 'string';
						node.quote ??= '"';
						node.value = `./${name}${suffix}`;
						dependencies.add(asset);
						assetsToRestore?.set(name, asset);
					})(),
				);
			};

			value.walk((node) => {
				if (node.type !== 'function') {
					return;
				}

				const name = node.value.toLowerCase();

				if (name === 'url') {
					const url = node.nodes.filter((child) => child.type !== 'space' && child.type !== 'comment');

					if (url.length === 1 && (url[0].type === 'string' || url[0].type === 'word')) {
						rewriteUrl(url[0]);
					}

					return false;
				}

				if (name === 'image-set' || name === '-webkit-image-set') {
					// Only direct strings are images; nested type("image/avif") is a descriptor.
					node.nodes.filter((child) => child.type === 'string').forEach((child) => rewriteUrl(child));
				}
			});
			pending.push(
				Promise.all(assets).then(() => {
					declaration.value = value.toString();
				}),
			);
		});
		await Promise.all(pending);

		return tree.toString();
	};

	const parts = [];
	const allDependencies = new Set();
	let dependencies;
	let assetsToRestore;
	const scan = async (sources, options) => {
		const explicit = (options.scanFiles ?? []).map((item) => (typeof item === 'string' ? { file: resolve(root, item), extension: extname(item).slice(1) } : { ...item, file: resolve(root, item.file) }));
		explicit.forEach(({ file }) => dependencies.add(file));
		const contents = await Promise.all(explicit.map(async ({ file, extension }) => ({ content: await readFile(file, 'utf8'), extension })));

		return [...new Set([...new Scanner({ sources }).scan(), ...(contents.length ? new Scanner({ sources: [] }).scanFiles(contents) : [])])];
	};

	const stamp = (path) => {
		const stat = fs.statSync(path, { bigint: true, throwIfNoEntry: false });

		return stat && `${stat.dev}:${stat.ino}:${stat.ctimeNs}:${stat.size}`;
	};

	let stylesheetStamps;
	const readStylesheet = (path) => {
		// Keep the first identity if the same stylesheet is imported more than once.
		if (stylesheetStamps && !stylesheetStamps.has(path)) {
			stylesheetStamps.set(path, stamp(path) ?? null);
		}

		return readFile(path, 'utf8');
	};

	const cssResolver = ResolverFactory.createResolver({
		fileSystem: new CachedInputFileSystem(fs, 4000),
		extensions: ['.css'],
		mainFields: ['style'],
		conditionNames: ['style'],
		modules: ['node_modules', ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(delimiter) : [])],
	});
	const loadStylesheet = async (id, base) => {
		const path = await new Promise((accept, reject) => {
			cssResolver.resolve({}, base, id, {}, (error, result) => {
				if (error) {
					reject(error);
				} else if (!result) {
					reject(new Error(`Could not resolve '${id}' from '${base}'`));
				} else {
					accept(result);
				}
			});
		});
		dependencies.add(path);

		// Retain each URL's source base through compilation; copy only emitted assets.
		return { path, base: dirname(path), content: await rewriteAssets(await readStylesheet(path), dirname(path)) };
	};

	for (const entry of files) {
		const options = typeof entry === 'string' ? { file: entry } : entry;

		if (!options?.file) {
			throw new Error('Each CSS entry requires a file path.');
		}

		if (options.content !== undefined && typeof options.content !== 'string') {
			throw new TypeError('CSS entry content must be a string.');
		}

		const file = resolve(root, options.file);
		dependencies = new Set();
		assetsToRestore = capture && new Map();
		stylesheetStamps = capture && new Map();
		const cached = reuse?.entries.get(file);

		if (cached && cached.inputs.every(([path, identity]) => stamp(path) === identity)) {
			const current = cached.sources && (await scan(cached.sources, options));

			if (!current || (current.length === cached.candidates.size && current.every((candidate) => cached.candidates.has(candidate)))) {
				cached.inputs.forEach(([path]) => allDependencies.add(path));
				dependencies.forEach((path) => allDependencies.add(path));

				if (capture) {
					// A full publication starts with empty staging, unlike the CSS-only path.
					for (const [name, asset] of capture.existingAssets ? [] : cached.assetsToRestore) {
						const bytes = await readFile(asset);

						if (`${createHash('sha256').update(bytes).digest('hex').slice(0, 20)}${extname(asset)}` !== name) {
							throw new Error(`CSS asset changed during compilation: ${asset}`);
						}

						await writeFile(resolve(outdir, name), bytes);
					}

					capture.entries.set(file, cached);
				}

				parts.push(cached.part);
				continue;
			}
		}

		let input = options.content ?? (await readStylesheet(file));

		dependencies.add(file);

		for (const source of options.removeSources ?? []) {
			const expected = postcss.parse(source).nodes;
			const tree = postcss.parse(input, { from: file });
			const rule = expected.length === 1 && expected[0].type === 'atrule' && expected[0].name === 'source' ? expected[0] : null;
			let found = false;

			if (rule) {
				const params = valueParser(rule.params).nodes.filter((node) => node.type !== 'space' && node.type !== 'comment');
				tree.walkAtRules('source', (node) => {
					const actual = valueParser(node.params).nodes.filter((part) => part.type !== 'space' && part.type !== 'comment');

					if (!found && params.length === 1 && actual.length === 1 && params[0].type === 'string' && actual[0].type === 'string' && params[0].value === actual[0].value) {
						node.remove();
						found = true;
					}
				});
			} else if (input.includes(source)) {
				input = input.replace(source, '');
				continue;
			}

			if (!found) {
				throw new Error(`Missing source rule in ${file}: ${source}`);
			}

			input = tree.toString();
		}

		const compiler = await compile(await rewriteAssets(input, dirname(file)), {
			base: dirname(file),
			from: file,
			polyfills: Polyfills.All,
			loadStylesheet,
			loadModule: (id, base) => loadModule(id, base, (dependency) => dependencies.add(dependency)),
		});

		if (compiler.root && compiler.root !== 'none') {
			const directoryParts = [];

			for (const part of compiler.root.pattern.split('/')) {
				if (/[*{]/.test(part)) {
					break;
				}

				directoryParts.push(part);
			}

			const directory = directoryParts.join('/');

			if (
				!(await fs.promises
					.stat(resolve(compiler.root.base, directory))
					.then((stat) => stat.isDirectory())
					.catch(() => false))
			) {
				throw new Error(`The \`source(${compiler.root.pattern})\` does not exist or is not a directory.`);
			}
		}

		let candidates = [];
		let sources;
		const inputs = [...dependencies];

		if (options.scan && (options.scan !== 'auto' || compiler.features & Features.Utilities)) {
			sources = (compiler.root === 'none' ? [] : compiler.root === null ? [{ base: root, pattern: '**/*', negated: false }] : [{ ...compiler.root, negated: false }]).concat(
				compiler.sources,
				(options.sources ?? []).map((source) => ({ ...source, base: resolve(root, source.base ?? '.') })),
			);
			candidates = await scan(sources, options);
		}

		const compiled = compiler.build(candidates);
		const beforeAssets = new Set(dependencies);
		const part = `/* ${relative(root, file)} */\n${await rewriteAssets(compiled, dirname(file), true)}`;
		parts.push(part);
		dependencies.forEach((path) => allDependencies.add(path));

		if (capture) {
			// Published sidecars stay valid under the watch generation's output stamp.
			inputs.push(...[...dependencies].filter((path) => !beforeAssets.has(path)));
			capture.entries.set(file, { part, sources, assetsToRestore, candidates: new Set(candidates), inputs: inputs.map((path) => [path, stylesheetStamps.has(path) ? stylesheetStamps.get(path) : stamp(path)]) });
		}
	}

	const css = parts.join('\n');
	const result = reuse?.css === css ? reuse.result : production ? transform({ filename: output, code: Buffer.from(css), minify: true, targets: browserslistToTargets(browserslist(browsers)) }).code : css;

	if (capture) {
		Object.assign(capture, { css, result });
	}

	await writeFile(output, result);

	return { outputFile: output, dependencies: [...allDependencies] };
}
