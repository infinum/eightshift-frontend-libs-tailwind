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

	const forwardInt = () => child.kill('SIGINT');
	const forwardTerm = () => child.kill('SIGTERM');
	process.on('SIGINT', forwardInt);
	process.on('SIGTERM', forwardTerm);
	const exitCode = await child.exited;
	process.removeListener('SIGINT', forwardInt);
	process.removeListener('SIGTERM', forwardTerm);
	process.exit(exitCode);
}

const args = process.argv.slice(2);
const command = args.shift();

const usage = 'Usage: eightshift-build <build|watch> [--config path] [--sourcemaps] [--quiet | --verbose]';

if (command === '--help' || command === '-h' || args.includes('--help') || args.includes('-h')) {
	console.log(`${usage}\n  --quiet    Suppress informational output (warnings/errors remain).\n  --verbose  Show build stages and entry/dependency details.`);
	process.exit(0);
}

if (!['build', 'watch'].includes(command)) {
	throw new Error(usage);
}

let config = 'eightshift.build.mjs';
const options = { sourcemaps: false };

while (args.length) {
	const arg = args.shift();

	if (arg === '--config') {
		config = args.shift();

		if (!config || config.startsWith('--')) {
			throw new Error('--config requires a path');
		}
	} else if (arg === '--verbose' || arg === '--quiet') {
		options[arg.slice(2)] = true;
	} else if (arg === '--sourcemaps') {
		options.sourcemaps = true;
	} else {
		throw new Error(`Unknown option: ${arg}`);
	}
}

if (options.quiet && options.verbose) {
	throw new Error('--quiet and --verbose cannot be combined');
}

const { default: definition } = await import(pathToFileURL(resolve(config)).href);

if (!definition || typeof definition.build !== 'function' || typeof definition.watch !== 'function') {
	throw new TypeError('Config default export must be a defineBuild result');
}

if (command === 'build') {
	await definition.build(options);
} else {
	const watcher = definition.watch(options);
	let stopping;
	const stop = () => {
		if (!stopping) {
			stopping = Promise.resolve()
				.then(() => watcher.stop())
				.finally(() => {
					process.removeListener('SIGINT', stop);
					process.removeListener('SIGTERM', stop);
				});
		}
		return stopping;
	};

	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);
}
