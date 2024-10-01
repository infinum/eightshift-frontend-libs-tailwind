import React, { useId, useState, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { BlockInserter, checkAttr, getAttrKey, tailwindClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import { RichText, useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import manifest from '../manifest.json';
import { JsxSvg } from '@eightshift/ui-components/icons';
import { AnimatedVisibility } from '@eightshift/ui-components';

export const AccordionItemEditor = ({ attributes, setAttributes, clientId }) => {
	const accordionItemLabel = checkAttr('accordionItemLabel', attributes, manifest);

	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		renderAppender: () => (
			<BlockInserter
				clientId={clientId}
				small
			/>
		),
	});

	const [expanded, setExpanded] = useState(false);

	return (
		<>
			<div
				aria-expanded={expanded}
				className={tailwindClasses('trigger', attributes, manifest)}
			>
				<RichText
					placeholder={__('Section title', '%g_textdomain%')}
					value={accordionItemLabel}
					onChange={(value) => setAttributes({ [getAttrKey('accordionItemLabel', attributes, manifest)]: value })}
					allowedFormats={['core/bold']}
					className='mr-auto w-fit'
				/>

				<button
					onClick={(e) => setExpanded(!expanded)}
					className={tailwindClasses('editor-trigger', attributes, manifest)}
				>
					<JsxSvg
						svg={manifest.resources.icon}
						className={tailwindClasses('editor-trigger-icon', attributes, manifest, expanded && 'rotate-45')}
					/>
				</button>
			</div>

			<AnimatedVisibility
				visible={expanded}
				noInitial
			>
				<div
					{...innerBlocksProps}
					className={tailwindClasses('content-container', attributes, manifest)}
				/>
			</AnimatedVisibility>
		</>
	);
};
