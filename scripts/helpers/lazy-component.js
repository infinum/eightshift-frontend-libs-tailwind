import { Spinner } from '@eightshift/ui-components/icons';
import { createElement, forwardRef, lazy, Suspense } from 'react';

const resolveExportedComponent = (module, exportName) => {
	if (exportName === 'default') {
		return module?.default ?? null;
	}

	if (exportName) {
		return module?.[exportName] ?? null;
	}

	const entries = Object.entries(module ?? {}).filter(([key]) => key !== '__esModule');
	const values = entries.map(([, value]) => value);
	const functions = new Set(values.filter((value) => typeof value === 'function'));

	if (functions.size) {
		return functions.size === 1 ? functions.values().next().value : null;
	}

	const components = new Set(values.filter((value) => value !== null && typeof value === 'object' && [Symbol.for('react.forward_ref'), Symbol.for('react.memo')].includes(value.$$typeof)));

	return components.size === 1 ? components.values().next().value : null;
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
 * @param {import('react').ReactNode} [fallback] Content displayed while loading.
 * @returns {import('react').ForwardRefExoticComponent<any>} Component forwarding props and refs through a Suspense boundary.
 */
export const lazyComponent = (moduleLoaderOrPromise, exportName, fallback = createElement(Spinner, { className: 'm-16 size-32!' })) => {
	if (typeof moduleLoaderOrPromise === 'string') {
		throw new TypeError('lazyComponent literal paths require the Eightshift Bun build transform. Use () => import("./component") for portable builds.');
	}

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
