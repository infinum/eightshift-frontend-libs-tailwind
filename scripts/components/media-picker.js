import React from 'react';
import { __ } from '@wordpress/i18n';
import { Button, HStack, ImagePlaceholder } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { ManageFileButton } from '@eightshift/frontend-libs-tailwind/scripts/components/file-picker';

const MediaButton = (props) => {
	return (
		<ManageFileButton
			{...props}
			kind='image'
			allowedTypes={['image']}
		/>
	);
};

/**
 * Renders a component for managing a media file
 *
 * @component
 * @param {Object} props - Component props.
 * @property {Function} props.onChange - The function that handles the change event.
 * @property {string} props.imageId - ID of the currently selected image. Used to mark the currently selected item when replacing the image.
 * @property {string} props.imageAlt - Alt text of the currently selected image.
 * @property {string} props.imageUrl - URL of the currently selected image.
 * @property {boolean} [props.noDelete] - If `true`, the delete button will be hidden.
 * @property {boolean} [props.noUpload] - If `true`, the upload button will be hidden.
 * @param {ImagePlaceholderImageMode} [props.imageMode='cover'] - Determines inner image display mode.
 *
 * @returns {JSX.Element} The MediaPicker component.
 *
 * @typedef {'cover'|'contain' | 'fill'} ImagePlaceholderImageMode
 *
 * @example
 * <MediaPicker
 * 	onChange={onChange}
 * 	imageId={imageId}
 * 	imageAlt={imageAlt}
 * 	imageUrl={imageUrl}
 * />
 *
 */
export const MediaPicker = (props) => {
	const { onChange, imageId, imageAlt, imageUrl, noDelete, noUpload, imageMode } = props;

	return (
		<HStack noWrap>
			<ImagePlaceholder
				url={imageUrl}
				alt={imageAlt}
				imageMode={imageMode}
			/>

			{!imageUrl && (
				<>
					<MediaButton onChange={onChange} />
					{!noUpload && (
						<MediaButton
							onChange={onChange}
							type='upload'
							compact
						/>
					)}
				</>
			)}

			{imageUrl && (
				<>
					<MediaButton
						type='replace'
						onChange={onChange}
						imageId={imageId}
					/>
					{!noDelete && (
						<Button
							icon={icons.trash}
							tooltip={__('Remove image', 'infobip')}
							onPress={() => onChange({ id: undefined, url: undefined })}
							type='danger'
						/>
					)}
				</>
			)}
		</HStack>
	);
};
