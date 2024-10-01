import { props, tailwindClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import { ImageEditor } from '../../image/components/image-editor';
import { HeadingEditor } from '../../heading/components/heading-editor';
import { ParagraphEditor } from '../../paragraph/components/paragraph-editor';
import { ButtonEditor } from '../../button/components/button-editor';
import manifest from './../manifest.json';

export const CardEditor = (attributes) => {
	const { additionalClass } = attributes;

	return (
		<div className={tailwindClasses(attributes, manifest, additionalClass)}>
			<ImageEditor
				{...props('image', attributes, {
					additionalClass: {
						image: tailwindClasses('image', attributes, manifest),
						picture: tailwindClasses('imagePicture', attributes, manifest),
						imagePlaceholder:
							'!border-x-0 !border-t-0 !border-solid !w-full !h-auto aspect-3/2 [&_svg]:!size-12 border-b !rounded-none bg-gray-100 !border-b-gray-200',
					},
				})}
			/>

			<div className={tailwindClasses('content-container', attributes, manifest)}>
				<ParagraphEditor
					{...props('intro', attributes, {
						additionalClass: tailwindClasses('intro', attributes, manifest),
					})}
				/>

				<HeadingEditor {...props('heading', attributes)} />

				<ParagraphEditor
					{...props('paragraph', attributes, { additionalClass: tailwindClasses('text', attributes, manifest) })}
				/>

				<ButtonEditor
					{...props('button', attributes, { additionalClass: tailwindClasses('button', attributes, manifest) })}
				/>
			</div>
		</div>
	);
};
