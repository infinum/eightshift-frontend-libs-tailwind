import React from 'react';
import { __ } from '@wordpress/i18n';
import { getOption, checkAttr, getAttrKey, getHiddenOptions } from '@eightshift/frontend-libs-tailwind/scripts';
import { ComponentToggle, HStack, OptionSelect } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from './../manifest.json';

export const HeadingOptions = (attributes) => {
	const { setAttributes, hideOptions, additionalControls, ...rest } = attributes;

	const hiddenOptions = getHiddenOptions(hideOptions);

	const headingUse = checkAttr('headingUse', attributes, manifest);
	const headingSize = checkAttr('headingSize', attributes, manifest);
	const headingTag = checkAttr('headingTag', attributes, manifest);

	const headingTags = [
		{ label: __('Heading 1', '%g_textdomain%'), value: 'h1' },
		{ label: __('Heading 2', '%g_textdomain%'), value: 'h2' },
		{ label: __('Heading 3', '%g_textdomain%'), value: 'h3' },
		{ label: __('Heading 4', '%g_textdomain%'), value: 'h4' },
		{ label: __('Heading 5', '%g_textdomain%'), value: 'h5' },
		{ label: __('Heading 6', '%g_textdomain%'), value: 'h6' },
		{ label: __('Paragraph', '%g_textdomain%'), value: 'p' },
	];

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.heading}
			onChange={(value) => setAttributes({ [getAttrKey('headingUse', attributes, manifest)]: value })}
			useComponent={headingUse}
			{...rest}
		>
			<HStack>
				<OptionSelect
					aria-label={__('Font size', '%g_textdomain%')}
					options={getOption('headingSize', attributes, manifest)}
					onChange={(value) => setAttributes({ [getAttrKey('headingSize', attributes, manifest)]: value })}
					value={headingSize}
					hidden={hiddenOptions?.size}
					type='menu'
				/>

				<OptionSelect
					aria-label={__('Heading level', '%g_textdomain%')}
					options={headingTags}
					value={headingTag}
					onChange={(value) => setAttributes({ [getAttrKey('headingTag', attributes, manifest)]: value })}
					type='menu'
					wrapperProps={{
						triggerIcon: <span className='es-uic-font-mono uppercase'>{headingTag}</span>,
						tooltip: __('Heading level', '%g_textdomain%'),
					}}
					hidden={hiddenOptions?.headingLevel}
					noTriggerLabel
				/>

				{additionalControls}
			</HStack>
		</ComponentToggle>
	);
};
