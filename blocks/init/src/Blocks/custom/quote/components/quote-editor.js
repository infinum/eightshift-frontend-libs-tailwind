import React from 'react';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { QuoteEditor as EditorComponent } from '../../../components/quote/components/quote-editor';

export const QuoteEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('quote', attributes, {
				setAttributes,
			})}
		/>
	);
};
