import { checkAttr, getBreakpointData, getBreakpointNames, getTwClasses, getTwPart } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImagePlaceholder } from '@eightshift/ui-components';
import manifest from './../manifest.json';

export const ImageEditor = (attributes) => {
	const { additionalClass } = attributes;

	const imageUse = checkAttr('imageUse', attributes, manifest);
	const imageData = checkAttr('imageData', attributes, manifest);

	if (!imageUse || typeof imageData?.['_default'] === 'undefined') {
		return null;
	}

	const isDesktopFirst = imageData['_desktopFirst'] ?? false;

	const breakpointNames = getBreakpointNames();
	const breakpointData = getBreakpointData();

	return (
		<>
			{imageData?.['_default']?.url && (
				<picture className={additionalClass?.picture ?? ''}>
					{breakpointNames.map((breakpointName) => {
						if (!imageData?.[breakpointName]?.url) {
							return null;
						}

						const breakpointWidth = breakpointData?.[breakpointName];

						if (!breakpointWidth) {
							return null;
						}

						return (
							<source
								key={breakpointName}
								srcSet={imageData?.[breakpointName]?.url}
								media={`(${isDesktopFirst ? 'max-width' : 'min-width'}: ${breakpointWidth}em)`}
							/>
						);
					})}
					<img
						className={getTwClasses(attributes, manifest, additionalClass?.image ?? additionalClass)}
						src={imageData?.['_default'].url}
					/>
				</picture>
			)}

			{!imageData?.['_default']?.url && (
				<ImagePlaceholder
					style='simple'
					size='large'
					className={additionalClass?.imagePlaceholder}
				/>
			)}
		</>
	);
};
