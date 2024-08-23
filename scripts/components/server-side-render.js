import GutenbergSsr from '@wordpress/server-side-render';
import { clsx } from '@eightshift/ui-components/utilities';

/**
 * Wraps Gutenberg's ServerSideRender component with a bit of extra styles.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {string} props.block - Fully qualified block name.
 * @param {Object} props.attributes - Block attributes.
 * @param {string} props.className - Classes to pass to the rendered content wrapper.
 *
 * @returns {JSX.Element} The ServerSideRender component.
 *
 * @example
 * <ServerSideRender
 *  block="core/latest-posts"
 *  attributes={{
 *   myProp: true,
 *  }}
 * />
 *
 */
export const ServerSideRender = (props) => {
	const { block, attributes, className, ...rest } = props;

	return (
		<GutenbergSsr
			{...rest}
			block={block}
			attributes={attributes}
			className={clsx(
				'es-uic-pointer-events-none es-uic-rounded-lg es-uic-border es-uic-border-dotted es-uic-border-gray-300 es-uic-p-2 es-uic-flow-root',
				className,
			)}
		/>
	);
};
