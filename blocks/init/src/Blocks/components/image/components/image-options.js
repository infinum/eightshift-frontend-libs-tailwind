import React from 'react';
import { __ } from '@wordpress/i18n';
import {
	checkAttr,
	getAttrKey,
	MediaPicker,
	getBreakpointNames,
	getBreakpointData,
	generateOptionsFromValue,
	getOption,
	getHiddenOptions,
} from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from './../manifest.json';
import { ComponentToggle, OptionSelect, Responsive } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { truncateMiddle } from '@eightshift/ui-components/utilities';

export const ImageOptions = (attributes) => {
	const {
		setAttributes,
		hideOptions,
		additionalControls,
		...rest
	} = attributes;

	const hiddenOptions = getHiddenOptions(hideOptions);

	const imageUse = checkAttr('imageUse', attributes, manifest);
	const imageRoundedCorners = checkAttr('imageRoundedCorners', attributes, manifest);

	const imageData = checkAttr('imageData', attributes, manifest);

	const breakpointNames = getBreakpointNames();
	const breakpointData = getBreakpointData(true);

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.image}
			onChange={(value) => setAttributes({ [getAttrKey('imageUse', attributes, manifest)]: value })}
			useComponent={imageUse}
			{...rest}
		>
			<Responsive
				value={imageData}
				onChange={(value) => setAttributes({ [getAttrKey('imageData', attributes, manifest)]: value })}
				icon={icons.imageFile}
				label={__('Image', 'eightshift-ui-components')}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				options={generateOptionsFromValue(imageData, (v) =>
					truncateMiddle(
						v?.url?.replace(window.location.origin, '')?.replace(/\/wp-content\/uploads\/\d{4}\/\d{2}\//g, '') ??
							__('Not set', '%g_textdomain%'),
						15,
					),
				)}
				hidden={hiddenOptions?.imagePicker}
			>
				{({ breakpoint, currentValue, handleChange }) => (
					<MediaPicker
						onChange={({ id, url }) => handleChange({ id: id, url: url })}
						imageId={currentValue?.id}
						imageUrl={currentValue?.url}
						noDelete={breakpoint !== '_default'}
					/>
				)}
			</Responsive>

			<OptionSelect
				icon={icons.roundedCorners}
				label={__('Rounded corners', '%g_textdomain%')}
				options={getOption('imageRoundedCorners', attributes, manifest)}
				value={imageRoundedCorners}
				onChange={(v) =>
					setAttributes({
						[getAttrKey('imageRoundedCorners', attributes, manifest)]: v,
					})
				}
				type='menu'
				hidden={hiddenOptions?.borderRadius}
				inline
			/>

			{additionalControls}
		</ComponentToggle>
	);
};
