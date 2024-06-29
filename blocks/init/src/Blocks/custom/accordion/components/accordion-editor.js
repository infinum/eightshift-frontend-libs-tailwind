import { BlockInserter } from '@eightshift/frontend-libs-tailwind/scripts';
import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';

export const AccordionEditor = ({ clientId }) => {
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		allowedBlocks: ['eightshift-boilerplate/accordion-item'],
		renderAppender: () => (
			<BlockInserter
				clientId={clientId}
				label
			/>
		),
	});

	return <div {...innerBlocksProps} className='space-y-0 *:!m-0' />;
};
