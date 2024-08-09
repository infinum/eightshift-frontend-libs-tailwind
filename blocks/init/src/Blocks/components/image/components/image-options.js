import { __ } from '@wordpress/i18n';
import {
	checkAttr,
	getAttrKey,
	MediaPicker,
	generateOptionsFromValue,
	getOption,
	getHiddenOptions,
	getResponsiveData,
} from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from './../manifest.json';
import { ComponentToggle, OptionSelect, Responsive, Spacer, Toggle } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { truncateMiddle } from '@eightshift/ui-components/utilities';

export const ImageOptions = (attributes) => {
	const { setAttributes, hideOptions, additionalControls, ...rest } = attributes;

	const hiddenOptions = getHiddenOptions(hideOptions);

	const imageUse = checkAttr('imageUse', attributes, manifest);
	const imageRoundedCorners = checkAttr('imageRoundedCorners', attributes, manifest);
	const imageAspectRatio = checkAttr('imageAspectRatio', attributes, manifest);
	const imageSize = checkAttr('imageSize', attributes, manifest);

	const imageData = checkAttr('imageData', attributes, manifest);

	const responsiveData = getResponsiveData(true);

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
				options={generateOptionsFromValue(imageData, (v) =>
					truncateMiddle(
						v?.url?.replace(window.location.origin, '')?.replace(/\/wp-content\/uploads\/\d{4}\/\d{2}\//g, '') ??
							__('Not set', 'ericsson'),
						15,
					),
				)}
				hidden={hiddenOptions?.imagePicker}
				{...responsiveData}
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

			<Spacer hidden={hiddenOptions?.borderRadius} />

			<OptionSelect
				icon={icons.roundedCorners}
				label={__('Rounded corners', 'ericsson')}
				options={getOption('imageRoundedCorners', attributes, manifest)}
				value={imageRoundedCorners}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('imageRoundedCorners', attributes, manifest)]: value,
					})
				}
				type='menu'
				hidden={hiddenOptions?.borderRadius}
				inline
			/>

			<Spacer hidden={hiddenOptions?.aspectRatio || hiddenOptions?.stretch} />

			<OptionSelect
				icon={icons.aspectRatio}
				label={__('Aspect ratio', 'ericsson')}
				options={getOption('imageAspectRatio', attributes, manifest)}
				value={imageAspectRatio}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('imageAspectRatio', attributes, manifest)]: value,
					})
				}
				type='menu'
				hidden={hiddenOptions?.aspectRatio}
				inline
			/>

			<Toggle
				icon={icons.expandXl}
				label={__('Stretch', 'ericsson')}
				checked={imageSize === 'stretch'}
				onChange={(value) =>
					setAttributes({ [getAttrKey('imageSize', attributes, manifest)]: value ? 'stretch' : 'default' })
				}
				hidden={hiddenOptions?.stretch}
			/>

			<Spacer hidden={!additionalControls} />
			{additionalControls}
		</ComponentToggle>
	);
};
