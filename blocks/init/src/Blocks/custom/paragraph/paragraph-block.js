import { ParagraphEditor } from './components/paragraph-editor';
import { ParagraphOptions } from './components/paragraph-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Paragraph = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={ParagraphOptions}
			editor={ParagraphEditor}
		/>
	);
};
