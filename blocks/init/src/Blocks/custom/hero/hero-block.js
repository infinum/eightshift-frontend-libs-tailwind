import { HeroEditor } from './components/hero-editor';
import { HeroOptions } from './components/hero-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Hero = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={HeroOptions}
			editor={HeroEditor}
		/>
	);
};
