import { mkdir, writeFile } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { buildSsr } from './ssr.mjs';

async function compileWatchSsr({ root, mode, outdir, quiet }) {
	let result;
	const child = Bun.spawn([process.execPath, resolve(import.meta.dir, 'ssr-watch-build.mjs'), JSON.stringify({ root, mode, outdir })], {
		cwd: root,
		stdout: quiet ? 'ignore' : 'inherit',
		stderr: 'pipe',
		ipc(message) {
			result = message;
		},
	});
	const [stderr, exitCode] = await Promise.all([new Response(child.stderr).text(), child.exited]);

	if (exitCode !== 0) {
		throw new Error(`SSR build failed: ${stderr}`);
	}

	if (!result) {
		throw new Error('SSR worker exited without a build result');
	}

	await mkdir(outdir, { recursive: true });

	for (const item of result.outputs) {
		item.path = resolve(outdir, `${item.name}.js`);
		item.output = new Blob([Buffer.from(item.bytes, 'base64')]);
		delete item.bytes;
		await writeFile(item.path, await item.output.arrayBuffer());
	}

	return result;
}

const cacheKey = Symbol('default SSR');
const styleInputs = new Set(['tailwind.css', 'tailwind-editor.css', 'tailwind-frontend.css', 'color-themes.css']);

function requiresRebuild(root, changes, dependencies) {
	if (!changes || changes.unknown || changes.structural || !Array.isArray(changes.paths) || !changes.paths.length) {
		return true;
	}

	return changes.paths.some((file) => {
		const path = resolve(file);
		const local = relative(root, path);

		if (dependencies.has(path) || ['package.json', 'tsconfig.json', 'jsconfig.json', 'bunfig.toml'].includes(basename(path))) {
			return true;
		}

		return !local.startsWith(`src${sep}`) && !styleInputs.has(local);
	});
}

/** Watch events invalidate dependency graphs; cached bytes survive disposable staging. */
export async function buildWatchSsr({ root, mode, outdir, watchSession, changes, quiet }) {
	if (!watchSession) {
		return buildSsr({ root, mode, outdir });
	}

	root = resolve(root);
	const previous = watchSession.get(cacheKey);
	watchSession.delete(cacheKey);

	if (previous?.root === root && previous.mode === mode && !requiresRebuild(root, changes, previous.dependencies)) {
		await mkdir(outdir, { recursive: true });

		for (const [name, bytes] of previous.bytes) {
			await writeFile(resolve(outdir, `${name}.js`), bytes);
		}

		watchSession.set(cacheKey, previous);

		return { cacheHit: true, cacheable: true, dependencies: [...previous.dependencies] };
	}

	// Bun retains package-resolution state across builds. A fresh compiler on
	// misses preserves correctness after package maps or resolution targets change.
	const result = await compileWatchSsr({ root, mode, outdir, quiet });

	try {
		const sourceEntries = readdirSync(resolve(root, 'src'), { recursive: true, withFileTypes: true });
		let configuredResolution = sourceEntries.some((entry) => ['tsconfig.json', 'jsconfig.json'].includes(entry.name));

		for (let directory = root; ; directory = dirname(directory)) {
			configuredResolution ||= ['tsconfig.json', 'jsconfig.json'].some((name) => existsSync(resolve(directory, name)));

			if (directory === dirname(directory)) {
				break;
			}
		}

		const supported = result.cacheable && result.dependencies.length && !configuredResolution && !sourceEntries.some((entry) => entry.isSymbolicLink());
		const localDependencies = result.dependencies.every((file) => {
			const local = relative(root, file);

			return local.startsWith(`src${sep}`) || local.startsWith(`node_modules${sep}`);
		});

		if (supported && localDependencies) {
			const bytes = await Promise.all(result.outputs.map(async ({ name, output }) => [name, new Uint8Array(await output.arrayBuffer())]));

			if (bytes.reduce((size, [, data]) => size + data.byteLength, 0) <= 32 * 1024 * 1024) {
				watchSession.set(cacheKey, { root, mode, dependencies: new Set(result.dependencies), bytes });
			}
		}
	} catch {
		// Unknown input trees are rebuilt on the next event.
	}

	return { ...result, cacheHit: false };
}
