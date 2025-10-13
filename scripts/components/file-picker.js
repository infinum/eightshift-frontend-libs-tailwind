import { __ } from '@wordpress/i18n';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { Button, FilePickerShell } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';

/**
 * A customizable button for managing files from the Media library.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {ManageFileButtonType} [props.type] - The type of the button (browse, upload, replace).
 * @param {Function} props.onChange - Function that handles the change event.
 * @param {string} [props.currentId] - ID of the currently selected item. Used for the 'replace' type, to mark the currently selected item.
 * @param {boolean} [props.compact] - Whether the button is compact (icon-only).
 * @param {string[]} props.allowedTypes - Determines types of files which are allowed to be uploaded.
 * @param {ManageFileButtonKind} [props.kind] - The kind of file to manage. Controls labels and icons on the buttons.
 * @param {Object} [props.labels] - Custom UI labels for the buttons. Applies only if `kind` is set to `custom`.
 * @param {Object} [props.buttonProps] - Props to pass to the trigger button.
 * @param {boolean} [props.hidden] - If `true`, the component will not be rendered.
 *
 * @returns {JSX.Element} The ManageFileButton component.
 *
 * @typedef {'browse' | 'upload' | 'replace'} ManageFileButtonType
 * @typedef {'file' | 'image' | 'video' | 'subtitle' | 'geoJson' | 'lottie' | 'custom'} ManageFileButtonKind
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

		buttonProps,

		hidden,
	} = props;

	if (hidden) {
		return null;
	}

	const strings = {
		file: {
			buttonLabel: {
				browse: __('Select', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload', 'eightshift-frontend-libs-tailwind'),
				replace: __('Replace', 'eightshift-frontend-libs-tailwind'),
			},
			modalTitle: {
				browse: __('Select a file', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload a file', 'eightshift-frontend-libs-tailwind'),
				replace: __('Select a new file', 'eightshift-frontend-libs-tailwind'),
			},
			buttonIcon: {
				browse: icons.itemSelect,
				upload: icons.upload,
				replace: icons.swap,
			},
		},
		video: {
			modalTitle: {
				browse: __('Select a video', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload a video', 'eightshift-frontend-libs-tailwind'),
				replace: __('Select a new video', 'eightshift-frontend-libs-tailwind'),
			},
		},
		image: {
			modalTitle: {
				browse: __('Select an image', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload an image', 'eightshift-frontend-libs-tailwind'),
				replace: __('Select a new image', 'eightshift-frontend-libs-tailwind'),
			},
		},
		subtitle: {
			modalTitle: {
				browse: __('Select a subtitle file', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload a subtitle file', 'eightshift-frontend-libs-tailwind'),
				replace: __('Select a new subtitle file', 'eightshift-frontend-libs-tailwind'),
			},
		},
		geoJson: {
			modalTitle: {
				browse: __('Select a GeoJSON file', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload a GeoJSON file', 'eightshift-frontend-libs-tailwind'),
				replace: __('Select a new GeoJSON file', 'eightshift-frontend-libs-tailwind'),
			},
		},
		lottie: {
			modalTitle: {
				browse: __('Select a Lottie animation', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload a Lottie animation', 'eightshift-frontend-libs-tailwind'),
				replace: __('Select a new Lottie animation', 'eightshift-frontend-libs-tailwind'),
			},
		},
		rive: {
			modalTitle: {
				browse: __('Select a Rive animation', 'eightshift-frontend-libs-tailwind'),
				upload: __('Upload a Rive animation', 'eightshift-frontend-libs-tailwind'),
				replace: __('Select a new Rive animation', 'eightshift-frontend-libs-tailwind'),
			},
		},
		custom: {
			buttonLabel: labels?.buttonLabel,
			modalTitle: labels?.modalTitle,
			buttonIcon: labels?.buttonIcon,
		},
	};

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
						{...buttonProps}
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
 * @param {Function} props.onChange - The function that handles the change event.
 * @param {string} props.fileId - ID of the currently selected file. Used to mark the currently selected item when replacing the file.
 * @param {string} props.fileName - URL of the currently selected image.
 * @param {boolean} [props.noDelete] - If `true`, the delete button will be hidden.
 * @param {boolean} [props.noUpload] - If `true`, the upload button will be hidden.
 * @param {string[]} props.allowedTypes - Determines types of files which are allowed to be uploaded.
 * @param {FileKind} [props.kind] - The kind of file to manage.
 * @param {Object} [props.labels] - Custom UI labels for the buttons. Applies only if `kind` is set to `custom`.
 *
 * @returns {JSX.Element} The FileSelector component.
 *
 * @typedef {'file' | 'image' | 'video' | 'subtitle' | 'geoJson' | 'lottie' | 'rive' | 'custom'} FileKind
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

	const fileIcons = {
		image: icons.imageFile,
		video: icons.videoFile,
		subtitle: icons.closedCaptions,
		geoJson: icons.fileMetadata,
		lottie: icons.animationFile,
		rive: icons.animationFile,
		custom: labels?.removeIcon,
	};

	return (
		<FilePickerShell
			icon={fileIcons[kind]}
			fileName={fileName}
			url={fileName}
			noUrlContent={
				<>
					<ManageFileButton {...commonManageFileButtonProps} />

					<ManageFileButton
						{...commonManageFileButtonProps}
						type='upload'
						hidden={noUpload}
					/>
				</>
			}
		>
			<ManageFileButton
				{...commonManageFileButtonProps}
				buttonProps={{ className: 'es:grow' }}
				currentId={fileId}
				type='replace'
			/>

			<Button
				onPress={() => onChange({ id: undefined, url: undefined })}
				className='es:grow'
				hidden={noDelete}
			>
				{__('Remove', 'eightshift-frontend-libs-tailwind')}
			</Button>
		</FilePickerShell>
	);
};
