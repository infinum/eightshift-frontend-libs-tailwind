import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, tailwindClasses, getAttrKey } from '@eightshift/frontend-libs-tailwind/scripts';
import { AnimatedVisibility } from '@eightshift/ui-components';
import { JsxSvg } from '@eightshift/ui-components/icons';
import manifest from './../manifest.json';

export const QuoteEditor = (attributes) => {
	const { additionalClass, setAttributes } = attributes;

	const quoteUse = checkAttr('quoteUse', attributes, manifest);

	if (!quoteUse) {
		return null;
	}

	const quoteShowIcon = checkAttr('quoteShowIcon', attributes, manifest);
	const quoteText = checkAttr('quoteText', attributes, manifest);
	const quoteAuthor = checkAttr('quoteAuthor', attributes, manifest);

	return (
		<figure className={tailwindClasses('container', attributes, manifest, additionalClass)}>
			<AnimatedVisibility
				visible={quoteShowIcon}
				noInitial
			>
				<JsxSvg
					className={tailwindClasses('icon', attributes, manifest)}
					svg={manifest.resources.quoteIcon}
				/>
			</AnimatedVisibility>

			<RichText
				tagName='blockquote'
				className={tailwindClasses('quote-text', attributes, manifest)}
				placeholder={__('Quote text', '%g_textdomain%')}
				value={quoteText}
				onChange={(value) => setAttributes({ [getAttrKey('quoteText', attributes, manifest)]: value })}
				allowedFormats={[]}
			/>

			<figcaption className={tailwindClasses('author', attributes, manifest)}>
				&mdash;
				<RichText
					placeholder={__('Quote author', '%g_textdomain%')}
					value={quoteAuthor}
					onChange={(value) => setAttributes({ [getAttrKey('quoteAuthor', attributes, manifest)]: value })}
					allowedFormats={[]}
				/>
			</figcaption>
		</figure>
	);
};
