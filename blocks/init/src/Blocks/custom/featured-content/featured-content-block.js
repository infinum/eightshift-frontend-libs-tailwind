import { FeaturedContentEditor } from './components/featured-content-editor';
import { FeaturedContentOptions } from './components/featured-content-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const FeaturedContent = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={FeaturedContentOptions}
			editor={FeaturedContentEditor}
		/>
	);
};
