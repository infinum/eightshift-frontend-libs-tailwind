import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey } from '@eightshift/frontend-libs-tailwind/scripts';
import { BaseControl, Checkbox } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const TableOfContentsOptions = ({ attributes, setAttributes }) => {
	const tableOfContentsHeadingLevels = checkAttr('tableOfContentsHeadingLevels', attributes, manifest);

	return (
		<BaseControl
			icon={icons.headingLevelAlt}
			label={__('Include', '%g_textdomain%')}
		>
			{Object.keys(tableOfContentsHeadingLevels).map((level, i, arr) => {
				return (
					<Checkbox
						key={i}
						checked={tableOfContentsHeadingLevels[level]}
						label={level.replace('h', __('Heading', '%g_textdomain%') + ' ')}
						onChange={(value) => {
							const newValue = { ...tableOfContentsHeadingLevels };
							newValue[level] = value;

							setAttributes({ [getAttrKey('tableOfContentsHeadingLevels', attributes, manifest)]: newValue });
						}}
					/>
				);
			})}
		</BaseControl>
	);
};
