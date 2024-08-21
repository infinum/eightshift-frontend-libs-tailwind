import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, getHiddenOptions, getOption } from '@eightshift/frontend-libs-tailwind/scripts';
import { ComponentToggle, HStack, OptionSelect, ToggleButton } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from './../manifest.json';

export const ParagraphOptions = (attributes) => {
	const { setAttributes, hideOptions, additionalControls, ...rest } = attributes;

	const hiddenOptions = getHiddenOptions(hideOptions);

	const paragraphUse = checkAttr('paragraphUse', attributes, manifest);
	const paragraphSize = checkAttr('paragraphSize', attributes, manifest);
	const paragraphFontWeight = checkAttr('paragraphFontWeight', attributes, manifest);

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.paragraph}
			onChange={(value) => setAttributes({ [getAttrKey('paragraphUse', attributes, manifest)]: value })}
			useComponent={paragraphUse}
			{...rest}
		>
			<HStack>
				<OptionSelect
					aria-label={__('Font size', '%g_textdomain%')}
					options={getOption('paragraphSize', attributes, manifest)}
					onChange={(value) => setAttributes({ [getAttrKey('paragraphSize', attributes, manifest)]: value })}
					value={paragraphSize}
					type='menu'
					hidden={hiddenOptions.size}
				/>

				<ToggleButton
					selected={paragraphFontWeight === '700'}
					icon={icons.bold}
					onChange={(value) =>
						setAttributes({ [getAttrKey('paragraphFontWeight', attributes, manifest)]: value ? '700' : '400' })
					}
					tooltip={__('Bold', '%g_textdomain%')}
					hidden={hiddenOptions.weight}
				/>

				{additionalControls}
			</HStack>
		</ComponentToggle>
	);
};
