/**
 * Convert the first letter of the string to uppercase.
 *
 * @param {string} str - String to convert to first letter uppercase.
 *
 * @access public
 *
 * @returns {string} - String with the first letter uppercase.
 *
 * Usage:
 * ```js
 * ucfirst('custom');
 * ```
 *
 * Output:
 * ```js
 * Custom
 * ```
 */
export function ucfirst(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Prepares the hidden option object from provided string, for use within the component.
 *
 * @param {Object} props - Component props.
 *
 * @returns {Object} Disabled component reference.
 *
 * @example
 * // ButtonEditor
 * <IconEditor hideOptions='size' />
 *
 * // IconEditor
 * const hiddenOptions = getHiddenOptions(attributes.hideOptions);
 *
 * ...
 *
 * {!hiddenOptions.size && <MyOptionComponent />}
 *
 */
export const getHiddenOptions = (options) => {
	if (!options) {
		return {};
	}

	return Object.fromEntries(options.split(',').map((item) => [item.trim(), true]));
};
