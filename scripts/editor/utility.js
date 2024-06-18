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

/**
 * Returns a unique ID, generally used with CSS variable generation.
 *
 * @access public
 *
 * @return {string}
 *
 * Usage:
 * ```js
 * getUnique();
 * ```
 *
 * Output:
 * ```js
 * mg2shbh9
 * ```
 */
export const getUnique = () => {
	return (Math.random() + 1).toString(36).substring(4);
};
