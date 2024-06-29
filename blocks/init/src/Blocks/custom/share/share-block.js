import { ShareEditor } from './components/share-editor';
import { ShareOptions } from './components/share-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Share = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={ShareOptions}
			editor={ShareEditor}
		/>
	);
};
