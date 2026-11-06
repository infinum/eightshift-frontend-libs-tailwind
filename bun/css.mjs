import { compile, Polyfills } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, relative, resolve } from 'node:path';
import browserslist from 'browserslist';
import { browserslistToTargets, transform } from 'lightningcss';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';

const require = createRequire(import.meta.url);

/**
 * Compile ordered stylesheets to one CSS file.
 * Paths are relative to projectDir unless absolute. Each files entry is a path
 * or { file, scan, sources, scanFiles, removeSources }; scan enables Tailwind
 * candidate scanning, sources extends its detected sources, scanFiles adds
 * explicit candidate files, and removeSources removes exact @source rules.
 * Assets are copied beside outputFile with content-hashed names.
 */
export async function processCss({ projectDir, outputFile, files, production = false, browsers = '>= 0.25%' }) {
	if (!projectDir || !outputFile || !Array.isArray(files) || files.length === 0) {
		throw new Error('processCss requires projectDir, outputFile and a non-empty files array.');
	}

	const root = resolve(projectDir);
	const output = resolve(root, outputFile);
	const outdir = dirname(output);

	await mkdir(outdir, { recursive: true });

	const rewriteAssets = async (css, base) => {
		const tree = postcss.parse(css);
		const pending = [];

		tree.walkDecls((declaration) => {
			const value = valueParser(declaration.value);
			const assets = [];

			value.walk((node) => {
				if (node.type !== 'function' || node.value.toLowerCase() !== 'url') {
					return;
				}

				const url = valueParser
					.stringify(node.nodes)
					.trim()
					.replace(/^(['"])(.*)\1$/, '$2');

				if (!url || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) {
					return;
				}

				assets.push(
					(async () => {
						const suffixIndex = url.search(/[?#]/);
						const pathname = suffixIndex < 0 ? url : url.slice(0, suffixIndex);
						const suffix = suffixIndex < 0 ? '' : url.slice(suffixIndex);
						let asset = resolve(base, pathname);
						let content;

						try {
							content = await readFile(asset);
						} catch (error) {
							if (error.code !== 'ENOENT' || pathname.startsWith('.')) {
								throw error;
							}

							asset = require.resolve(pathname, { paths: [base] });
							content = await readFile(asset);
						}

						const name = `${createHash('sha256').update(content).digest('hex').slice(0, 20)}${extname(asset)}`;

						await writeFile(resolve(outdir, name), content);
						node.nodes = [{ type: 'string', quote: '"', value: `./${name}${suffix}` }];
					})(),
				);
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
	const dependencies = new Set();

	for (const entry of files) {
		const options = typeof entry === 'string' ? { file: entry } : entry;

		if (!options?.file) {
			throw new Error('Each CSS entry requires a file path.');
		}

		const file = resolve(root, options.file);
		let input = await readFile(file, 'utf8');

		dependencies.add(file);

		for (const source of options.removeSources ?? []) {
			if (!input.includes(source)) {
				throw new Error(`Missing source rule in ${file}: ${source}`);
			}

			input = input.replace(source, '');
		}

		const compiler = await compile(input, {
			base: dirname(file),
			from: file,
			shouldRewriteUrls: true,
			polyfills: Polyfills.All,
			onDependency: (dependency) => dependencies.add(dependency),
		});
		let candidates = [];

		if (options.scan) {
			const sources = (compiler.root === 'none' ? [] : compiler.root === null ? [{ base: root, pattern: '**/*', negated: false }] : [{ ...compiler.root, negated: false }]).concat(
				compiler.sources,
				(options.sources ?? []).map((source) => ({ ...source, base: resolve(root, source.base ?? '.') })),
			);
			const scanner = new Scanner({ sources });
			const explicit = (options.scanFiles ?? []).map((item) => (typeof item === 'string' ? { file: resolve(root, item), extension: extname(item).slice(1) } : { ...item, file: resolve(root, item.file) }));

			explicit.forEach(({ file: candidateFile }) => dependencies.add(candidateFile));
			candidates = [...new Set([...scanner.scan(), ...(explicit.length ? scanner.scanFiles(explicit) : [])])];
		}

		parts.push(`/* ${relative(root, file)} */\n${await rewriteAssets(compiler.build(candidates), dirname(file))}`);
	}

	const css = parts.join('\n');
	const result = production ? transform({ filename: output, code: Buffer.from(css), minify: true, targets: browserslistToTargets(browserslist(browsers)) }).code : css;

	await writeFile(output, result);

	return { outputFile: output, dependencies: [...dependencies] };
}
