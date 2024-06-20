import React from 'react';
import { __ } from '@wordpress/i18n';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { Button, HStack, VStack, FilePlaceholder, AnimatedVisibility } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';

/**
 * A customizable button for managing files from the Media library.
 *
 * @component
 * @param {Object} props - Component props.
 * @property {ManageFileButtonType} [props.type] - The type of the button (browse, upload, replace).
 * @property {Function} props.onChange - Function that handles the change event.
 * @property {string} [props.currentId] - ID of the currently selected item. Used for the 'replace' type, to mark the currently selected item.
 * @property {boolean} [props.compact] - Whether the button is compact (icon-only).
 * @property {string[]} props.allowedTypes - Determines types of files which are allowed to be uploaded.
 * @property {ManageFileButtonKind} [props.kind] - The kind of file to manage. Controls labels and icons on the buttons.
 * @property {Object} [props.labels] - Custom UI labels for the buttons. Applies only if `kind` is set to `custom`.
 *
 * @returns {JSX.Element} The ManageFileButton component.
 *
 * @typedef {'browse' | 'upload' | 'replace'} ManageFileButtonType
 * @typedef {'file' | 'image' | 'video' | 'subtitle' | 'geoJson' | 'custom'} ManageFileButtonKind
 *
 * @example
 * <ManageFileButton />
 *
 */
export const ManageFileButton = (props) => {
	const {
		type = 'browse',
		onChange,
		currentId,

		labels,
		allowedTypes,

		kind = 'file',

		compact = false,
	} = props;

	const strings = {
		file: {
			buttonTooltip: {
				browse: __('Select a file from Media library', '%g_textdomain%'),
				upload: __('Upload a file', '%g_textdomain%'),
				replace: __('Replace file', '%g_textdomain%'),
			},
			buttonLabel: {
				browse: __('Select', '%g_textdomain%'),
				upload: __('Upload', '%g_textdomain%'),
				replace: __('Replace', '%g_textdomain%'),
			},
			modalTitle: {
				browse: __('Select a file', '%g_textdomain%'),
				upload: __('Upload a file', '%g_textdomain%'),
				replace: __('Select a new file', '%g_textdomain%'),
			},
			buttonIcon: {
				browse: icons.itemSelect,
				upload: icons.upload,
				replace: icons.swap,
			},
		},
		video: {
			buttonTooltip: {
				browse: __('Select a video from Media library', '%g_textdomain%'),
				upload: __('Upload a video', '%g_textdomain%'),
				replace: __('Replace video', '%g_textdomain%'),
			},
			modalTitle: {
				browse: __('Select a video', '%g_textdomain%'),
				upload: __('Upload a video', '%g_textdomain%'),
				replace: __('Select a new video', '%g_textdomain%'),
			},
		},
		image: {
			buttonTooltip: {
				browse: __('Select an image from Media library', '%g_textdomain%'),
				upload: __('Upload an image', '%g_textdomain%'),
				replace: __('Replace image', '%g_textdomain%'),
			},
			modalTitle: {
				browse: __('Select an image', '%g_textdomain%'),
				upload: __('Upload an image', '%g_textdomain%'),
				replace: __('Select a new image', '%g_textdomain%'),
			},
		},
		subtitle: {
			buttonTooltip: {
				browse: __('Select a subtitle file', '%g_textdomain%'),
				upload: __('Upload a subtitle file', '%g_textdomain%'),
				replace: __('Replace subtitle file', '%g_textdomain%'),
			},
			modalTitle: {
				browse: __('Select a subtitle file', '%g_textdomain%'),
				upload: __('Upload a subtitle file', '%g_textdomain%'),
				replace: __('Select a new subtitle file', '%g_textdomain%'),
			},
		},
		geoJson: {
			buttonTooltip: {
				browse: __('Select a GeoJSON file', '%g_textdomain%'),
				upload: __('Upload a GeoJSON file', '%g_textdomain%'),
				replace: __('Replace GeoJSON file', '%g_textdomain%'),
			},
			modalTitle: {
				browse: __('Select a GeoJSON file', '%g_textdomain%'),
				upload: __('Upload a GeoJSON file', '%g_textdomain%'),
				replace: __('Select a new GeoJSON file', '%g_textdomain%'),
			},
		},
		custom: {
			buttonTooltip: labels?.buttonTooltip,
			buttonLabel: labels?.buttonLabel,
			modalTitle: labels?.modalTitle,
			buttonIcon: labels?.buttonIcon,
		},
	};

	const buttonTooltip = strings?.[kind]?.buttonTooltip?.[type] ?? strings.file.buttonTooltip?.[type];
	const buttonLabel = strings?.[kind]?.buttonLabel?.[type] ?? strings.file.buttonLabel?.[type];
	const buttonIcon = strings?.[kind]?.buttonIcon?.[type] ?? strings.file.buttonIcon?.[type];
	const modalTitle = strings?.[kind]?.modalTitle?.[type] ?? strings.file.modalTitle?.[type];

	return (
		<MediaUploadCheck>
			<MediaUpload
				onSelect={({ id, url, ...rest }) => onChange({ id, url, ...rest })}
				allowedTypes={allowedTypes}
				value={type === 'replace' && currentId}
				title={modalTitle}
				mode={type === 'upload' ? 'upload' : 'browse'}
				render={({ open }) => (
					<Button
						onPress={open}
						icon={compact && buttonIcon}
						tooltip={buttonTooltip}
					>
						{!compact && buttonLabel}
					</Button>
				)}
			/>
		</MediaUploadCheck>
	);
};

