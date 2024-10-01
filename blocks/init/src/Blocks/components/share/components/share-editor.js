import { checkAttr, classnames, getAttrKey, tailwindClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import { JsxSvg } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const ShareEditor = (attributes) => {
	const { additionalClass } = attributes;

	const shareUse = checkAttr('shareUse', attributes, manifest);

	if (!shareUse) {
		return null;
	}

	const shareTargets = checkAttr('shareTargets', attributes, manifest);

	return (
		<div className={tailwindClasses('container', attributes, manifest, additionalClass)}>
			{shareTargets.map((network) => {
				return (
					<JsxSvg
						className={tailwindClasses('icon', attributes, manifest)}
						svg={manifest?.networks?.[network]?.icon}
					/>
				);
			})}
		</div>
	);
};
