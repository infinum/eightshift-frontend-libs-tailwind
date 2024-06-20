import React from 'react';
import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, getTwClasses, getTwPart, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImagePlaceholder } from '@eightshift/ui-components';
import { ShareEditor } from '../../../components/share/components/share-editor';
import { LinkSectionEditor } from '../../../assets/scripts/link-section-editor';
import manifest from '../manifest.json';

export const SiteFooterEditor = ({ attributes, setAttributes }) => {
	const siteFooterPrimary = checkAttr('siteFooterPrimary', attributes, manifest);
	const siteFooterCopyright = checkAttr('siteFooterCopyright', attributes, manifest);
	const siteFooterLogoUrl = checkAttr('siteFooterLogoUrl', attributes, manifest);

	return (
		<div className={getTwClasses(attributes, manifest)}>
			<div className={getTwPart('topContainer', manifest)}>
				<ImagePlaceholder
					style='simple'
					imageMode='contain'
					url={siteFooterLogoUrl}
					size='fullWidth'
					className={getTwPart('logo', manifest)}
				/>

				<div className={getTwPart('linksContainer', manifest)}>
					<LinkSectionEditor
						links={siteFooterPrimary}
						onChange={(value) => setAttributes({ [getAttrKey('siteFooterPrimary', attributes, manifest)]: value })}
						classNames={{
							sectionContainer: getTwPart('sectionContainer', manifest),
							sectionTitle: getTwPart('sectionTitle', manifest),
							link: getTwPart('link', manifest),
						}}
					/>
				</div>
			</div>

			<div className={getTwPart('bottomContainer', manifest)}>
				<span className={getTwPart('copyright', manifest)}>
					&copy;
					<RichText
						placeholder={__('Copyright', '%g_textdomain%')}
						value={siteFooterCopyright}
						onChange={(value) => setAttributes({ [getAttrKey('siteFooterCopyright', attributes, manifest)]: value })}
						allowedFormats={[]}
					/>
				</span>

				<ShareEditor
					{...props('share', attributes, {
						setAttributes,
					})}
				/>
			</div>
		</div>
	);
};
