#!/usr/bin/env bun
import { resolve } from 'node:path';

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

const { supervise } = await import('./cli-supervisor.mjs');
await supervise({ command, config: resolve(config), options });
