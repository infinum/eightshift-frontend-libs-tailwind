import React from 'react';
import { __ } from '@wordpress/i18n';
import { Button, icons, HStack, ImagePlaceholder } from '@eightshift/ui-components';
import { ManageFileButton } from '@eightshift/frontend-libs/scripts/components/file-picker';

const MediaButton = (props) => {
	return (
		<ManageFileButton
			{...props}
			kind='image'
			allowedTypes={['image']}
		/>
	)
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
 *
 * @returns {JSX.Element} The MediaPlaceholder component.
 *
 * @example
 * <MediaPlaceholder
 * 	onChange={onChange}
 * 	imageId={imageId}
 * 	imageAlt={imageAlt}
 * 	imageUrl={imageUrl}
 * />
 *
 */
export const MediaPlaceholder = (props) => {
	const { onChange, imageId, imageAlt, imageUrl, noDelete, noUpload } = props;

	return (
		<HStack noWrap>
			<ImagePlaceholder
				url={imageUrl}
				alt={imageAlt}
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
