import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { CardEditor as EditorComponent } from '../../../components/card/components/card-editor';

export const CardEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('card', attributes, {
				setAttributes,
			})}
		/>
	);
};
