import { __ } from '@wordpress/i18n';
import { props, getOptions } from '@eightshift/frontend-libs-tailwind/scripts';
import { CardOptions as OptionsComponent } from '../../../components/card/components/card-options';
import manifest from './../manifest.json';

export const CardOptions = ({ attributes, setAttributes }) => {
	return (
		<OptionsComponent
			{...props('card', attributes, {
				setAttributes,
				options: getOptions(attributes, manifest),
			})}
		/>
	);
};
