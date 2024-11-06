import React from 'react';
import { tailwindClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ParagraphEditor as EditorComponent } from '../../../components/paragraph/components/paragraph-editor';
import manifest from './../manifest.json';

export const ParagraphEditor = ({ attributes, setAttributes, onReplace, mergeBlocks }) => {
	return (
		<EditorComponent
			{...props('paragraph', attributes)}
			setAttributes={setAttributes}
			mergeBlocks={mergeBlocks}
			onReplace={onReplace}
			onRemove={onReplace ? () => onReplace([]) : undefined}
			additionalClass={tailwindClasses(attributes, manifest)}
		/>
	);
};
