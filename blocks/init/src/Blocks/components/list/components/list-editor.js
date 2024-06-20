import React from 'react';
import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, getTwClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from '../manifest.json';

export const ListEditor = (attributes) => {
	const { setAttributes, additionalClass, placeholder = __('Add content', '%g_textdomain%') } = attributes;

	const listUse = checkAttr('listUse', attributes, manifest);

	if (!listUse) {
		return null;
	}

	const listContent = checkAttr('listContent', attributes, manifest);
	const listType = checkAttr('listType', attributes, manifest);

	return (
		<div className={getTwClasses(attributes, manifest, additionalClass)}>
			<RichText
				tagName={listType}
				multiline='li'
				placeholder={placeholder}
				value={listContent}
				onChange={(value) => setAttributes({ [getAttrKey('listContent', attributes, manifest)]: value })}
				allowedFormats={['core/bold', 'core/link']}
			/>
		</div>
	);
};
