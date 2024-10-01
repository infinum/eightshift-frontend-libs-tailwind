import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getAttrKey, tailwindClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImagePlaceholder } from '@eightshift/ui-components';
import { ShareEditor } from '../../../components/share/components/share-editor';
import { LinkSectionEditor } from '../../../assets/scripts/link-section-editor';
import manifest from '../manifest.json';

export const SiteFooterEditor = ({ attributes, setAttributes }) => {
	const siteFooterPrimary = checkAttr('siteFooterPrimary', attributes, manifest);
	const siteFooterCopyright = checkAttr('siteFooterCopyright', attributes, manifest);
	const siteFooterLogoUrl = checkAttr('siteFooterLogoUrl', attributes, manifest);

	return (
		<div className={tailwindClasses(attributes, manifest)}>
			<div className={tailwindClasses('topContainer', attributes, manifest)}>
				<ImagePlaceholder
					style='simple'
					imageMode='contain'
					url={siteFooterLogoUrl}
					size='fullWidth'
					className={tailwindClasses('logo', attributes, manifest)}
				/>

				<div className={tailwindClasses('linksContainer', attributes, manifest)}>
					<LinkSectionEditor
						links={siteFooterPrimary}
						onChange={(value) => setAttributes({ [getAttrKey('siteFooterPrimary', attributes, manifest)]: value })}
						classNames={{
							sectionContainer: tailwindClasses('sectionContainer', attributes, manifest),
							sectionTitle: tailwindClasses('sectionTitle', attributes, manifest),
							link: tailwindClasses('link', attributes, manifest),
						}}
					/>
				</div>
			</div>

			<div className={tailwindClasses('bottomContainer', attributes, manifest)}>
				<span className={tailwindClasses('copyright', attributes, manifest)}>
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
