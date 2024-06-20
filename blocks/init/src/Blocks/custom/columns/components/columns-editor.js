import React from 'react';
import { __ } from '@wordpress/i18n';
import { useSelect, dispatch } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { BlockInserter, getTwClasses, checkAttr } from '@eightshift/frontend-libs-tailwind/scripts';
import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { Button, RichLabel } from '@eightshift/ui-components';
import { icons, BlockIcon } from '@eightshift/ui-components/icons';
import manifest from './../manifest.json';

export const ColumnsEditor = ({ attributes, setAttributes, clientId }) => {
	const { title, layoutPresets } = manifest;

	const innerBlockCount = useSelect(
		(select) => select('core/block-editor').getBlock(clientId).innerBlocks?.length ?? 0,
	);

	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(blockProps, {
		allowedBlocks: ['eightshift-boilerplate/column'],
		renderAppender: false,
		orientation: 'horizontal',
	});

	return (
		<>
			{innerBlockCount < 1 && (
				<div className='es-uic-font-sans mx-auto grid max-w-72 grid-cols-2 gap-1.5 rounded-lg border border-gray-200 p-3 text-xs shadow-lg'>
					<RichLabel
						icon={<BlockIcon iconName='es-columns' />}
						label={title}
						className='col-span-2 mb-2 select-none font-medium !text-gray-400'
					/>

					<span className='col-span-2 select-none justify-self-center'>{__('Common layouts', '%g_textdomain%')}</span>

					{layoutPresets.map(({ name, icon, blocks: blockData, attributes: attrsToSet }, index) => {
						return (
							<Button
								key={index}
								onPress={async () => {
									const blocksToInsert = blockData.map(({ name: blockName, attributes: blockAttrs }) =>
										createBlock(blockName, blockAttrs),
									);

									setAttributes(attrsToSet);

									await dispatch('core/block-editor').insertBlocks(blocksToInsert, 0, clientId);
								}}
								icon={icons?.[icon] ?? icons.genericShapesAlt}
								size='large'
							>
								{name}
							</Button>
						);
					})}

					<span className='col-span-2 select-none justify-self-center'>{__('or', '%g_textdomain%')}</span>

					<BlockInserter
						label
						clientId={clientId}
						className='col-span-2 justify-self-center'
					/>
				</div>
			)}

			<div
				{...innerBlocksProps}
				className={getTwClasses(attributes, manifest, '[&>.block-list-appender]:hidden')}
			/>

			{innerBlockCount > 0 && (
				<BlockInserter
					label
					clientId={clientId}
					className='mx-auto mt-2.5'
				/>
			)}
		</>
	);
};
