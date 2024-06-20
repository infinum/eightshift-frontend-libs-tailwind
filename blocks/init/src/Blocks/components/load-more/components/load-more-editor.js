import React from 'react';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ButtonEditor } from '../../../components/button/components/button-editor';

export const LoadMoreEditor = (attributes) => {
	const { setAttributes, additionalClass } = attributes;

	return (
		<ButtonEditor
			{...props('button', attributes, {
				setAttributes,
			})}
		/>
	);
};
