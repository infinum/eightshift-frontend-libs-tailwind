import { checkAttr } from '../editor/attributes';
import { clsx } from '@eightshift/ui-components/utilities';

/**
 * Gets Tailwind classes for the provided part.
 *
 * The part needs to be defined within the manifest, in the `tailwind` object.
 *
 * @param {string} part - Part name.
 * @param {Object<string, mixed>} manifest - Component/block manifest.
 * @param {...string?} custom - Custom classes to include in the output.
 *
 * @returns {string} Output classes.
 *
 * @deprecated Since 1.4.0. Use `tailwindClasses` instead.
 *
 * @example
 * const classes = getTwPart('intro', manifest);
 *
 * @example
 * const classes = getTwPart('intro', manifest, 'p-4 bg-gray-100');
 *
 */
export const getTwPart = (part, manifest, ...custom) => {
	if (!part || !manifest || !manifest?.tailwind || Object.keys(manifest?.tailwind ?? {}).length === 0) {
		return clsx(...custom);
	}

	let partClasses = manifest?.tailwind?.parts?.[part]?.twClassesEditor ?? manifest?.tailwind?.parts?.[part]?.twClasses ?? '';

	if (Array.isArray(partClasses)) {
		partClasses = partClasses.join(' ');
	}

	return clsx(partClasses, ...custom);
};

/**
 * Gets Tailwind classes for the provided dynamic part.
 *
 * The part needs to be defined within the manifest, in the `tailwind` object.
 *
 * @param {string} part - Part name.
 * @param {Object<string, mixed>} attributes - Current attribute value.
 * @param {Object<string, mixed>} manifest - Component/block manifest.
 * @param {...string?} custom - Custom classes to include in the output.
 *
 * @returns {string} Output classes.
 *
 * @deprecated Since 1.4.0. Use `tailwindClasses` instead.
 *
 * @example
 * const classes = getTwPart('intro', manifest);
 *
 * @example
 * const classes = getTwPart('intro', manifest, 'p-4 bg-gray-100');
 *
 */
export const getTwDynamicPart = (part, attributes, manifest, ...custom) => {
	if (!part || !manifest || !manifest?.tailwind || Object.keys(manifest?.tailwind ?? {}).length === 0) {
		return clsx(...custom);
	}

	const baseClasses = manifest?.tailwind?.parts?.[part]?.twClassesEditor ?? manifest?.tailwind?.parts?.[part]?.twClasses ?? '';

	const mainClasses = Object.entries(manifest?.tailwind?.options ?? {}).reduce((current, [attributeName, { responsive, twClasses, twClassesEditor, part: partName }]) => {
		if (partName !== part) {
			return current;
		}

		const value = checkAttr(attributeName, attributes, manifest, true);

		if (!value) {
			return current;
		}

		if (!responsive) {
			const currentClasses = twClassesEditor?.[value] ?? twClasses?.[value];

			if (Array.isArray(currentClasses)) {
				return [...current, ...currentClasses];
			}

			return [...current, currentClasses];
		}

		const responsiveClasses = Object.keys(value).reduce((curr, breakpoint) => {
			if (breakpoint === '_desktopFirst') {
				return curr;
			}

			let currentClasses = twClassesEditor?.[value[breakpoint]] ?? twClasses?.[value[breakpoint]];

			if (!Array.isArray(currentClasses)) {
				currentClasses = [currentClasses];
			}

			if (breakpoint === '_default') {
				return [...curr, ...currentClasses];
			}

			return [...curr, ...currentClasses.split(' ').map((currentClass) => `${breakpoint}:${currentClass}`)];
		}, []);

		return [...current, ...responsiveClasses];
	}, []);

	return clsx(baseClasses, ...mainClasses, ...custom);
};