/**
 * Renders a component for managing a media file
 *
 * @component
 * @param {Object} props - Component props.
 * @property {Function} props.onChange - The function that handles the change event.
 * @property {string} props.fileId - ID of the currently selected file. Used to mark the currently selected item when replacing the file.
 * @property {string} props.fileName - URL of the currently selected image.
 * @property {boolean} [props.noDelete] - If `true`, the delete button will be hidden.
 * @property {boolean} [props.noUpload] - If `true`, the upload button will be hidden.
 * @property {string[]} props.allowedTypes - Determines types of files which are allowed to be uploaded.
 * @property {FileKind} [props.kind] - The kind of file to manage.
 * @property {Object} [props.labels] - Custom UI labels for the buttons. Applies only if `kind` is set to `custom`.
 *
 * @returns {JSX.Element} The FileSelector component.
 *
 * @typedef {'file' | 'image' | 'video' | 'subtitle' | 'geoJson' | 'custom'} FileKind
 *
 * @example
 * <FileSelector
 * 	onChange={onChange}
 * 	fileId={fileId}
 * 	fileName={fileName}
 * 	allowedTypes={['video']}
 * />
 *
 */
export const FileSelector = (props) => {
	const { onChange, fileId, fileName, noDelete, noUpload, labels, allowedTypes, kind = 'file' } = props;

	const commonManageFileButtonProps = {
		onChange,
		allowedTypes,
		kind,
		labels,
	};

	const removeTooltips = {
		file: __('Remove file', '%g_textdomain%'),
		image: __('Remove image', '%g_textdomain%'),
		video: __('Remove video', '%g_textdomain%'),
		subtitle: __('Remove subtitle file', '%g_textdomain%'),
		geoJson: __('Remove GeoJSON file', '%g_textdomain%'),
		custom: labels?.removeTooltip,
	};

	const fileIcons = {
		image: icons.imageFile,
		video: icons.videoFile,
		subtitle: icons.closedCaptions,
		geoJson: icons.fileMetadata,
		custom: labels?.removeIcon,
	};

	return (
		<VStack noWrap>
			<FilePlaceholder
				icon={fileIcons[kind] ?? icons.file}
				fileName={fileName}
			>
				<HStack noWrap className='es-uic-pl-1'>
					<ManageFileButton {...commonManageFileButtonProps} />
					{!noUpload && (
						<ManageFileButton
							{...commonManageFileButtonProps}
							type='upload'
							compact
						/>
					)}
				</HStack>
			</FilePlaceholder>

			<AnimatedVisibility
				visible={fileName}
				noInitial
			>
				<HStack noWrap>
					<ManageFileButton
						{...commonManageFileButtonProps}
						currentId={fileId}
						type='replace'
					/>
					{!noDelete && (
						<Button
							icon={icons.trash}
							tooltip={removeTooltips[kind] ?? removeTooltips.file}
							onPress={() => onChange({ id: undefined, url: undefined })}
							type='danger'
						/>
					)}
				</HStack>
			</AnimatedVisibility>
		</VStack>
	);
};
