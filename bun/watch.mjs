import { watch } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

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
	let watcher;

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
			watcher.close();
		}

		await running;
	};

	watcher = watch(root, { recursive: true }, (_event, filename) => {
		if (!filename || stopped) {
			return;
		}

		const path = resolve(root, String(filename));

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
	});
	watcher.on('error', (error) => {
		report(error);
		void stop();
	});

	if (initial) {
		pending = true;
		run();
	}

	return { stop };
}
