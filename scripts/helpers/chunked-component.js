import { createElement, lazy, Suspense } from 'react';

const resolveExportedComponent = (module, exportName) => {
	if (exportName === 'default') {
		return module?.default ?? null;
	}

	if (exportName) {
		return module?.[exportName] ?? null;
	}

	const exportedEntries = Object.entries(module ?? {}).filter(([key, value]) => key !== '__esModule' && typeof value === 'function');

	return exportedEntries.length === 1 ? exportedEntries[0][1] : null;
};

const resolveLazyModule = (moduleLoaderOrPromise, exportName) =>
	Promise.resolve(typeof moduleLoaderOrPromise === 'function' ? moduleLoaderOrPromise() : moduleLoaderOrPromise).then((module) => {
		const Component = resolveExportedComponent(module, exportName);

		if (!Component) {
			throw new Error(`Unable to resolve chunked component${exportName ? ` "${exportName}"` : ''}.`);
		}

		return { default: Component };
	});

/**
 * Create a stable lazy component. Call outside render; prefer a loader to defer loading.
 *
 * @param {Function|Promise} moduleLoaderOrPromise Module loader or already-started promise.
 * @param {string} [exportName] Explicit export; otherwise infer the only function export.
 * @param {import('react').ReactNode} [fallback=null] Content displayed while loading.
 * @returns {Function} Component forwarding props through a Suspense boundary.
 */
export const createChunkedComponent = (moduleLoaderOrPromise, exportName, fallback = null) => {
	const LazyComponent = lazy(() => resolveLazyModule(moduleLoaderOrPromise, exportName));

	const ChunkedComponent = (props) =>
		createElement(
			Suspense,
			{
				fallback,
			},
			createElement(LazyComponent, props),
		);

	return ChunkedComponent;
};
