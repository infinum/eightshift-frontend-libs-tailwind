import { __ } from '@wordpress/i18n';
import { ManageFileButton, checkAttr, getAttrKey, getTwPart } from '@eightshift/frontend-libs-tailwind/scripts';
import { HStack, MediaPlaceholder, VStack } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const VideoEditor = (attributes) => {
	const { setAttributes, additionalClass } = attributes;

	const videoUse = checkAttr('videoUse', attributes, manifest);
	const videoUrl = checkAttr('videoUrl', attributes, manifest);

	if (!videoUse) {
		return null;
	}

	const hasVideo = videoUrl?.length > 0;

	return (
		<>
			{!hasVideo && (
				<MediaPlaceholder
					style='simple'
					size='video'
					icon={icons.video}
					helpText={
						<VStack className='mt-2 text-center'>
							{__('Add a video', 'eightshift-frontend-libs')}

							<HStack>
								<ManageFileButton
									type='browse'
									onChange={({ id, url, mime, mime_type }) =>
										setAttributes({
											[getAttrKey('videoId', attributes, manifest)]: id,
											[getAttrKey('videoUrl', attributes, manifest)]: url,
											[getAttrKey('videoMimeType', attributes, manifest)]:
												typeof mime === 'undefined' ? mime_type : mime,
										})
									}
									allowedTypes={['video/mp4', 'video/webm']}
									kind='video'
								/>

								<ManageFileButton
									type='upload'
									onChange={({ id, url, mime, mime_type }) =>
										setAttributes({
											[getAttrKey('videoId', attributes, manifest)]: id,
											[getAttrKey('videoUrl', attributes, manifest)]: url,
											[getAttrKey('videoMimeType', attributes, manifest)]:
												typeof mime === 'undefined' ? mime_type : mime,
										})
									}
									allowedTypes={['video/mp4', 'video/webm']}
									kind='video'
								/>
							</HStack>
						</VStack>
					}
				/>
			)}

			{hasVideo && (
				<video
					className={getTwPart('video', manifest, additionalClass)}
					src={videoUrl}
					controls
					muted
				/>
			)}
		</>
	);
};
