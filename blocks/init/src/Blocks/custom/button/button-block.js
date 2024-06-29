import { ButtonEditor } from './components/button-editor';
import { ButtonOptions } from './components/button-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Button = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={ButtonOptions}
			editor={ButtonEditor}
		/>
	);
};
