import { useSelect } from '@wordpress/data';
import { GutenbergBlock, overrideInnerBlockAttributes } from '@eightshift/frontend-libs-tailwind/scripts/editor';
import { ColumnEditor } from './components/column-editor';
import { ColumnOptions } from './components/column-options';

export const Column = (props) => {
	useSelect((select) => {
		overrideInnerBlockAttributes(select, props.clientId, {
			wrapperNoWidthControls: true,
			wrapperWidth: 'none',
		});
	});

	return (
		<GutenbergBlock
			{...props}
			options={ColumnOptions}
			editor={ColumnEditor}
		/>
	);
};
