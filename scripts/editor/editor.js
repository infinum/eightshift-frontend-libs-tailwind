import React from 'react';
import { dispatch } from '@wordpress/data';
import { InspectorControls, BlockControls } from '@wordpress/block-editor';
import { ContainerPanel, PortalProvider } from '@eightshift/ui-components';
import { upperFirst } from '@eightshift/ui-components/utilities';

/**
 * Given a block's client ID and an attribute key, locks post saving in Gutenberg.
 * A lock is created under the name undefined-lock-[blockClientId]-[attributeKey],
 * meaning that a lock can be created for each attribute key of each block.
 * Multiple locks can be present and all of them have to be removed before saving is unlocked.
 *
 * @param {string} blockClientId A block's client ID
 * @param {string} attributeKey The attribute key
 *
 * @access public
 *
 * @returns {void}
 *
 * Usage:
 * ```js
 * lockPostEditing(clientId, getAttrKey('headingContent', attributes, manifest), value);
 * ```
 */
export const lockPostEditing = (blockClientId, attributeKey) => {
	dispatch('core/editor').lockPostSaving(`undefined-lock-${blockClientId}-${attributeKey}`);
};

/**
 * Given a block's client ID and an attribute key, unlocks post saving in Gutenberg.
 * A lock is created under the name undefined-lock-[blockClientId]-[attributeKey],
 * meaning that a lock can be created for each attribute key of each block.
 * Multiple locks can be present and all of them have to be removed before saving is unlocked.
 *
 * @param {string} blockClientId A block's client ID
 * @param {string} attributeKey The attribute key
 *
 * @access public
 *
 * @returns {void}
 *
 * Usage:
 * ```js
 * unlockPostEditing(clientId, getAttrKey('headingContent', attributes, manifest), value);
 * ```
 */
export const unlockPostEditing = (blockClientId, attributeKey) => {
	dispatch('core/editor').unlockPostSaving(`undefined-lock-${blockClientId}-${attributeKey}`);
};

/**
 * Given a block's client ID, attribute key and new value, creates a lock, locks post saving in Gutenberg
 * if the value is undefined, null or an empty string and unlocks that attribute's lock otherwise.
 *
 * A lock is created under the name undefined-lock-[blockClientId]-[attributeKey],
 * meaning that a lock can be created for each attribute key of each block.
 * Multiple locks can be present and all of them have to be removed before saving is unlocked.
 *
 * @param {string} blockClientId A block's client ID
 * @param {string} attributeKey The attribute key
 *
 * @access public
 *
 * @returns {void}
 *
 * Usage:
 * ```js
 * onChange={(value) => {
 *  setAttributes({ [getAttrKey('headingContent', attributes, manifest)]: value });
 *  lockIfUndefined(clientId, getAttrKey('headingContent', attributes, manifest), value);
 * }}
 * ```
 */
export const lockIfUndefined = (blockClientId, attributeKey, value) => {
	if (typeof value === 'undefined' || value === null || value === '') {
		lockPostEditing(blockClientId, attributeKey);

		return;
	}
	unlockPostEditing(blockClientId, attributeKey);
};

/**
 * Initialize the block context with all necessary data
 *
 * @component
 * @param {Object} props - Component props.
 * @param {JSX.Element?} [props.options] - Options component
 * @param {JSX.Element?} [props.toolbar] - Toolbar component
 * @param {JSX.Element?} [props.editor] - Editor component
 * @param {JSX.Element?} [props.toolbarPortalElement] - Portal override element to use for toolbar. Set to `false` to disable.
 * @param {JSX.Element?} [props.editorPortalElement] - Portal override element to use for editor view. Set to `false` to disable.
 * @param {boolean} [props.noOptionsContainer] - If `true`, the options component will not be wrapped in a container.
 * @param {string} props.title - Block name. Will fall back to a name generated from the `blockName` attribute.
 *
 * @returns {JSX.Element} The GutenbergBlock component.
 *
 * @access public
 * @since 1.0.0
 *
 * @example
 * <GutenbergBlock
 * 	{...props}
 * 	options={OptionsComponent}
 * 	editor={EditorComponent}
 * />
 *
 */
export const GutenbergBlock = (props) => {
	const {
		options: OptionsComponent,
		toolbar: ToolbarComponent,
		editor: EditorComponent,
		noOptionsContainer = false,
		toolbarPortalElement = document.querySelector('.block-editor-iframe__scale-container > iframe')?.contentWindow
			?.document?.body,
		editorPortalElement = document.querySelector('.block-editor-iframe__scale-container > iframe')?.contentWindow
			?.document?.body,
		title,
	} = props;

	return (
		<>
			{OptionsComponent && (
				<InspectorControls>
					{!noOptionsContainer && (
						<ContainerPanel title={title ?? upperFirst(props?.attributes?.blockName)}>
							<OptionsComponent {...props} />
						</ContainerPanel>
					)}
					{noOptionsContainer && <OptionsComponent {...props} />}
				</InspectorControls>
			)}

			{ToolbarComponent && toolbarPortalElement !== false && (
				<PortalProvider portalElement={toolbarPortalElement}>
					<BlockControls>
						<ToolbarComponent {...props} />
					</BlockControls>
				</PortalProvider>
			)}

			{ToolbarComponent && toolbarPortalElement === false && (
				<BlockControls>
					<ToolbarComponent {...props} />
				</BlockControls>
			)}

			{EditorComponent && editorPortalElement !== false && (
				<PortalProvider portalElement={editorPortalElement}>
					<EditorComponent {...props} />
				</PortalProvider>
			)}

			{EditorComponent && editorPortalElement === false && <EditorComponent {...props} />}
		</>
	);
};
