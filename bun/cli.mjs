#!/usr/bin/env bun
import { delimiter, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectModules = resolve('node_modules');

if (!(process.env.NODE_PATH ?? '').split(delimiter).includes(projectModules)) {
	const child = Bun.spawn([process.execPath, ...process.argv.slice(1)], {
		cwd: process.cwd(),
		env: { ...process.env, NODE_PATH: [projectModules, process.env.NODE_PATH].filter(Boolean).join(delimiter) },
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit',
	});

	process.exit(await child.exited);
}

const args = process.argv.slice(2);
const command = args.shift();

if (!['build', 'watch'].includes(command)) {
	throw new Error('Usage: eightshift-build <build|watch> [--config path] [--sourcemaps] [--activate]');
}

let config = 'eightshift.build.mjs';
const options = { sourcemaps: false, activate: false };

while (args.length) {
	const arg = args.shift();

	if (arg === '--config') {
		config = args.shift();

		if (!config || config.startsWith('--')) {
			throw new Error('--config requires a path');
		}
	} else if (arg === '--sourcemaps') {
		options.sourcemaps = true;
	} else if (arg === '--activate') {
		options.activate = true;
	} else {
		throw new Error(`Unknown option: ${arg}`);
	}
}

const { default: definition } = await import(pathToFileURL(resolve(config)).href);

if (!definition || typeof definition.build !== 'function' || typeof definition.watch !== 'function') {
	throw new TypeError('Config default export must be a defineBuild result');
}

if (command === 'build') {
	await definition.build(options);
} else {
	const watcher = definition.watch(options);
	const stop = async () => {
		process.removeListener('SIGINT', stop);
		process.removeListener('SIGTERM', stop);
		await watcher.stop();
	};

	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
}
