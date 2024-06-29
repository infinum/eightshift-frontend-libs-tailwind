import { __ } from '@wordpress/i18n';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImageOptions as OptionsComponent } from '../../../components/image/components/image-options';

export const ImageOptions = ({ attributes, setAttributes }) => {
	return (
		<OptionsComponent
			{...props('image', attributes, {
				setAttributes,
			})}
			controlOnly
		/>
	);
};
