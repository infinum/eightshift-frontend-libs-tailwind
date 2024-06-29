import { props, getOptions } from '@eightshift/frontend-libs-tailwind/scripts';
import { ButtonOptions } from '../../../components/button/components/button-options';
import manifest from '../manifest.json';

export const LoadMoreOptions = (attributes) => {
	const { setAttributes, label, noUseToggle, controlOnly } = attributes;
	return (
		<ButtonOptions
			label={label ?? manifest.title}
			{...props('button', attributes, {
				setAttributes: setAttributes,
			})}
			hideOptions='link,uniqueId'
			noUseToggle={noUseToggle}
			controlOnly={controlOnly}
		/>
	);
};
