import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, MediaPicker, wpSearchRoute } from '@eightshift/frontend-libs-tailwind/scripts';
import { BaseControl, Repeater, RepeaterItem, LinkInput, Toggle, Spacer } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { truncate } from '@eightshift/ui-components/utilities';
import manifest from '../manifest.json';

export const SiteNavigationOptions = ({ attributes, setAttributes }) => {
	const siteNavigationLinks = checkAttr('siteNavigationLinks', attributes, manifest);
	const siteNavigationLogoUrl = checkAttr('siteNavigationLogoUrl', attributes, manifest);
	const siteNavigationLogoId = checkAttr('siteNavigationLogoId', attributes, manifest);

	return (
		<>
			<BaseControl
				icon={icons.iconGeneric}
				label={__('Logo', '%g_textdomain%')}
			>
				<MediaPicker
					onChange={({ id, url }) => {
						setAttributes({
							[getAttrKey('siteNavigationLogoId', attributes, manifest)]: id,
							[getAttrKey('siteNavigationLogoUrl', attributes, manifest)]: url,
						});
					}}
					imageId={siteNavigationLogoId}
					imageUrl={siteNavigationLogoUrl}
					imageMode='contain'
				/>

				<Spacer />

				<Repeater
					icon={icons.link}
					label={__('Links', '%g_textdomain%')}
					items={siteNavigationLinks}
					onChange={(value) => setAttributes({ [getAttrKey('siteNavigationLinks', attributes, manifest)]: value })}
					addDefaultItem={{
						text: '',
						url: '',
						newTab: false,
					}}
				>
					{(item) => {
						const { text, url, newTab, updateData } = item;

						return (
							<RepeaterItem
								icon={text?.length < 1 && icons.solidCircleGradient}
								label={text?.length > 0 ? text : __('New link', '%g_textdomain%')}
								subtitle={truncate(url?.replace(window.location.origin, ''), 30)}
							>
								<LinkInput
									icon={url?.includes('#')}
									url={url}
									onChange={({ url }) => updateData({ url: url })}
									fetchSuggestions={wpSearchRoute}
								/>

								<Toggle
									icon={icons.newTab}
									label={__('Open in new tab', '%g_textdomain%')}
									checked={newTab}
									onChange={(value) => updateData({ newTab: value })}
								/>
							</RepeaterItem>
						);
					}}
				</Repeater>
			</BaseControl>
		</>
	);
};
