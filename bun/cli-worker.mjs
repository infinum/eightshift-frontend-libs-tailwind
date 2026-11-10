import { pathToFileURL } from 'node:url';

let stopping = false;
let watcher;
let drain;
const stop = () => {
	stopping = true;
	if (watcher && !drain) {
		drain = Promise.resolve()
			.then(() => watcher.stop())
			.catch((error) => {
				console.error(error);
				process.exitCode = 1;
			})
			.finally(() => process.disconnect?.());
	}
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('message', (message) => {
	if (message === 'stop') stop();
});
process.send('ready');
try {
	const { command, config, options } = JSON.parse(process.argv[2]);
	const { default: definition } = await import(pathToFileURL(config).href);
	if (!definition || typeof definition.build !== 'function' || typeof definition.watch !== 'function') {
		throw new TypeError('Config default export must be a defineBuild result');
	}
	if (!stopping) {
		if (command === 'build') await definition.build(options);
		else watcher = definition.watch(options);
	}
	if (stopping) stop();
} catch (error) {
	console.error(error);
	process.exitCode = 1;
} finally {
	if (!watcher) process.disconnect?.();
}
