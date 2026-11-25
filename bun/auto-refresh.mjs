// Serialized into watch-only entry wrappers. Keep this function self-contained.
function watchPublication(url, current) {
	if (window !== window.top) {
		return;
	}

	const key = `eightshift:refresh:${url}`;

	if (window[key]) {
		return;
	}

	window[key] = true;
	const poll = async () => {
		try {
			const response = await fetch(url, { cache: 'no-store', credentials: 'omit', mode: 'same-origin', redirect: 'error' });

			if (response.ok) {
				const next = await response.json();

				if (typeof next === 'string' && next !== current && sessionStorage.getItem(key) !== next) {
					const admin = document.body?.classList.contains('wp-admin') || location.pathname.includes('/wp-admin/');
					const editor = admin && window.wp?.data?.select?.('core/editor');
					const canRefresh = !admin || (editor?.isEditedPostDirty?.() === false && editor?.isSavingPost?.() === false && window.wp.data.select('core').__experimentalGetDirtyEntityRecords?.()?.length === 0);

					if (canRefresh) {
						sessionStorage.setItem(key, next);
						location.reload();

						return;
					}
				}
			}
		} catch {
			// A temporary missing release or unreadable editor state is not a reload signal.
		}

		setTimeout(poll, 1000);
	};

	setTimeout(poll, 1000);
}

export const refreshMarker = 'eightshift-watch-refresh.json';
export const refreshScript = (publicPath, token) => `;(${watchPublication.toString()})(${JSON.stringify(publicPath + refreshMarker)}, ${JSON.stringify(token)});\n`;
