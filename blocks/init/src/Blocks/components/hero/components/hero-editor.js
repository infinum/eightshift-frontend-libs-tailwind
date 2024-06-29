import { props, checkAttr, getTwPart, getTwClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImageEditor } from '../../image/components/image-editor';
import { HeadingEditor } from '../../heading/components/heading-editor';
import { ParagraphEditor } from '../../paragraph/components/paragraph-editor';
import { ButtonEditor } from '../../button/components/button-editor';
import manifest from '../manifest.json';

export const HeroEditor = (attributes) => {
	const { additionalClass } = attributes;

	const heroUse = checkAttr('heroUse', attributes, manifest);

	if (!heroUse) {
		return null;
	}

	return (
		<div className={getTwClasses(attributes, manifest, additionalClass)}>
			<ImageEditor
				{...props('image', attributes, {
					additionalClass: {
						image: '!size-full grayscale',
						picture: getTwPart('imagePicture', manifest),
					},
				})}
			/>

			<HeadingEditor {...props('heading', attributes)} />

			<ParagraphEditor
				{...props('paragraph', attributes, {
					additionalClass: 'mt-4 max-w-96 text-pretty',
				})}
			/>

			<div className='mt-6 flex gap-2'>
				<ButtonEditor {...props('buttonMain', attributes)} />
				<ButtonEditor {...props('buttonSecondary', attributes)} />
			</div>
		</div>
	);
};
