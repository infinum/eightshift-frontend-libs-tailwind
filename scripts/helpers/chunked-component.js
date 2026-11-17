import { createElement, forwardRef, lazy, Suspense } from 'react';

const resolveExportedComponent = (module, exportName) => {
	if (exportName === 'default') {
		return module?.default ?? null;
	}

	if (exportName) {
		return module?.[exportName] ?? null;
	}

	const entries = Object.entries(module ?? {}).filter(([key]) => key !== '__esModule');
	const functions = entries.filter(([, value]) => typeof value === 'function');

	if (functions.length) {
		return functions.length === 1 ? functions[0][1] : null;
	}

	const forwarded = entries.filter(([, value]) => value !== null && typeof value === 'object' && value.$$typeof === Symbol.for('react.forward_ref'));

	return forwarded.length === 1 ? forwarded[0][1] : null;
};

const resolveLazyModule = (moduleLoaderOrPromise, exportName) =>
	Promise.resolve(typeof moduleLoaderOrPromise === 'function' ? moduleLoaderOrPromise() : moduleLoaderOrPromise).then((module) => {
		const Component = resolveExportedComponent(module, exportName);

		if (!Component) {
			throw new Error(`Unable to resolve chunked component${exportName ? ` "${exportName}"` : ''}.`);
		}

		// React 18's server renderer does not forward refs through lazy boundaries.
		return { default: ({ componentProps, componentRef }) => createElement(Component, { ...componentProps, ref: componentRef }) };
	});

/**
 * Create a stable lazy component. Call outside render; prefer a loader to defer loading.
 *
 * @param {Function|Promise} moduleLoaderOrPromise Module loader or already-started promise.
 * @param {string} [exportName] Explicit export; otherwise infer a sole function or forwardRef export.
 * @param {import('react').ReactNode} [fallback=null] Content displayed while loading.
 * @returns {import('react').ForwardRefExoticComponent<any>} Component forwarding props and refs through a Suspense boundary.
 */
export const createChunkedComponent = (moduleLoaderOrPromise, exportName, fallback = null) => {
	const LazyComponent = lazy(() => resolveLazyModule(moduleLoaderOrPromise, exportName));

	return forwardRef((props, ref) =>
		createElement(
			Suspense,
			{
				fallback,
			},
			createElement(LazyComponent, { componentProps: props, componentRef: ref }),
		),
	);
};
