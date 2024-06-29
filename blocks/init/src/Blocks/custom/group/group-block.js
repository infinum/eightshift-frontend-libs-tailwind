import { useSelect } from '@wordpress/data';
import { overrideInnerBlockAttributes } from '@eightshift/frontend-libs-tailwind/scripts/editor';
import { GroupEditor } from './components/group-editor';

export const Group = (props) => {
	useSelect((select) => {
		overrideInnerBlockAttributes(select, props.clientId, {
			wrapperNoWidthControls: true,
			wrapperWidth: 'none',
		});
	});

	return <GroupEditor {...props} />;
};
