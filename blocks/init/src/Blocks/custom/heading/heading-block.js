import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';
import { HeadingEditor } from './components/heading-editor';
import { HeadingOptions } from './components/heading-options';

export const Heading = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={HeadingOptions}
			editor={HeadingEditor}
		/>
	);
};
