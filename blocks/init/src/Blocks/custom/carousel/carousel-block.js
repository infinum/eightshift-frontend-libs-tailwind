import React from 'react';
import { useSelect } from '@wordpress/data';
import { GutenbergBlock, overrideInnerBlockAttributes } from '@eightshift/frontend-libs-tailwind/scripts/editor';
import { CarouselOptions } from './components/carousel-options';
import { CarouselEditor } from './components/carousel-editor';

export const Carousel = (props) => {
	useSelect((select) => {
		overrideInnerBlockAttributes(select, props.clientId, {
			wrapperUse: false,
			wrapperNoControls: true,
		});
	});

	return (
		<GutenbergBlock
			{...props}
			options={CarouselOptions}
			editor={CarouselEditor}
		/>
	);
};
