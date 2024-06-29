import { SiteNavigationEditor } from './components/site-navigation-editor';
import { SiteNavigationOptions } from './components/site-navigation-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const SiteNavigation = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={SiteNavigationOptions}
			editor={SiteNavigationEditor}
		/>
	);
};
