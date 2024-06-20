import React from 'react';
import { props, getOptions } from '@eightshift/frontend-libs-tailwind/scripts';
import { ButtonOptions } from '../../button/components/button-options';
import manifest from '../manifest.json';

export const LoadMoreOptions = (attributes) => {
	return (
		<ButtonOptions
			hideId
			hideUrl
			label={attributes?.label ?? manifest.title}
			{...props('button', attributes, { options: getOptions(attributes, manifest) })}
			// {...generateUseToggleConfig(attributes, manifest, 'loadMoreUse')}
			hideOptions='link,uniqueId'
		/>
	);
};
