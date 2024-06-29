import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImageEditor as EditorComponent } from '../../../components/image/components/image-editor';

export const ImageEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('image', attributes, {
				setAttributes,
			})}
		/>
	);
};
