import { statSync, watch } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Watch source paths under projectDir and run build serially after changes settle.
 * Paths in sources and ignored are relative to projectDir unless absolute.
 * Ignored paths exclude themselves and their descendants, including outputs.
 * `ignore` optionally filters absolute event paths in addition to ignored paths.
 * Returns { stop }, whose promise settles after any running build finishes.
 * Build and watcher errors are passed to onError; watcher errors stop watching.
 */
export function watchBuild({ projectDir, sources, ignored = [], ignore = () => false, build, debounce = 200, initial = true, onError = console.error }) {
	if (!projectDir || !Array.isArray(sources) || sources.length === 0 || !Array.isArray(ignored) || typeof ignore !== 'function' || typeof build !== 'function' || typeof onError !== 'function' || !Number.isFinite(debounce) || debounce < 0) {
		throw new TypeError('watchBuild requires projectDir, sources, a build function, and a non-negative debounce.');
	}

	const root = resolve(projectDir);
	const within = (parent, path) => {
		const rel = relative(parent, path);

		return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
	};
	const paths = (items) =>
		items.map((item) => {
			if (typeof item !== 'string' || !item) {
				throw new TypeError('Watch paths must be non-empty strings.');
			}

			const path = resolve(root, item);

			if (!within(root, path)) {
				throw new TypeError('Watch paths must be inside projectDir.');
			}

			return path;
		});
	const inputs = paths(sources);
	const exclusions = paths(ignored);
	let timer;
	let running;
	let pending = false;
	let stopped = false;
	const watchers = new Map();

	const report = (error) => {
		try {
			onError(error);
		} catch (callbackError) {
			console.error(callbackError);
		}
	};
	const run = () => {
		if (stopped || running || !pending) {
			return;
		}

		pending = false;
		running = Promise.resolve()
			.then(build)
			.catch(report)
			.finally(() => {
				running = undefined;

				if (!timer) {
					run();
				}
			});
	};
	const schedule = () => {
		if (stopped) {
			return;
		}

		pending = true;
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			run();
		}, debounce);
	};
	const stop = async () => {
		if (!stopped) {
			stopped = true;
			pending = false;
			clearTimeout(timer);
			for (const watcher of watchers.values()) {
				watcher.close();
			}
			watchers.clear();
		}

		await running;
	};

	const onEvent = (path) => {
		if (stopped) {
			return;
		}

		if (!within(root, path) || exclusions.some((item) => within(item, path))) {
			return;
		}

		try {
			if (ignore(path)) {
				return;
			}
		} catch (error) {
			report(error);
			return;
		}

		if (inputs.some((item) => within(item, path) || within(path, item))) {
			schedule();
		}
	};
	const refresh = () => {
		if (stopped) {
			return;
		}
		const desired = new Map();
		const add = (directory, recursive, name) => {
			const key = `${recursive ? 'recursive' : 'parent'}:${directory}`;
			if (!desired.has(key)) {
				desired.set(key, { directory, recursive, names: new Set() });
			}
			if (name) {
				desired.get(key).names.add(name);
			}
		};
		for (const input of inputs) {
			let current = input;
			let info;
			while (true) {
				try {
					info = statSync(current);
					break;
				} catch (error) {
					if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
						throw error;
					}
					if (current === root) {
						throw error;
					}
					current = dirname(current);
				}
			}
			if (current === input && info.isDirectory()) {
				add(input, true);
				if (input !== root) {
					add(dirname(input), false, basename(input));
				}
			} else {
				const directory = current === input ? dirname(input) : current;
				const next = relative(directory, input).split(sep)[0];
				add(directory, false, next);
			}
		}
		for (const [key, config] of desired) {
			const existing = watchers.get(key);
			if (existing) {
				existing.names = config.names;
				continue;
			}
			const watcher = watch(config.directory, { recursive: config.recursive }, (_event, filename) => {
				if (!filename || stopped) {
					return;
				}
				const name = String(filename);
				if (!config.recursive && !watcher.names.has(name)) {
					return;
				}
				const path = resolve(config.directory, name);
				onEvent(path);
				try {
					refresh();
				} catch (error) {
					report(error);
					void stop();
				}
			});
			watcher.names = config.names;
			watcher.on('error', (error) => {
				report(error);
				void stop();
			});
			watchers.set(key, watcher);
		}
		for (const [key, watcher] of watchers) {
			if (!desired.has(key)) {
				watcher.close();
				watchers.delete(key);
			}
		}
	};
	try {
		refresh();
	} catch (error) {
		for (const watcher of watchers.values()) {
			watcher.close();
		}
		throw error;
	}

	if (initial) {
		pending = true;
		run();
	}

	return { stop };
}
