import React from 'react';
import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, getTwClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from './../manifest.json';

export const ParagraphEditor = (attributes) => {
	const {
		setAttributes,
		placeholder = __('Add content', '%g_textdomain%'),
		additionalClass,

		onSplit,
		mergeBlocks,
		onReplace,
		onRemove,
	} = attributes;

	const paragraphUse = checkAttr('paragraphUse', attributes, manifest);
	const paragraphContent = checkAttr('paragraphContent', attributes, manifest);

	if (!paragraphUse) {
		return null;
	}

	return (
		<RichText
			identifier={getAttrKey('paragraphContent', attributes, manifest)}
			className={getTwClasses(attributes, manifest, additionalClass)}
			placeholder={placeholder}
			value={paragraphContent}
			onChange={(value) => setAttributes({ [getAttrKey('paragraphContent', attributes, manifest)]: value })}
			allowedFormats={['core/bold', 'core/link', 'core/italic']}
			onSplit={onSplit}
			onMerge={mergeBlocks}
			onReplace={onReplace}
			onRemove={onRemove}
			deleteEnter={true}
		/>
	);
};
