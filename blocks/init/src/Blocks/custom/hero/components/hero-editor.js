import React from 'react';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { HeroEditor as EditorComponent } from '../../../components/hero/components/hero-editor';

export const HeroEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('hero', attributes, {
				setAttributes,
			})}
		/>
	);
};
