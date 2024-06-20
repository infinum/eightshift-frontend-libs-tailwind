import React from 'react';
import { useSelect } from '@wordpress/data';
import { GutenbergBlock, overrideInnerBlockAttributes } from '@eightshift/frontend-libs-tailwind/scripts/editor';
import { AccordionItemEditor } from './components/accordion-item-editor';

export const AccordionItem = (props) => {
	useSelect((select) => {
		overrideInnerBlockAttributes(select, props.clientId, {
			wrapperNoWidthControls: true,
			wrapperWidth: 'none',
		});
	});

	return (
		<GutenbergBlock
			{...props}
			editor={AccordionItemEditor}
		/>
	);
};
