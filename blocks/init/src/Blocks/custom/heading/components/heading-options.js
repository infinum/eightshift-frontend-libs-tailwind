import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, getOption, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { HeadingOptions as OptionsComponent } from '../../../components/heading/components/heading-options';
import { ColorPicker, OptionSelect } from '@eightshift/ui-components';
import { getColorOption } from '../../../assets/scripts/shared';
import manifest from '../manifest.json';

export const HeadingOptions = ({ attributes, setAttributes }) => {
	const headingAlign = checkAttr('headingAlign', attributes, manifest);
	const headingColor = checkAttr('headingColor', attributes, manifest);

	return (
		<OptionsComponent
			{...props('heading', attributes, {
				setAttributes,
			})}
			additionalControls={
				<>
					<ColorPicker
						colors={getColorOption('headingColor', manifest)}
						onChange={(value) => setAttributes({ [getAttrKey('headingColor', attributes, manifest)]: value })}
						type='textColor'
						value={headingColor}
						aria-label={__('Text color', '%g_textdomain%')}
					/>

					<OptionSelect
						value={headingAlign}
						onChange={(value) => setAttributes({ [getAttrKey('headingAlign', attributes, manifest)]: value })}
						options={getOption('headingAlign', attributes, manifest)}
						aria-label={__('Text alignment', '%g_textdomain%')}
					/>
				</>
			}
			controlOnly
		/>
	);
};
