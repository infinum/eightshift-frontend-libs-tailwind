import React from 'react';
import { dispatch } from '@wordpress/data';
import { InspectorControls, BlockControls } from '@wordpress/block-editor';
import { ContainerPanel } from '@eightshift/ui-components';
import { upperFirst } from '@eightshift/frontend-libs/scripts/helpers/es-dash';

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
 * @param {boolean} [props.noOptionsContainer] - If `true`, the options component will not be wrapped in a container.
 *
 * @returns {JSX.Element} The componentName component.
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
	} = props;

	return (
		<>
			{OptionsComponent &&
				<InspectorControls>
					{!noOptionsContainer &&
						<ContainerPanel title={upperFirst(props?.attributes?.blockName)}>
							<OptionsComponent {...props} />
						</ContainerPanel>
					}
					{noOptionsContainer && <OptionsComponent {...props} />}
				</InspectorControls>
			}

			{ToolbarComponent &&
				<BlockControls>
					<ToolbarComponent {...props} />
				</BlockControls>
			}

			{EditorComponent &&
				<EditorComponent {...props} />
			}
		</>
	);
};
