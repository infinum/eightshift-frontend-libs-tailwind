import React, { useMemo } from 'react';
import { getTwClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { HeadingEditor as EditorComponent } from '../../../components/heading/components/heading-editor';
import manifest from './../manifest.json';

export const HeadingEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('heading', attributes, {
				setAttributes,
			})}
			additionalClass={getTwClasses(attributes, manifest)}
		/>
	);
};
