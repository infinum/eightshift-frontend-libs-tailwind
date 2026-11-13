import { readFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function supervise(invocation) {
	const watching = invocation.command === 'watch';
	const inputs = [invocation.config, ...['package.json', 'bun.lock', 'bun.lockb'].map((name) => resolve(name))];
	const snapshot = () =>
		JSON.stringify(
			inputs.map((path) => {
				try {
					return readFileSync(path).toString('base64');
				} catch (error) {
					if (error.code === 'ENOENT') {
						return null;
					}

					throw error;
				}
			}),
		);
	let observed = watching ? snapshot() : '';
	let child,
		ready,
		resolveReady,
		timer,
		changedAt = 0,
		pending = false,
		closing = false,
		busy = false,
		failure = 0;
	let draining;
	const drain = () => {
		if (!child) {
			return Promise.resolve();
		}

		if (!draining) {
			const current = child;
			draining = (async () => {
				await Promise.race([ready, current.exited]);

				if (current.exitCode === null) {
					current.send('stop');
				}

				await current.exited;

				if (child === current) {
					child = undefined;
				}
			})();
		}

		return draining;
	};

	const launch = () => {
		draining = undefined;
		ready = new Promise((done) => {
			resolveReady = done;
		});
		child = Bun.spawn([process.execPath, fileURLToPath(new URL('./cli-worker.mjs', import.meta.url)), JSON.stringify(invocation)], {
			cwd: process.cwd(),
			env: { ...process.env, NODE_PATH: [resolve('node_modules'), process.env.NODE_PATH].filter(Boolean).join(delimiter) },
			stdin: 'inherit',
			stdout: 'inherit',
			stderr: 'inherit',
			ipc(message) {
				if (message === 'ready') {
					resolveReady();
				}
			},
		});
		const current = child;
		void current.exited.then((code) => {
			if (child === current && !busy && !closing) {
				failure = code || failure;

				if (watching) {
					console.error(`[eightshift-build] Worker exited (${code}); waiting for a restart input change.`);
				}
			}
		});
	};

	const stop = async () => {
		if (closing) {
			return;
		}

		closing = true;

		if (!watching) {
			failure ||= 1;
		}

		clearInterval(timer);

		while (busy) {
			await Bun.sleep(20);
		}

		await drain();
		process.exitCode = failure;
	};

	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);

	try {
		launch();

		if (!watching) {
			failure = (await child.exited) || failure;

			return;
		}

		timer = setInterval(async () => {
			if (closing || busy) {
				return;
			}

			try {
				const next = snapshot();

				if (next !== observed) {
					observed = next;
					changedAt = Date.now();
					pending = true;
				}

				if (!pending || Date.now() - changedAt < 200) {
					return;
				}

				busy = true;
				await drain();
				observed = snapshot();
				pending = false;

				if (!closing) {
					launch();
				}
			} catch (error) {
				console.error(error);
				failure = 1;
				pending = false;
			} finally {
				busy = false;
			}
		}, 100);

		while (!closing) {
			await Bun.sleep(100);
		}

		await stop();
	} finally {
		while (busy) {
			await Bun.sleep(20);
		}

		await drain();
		clearInterval(timer);
		process.removeListener('SIGINT', stop);
		process.removeListener('SIGTERM', stop);
		process.exitCode = failure;
	}
}
