import { __, sprintf, _n } from '@wordpress/i18n';
import { props, checkAttr, getAttrKey, MediaPicker, wpSearchRoute } from '@eightshift/frontend-libs-tailwind/scripts';
import { ShareOptions } from '../../../components/share/components/share-options';
import { BaseControl, Repeater, RepeaterItem, LinkInput, Toggle } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { truncate } from '@eightshift/ui-components/utilities';
import manifest from '../manifest.json';

export const SiteFooterOptions = ({ attributes, setAttributes, randId, setRandId }) => {
	const siteFooterLogoUrl = checkAttr('siteFooterLogoUrl', attributes, manifest);
	const siteFooterLogoId = checkAttr('siteFooterLogoId', attributes, manifest);
	const siteFooterPrimary = checkAttr('siteFooterPrimary', attributes, manifest);

	return (
		<>
			<BaseControl
				icon={icons.iconGeneric}
				label={__('Logo', '%g_textdomain%')}
			>
				<MediaPicker
					onChange={({ id, url }) => {
						setAttributes({
							[getAttrKey('siteFooterLogoId', attributes, manifest)]: id,
							[getAttrKey('siteFooterLogoUrl', attributes, manifest)]: url,
						});
					}}
					imageId={siteFooterLogoId}
					imageUrl={siteFooterLogoUrl}
					imageMode='contain'
				/>
			</BaseControl>

			<ShareOptions
				{...props('share', attributes, { setAttributes })}
				noUseToggle
			/>

			<Repeater
				icon={icons.linkNav}
				label={__('Links', '%g_textdomain%')}
				items={siteFooterPrimary}
				onChange={(value) => setAttributes({ [getAttrKey('siteFooterPrimary', attributes, manifest)]: value })}
				addDefaultItem={{
					header: '',
					items: [
						{
							text: '',
							url: '',
							newTab: false,
						},
					],
				}}
			>
				{(item) => {
					const { header, items, updateData, itemIndex } = item;

					return (
						<RepeaterItem
							label={header?.length > 0 ? header : __('New section', '%g_textdomain%')}
							subtitle={
								items.length > 0 && sprintf(_n('%d link', '%d links', items.length, '%g_textdomain%'), items.length)
							}
						>
							<Repeater
								icon={icons.link}
								label={__('Links', '%g_textdomain%')}
								items={items}
								onChange={(value) => updateData({ items: value })}
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
						</RepeaterItem>
					);
				}}
			</Repeater>
		</>
	);
};
