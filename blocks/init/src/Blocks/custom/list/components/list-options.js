import { __ } from '@wordpress/i18n';
import { props, getOption, checkAttr, getAttrKey } from '@eightshift/frontend-libs-tailwind/scripts';
import { ListOptions as OptionsComponent } from '../../../components/list/components/list-options';
import { ButtonGroup, ColorPicker } from '@eightshift/ui-components';
import { getColorOption } from '../../../assets/scripts/shared';
import manifest from '../manifest.json';

export const ListOptions = ({ attributes, setAttributes }) => {
	const listTextColor = checkAttr('listTextColor', attributes, manifest);
	const listMarkerColor = checkAttr('listMarkerColor', attributes, manifest);

	const colorOptions = getColorOption('listColor', manifest);

	return (
		<OptionsComponent
			{...props('list', attributes, {
				setAttributes,
			})}
			additionalControls={
				<ButtonGroup>
					<ColorPicker
						value={listTextColor}
						onChange={(value) => setAttributes({ [getAttrKey('listTextColor', attributes, manifest)]: value })}
						colors={colorOptions}
						type='textColor'
					/>
					<ColorPicker
						value={listMarkerColor}
						onChange={(value) => setAttributes({ [getAttrKey('listMarkerColor', attributes, manifest)]: value })}
						colors={colorOptions}
						type='listMarkerColor'
						clearable
					/>
				</ButtonGroup>
			}
			controlOnly
		/>
	);
};
