import { __ } from '@wordpress/i18n';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { QuoteOptions as OptionsComponent } from '../../../components/quote/components/quote-options';

export const QuoteOptions = ({ attributes, setAttributes }) => {
	return (
		<OptionsComponent
			{...props('quote', attributes, {
				setAttributes,
			})}
			controlOnly
		/>
	);
};
