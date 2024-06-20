import React from 'react';
import { __ } from '@wordpress/i18n';
import { BlockInserter, checkAttr, getAttrKey } from '@eightshift/frontend-libs-tailwind/scripts';
import { RichText, useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { AnimatedVisibility, InputField, Notice, TriggeredPopover } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const ModalEditor = ({ attributes, setAttributes, clientId }) => {
	const modalId = checkAttr('modalId', attributes, manifest);
	const modalTitle = checkAttr('modalTitle', attributes, manifest);

	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		renderAppender: () => (
			<BlockInserter
				clientId={clientId}
				small
			/>
		),
	});

	return (
		<div className='p-8'>
			<div className='mx-auto max-h-[80vh] min-h-[40vh] w-full max-w-[50vw] rounded-lg border border-dashed border-gray-400 p-4'>
				<div className='flex justify-between gap-4'>
					<RichText
						placeholder={__('Modal title', '%g_textdomain%')}
						value={modalTitle}
						onChange={(value) => setAttributes({ [getAttrKey('modalTitle', attributes, manifest)]: value })}
						allowedFormats={[]}
						withoutInteractiveFormatting
						disableLineBreaks
					/>

					<TriggeredPopover
						triggerButtonIcon={icons.options}
						triggerButtonProps={{
							className: modalId?.length < 1 && '[&>svg]:animate-pulse [&>svg]:duration-1000 [&>svg]:text-red-500',
							type: modalId?.length > 0 ? 'default' : 'danger',
						}}
						className='w-80 !p-2'
					>
						<InputField
							icon={icons.id}
							label={__('Modal unique identifier', '%g_textdomain%')}
							help={__('Used for opening the modal', '%g_textdomain%')}
							value={modalId}
							onChange={(value) => setAttributes({ [getAttrKey('modalId', attributes, manifest)]: value })}
							className='es-uic-font-mono'
						/>
					</TriggeredPopover>
				</div>

				{modalId?.length > 0 && (
					<div
						{...innerBlocksProps}
						className='space-y-3'
					/>
				)}

				<AnimatedVisibility
					noInitial
					visible={modalId?.length < 1}
					className='mx-auto mt-4 w-80'
				>
					<Notice
						type='warning'
						label={__('Modal unique identifier not set', '%g_textdomain%')}
					/>
				</AnimatedVisibility>
			</div>
			<AnimatedVisibility
				noInitial
				visible={modalId?.length > 0}
				className='mx-auto mt-4 w-80'
			>
				<Notice
					type='success'
					label={__('Modal is ready to use', '%g_textdomain%')}
					subtitle={
						<>
							{__('To open, set an URL in any element that accepts it to ', '%g_textdomain%')}
							<span className='es-uic-font-mono select-all font-medium'>:open-modal-{modalId}:</span>
						</>
					}
				/>
			</AnimatedVisibility>
		</div>
	);
};
