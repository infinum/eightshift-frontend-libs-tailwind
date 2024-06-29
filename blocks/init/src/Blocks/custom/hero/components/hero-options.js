import { __ } from '@wordpress/i18n';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { HeroOptions as OptionsComponent } from '../../../components/hero/components/hero-options';

export const HeroOptions = ({ attributes, setAttributes }) => {
	return (
		<OptionsComponent
			{...props('hero', attributes, {
				setAttributes,
			})}
			controlOnly
		/>
	);
};
