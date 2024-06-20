import React from 'react';
import { __ } from '@wordpress/i18n';
import { getOption, getAttrKey, checkAttr, getHiddenOptions } from '@eightshift/frontend-libs-tailwind/scripts';
import { ComponentToggle, OptionSelect, HStack, ToggleButton } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const ListOptions = (attributes) => {
	const { setAttributes, additionalControls, hideOptions, ...rest } = attributes;

	const hiddenOptions = getHiddenOptions(hideOptions);

	const listUse = checkAttr('listUse', attributes, manifest);
	const listSize = checkAttr('listSize', attributes, manifest);
	const listFontWeight = checkAttr('listFontWeight', attributes, manifest);
	const listStyle = checkAttr('listStyle', attributes, manifest);

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.listUnordered}
			onChange={(value) => setAttributes({ [getAttrKey('listUse', attributes, manifest)]: value })}
			useComponent={listUse}
			{...rest}
		>
			<HStack>
				<OptionSelect
					options={getOption('listSize', attributes, manifest)}
					onChange={(value) => setAttributes({ [getAttrKey('listSize', attributes, manifest)]: value })}
					value={listSize}
					aria-label={__('Font size', '%g_textdomain%')}
					hidden={hiddenOptions.size}
					type='menu'
				/>

				<ToggleButton
					selected={listFontWeight === '700'}
					icon={icons.bold}
					onChange={(value) =>
						setAttributes({ [getAttrKey('listFontWeight', attributes, manifest)]: value ? '700' : '400' })
					}
					tooltip={__('Bold', '%g_textdomain%')}
					hidden={hiddenOptions.weight}
				/>

				<OptionSelect
					value={listStyle}
					onChange={(value) =>
						setAttributes({
							[getAttrKey('listStyle', attributes, manifest)]: value,
							[getAttrKey('listType', attributes, manifest)]: value === 'decimal' ? 'ol' : 'ul',
						})
					}
					aria-label={__('List style', '%g_textdomain%')}
					options={getOption('listStyle', attributes, manifest)}
					noItemLabel
				/>
			</HStack>

			{additionalControls}
		</ComponentToggle>
	);
};
