import { ImageEditor } from './components/image-editor';
import { ImageOptions } from './components/image-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Image = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={ImageOptions}
			editor={ImageEditor}
		/>
	);
};
