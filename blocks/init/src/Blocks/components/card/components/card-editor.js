import { props, getTwClasses, getTwPart } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImageEditor } from '../../image/components/image-editor';
import { HeadingEditor } from '../../heading/components/heading-editor';
import { ParagraphEditor } from '../../paragraph/components/paragraph-editor';
import { ButtonEditor } from '../../button/components/button-editor';
import manifest from './../manifest.json';

export const CardEditor = (attributes) => {
	const { additionalClass } = attributes;

	return (
		<div className={getTwClasses(attributes, manifest, additionalClass)}>
			<ImageEditor
				{...props('image', attributes, {
					additionalClass: {
						image: getTwPart('image', manifest),
						picture: getTwPart('imagePicture', manifest),
						imagePlaceholder: '!border-x-0 !border-t-0 !border-solid !w-full !h-auto aspect-3/2 [&_svg]:!size-12 border-b !rounded-none bg-gray-100 !border-b-gray-200',
					},
				})}
			/>

			<div className={getTwPart('content-container', manifest)}>
				<ParagraphEditor
					{...props('intro', attributes, {
						additionalClass: getTwPart('intro', manifest),
					})}
				/>

				<HeadingEditor {...props('heading', attributes)} />

				<ParagraphEditor {...props('paragraph', attributes, { additionalClass: getTwPart('text', manifest) })} />

				<ButtonEditor {...props('button', attributes, { additionalClass: getTwPart('button', manifest) })} />
			</div>
		</div>
	);
};
