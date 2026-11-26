import { lstatSync, readdirSync, statSync, watch } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Watch source paths under projectDir and run build serially after changes settle.
 * Paths in sources and ignored are relative to projectDir unless absolute.
 * Ignored paths exclude themselves and their descendants, including outputs.
 * `ignore` optionally filters absolute event paths in addition to ignored paths.
 * Events without filenames are reconciled against file metadata and directory entries.
 * build receives { paths, structural, unknown }; initial/nameless batches are unknown.
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
	let changedPaths = new Set();
	let structuralChange = false;
	let unknownChange = true;
	let stopped = false;
	const watchers = new Map();
	const directoryStamps = new Map();
	const filterDirectoryEvents = process.platform === 'darwin' && typeof Bun !== 'undefined';
	const directoryStamp = (path) => {
		try {
			const info = statSync(path);

			return info.isDirectory() ? `${info.dev}:${info.ino}:${info.mode}:${info.mtimeMs}:${info.ctimeMs}` : undefined;
		} catch (error) {
			if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
				return undefined;
			}

			throw error;
		}
	};

	const unavailable = (error) => ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code);
	const stamp = (info) => {
		const identity = `${info.dev}:${info.ino}:${info.mode}`;

		// Directory timestamps also change for ignored children, including build outputs.
		return info.isDirectory() ? identity : `${identity}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
	};

	const snapshotPath = (snapshot, path, recursive, followLink = false) => {
		if (!within(root, path) || exclusions.some((item) => within(item, path))) {
			return;
		}

		let info;

		try {
			info = lstatSync(path);
		} catch (error) {
			if (unavailable(error)) {
				return;
			}

			throw error;
		}

		let target = info;
		const link = info.isSymbolicLink();

		if (link) {
			try {
				target = statSync(path);
			} catch (error) {
				if (!unavailable(error) && error.code !== 'ELOOP') {
					throw error;
				}

				target = undefined;
			}
		}

		const directory = Boolean(target?.isDirectory());
		snapshot.set(path, { stamp: `${stamp(info)}|${target && target !== info ? stamp(target) : ''}`, directory });

		if (!recursive || !directory || (link && !followLink)) {
			return;
		}

		let entries;

		try {
			entries = readdirSync(path);
		} catch (error) {
			if (unavailable(error)) {
				return;
			}

			throw error;
		}

		for (const entry of entries) {
			snapshotPath(snapshot, resolve(path, entry), true);
		}
	};

	const capture = (directory, recursive, names) => {
		const snapshot = new Map();

		if (recursive) {
			snapshotPath(snapshot, directory, true, true);
		} else {
			for (const name of names) {
				snapshotPath(snapshot, resolve(directory, name), false);
			}
		}

		return snapshot;
	};

	const updateSnapshot = (snapshot, path, recursive, followLink = false) => {
		if (snapshot.get(path)?.directory) {
			for (const item of snapshot.keys()) {
				if (within(path, item)) {
					snapshot.delete(item);
				}
			}
		} else {
			snapshot.delete(path);
		}

		snapshotPath(snapshot, path, recursive, followLink);
	};

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
		const changes = { paths: [...changedPaths], structural: structuralChange, unknown: unknownChange };
		changedPaths = new Set();
		structuralChange = false;
		unknownChange = false;
		running = Promise.resolve()
			.then(() => build(changes))
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
		const scheduled = performance.now();
		timer = setTimeout(() => {
			if (process.env.EIGHTSHIFT_WATCH_TIMINGS) {
				console.info(`[watch] debounce: ${Math.round(performance.now() - scheduled)}ms`);
			}

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

	const onEvent = (path, { structural = false, unknown = true } = {}) => {
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
			changedPaths.add(path);
			structuralChange ||= structural;
			unknownChange ||= unknown;
			schedule();

			return true;
		}

		return false;
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
				if (filterDirectoryEvents && !directoryStamps.has(input)) {
					directoryStamps.set(input, directoryStamp(input));
				}

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
				for (const name of existing.names) {
					if (!config.names.has(name)) {
						existing.snapshot.delete(resolve(config.directory, name));
					}
				}

				for (const name of config.names) {
					if (!existing.names.has(name)) {
						snapshotPath(existing.snapshot, resolve(config.directory, name), false);
					}
				}

				existing.names = config.names;
				continue;
			}

			const watcher = watch(config.directory, { recursive: config.recursive }, (_event, filename) => {
				if (stopped) {
					return;
				}

				try {
					if (!filename) {
						const previous = watcher.snapshot;
						const current = capture(config.directory, config.recursive, watcher.names);
						watcher.snapshot = current;

						if (filterDirectoryEvents) {
							const directories = config.recursive ? [config.directory] : [...watcher.names].map((name) => resolve(config.directory, name)).filter((path) => inputs.includes(path));

							for (const directory of directories) {
								const value = directoryStamp(directory);

								if (value) {
									directoryStamps.set(directory, value);
								}
							}
						}

						for (const path of new Set([...previous.keys(), ...current.keys()])) {
							if (previous.get(path)?.stamp !== current.get(path)?.stamp) {
								onEvent(path);
							}
						}

						refresh();

						return;
					}

					const name = String(filename);

					if (!config.recursive && !watcher.names.has(name)) {
						return;
					}

					const path = resolve(config.directory, name);

					// Bun on macOS can report unchanged watched directories as changes.
					if (filterDirectoryEvents && _event === 'change') {
						let directory;

						if (!config.recursive && inputs.includes(path)) {
							directory = path;
						} else if (config.recursive && name === basename(config.directory)) {
							try {
								statSync(path);
							} catch (error) {
								if (error.code !== 'ENOENT') {
									throw error;
								}

								directory = config.directory;
							}
						}

						if (directory) {
							const stamp = directoryStamp(directory);

							if (stamp && directoryStamps.get(directory) === stamp) {
								return;
							}

							if (stamp) {
								directoryStamps.set(directory, stamp);
							}
						}
					}

					if (filterDirectoryEvents && config.recursive) {
						const stamp = directoryStamp(config.directory);

						if (stamp) {
							directoryStamps.set(config.directory, stamp);
						}
					}

					let structural = _event !== 'change';
					const previous = watcher.snapshot.get(path);

					try {
						const info = lstatSync(path);
						structural ||= !info.isFile() || !previous || !previous.stamp.startsWith(`${info.dev}:${info.ino}:${info.mode}:`);
					} catch {
						structural = true;
					}

					const accepted = onEvent(path, { structural, unknown: false });

					if (accepted && within(config.directory, path)) {
						updateSnapshot(watcher.snapshot, path, config.recursive, path === config.directory);
					}

					refresh();
				} catch (error) {
					report(error);
					void stop();
				}
			});

			try {
				watcher.names = config.names;
				watcher.snapshot = capture(config.directory, config.recursive, config.names);
			} catch (error) {
				watcher.close();

				throw error;
			}

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
