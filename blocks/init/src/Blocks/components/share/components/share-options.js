import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, getHiddenOptions } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from '../manifest.json';
import {
	ComponentToggle,
	OptionSelect,
	DraggableList,
	DraggableListItem,
	Spacer,
	Switch,
} from '@eightshift/ui-components';
import { icons, JsxSvg } from '@eightshift/ui-components/icons';

export const ShareOptions = (attributes) => {
	const { hideOptions, setAttributes, ...rest } = attributes;

	const hiddenOptions = getHiddenOptions(hideOptions);

	const shareUse = checkAttr('shareUse', attributes, manifest);

	const shareTargets = checkAttr('shareTargets', attributes, manifest);
	const shareMode = checkAttr('shareMode', attributes, manifest);

	const networksToShow = Object.entries(manifest.networks).reduce((current, [name, info]) => {
		if (shareMode === 'share' && !info?.shareUrl) {
			return current;
		}

		return [...current, { name: name, enabled: shareTargets.includes(name), ...info }];
	}, []);

	const modeOptions = [
		{
			label: __('Link to social networks', '%g_textdomain%'),
			icon: icons.link,
			value: 'links',
		},
		{
			label: __('Share the current URL', '%g_textdomain%'),
			subtitle: __('Unavailable for some networks', '%g_textdomain%'),
			icon: icons.share,
			value: 'share',
		},
	];

	const pickerSectionTitle = shareMode
		? __('Share targets', '%g_textdomain%')
		: __('Social networks', '%g_textdomain%');

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.share}
			onChange={(value) => setAttributes({ [getAttrKey('shareUse', attributes, manifest)]: value })}
			useComponent={shareUse}
			{...rest}
		>
			<OptionSelect
				aria-label={__('Share mode', '%g_textdomain%')}
				value={shareMode}
				options={modeOptions}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('shareMode', attributes, manifest)]: value,
					})
				}
				type='radiosSegmented'
				hidden={hiddenOptions?.mode}
				vertical
			/>

			<Spacer />

			<DraggableList
				icon={icons.globe}
				label={pickerSectionTitle}
				items={networksToShow}
				onChange={(value) => {
					const newValue = value.reduce((current, { name, enabled }) => {
						if (!enabled) {
							return current;
						}

						return [...current, name];
					}, []);

					setAttributes({ [getAttrKey('shareTargets', attributes, manifest)]: newValue });
				}}
				hidden={hiddenOptions?.networks}
				key={shareMode}
			>
				{(item) => {
					const { enabled, title, icon, updateData } = item;

					return (
						<DraggableListItem
							icon={<JsxSvg svg={icon} />}
							label={title}
						>
							<Switch
								checked={enabled}
								onChange={(value) => {
									updateData({ enabled: value });
								}}
							/>
						</DraggableListItem>
					);
				}}
			</DraggableList>
		</ComponentToggle>
	);
};
