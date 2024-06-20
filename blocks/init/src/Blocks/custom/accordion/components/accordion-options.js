import React from 'react';
import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey } from '@eightshift/frontend-libs-tailwind/scripts';
import { Toggle } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const AccordionOptions = ({ attributes, setAttributes }) => {
	const accordionCloseAdjacent = checkAttr('accordionCloseAdjacent', attributes, manifest);

	return (
		<Toggle
			icon={icons.dropdownClose}
			label={__('Allow only one panel to be open', '%g_textdomain%')}
			checked={accordionCloseAdjacent}
			onChange={(value) => setAttributes({ [getAttrKey('accordionCloseAdjacent', attributes, manifest)]: value })}
		/>
	);
};
