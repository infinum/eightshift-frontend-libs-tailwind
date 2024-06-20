import React from 'react';
import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey } from '@eightshift/frontend-libs-tailwind/scripts';
import { ComponentToggle, Toggle } from '@eightshift/ui-components';
import { icons, JsxSvg } from '@eightshift/ui-components/icons';
import manifest from './../manifest.json';

export const QuoteOptions = (attributes) => {
	const { setAttributes, ...rest } = attributes;

	const quoteUse = checkAttr('quoteUse', attributes, manifest);
	const quoteShowIcon = checkAttr('quoteShowIcon', attributes, manifest);

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.paragraph}
			onChange={(value) => setAttributes({ [getAttrKey('quoteUse', attributes, manifest)]: value })}
			useComponent={quoteUse}
			{...rest}
		>
			<Toggle
				icon={<JsxSvg svg={manifest.resources.quoteIcon} />}
				label={__('Icon', '%g_textdomain%')}
				checked={quoteShowIcon}
				onChange={(value) => setAttributes({ [getAttrKey('quoteShowIcon', attributes, manifest)]: value })}
			/>
		</ComponentToggle>
	);
};
