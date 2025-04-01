import { useSelect } from '@wordpress/data';
import { STORE_NAME } from './store';
import { upperFirst } from '@eightshift/ui-components/utilities';

/**
 * Returns colors from the global stores from the theme.
 *
 * @access public
 *
 * @returns {object}
 *
 * Usage:
 * ```js
 * getPaletteColors()
 * ```
 */
export const getPaletteColors = () =>
	useSelect((select) => {
		const colors = select(STORE_NAME).getSettings()?.globalVariables?.colors;

		return colors?.reduce(
			(obj, item) => ({
				...obj,
				[item.slug]: item,
			}),
			{},
		);
	});

export const getColorData = (themeColors) =>
	Object.entries(themeColors ?? {})?.reduce((curr, [name, value]) => {
		if (name === 'current') {
			return curr;
		}

		if (name === 'transparent') {
			return [
				...curr,
				{
					name: 'Transparent',
					slug: 'transparent',
					color: '#00000000',
				},
			];
		}

		if (typeof value === 'string') {
			return [
				...curr,
				{
					name: upperFirst(name),
					slug: name,
					color: value,
				},
			];
		}

		return [
			...curr,
			...Object.entries(value).map(([shade, color]) => ({
				name: `${upperFirst(name)} ${shade}`,
				slug: `${name}-${shade}`,
				color,
			})),
		];
	}, []) ?? [];
