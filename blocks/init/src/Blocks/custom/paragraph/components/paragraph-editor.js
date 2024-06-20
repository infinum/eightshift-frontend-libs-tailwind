import React, { useMemo } from 'react';
import { createBlock } from '@wordpress/blocks';
import { getTwClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ParagraphEditor as EditorComponent } from '../../../components/paragraph/components/paragraph-editor';
import manifest from './../manifest.json';
import globalManifest from './../../../manifest.json';

export const ParagraphEditor = (keyProps) => {
	const { attributes, setAttributes, onReplace, mergeBlocks } = keyProps;

	const propsObject = props('paragraph', attributes);

	/**
	 * Block-splitting logic. If content is available, creates
	 * a new block with the attributes of the original.
	 *
	 * @param {*} value Content value.
	 */
	const splitBlocks = (value) => {
		if (!value) {
			return createBlock(`${globalManifest.namespace}/${manifest.blockName}`);
		}

		return createBlock(`${globalManifest.namespace}/${manifest.blockName}`, {
			...attributes,
			[`${propsObject.prefix}Content`]: value,
		});
	};

	return (
		<EditorComponent
			{...propsObject}
			setAttributes={setAttributes}
			onSplit={splitBlocks}
			mergeBlocks={mergeBlocks}
			onReplace={onReplace}
			onRemove={onReplace ? () => onReplace([]) : undefined}
			additionalClass={getTwClasses(attributes, manifest)}
		/>
	);
};
