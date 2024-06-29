import { useSelect } from '@wordpress/data';
import { ColumnsOptions } from './components/columns-options';
import { ColumnsEditor } from './components/columns-editor';
import { GutenbergBlock, overrideInnerBlockAttributes } from '@eightshift/frontend-libs-tailwind/scripts';

export const Columns = (props) => {
	useSelect((select) => {
		overrideInnerBlockAttributes(select, props.clientId, {
			columnsConfig: props.attributes.columnsNumOfColumns,
		});
	});

	return (
		<GutenbergBlock
			{...props}
			options={ColumnsOptions}
			editor={ColumnsEditor}
		/>
	);
};
