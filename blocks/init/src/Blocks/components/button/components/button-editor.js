import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, getTwClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { IconEditor } from '../../icon/components/icon-editor';
import manifest from './../manifest.json';

export const ButtonEditor = (attributes) => {
	const { componentClass } = manifest;

	const { setAttributes, additionalClass, placeholder = __('Add content', '%g_textdomain%') } = attributes;

	const buttonContent = checkAttr('buttonContent', attributes, manifest);
	const buttonUse = checkAttr('buttonUse', attributes, manifest);

	if (!buttonUse) {
		return null;
	}

	return (
		<div className={getTwClasses(attributes, manifest, additionalClass)}>
			<IconEditor
				{...props('icon', attributes, {
					blockClass: componentClass,
				})}
			/>

			<RichText
				placeholder={placeholder}
				value={buttonContent}
				onChange={(value) => setAttributes({ [getAttrKey('buttonContent', attributes, manifest)]: value })}
				keepPlaceholderOnFocus
				allowedFormats={[]}
			/>
		</div>
	);
};
