import { tailwindClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImageEditor as EditorComponent } from '../../../components/image/components/image-editor';
import manifest from './../manifest.json';

export const ImageEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('image', attributes, {
				setAttributes,
			})}
			additionalClass={tailwindClasses('base', attributes, manifest)}
		/>
	);
};