/**
 * Get Tailwind classes from attributes and manifest.
 *
 * @param {Object<string, mixed>} attributes - Current attribute value.
 * @param {Object<string, mixed>} manifest - Component/block manifest.
 * @param {...string?} custom - Custom classes to include in the output.
 *
 * @returns {string} Output classes
 *
 * @deprecated Since 1.4.0. Use `tailwindClasses` instead.
 *
 * @example
 * const classes = getTwClasses(attributes, manifest);
 *
 * @example
 * const classes = getTwClasses(attributes, manifest, 'p-4 bg-gray-100');
 *
 */
export const getTwClasses = (attributes, manifest, ...custom) => {
	if (!attributes || !manifest || !manifest?.tailwind || Object.keys(manifest?.tailwind ?? {}).length === 0) {
		return clsx(...custom);
	}

	let baseClasses = manifest?.tailwind?.base?.twClassesEditor ?? manifest?.tailwind?.base?.twClasses ?? '';

	if (Array.isArray(baseClasses)) {
		baseClasses = baseClasses.join(' ');
	}

	const mainClasses = Object.entries(manifest?.tailwind?.options ?? {}).reduce((current, [attributeName, { responsive, twClasses, twClassesEditor, part: partName }]) => {
		if (partName) {
			return current;
		}

		const value = checkAttr(attributeName, attributes, manifest, true);

		if (!value) {
			return current;
		}

		if (!responsive) {
			let currentClasses = twClassesEditor?.[value] ?? twClasses?.[value];

			if (Array.isArray(currentClasses)) {
				currentClasses = currentClasses.join(' ');
			}

			return [...current, currentClasses];
		}

		const responsiveClasses = Object.keys(value).reduce((curr, breakpoint) => {
			if (breakpoint === '_desktopFirst') {
				return curr;
			}

			let currentClasses = twClassesEditor?.[value[breakpoint]] ?? twClasses?.[value[breakpoint]];

			if (!Array.isArray(currentClasses)) {
				currentClasses = [currentClasses];
			}

			if (breakpoint === '_default') {
				return [...curr, ...currentClasses];
			}

			return [...curr, ...currentClasses.map((currentClass) => `${breakpoint}:${currentClass}`)];
		}, []);

		return [...current, ...responsiveClasses];
	}, []);

	const combinationClasses =
		manifest?.tailwind?.combinations?.reduce((current, { attributes: conditions, twClasses, twClassesEditor }) => {
			const conditionKeys = Object.keys(conditions);

			for (const key of conditionKeys) {
				const value = checkAttr(key, attributes, manifest, true);

				const isArrayCondition = Array.isArray(conditions[key]);

				if (!value) {
					return current;
				} else if (isArrayCondition && !conditions[key].includes(value)) {
					return current;
				} else if (!isArrayCondition && value !== conditions[key]) {
					return current;
				}
			}

			let currentClasses = twClassesEditor ?? twClasses;

			if (!Array.isArray(currentClasses)) {
				currentClasses = [currentClasses];
			}

			return [...current, ...currentClasses];
		}, []) ?? [];

	return clsx(baseClasses, ...mainClasses, ...combinationClasses, ...custom);
};

/**
 * Custom transformer for JSON files. Required for processing responsive classes.
 *
 * @returns {Object} Custom transformation object for JSON.
 *
 * @example
 * // Tailwind config
 * module.exports = {
 *   content: {
 *     // ...
 *     transform: processEightshiftClasses(breakpointNames),
 *   },
 * }
 *
 * @example
 * // Tailwind config
 * module.exports = {
 *   content: {
 *     // ...
 *     transform: {
 *       ...processEightshiftClasses(breakpointNames),
 *       // Your transformations.
 *     },
 *   },
 * }
 *
 */
