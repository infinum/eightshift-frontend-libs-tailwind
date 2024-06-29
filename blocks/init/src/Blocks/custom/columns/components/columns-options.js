import { __ } from '@wordpress/i18n';
import { Responsive, Spacer, OptionSelect, NumberPicker } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { getResponsiveData } from '@eightshift/frontend-libs-tailwind/scripts/helpers/breakpoints';
import { checkAttr, getOption, getAttrKey, generateOptionsFromValue } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from './../manifest.json';

export const ColumnsOptions = ({ attributes, setAttributes }) => {
	const columnsNumOfColumns = checkAttr('columnsNumOfColumns', attributes, manifest);
	const columnsColumnGap = checkAttr('columnsColumnGap', attributes, manifest);
	const columnsRowGap = checkAttr('columnsRowGap', attributes, manifest);
	const columnsRowHeight = checkAttr('columnsRowHeight', attributes, manifest);

	const responsiveData = getResponsiveData(true);

	return (
		<>
			<Responsive
				value={columnsNumOfColumns}
				onChange={(value) => setAttributes({ [getAttrKey('columnsNumOfColumns', attributes, manifest)]: value })}
				icon={icons.gridAutoCols}
				label={__('Number of columns', 'eightshift-ui-components')}
				options={generateOptionsFromValue(columnsNumOfColumns)}
				noModeSelect
				inline
				{...responsiveData}
			>
				{({ currentValue, handleChange }) => (
					<NumberPicker
						value={parseInt(currentValue)}
						onChange={(value) => handleChange(`${value}`)}
						fixedWidth={2.25}
						size='small'
						min={1}
						max={12}
						step={1}
						aria-label={__('Number of columns', 'eightshift-ui-components')}
					/>
				)}
			</Responsive>

			<Responsive
				value={columnsRowHeight}
				onChange={(value) => setAttributes({ [getAttrKey('columnsRowHeight', attributes, manifest)]: value })}
				icon={icons.gridRow}
				label={__('Row height', 'eightshift-ui-components')}
				options={getOption('columnsRowHeight', attributes, manifest)}
				noModeSelect
				inline
				{...responsiveData}
			>
				{({ currentValue, options, handleChange }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
					/>
				)}
			</Responsive>

			<Spacer />

			<Responsive
				value={columnsColumnGap}
				onChange={(value) => setAttributes({ [getAttrKey('columnsColumnGap', attributes, manifest)]: value })}
				icon={icons.gutter}
				label={__('Column gap', 'eightshift-ui-components')}
				options={getOption('columnsGap', attributes, manifest)}
				noModeSelect
				inline
				{...responsiveData}
			>
				{({ currentValue, options, handleChange, isInlineCollapsedView }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type={isInlineCollapsedView ? 'menu' : 'toggleButtons'}
					/>
				)}
			</Responsive>

			<Responsive
				value={columnsRowGap}
				onChange={(value) => setAttributes({ [getAttrKey('columnsRowGap', attributes, manifest)]: value })}
				icon={icons.verticalSpacing}
				label={__('Row gap', 'eightshift-ui-components')}
				options={getOption('columnsGap', attributes, manifest)}
				noModeSelect
				inline
				{...responsiveData}
			>
				{({ currentValue, options, handleChange, isInlineCollapsedView }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type={isInlineCollapsedView ? 'menu' : 'toggleButtons'}
					/>
				)}
			</Responsive>
		</>
	);
};
