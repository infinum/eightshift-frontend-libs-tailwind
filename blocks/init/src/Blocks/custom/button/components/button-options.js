import { __ } from '@wordpress/i18n';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ButtonOptions as OptionsComponent } from '../../../components/button/components/button-options';

export const ButtonOptions = ({ attributes, setAttributes }) => {
	return (
		<OptionsComponent
			{...props('button', attributes, { setAttributes })}
			controlOnly
		/>
	);
};
