import { ListEditor } from './components/list-editor';
import { ListOptions } from './components/list-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const List = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={ListOptions}
			editor={ListEditor}
		/>
	);
};