export const processEightshiftClasses = (breakpoints) => ({
	// Make sure to include all the custom ES classes from JSON manifests.
	json: (rawContent) => {
		if (!rawContent.includes('tailwind')) {
			return rawContent;
		}

		const content = JSON.parse(rawContent);

		const results = Array.from(extractKeys(content));

		const combinedResults = combineAndRemoveDuplicates(results);

		for (let key in combinedResults) {
			let combined = combinedResults[key].split(' ');
			combined = [...new Set(combined)];
			combinedResults[key] = combined.join(' ');
		}

		const responsiveVars =
			combinedResults?.responsive
				?.split(' ')
				?.map((cls) => {
					return breakpoints.reduce((curr, breakpoint) => `${curr} ${breakpoint}:${cls} max-${breakpoint}:${cls}`, cls);
				})
				?.join(' ') ?? '';

		const nonResponsiveVars = combinedResults?.regular ?? '';

		return `${nonResponsiveVars} ${responsiveVars}`.trim();
	},
});

/**
 * Converts global manifest breakpoints to Tailwind screen definitions.
 *
 * @param {Object<string, Number>} breakpointData - Breakpoint data from global manifest.
 *
 * @returns {Object} Tailwind screen definitions.
 *
 * @example
 * // Tailwind config
 * module.exports = {
 *   // ...
 *   theme: {
 *     screens: getScreens(globalManifest.globalVariables.breakpoints),
 *     // ...
 *   },
 * }
 *
 */
export const getScreens = (breakpointData, unit = 'rem') => {
	return Object.entries(breakpointData ?? []).reduce(
		(acc, [key, value]) => ({
			...acc,
			[key]: `${value}${unit}`,
		}),
		{},
	);
};

export const generateOptionsFromValue = (value, getLabel = (v) => v) => {
	return Object.entries(value)
		.filter(([breakpoint]) => breakpoint !== '_desktopFirst')
		.map(([breakpoint, innerValue]) => ({
			value: innerValue,
			label: getLabel(innerValue, breakpoint),
		}));
};

// Utilities
function* extractKeys(obj, parentKey = '', isResponsive = false) {
	const responsive = obj['responsive'] === true ? true : isResponsive;
	let resultKey = responsive ? 'responsive' : 'regular';

	for (let key in obj) {
		let newKey = parentKey ? `${parentKey}.${key}` : key;

		if (typeof obj[key] === 'object' && obj[key] !== null) {
			yield* extractKeys(obj[key], newKey, responsive);
		} else if (newKey.includes('twClasses')) {
			if (typeof obj[key] === 'object') {
				for (let subKey in obj[key]) {
					yield { key: `${newKey}.${subKey}`, value: obj[key][subKey], responsive: resultKey };
				}
			} else {
				yield { key: newKey, value: obj[key], responsive: resultKey };
			}
		}
	}
}

const combineAndRemoveDuplicates = (results) => {
	return results.reduce((acc, { value, responsive }) => {
		acc[responsive] = acc[responsive] ? `${acc[responsive]} ${value}` : value;

		if (Array.isArray(acc[responsive])) {
			acc[responsive] = acc[responsive].join(' ');
		}

		return acc;
	}, {});
};

const unifyClasses = (classes) => {
	if (Array.isArray(classes)) {
		return clsx(...classes);
	}

	return classes.trim();
};

