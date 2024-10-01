import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, tailwindClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImagePlaceholder } from '@eightshift/ui-components';
import manifest from '../manifest.json';

export const SiteNavigationEditor = ({ attributes, setAttributes }) => {
	const siteNavigationLinks = checkAttr('siteNavigationLinks', attributes, manifest);
	const siteNavigationLogoUrl = checkAttr('siteNavigationLogoUrl', attributes, manifest);

	return (
		<div className={tailwindClasses(attributes, manifest)}>
			<ImagePlaceholder
				style='simple'
				imageMode='contain'
				url={siteNavigationLogoUrl}
				size='fullWidth'
				className={tailwindClasses('logo', attributes, manifest)}
			/>

			<div className={tailwindClasses('linkContainer', attributes, manifest)}>
				{siteNavigationLinks.map(({ text }, index) => {
					return (
						<RichText
							placeholder={__('Item', '%g_textdomain%')}
							value={text}
							onChange={(value) => {
								const newLinks = [...siteNavigationLinks];
								newLinks[index].text = value;
								setAttributes({ [getAttrKey('siteNavigationLinks', attributes, manifest)]: newLinks });
							}}
							allowedFormats={[]}
							className={tailwindClasses('link', attributes, manifest)}
							withoutInteractiveFormatting
							disableLineBreaks
						/>
					);
				})}
			</div>
		</div>
	);
};
