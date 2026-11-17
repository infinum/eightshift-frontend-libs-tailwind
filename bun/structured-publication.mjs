import { lstat, mkdir, readdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// Only compiler-owned output surfaces are eligible; discovery and metadata stay private.
export async function preserveAssets({ outdir, flatDir, directories = ['frontend', 'editor', 'admin', 'css'], extraSources = {} }) {
	const sources = new Map();
	const valid = (path) => {
		if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0') || path.split('/').some((p) => !p || p === '.' || p === '..')) {
			throw new Error(`Invalid output path: ${path}`);
		}

		return path;
	};

	const collect = async (directory, prefix) => {
		for (const item of await readdir(directory, { withFileTypes: true })) {
			const path = valid(`${prefix}/${item.name}`);

			if (path === 'editor/discovery' || (!prefix.includes('/') && item.name === `${prefix}.asset.json`)) {
				continue;
			}

			if (item.isDirectory()) {
				await collect(resolve(directory, item.name), path);
			} else if (item.isFile()) {
				sources.set(path, resolve(directory, item.name));
			} else {
				throw new Error(`Unsupported output: ${path}`);
			}
		}
	};

	for (const directory of directories) {
		const source = resolve(outdir, valid(directory));

		if (!(await lstat(source)).isDirectory()) {
			throw new Error(`Invalid output directory: ${directory}`);
		}

		await collect(source, directory);
	}

	for (const [path, source] of Object.entries(extraSources)) {
		valid(path);

		if (sources.has(path)) {
			throw new Error(`Duplicate output: ${path}`);
		}

		if (!(await lstat(source)).isFile()) {
			throw new Error(`Invalid extra source: ${path}`);
		}

		sources.set(path, source);
	}

	await mkdir(flatDir);

	for (const [path, source] of sources) {
		const target = resolve(flatDir, path);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(source, target, 1);
	}

	return { sources };
}