const processOption = (partName, optionValue, defs, options) => {
	const { ignoreEditorClasses } = options;

	let optionClasses = [];

	const isResponsive = defs?.responsive === true;
	const itemPartName = defs?.part ?? 'base';
	const isSingleValue = 'twClasses' in defs || 'twClassesEditor' in defs || 'twClassesEditorOnly' in defs;

	// Part checks.
	if (!isSingleValue && typeof defs?.[partName] === 'undefined') {
		return '';
	}

	if (isSingleValue && !itemPartName.includes(partName)) {
		return '';
	}

	// Non-responsive options.
	if (!isResponsive && !ignoreEditorClasses) {
		const rawValueBase = defs?.twClassesEditorOnly?.[optionValue] ?? defs?.twClasses?.[optionValue] ?? defs?.[partName]?.twClassesEditorOnly?.[optionValue] ?? defs?.[partName]?.twClasses?.[optionValue] ?? '';

		const rawValueEditor = defs?.twClassesEditor?.[optionValue] ?? defs?.[partName]?.twClassesEditor?.[optionValue] ?? '';

		return clsx(unifyClasses(rawValueBase), unifyClasses(rawValueEditor));
	}

	if (!isResponsive && ignoreEditorClasses) {
		const rawValueBase = defs?.twClasses?.[optionValue] ?? defs?.[partName]?.twClasses?.[optionValue] ?? '';

		return unifyClasses(rawValueBase);
	}

	// Responsive options.
	const breakpoints = Object.keys(optionValue).filter((key) => key !== '_desktopFirst');

	for (const breakpoint of breakpoints) {
		const breakpointValue = optionValue?.[breakpoint];

		if (typeof breakpointValue === 'undefined') {
			continue;
		}

		let rawValueBase = '';
		let rawValueEditor = '';

		if (ignoreEditorClasses) {
			rawValueBase = defs?.twClasses?.[breakpointValue] ?? defs?.[partName]?.twClasses?.[breakpointValue] ?? '';
		} else {
			rawValueBase = defs?.twClassesEditorOnly?.[breakpointValue] ?? defs?.twClasses?.[breakpointValue] ?? defs?.[partName]?.twClassesEditorOnly?.[breakpointValue] ?? defs?.[partName]?.twClasses?.[breakpointValue] ?? '';
			rawValueEditor = defs?.twClassesEditor?.[breakpointValue] ?? defs?.[partName]?.twClassesEditor?.[breakpointValue] ?? '';
		}

		if (breakpoint === '_default') {
			optionClasses = [...optionClasses, unifyClasses(rawValueBase), unifyClasses(rawValueEditor)];

			continue;
		}

		const splitClassesBase = unifyClasses(rawValueBase)
			.split(' ')
			.filter(Boolean)
			.map((currentClass) => `${breakpoint}:${currentClass}`);

		const splitClassesEditor = unifyClasses(rawValueEditor)
			.split(' ')
			.filter(Boolean)
			.map((currentClass) => `${breakpoint}:${currentClass}`);

		optionClasses = [...optionClasses, unifyClasses(splitClassesBase), unifyClasses(splitClassesEditor)];
	}

	return unifyClasses(optionClasses);
};

const processCombination = (partName, combo, attributes, manifest, options) => {
	const { ignoreEditorClasses } = options;

	let matches = true;

	for (const [attributeName, allowedValue] of Object.entries(combo?.attributes ?? {})) {
		const optionValue = checkAttr(attributeName, attributes, manifest, true);

		const isArrayCondition = Array.isArray(allowedValue);

		if (isArrayCondition && !allowedValue.includes(optionValue)) {
			matches = false;
			break;
		} else if (!isArrayCondition && optionValue !== allowedValue) {
			matches = false;
			break;
		}
	}

	if (!matches) {
		return '';
	}

	const itemPartName = combo?.part ?? 'base';
	const isSingleValue = 'twClasses' in combo || 'twClassesEditor' in combo || 'twClassesEditorOnly' in combo;

	if (isSingleValue && !partName.includes(itemPartName)) {
		return '';
	}

	let rawValueBase = '';
	let rawValueEditor = '';

	if (ignoreEditorClasses) {
		rawValueBase = combo?.output?.[partName]?.twClasses ?? combo?.twClasses ?? '';
	} else {
		rawValueBase = combo?.output?.[partName]?.twClassesEditorOnly ?? combo?.output?.[partName]?.twClasses ?? combo?.twClassesEditorOnly ?? combo?.twClasses ?? '';
		rawValueEditor = combo?.output?.[partName]?.twClassesEditor ?? combo?.twClassesEditor ?? '';
	}

	if (!Array.isArray(rawValueBase) && typeof rawValueBase !== 'string') {
		throw new Error('Combination classes/editor-only classes were not defined correctly. Please check the combination definition in the manifest.');
	}

	if (!Array.isArray(rawValueEditor) && typeof rawValueEditor !== 'string') {
		throw new Error('Combination editor classes were not defined correctly. Please check the combination definition in the manifest.');
	}

	return clsx(unifyClasses(rawValueBase), unifyClasses(rawValueEditor));
};

