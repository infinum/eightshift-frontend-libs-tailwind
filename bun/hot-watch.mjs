export const hotMarker = 'eightshift-watch-hot.json';

export function classify(previous, next, changes) {
	if (!previous || !changes?.paths.length || changes.structural || changes.unknown || !next.enabled) {
		return null;
	}

	const text = [],
		styles = [];

	for (const path of changes.paths) {
		if (next.css.has(path) && previous.css.has(path)) {
			continue;
		}

		const before = previous.records.get(path),
			after = next.records.get(path);

		if (!after || before?.shape !== after.shape) {
			return null;
		}

		after.values.forEach((value, index) => {
			if (value !== before.values[index]) {
				text.push([after.file + ':' + index, value]);
			}
		});
	}

	if (previous.extra !== next.extra) {
		return null;
	}

	for (const [key, url] of Object.entries(next.styles)) {
		if (!previous.styles[key] || !url) {
			return null;
		}

		if (url !== previous.styles[key]) {
			styles.push([previous.styles[key], url]);
		}
	}

	return styles.length || text.length ? { styles, text } : null;
}

// Serialized into watch entry wrappers; no imports or evaluation of updated JS.
function hotClient(prefix, marker, version, key) {
	if (window !== window.top) {
		return;
	}

	const state = (globalThis[key] ??= { values: new Map(), events: new EventTarget() });

	if (state.polling) {
		return;
	}

	state.polling = true;
	const requireRefresh = () => {
		const message = 'Theme build changed. Save your work before refreshing.';
		const refresh = () => window.location.reload();

		if (document.querySelector('.components-snackbar-list')) {
			const notices = window.wp?.data?.dispatch?.('core/notices');

			if (notices?.createNotice) {
				notices.createNotice('info', message, { id: 'eightshift-watch-refresh', type: 'snackbar', actions: [{ label: 'Refresh', onClick: refresh }] });

				return;
			}
		}

		const notice = document.createElement('div');
		notice.setAttribute('role', 'alert');
		notice.textContent = `${message} `;
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = 'Refresh';
		button.addEventListener('click', refresh);
		notice.append(button);
		notice.style.cssText = 'position:fixed;bottom:1em;right:1em;padding:1em;background:#222;color:white;z-index:2147483647';
		document.body.append(notice);
	};

	let baseVersion = version;
	const apply = async ({ styles, text }, reconcile = false) => {
		const docs = [document, ...Array.from(document.querySelectorAll('iframe[name="editor-canvas"]'), (f) => f.contentDocument)];
		const staged = [];

		try {
			for (const [old, next] of styles) {
				if (![old, next].every((p) => typeof p === 'string' && p.startsWith(prefix + 'css/') && new URL(p, location.href).pathname === p && p.endsWith('.css'))) {
					throw Error();
				}

				for (const doc of docs) {
					let count = 0;

					for (const sheet of [...doc.styleSheets, ...doc.adoptedStyleSheets]) {
						const owner = sheet.ownerNode;
						const matches = (url) => {
							const u = new URL(url, doc.baseURI);

							return u.origin === location.origin && (u.pathname === old || (reconcile && u.pathname.replace(/-[a-f0-9]{64}\.css$/, '') === next.replace(/-[a-f0-9]{64}\.css$/, '')));
						};

						if (sheet.href && !matches(sheet.href)) {
							continue;
						}

						const target = owner;

						if (!sheet.href) {
							const rules = Array.from(sheet.cssRules);

							if (!rules.some((r) => r.href && matches(r.href))) {
								continue;
							}

							if (rules.length !== 1 || owner?.tagName !== 'STYLE' || rules[0].media.length || rules[0].layerName != null || rules[0].supportsText) {
								throw Error();
							}
						} else if (owner?.tagName !== 'LINK' || owner.rel !== 'stylesheet' || owner.integrity || owner.disabled) {
							throw Error();
						}

						if (reconcile && new URL(sheet.href || sheet.cssRules[0].href, doc.baseURI).pathname === next) {
							count++;
							continue;
						}
						const link = owner.tagName === 'LINK' ? owner.cloneNode(false) : doc.createElement('link');
						link.removeAttribute('id');
						link.rel = 'stylesheet';
						link.media = 'not all';
						link.href = next;
						staged.push({ target, link, media: owner.media, id: owner.id });
						count++;
					}

					const expected = doc === document && !document.body.classList.contains('wp-admin') ? '/applicationBlocksFrontend-' : '/applicationBlocksEditor-';

					if (!count && (doc !== document || !document.body.classList.contains('wp-admin')) && old.includes(expected)) {
						throw Error();
					}
				}
			}

			if (!text.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((s) => typeof s === 'string'))) {
				throw Error();
			}

			await Promise.all(
				staged.map(
					({ target, link }) =>
						new Promise((ok, fail) => {
							const timer = setTimeout(fail, 10000);
							link.onload = () => {
								clearTimeout(timer);
								ok();
							};

							link.onerror = () => {
								clearTimeout(timer);
								fail();
							};

							target.after(link);
						}),
				),
			);

			if (staged.some(({ target, link }) => !target.isConnected || !link.sheet)) {
				throw Error();
			}

			for (const { target, link, media, id } of staged) {
				link.media = media || 'all';
				target.remove();

				if (id) {
					link.id = id;
				}
			}

			for (const [id, value] of text) {
				state.values.set(id, value);
			}

			state.events.dispatchEvent(new Event('text'));
		} catch (error) {
			for (const { link } of staged) {
				link.remove();
			}

			throw error;
		}
	};

	let overlay;
	const rollback = () => {
		if (!overlay) {
			return;
		}

		state.values = overlay.committed;
		overlay = undefined;
		state.events.dispatchEvent(new Event('text'));
	};

	const poll = async () => {
		let next;

		try {
			const res = await fetch(prefix + marker, { cache: 'no-store', mode: 'same-origin', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(5000) });

			if (res.ok) {
				next = await res.json();
			}
		} catch {
			/* Publication in progress. */
		}

		const preview = next?.preview;

		if (overlay && (next?.version !== version || overlay.id !== preview?.id || !(preview.expires > Date.now()))) {
			rollback();
		}

		if (next && next.version !== version) {
			try {
				if (next.base === baseVersion && next.styles) {
					await apply({ styles: Object.values(next.styles).map((path) => [path, path]), text: [] }, true);
				} else if (next.parent === version && next.delta) {
					await apply(next.delta);
					if (!next.base) baseVersion = next.version;
				} else {
					throw Error();
				}

				version = next.version;
			} catch {
				requireRefresh();

				return;
			}
		}

		if (!overlay && preview && next.version === version && preview.expires > Date.now()) {
			overlay = { id: preview.id, committed: state.values };
			state.values = new Map(state.values);

			try {
				await apply({ styles: [], text: preview.text });
			} catch {
				rollback();
			}
		}

		setTimeout(poll, document.hidden ? 1500 : 125);
	};

	setTimeout(poll, document.hidden ? 1500 : 125);
}

export const hotScript = (prefix, version, key) => `;(${hotClient.toString()})(${[prefix, hotMarker, version, key].map((x) => JSON.stringify(x)).join(',')});\n`;
