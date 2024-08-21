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
	isResponsive = obj['responsive'] === true ? true : isResponsive;
	let resultKey = isResponsive ? 'responsive' : 'regular';

	for (let key in obj) {
		let newKey = parentKey ? `${parentKey}.${key}` : key;

		if (typeof obj[key] === 'object' && obj[key] !== null) {
			yield* extractKeys(obj[key], newKey, isResponsive);
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
