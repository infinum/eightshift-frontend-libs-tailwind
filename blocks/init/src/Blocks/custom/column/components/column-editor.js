import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { BlockInserter } from '@eightshift/frontend-libs-tailwind/scripts';

export const ColumnEditor = ({ clientId }) => {
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		renderAppender: false,
	});

	return (
		<>
			<div
				{...innerBlocksProps}
				className='contents *:!m-0'
			/>
			<BlockInserter
				small
				clientId={clientId}
			/>
		</>
	);
};
