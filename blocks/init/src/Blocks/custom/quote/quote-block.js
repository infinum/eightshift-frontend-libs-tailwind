import { QuoteEditor } from './components/quote-editor';
import { QuoteOptions } from './components/quote-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Quote = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={QuoteOptions}
			editor={QuoteEditor}
		/>
	);
};
