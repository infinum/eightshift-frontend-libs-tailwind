import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ButtonEditor as EditorComponent } from '../../../components/button/components/button-editor';

export const ButtonEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('button', attributes, {
				setAttributes,
			})}
		/>
	);
};
