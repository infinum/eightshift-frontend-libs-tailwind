import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';
import { AccordionEditor } from './components/accordion-editor';
import { AccordionOptions } from './components/accordion-options';
import manifest from './manifest.json';

export const Accordion = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={AccordionOptions}
			editor={AccordionEditor}
			title={manifest.title}
		/>
	);
};