/**
 * Get Tailwind classes from attributes and manifest.
 *
 * @param {string} part - Part to get classes for.
 * @param {Object<string, mixed>} attributes - Component/block attributes.
 * @param {Object<string, mixed>} manifest - Component/block manifest data.
 * @param {...string?} custom - Custom classes to include in the output.
 *
 * @returns {string} Output classes
 *
 * ### Note
 * `_twcOptions` can be passed in the `attributes` object to customize the behavior of this function.
 *
 * Options include:
 * - `ignoreEditorClasses` (boolean): If true, editor/editor-only classes will be ignored. Default: `false`.
 * - `noPartDebug` (boolean): If true, debug classes for parts will not be added. Default: `false`.
 * - `ssr` (boolean): If true, indicates server-side rendering. Default: determined by checking if `window` is `undefined`.
 *
 * @example
 * const classes = tailwindClasses(attributes, manifest);
 *
 * @example
 * const classes = tailwindClasses(attributes, manifest, 'p-4 bg-gray-100');
 *
 */
export const tailwindClasses = (part, attributes, manifest, ...custom) => {
	// eslint-disable-next-line no-underscore-dangle
	const twcOptions = attributes?._twcOptions ?? {};

	const { ignoreEditorClasses = false, noPartDebug = false, ssr = typeof window === 'undefined' } = twcOptions;

	// If nothing is set, return custom classes as a fallback.
	if (!attributes || !manifest || !manifest?.tailwind || Object.keys(manifest?.tailwind ?? {}).length === 0) {
		return clsx(...custom);
	}

	const allParts = ['base', ...Object.keys(manifest?.tailwind?.parts ?? {})];

	let partName = 'base';

	if (part !== 'base' && part?.length > 0 && typeof manifest?.tailwind?.parts?.[part] !== 'undefined' && allParts.includes(part)) {
		partName = part;
	} else if (part !== 'base') {
		throw new Error(`Part '${part}' is not defined in the manifest.`);
	}

	// Base classes.
	let baseBaseClasses = '';
	let baseEditorClasses = '';

	if (ignoreEditorClasses) {
		baseBaseClasses = manifest?.tailwind?.parts?.[partName]?.twClasses ?? manifest?.tailwind?.base?.twClasses ?? [''];
	} else {
		baseBaseClasses = manifest?.tailwind?.parts?.[partName]?.twClassesEditorOnly ?? manifest?.tailwind?.parts?.[partName]?.twClasses ?? manifest?.tailwind?.base?.twClassesEditorOnly ?? manifest?.tailwind?.base?.twClasses ?? [''];
		baseEditorClasses = manifest?.tailwind?.parts?.[partName]?.twClassesEditor ?? manifest?.tailwind?.base?.twClassesEditor ?? [''];
	}

	// Option classes.
	const options = manifest?.tailwind?.options ?? {};

	let optionClasses = [];

	for (const [attributeName, defs] of Object.entries(options)) {
		const optionValue = checkAttr(attributeName, attributes, manifest, true);

		optionClasses = [...optionClasses, processOption(partName, optionValue, defs, twcOptions)];
	}

	// Combinations.
	const combinations = manifest?.tailwind?.combinations ?? [];

	let combinationClasses = [];

	for (const combo of combinations) {
		combinationClasses = [...combinationClasses, processCombination(partName, combo, attributes, manifest, twcOptions)];
	}

	const partPrefix = manifest.title.replace(/[^a-zA-Z]+/g, '-').toLowerCase();

	let extras = [];

	if (!ssr && !noPartDebug) {
		extras = [...extras, document?.body?.classList?.contains('es-wp-debug') && `_es__${partPrefix}/${part}`];
	}

	return clsx(...extras, unifyClasses(baseBaseClasses), unifyClasses(baseEditorClasses), ...optionClasses, ...combinationClasses, ...custom);
};
