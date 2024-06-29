import { CardEditor } from './components/card-editor';
import { CardOptions } from './components/card-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Card = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={CardOptions}
			editor={CardEditor}
		/>
	);
};
