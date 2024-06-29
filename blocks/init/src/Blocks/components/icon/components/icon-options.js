import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, getHiddenOptions, getOption } from '@eightshift/frontend-libs-tailwind/scripts';
import { RSOption, RSSingleValue, ComponentToggle, Select, RichLabel } from '@eightshift/ui-components';
import { icons, JsxSvg } from '@eightshift/ui-components/icons';
import manifest from './../manifest.json';

const { icons: manifestIcons } = manifest;

const IconPickerOption = (props) => (
	<RSOption {...props}>
		<RichLabel
			icon={<JsxSvg svg={manifestIcons[props.value]} />}
			label={props.label}
		/>
	</RSOption>
);

const IconPickerValueDisplay = ({ children, ...props }) => (
	<RSSingleValue {...props}>
		<RichLabel
			icon={<JsxSvg svg={manifestIcons[props.data.value]} />}
			label={children}
		/>
	</RSSingleValue>
);

export const IconOptions = (attributes) => {
	const { setAttributes, hideOptions, ...rest } = attributes;

	const hiddenOptions = getHiddenOptions(hideOptions);

	const iconName = checkAttr('iconName', attributes, manifest);
	const iconSize = checkAttr('iconSize', attributes, manifest);
	const iconUse = checkAttr('iconUse', attributes, manifest);

	return (
		<ComponentToggle
			label={manifest.title}
			icon={icons.iconGeneric}
			onChange={(value) => setAttributes({ [getAttrKey('iconUse', attributes, manifest)]: value })}
			useComponent={iconUse}
			{...rest}
		>
			<Select
				value={iconName}
				options={getOption('iconName', attributes, manifest)}
				placeholder={__('Select an icon', '%g_textdomain%')}
				customMenuOption={IconPickerOption}
				customValueDisplay={IconPickerValueDisplay}
				onChange={(value) => setAttributes({ [getAttrKey('iconName', attributes, manifest)]: value })}
				simpleValue
				hidden={hiddenOptions?.iconName}
			/>

			<Select
				value={iconSize}
				options={getOption('iconSize', attributes, manifest)}
				onChange={(value) => setAttributes({ [getAttrKey('iconSize', attributes, manifest)]: value })}
				simpleValue
				noSearch
				hidden={hiddenOptions?.size}
			/>
		</ComponentToggle>
	);
};
