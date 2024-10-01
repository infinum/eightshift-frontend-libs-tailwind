import { checkAttr, tailwindClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from './../manifest.json';

export const WrapperEditor = ({ attributes, children }) => {
	const wrapperUse = checkAttr('wrapperUse', attributes, manifest);

	if (!wrapperUse) {
		return children;
	}

	return <div className={tailwindClasses(attributes, manifest)}>{children}</div>;
};
