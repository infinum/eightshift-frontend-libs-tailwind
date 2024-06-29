import { __ } from '@wordpress/i18n';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ShareOptions as OptionsComponent } from '../../../components/share/components/share-options';

export const ShareOptions = ({ attributes, setAttributes }) => {
	return (
		<OptionsComponent
			{...props('share', attributes, { setAttributes })}
			controlOnly
		/>
	);
};
