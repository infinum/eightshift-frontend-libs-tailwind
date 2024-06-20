import React from 'react';
import { __ } from '@wordpress/i18n';
import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { BlockInserter, getTwClasses, getTwPart } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from '../manifest.json';

export const CarouselEditor = ({ attributes, clientId }) => {
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		renderAppender: false,
		orientation: 'horizontal',
	});

	return (
		<div className='flex items-center gap-2'>
			<div className={getTwPart('container', manifest)}>
				<div
					{...innerBlocksProps}
					className={getTwClasses(attributes, manifest)}
				/>
			</div>

			<BlockInserter clientId={clientId} />
		</div>
	);
};
