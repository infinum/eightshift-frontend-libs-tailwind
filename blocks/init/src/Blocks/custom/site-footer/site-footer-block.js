import { SiteFooterEditor } from './components/site-footer-editor';
import { SiteFooterOptions } from './components/site-footer-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const SiteFooter = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={SiteFooterOptions}
			editor={SiteFooterEditor}
		/>
	);
};
