import React from 'react';
import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, getOption, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ParagraphOptions as OptionsComponent } from '../../../components/paragraph/components/paragraph-options';
import { OptionSelect, ColorPicker } from '@eightshift/ui-components';
import { getColorOption } from '../../../assets/scripts/shared';
import manifest from '../manifest.json';

export const ParagraphOptions = ({ attributes, setAttributes }) => {
	const paragraphAlign = checkAttr('paragraphAlign', attributes, manifest);
	const paragraphColor = checkAttr('paragraphColor', attributes, manifest);

	return (
		<OptionsComponent
			{...props('paragraph', attributes, {
				setAttributes,
			})}
			additionalControls={
				<>
					<ColorPicker
						colors={getColorOption('paragraphColor', manifest)}
						onChange={(value) => setAttributes({ [getAttrKey('paragraphColor', attributes, manifest)]: value })}
						type='textColor'
						value={paragraphColor}
						aria-label={__('Text color', '%g_textdomain%')}
					/>

					<OptionSelect
						value={paragraphAlign}
						onChange={(value) => setAttributes({ [getAttrKey('paragraphAlign', attributes, manifest)]: value })}
						options={getOption('paragraphAlign', attributes, manifest)}
						aria-label={__('Text alignment', '%g_textdomain%')}
					/>
				</>
			}
			controlOnly
		/>
	);
};
