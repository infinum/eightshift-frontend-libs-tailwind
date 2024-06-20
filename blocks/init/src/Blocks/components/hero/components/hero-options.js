import React from 'react';
import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, getOption, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImageOptions } from '../../image/components/image-options';
import { HeadingOptions } from '../../heading/components/heading-options';
import { ParagraphOptions } from '../../paragraph/components/paragraph-options';
import { ButtonOptions } from '../../button/components/button-options';
import { ComponentToggle, OptionSelect } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const HeroOptions = (attributes) => {
	const { setAttributes, ...rest } = attributes;

	const heroUse = checkAttr('heroUse', attributes, manifest);
	const heroColor = checkAttr('heroColor', attributes, manifest);

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.image}
			onChange={(value) => setAttributes({ [getAttrKey('heroUse', attributes, manifest)]: value })}
			useComponent={heroUse}
			{...rest}
		>
			<OptionSelect
				icon={icons.paletteColor}
				label={__('Theme', 'eightshift-frontend-libs')}
				value={heroColor}
				onChange={(value) => {
					let mainButtonColor = 'navy-500';
					let secondaryButtonColor = 'navy-800';

					switch (value) {
						case 'navy-dark':
							mainButtonColor = 'navy-500';
							secondaryButtonColor = 'navy-100';
							break;
						case 'red':
							mainButtonColor = 'red-500';
							secondaryButtonColor = 'red-800';
							break;
						case 'red-dark':
							mainButtonColor = 'red-500';
							secondaryButtonColor = 'red-100';
							break;
						case 'gray':
							mainButtonColor = 'gray-500';
							secondaryButtonColor = 'gray-800';
							break;
						case 'gray-dark':
							mainButtonColor = 'gray-500';
							secondaryButtonColor = 'gray-100';
							break;
						default:
							break;
					}

					return setAttributes({
						[getAttrKey('heroColor', attributes, manifest)]: value,
						[getAttrKey('heroButtonMainColor', attributes, manifest)]: mainButtonColor,
						[getAttrKey('heroButtonSecondaryColor', attributes, manifest)]: secondaryButtonColor,
					});
				}}
				options={getOption('heroColor', attributes, manifest)}
				type='menu'
				inline
			/>

			<div>
				<ImageOptions
					{...props('image', attributes)}
					hideOptions='borderRadius'
				/>

				<HeadingOptions
					{...props('heading', attributes)}
					hideOptions='size'
				/>

				<ParagraphOptions
					{...props('paragraph', attributes)}
					hideOptions='size'
				/>

				<ButtonOptions
					{...props('buttonMain', attributes)}
					label={__('Primary button', 'eightshift-frontend-libs')}
					hideOptions='variant,color'
					icon={icons.buttonFilled}
				/>

				<ButtonOptions
					{...props('buttonSecondary', attributes)}
					label={__('Secondary button', 'eightshift-frontend-libs')}
					hideOptions='variant,color'
				/>
			</div>
		</ComponentToggle>
	);
};
