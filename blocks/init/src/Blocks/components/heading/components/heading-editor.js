import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, getTwClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from './../manifest.json';

export const HeadingEditor = (attributes) => {
	const { setAttributes, additionalClass, placeholder = __('Heading', '%g_textdomain%') } = attributes;

	const headingUse = checkAttr('headingUse', attributes, manifest);

	if (!headingUse) {
		return null;
	}

	const headingContent = checkAttr('headingContent', attributes, manifest);

	return (
		<RichText
			className={getTwClasses(attributes, manifest, additionalClass)}
			placeholder={placeholder}
			value={headingContent}
			onChange={(value) => setAttributes({ [getAttrKey('headingContent', attributes, manifest)]: value })}
			allowedFormats={[]}
		/>
	);
};
