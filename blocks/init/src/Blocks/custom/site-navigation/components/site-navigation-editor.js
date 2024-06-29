import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, getTwClasses, getTwPart } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImagePlaceholder } from '@eightshift/ui-components';
import manifest from '../manifest.json';

export const SiteNavigationEditor = ({ attributes, setAttributes }) => {
	const siteNavigationLinks = checkAttr('siteNavigationLinks', attributes, manifest);
	const siteNavigationLogoUrl = checkAttr('siteNavigationLogoUrl', attributes, manifest);

	return (
		<div className={getTwClasses(attributes, manifest)}>
			<ImagePlaceholder
				style='simple'
				imageMode='contain'
				url={siteNavigationLogoUrl}
				size='fullWidth'
				className={getTwPart('logo', manifest)}
			/>

			<div className={getTwPart('linkContainer', manifest)}>
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
							className={getTwPart('link', manifest)}
							withoutInteractiveFormatting
							disableLineBreaks
						/>
					);
				})}
			</div>
		</div>
	);
};
