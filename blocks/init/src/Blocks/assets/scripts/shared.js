import { getColorData } from '@eightshift/frontend-libs-tailwind/scripts';
import { themeColors } from '../../../../assets/scripts/theme-colors';

const colorData = getColorData(themeColors);

export const getColorOption = (key, manifest) => {
	if (!manifest?.options?.[key]) {
		throw new Error(`The key ${key} is not defined in the manifest options for ${manifest?.componentName ?? manifest?.title}.`);
	}

	return colorData?.filter(({ slug }) => manifest?.options?.[key]?.includes(slug)) ?? [];
};

export const rotationClassName = {
	'to-t': 'rotate-0',
	'to-tr': 'rotate-45',
	'to-r': 'rotate-90',
	'to-br': 'rotate-135',
	'to-b': 'rotate-180',
	'to-bl': '-rotate-135',
	'to-l': '-rotate-90',
	'to-tl': '-rotate-45',
};
