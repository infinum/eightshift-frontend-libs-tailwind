import { checkAttr, getTwClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import { JsxSvg } from '@eightshift/ui-components/icons';
import manifest from './../manifest.json';

export const IconEditor = (attributes) => {
	const { icons: manifestIcons } = manifest;

	const { additionalClass } = attributes;

	const iconUse = checkAttr('iconUse', attributes, manifest);
	const iconName = checkAttr('iconName', attributes, manifest);

	if (!iconUse || !manifestIcons?.[iconName]) {
		return null;
	}

	return (
		<JsxSvg
			svg={manifestIcons[iconName]}
			className={getTwClasses(attributes, manifest, additionalClass)}
		/>
	);
};
