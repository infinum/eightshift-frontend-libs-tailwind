import React from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	getAttrKey,
	checkAttr,
	getOption,
	generateOptionsFromValue,
	getColorData,
} from '@eightshift/frontend-libs-tailwind/scripts';
import {
	Button,
	ColumnConfigSlider,
	NumberPicker,
	OptionSelect,
	Responsive,
	Spacer,
	getColumnConfigOutputText,
	BaseControl,
	ButtonGroup,
	ColorPicker,
	HStack,
} from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { clsx } from '@eightshift/ui-components/utilities';
import { getBreakpointData, getBreakpointNames } from '@eightshift/frontend-libs-tailwind/scripts/helpers/breakpoints';
import { rotationClassName, getColorOption } from '../../../assets/scripts/shared';
import manifest from './../manifest.json';

export const ColumnOptions = ({ attributes, setAttributes }) => {
	const columnOffset = checkAttr('columnOffset', attributes, manifest);
	const columnWidth = checkAttr('columnWidth', attributes, manifest);
	const columnRowSpan = checkAttr('columnRowSpan', attributes, manifest);

	const columnHide = checkAttr('columnHide', attributes, manifest);
	const columnVerticalAlign = checkAttr('columnVerticalAlign', attributes, manifest);
	const columnHorizontalAlign = checkAttr('columnHorizontalAlign', attributes, manifest);

	const columnPaddingLeft = checkAttr('columnPaddingLeft', attributes, manifest);
	const columnPaddingRight = checkAttr('columnPaddingRight', attributes, manifest);
	const columnPaddingTop = checkAttr('columnPaddingTop', attributes, manifest);
	const columnPaddingBottom = checkAttr('columnPaddingBottom', attributes, manifest);

	const columnGap = checkAttr('columnGap', attributes, manifest);

	const columnBackground = checkAttr('columnBackground', attributes, manifest);
	const columnGradientDirection = checkAttr('columnGradientDirection', attributes, manifest);
	const columnBorderRadius = checkAttr('columnBorderRadius', attributes, manifest);

	const columnShadow = checkAttr('columnShadow', attributes, manifest);
	const columnBorder = checkAttr('columnBorder', attributes, manifest);

	const breakpointNames = getBreakpointNames();
	const breakpointData = getBreakpointData(true);

	const allBreakpoints = [...breakpointNames.toReversed(), '_default'];

	const columnsConfig = attributes?.columnsConfig;

	const hasEqualColumnConfigs = Object.keys(columnsConfig ?? {}).length <= 2;

	const widthOffsetValue = Object.keys(columnOffset)
		.filter((breakpoint) => breakpoint !== '_mobileFirst')
		.reduce(
			(prev, breakpoint) => {
				return {
					...prev,
					[breakpoint]: `${breakpoint},${columnOffset?.[breakpoint]},${columnWidth?.[breakpoint]}`,
				};
			},
			{ _mobileFirst: true },
		);

	const widthOffsetOptions = generateOptionsFromValue(widthOffsetValue, (value, breakpoint) => {
		const [_, offset, width] = value.split(',');
		const numColumns = parseInt(columnsConfig?.[breakpoint] ?? columnsConfig?.['_default']);
		return getColumnConfigOutputText(numColumns, parseInt(offset), parseInt(width));
	});

	let backgroundType = 'none';

	if (columnBackground?.startsWith('solid-')) {
		backgroundType = 'solid';
	} else if (columnBackground?.startsWith('gradient-')) {
		backgroundType = 'gradient';
	}

	return (
		<>
			<Responsive
				value={widthOffsetValue}
				onChange={(newValue) => {
					const valueKeys = Object.keys(newValue);

					let newColumnOffset = { ...columnOffset };
					let newColumnWidth = { ...columnWidth };

					Object.keys(columnOffset).forEach((breakpoint) => {
						if (breakpoint === '_default' || breakpoint === '_mobileFirst') {
							return;
						}

						if (valueKeys.includes(breakpoint)) {
							return;
						}

						delete newColumnOffset[breakpoint];
						delete newColumnWidth[breakpoint];
					});

					setAttributes({
						[getAttrKey('columnOffset', attributes, manifest)]: newColumnOffset,
						[getAttrKey('columnWidth', attributes, manifest)]: newColumnWidth,
					});
				}}
				icon={icons.positioningWidthGuide}
				label={__('Placement', '%g_textdomain%')}
				options={widthOffsetOptions}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
			>
				{({ breakpoint }) => {
					let localBreakpoints = [...allBreakpoints];
					const isUnset = !columnOffset[breakpoint] || !columnWidth[breakpoint];

					if (breakpoint !== '_default') {
						localBreakpoints = localBreakpoints.slice(localBreakpoints?.findIndex((v) => v === breakpoint) + 1);
					}

					const numOfColumns = parseInt(columnsConfig?.[breakpoint] ?? columnsConfig?.['_default']);

					let offset = columnOffset[breakpoint];
					let width = columnWidth[breakpoint];

					if (!offset && breakpoint !== '_default' && hasEqualColumnConfigs) {
						offset = columnOffset?.[localBreakpoints.find((breakpoint) => columnOffset?.[breakpoint])];
					} else if (!offset && breakpoint !== '_default' && !hasEqualColumnConfigs) {
						offset = '1';
					}

					if (!width && breakpoint !== '_default' && hasEqualColumnConfigs) {
						width = columnWidth?.[localBreakpoints.find((breakpoint) => columnWidth?.[breakpoint])];
					} else if (!width && breakpoint !== '_default' && !hasEqualColumnConfigs) {
						width = columnsConfig?.[breakpoint] ?? '1';
					}

					if (isUnset && numOfColumns > 1) {
						return (
							<Button
								onPress={() => {
									setAttributes({
										[getAttrKey('columnOffset', attributes, manifest)]: {
											...columnOffset,
											[breakpoint]: '1',
										},
										[getAttrKey('columnWidth', attributes, manifest)]: {
											...columnWidth,
											[breakpoint]: `${numOfColumns}`,
										},
									});
								}}
								className='min-h-10 justify-center'
							>
								{__('Set value', '%g_textdomain%')}
							</Button>
						);
					}

					return (
						<ColumnConfigSlider
							key={breakpoint}
							columns={numOfColumns}
							onChange={([newOffset, newWidth]) => {
								const o = isNaN(newOffset) ? 1 : newOffset;
								const w = isNaN(newWidth) ? 1 : newWidth;

								setAttributes({
									[getAttrKey('columnOffset', attributes, manifest)]: {
										...columnOffset,
										[breakpoint]: `${o}`,
									},
									[getAttrKey('columnWidth', attributes, manifest)]: {
										...columnWidth,
										[breakpoint]: `${w - o + 1}`,
									},
								});
							}}
							value={[parseInt(offset), parseInt(offset) + parseInt(width) - 1]}
							disableOffset={numOfColumns === 1}
							disableWidth={numOfColumns === 1}
							aria-label={sprintf(__('Column: width and offset - %s', '%g_textdomain%'), breakpoint)}
						/>
					);
				}}
			</Responsive>

			<Responsive
				value={columnRowSpan}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnRowSpan', attributes, manifest)]: value,
					})
				}
				icon={icons.gridAutoRows}
				label={__('Row span', '%g_textdomain%')}
				options={generateOptionsFromValue(columnRowSpan, (v) =>
					!v ? __('Not set', '%g_textdomain%') : sprintf(_n('1 row', '%d rows', v, '%g_textdomain%'), v),
				)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, breakpoint }) => (
					<NumberPicker
						value={parseInt(currentValue)}
						onChange={(value) => handleChange(`${value}`)}
						min={1}
						max={12}
						step={1}
						aria-label={sprintf(__('Column: row span - %s', '%g_textdomain%'), breakpoint)}
						size='small'
						fixedWidth={2.5}
						placeholder='–'
					/>
				)}
			</Responsive>

			<Spacer />
			<Spacer
				icon={icons.alignHorizontalVerticalAlt2}
				text={__('Content alignment', '%g_textdomain%')}
				border
			/>

			<Responsive
				value={columnHorizontalAlign}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnHorizontalAlign', attributes, manifest)]: value,
					})
				}
				icon={icons.horizontalAlign}
				label={__('Horizontal', '%g_textdomain%')}
				options={getOption('columnHorizontalAlign', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options, isInlineCollapsedView, breakpoint }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type={isInlineCollapsedView ? 'menu' : 'toggleButtons'}
						noItemIcon={!isInlineCollapsedView}
						noTriggerLabel
						aria-label={sprintf(__('Column: content horizontal align - %s', '%g_textdomain%'), breakpoint)}
					/>
				)}
			</Responsive>

			<Responsive
				value={columnVerticalAlign}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnVerticalAlign', attributes, manifest)]: value,
					})
				}
				icon={icons.verticalAlign}
				label={__('Vertical', '%g_textdomain%')}
				options={getOption('columnVerticalAlign', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options, isInlineCollapsedView, breakpoint }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type={isInlineCollapsedView ? 'menu' : 'toggleButtons'}
						noItemIcon={!isInlineCollapsedView}
						noTriggerLabel
						aria-label={sprintf(__('Column: content vertical align - %s', '%g_textdomain%'), breakpoint)}
					/>
				)}
			</Responsive>

			<Spacer />
			<Spacer
				icon={icons.design}
				text={__('Design', '%g_textdomain%')}
				border
			/>

			<BaseControl
				icon={icons.backgroundType}
				label={__('Background', '%g_textdomain%')}
				inline
			>
				<ButtonGroup>
					<OptionSelect
						options={getOption('columnBackground', attributes, manifest)}
						value={backgroundType}
						onChange={(value) => {
							if (value === 'none') {
								setAttributes({ [getAttrKey('columnBackground', attributes, manifest)]: undefined });
							} else {
								setAttributes({
									[getAttrKey('columnBackground', attributes, manifest)]: Object.keys(
										manifest.tailwind.options.columnBackground.twClasses,
									).find((key) => key.startsWith(value)),
								});
							}
						}}
						aria-label={__('Background type', '%g_textdomain%')}
						type='menu'
						noItemIcon
					/>

					{backgroundType === 'solid' && (
						<ColorPicker
							colors={getColorOption('columnBackgroundSolid', manifest)}
							onChange={(value) =>
								setAttributes({ [getAttrKey('columnBackground', attributes, manifest)]: `solid-${value}` })
							}
							value={columnBackground?.replace('solid-', '')}
							aria-label={__('Background color', '%g_textdomain%')}
						/>
					)}
					{backgroundType === 'gradient' && (
						<>
							<OptionSelect
								value={columnBackground}
								onChange={(value) => setAttributes({ [getAttrKey('columnBackground', attributes, manifest)]: value })}
								options={getOption('columnBackgroundGradient', attributes, manifest).map((option) => ({
									...option,
									endIcon: (
										<div
											className={clsx(
												'es-uic-size-5 es-uic-rounded es-uic-border es-uic-border-gray-300 bg-gradient-to-r',
												manifest.tailwind.options.columnBackground.twClasses[option.value],
											)}
										/>
									),
								}))}
								wrapperProps={{
									triggerIcon: (
										<div
											className={clsx(
												'es-uic-size-6 es-uic-rounded es-uic-border es-uic-border-gray-300 es-uic-shadow-sm bg-gradient-to-r',
												manifest.tailwind.options.columnBackground.twClasses[columnBackground],
											)}
										/>
									),
								}}
								aria-label={__('Gradient style', '%g_textdomain%')}
								noTriggerLabel
								type='menu'
							/>
							<OptionSelect
								value={columnGradientDirection}
								onChange={(value) =>
									setAttributes({ [getAttrKey('columnGradientDirection', attributes, manifest)]: value })
								}
								options={getOption('columnGradientDirection', attributes, manifest)}
								wrapperProps={{
									triggerIcon: <div className={rotationClassName[columnGradientDirection]}>{icons.arrowUpCircle}</div>,
								}}
								aria-label={__('Gradient angle', '%g_textdomain%')}
								noTriggerLabel
								type='menu'
							/>
						</>
					)}
				</ButtonGroup>
			</BaseControl>

			<ColorPicker
				icon={icons.border}
				label={__('Border', '%g_textdomain%')}
				colors={getColorOption('columnBorder', manifest)}
				onChange={(value) => setAttributes({ [getAttrKey('columnBorder', attributes, manifest)]: value })}
				value={columnBorder}
				aria-label={__('Border', '%g_textdomain%')}
				clearable
				inline
			/>

			<OptionSelect
				icon={icons.roundedCorners}
				label={__('Rounded corners', '%g_textdomain%')}
				value={columnBorderRadius}
				onChange={(value) => setAttributes({ [getAttrKey('columnBorderRadius', attributes, manifest)]: value })}
				options={getOption('columnBorderRadius', attributes, manifest)}
				aria-label={__('Rounded corners', '%g_textdomain%')}
				type='menu'
				inline
			/>

			<OptionSelect
				icon={icons.shadow}
				label={__('Shadow', '%g_textdomain%')}
				value={columnShadow}
				onChange={(value) => setAttributes({ [getAttrKey('columnShadow', attributes, manifest)]: value })}
				options={getOption('columnShadow', attributes, manifest)}
				aria-label={__('Shadow', '%g_textdomain%')}
				type='menu'
				inline
			/>

			<Spacer />
			<Spacer
				icon={icons.containerSpacingH}
				text={__('Spacing', '%g_textdomain%')}
				border
			/>

			<Responsive
				value={columnPaddingTop}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnPaddingTop', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingTopIn}
				label={__('Top padding', '%g_textdomain%')}
				options={getOption('columnSpacing', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type='menu'
					/>
				)}
			</Responsive>

			<Responsive
				value={columnPaddingRight}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnPaddingRight', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingRightIn}
				label={__('Right padding', '%g_textdomain%')}
				options={getOption('columnSpacing', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type='menu'
					/>
				)}
			</Responsive>

			<Responsive
				value={columnPaddingBottom}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnPaddingBottom', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingBottomIn}
				label={__('Bottom padding', '%g_textdomain%')}
				options={getOption('columnSpacing', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type='menu'
					/>
				)}
			</Responsive>

			<Responsive
				value={columnPaddingLeft}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnPaddingLeft', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingBottomIn}
				label={__('Left padding', '%g_textdomain%')}
				options={getOption('columnSpacing', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type='menu'
					/>
				)}
			</Responsive>

			<Spacer />

			<Responsive
				value={columnGap}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnGap', attributes, manifest)]: value,
					})
				}
				icon={icons.verticalSpacing}
				label={__('Item gap', '%g_textdomain%')}
				options={getOption('columnGap', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options, isInlineCollapsedView, breakpoint }) => (
					<OptionSelect
						options={options}
						value={currentValue}
						onChange={(value) => handleChange(value)}
						type={isInlineCollapsedView ? 'menu' : 'toggleButtons'}
						noItemIcon={!isInlineCollapsedView}
						aria-label={sprintf(__('Column: content gap - %s', '%g_textdomain%'), breakpoint)}
					/>
				)}
			</Responsive>

			<Spacer />
			<Spacer
				icon={icons.moreHCircle}
				text={__('Advanced', '%g_textdomain%')}
				border
			/>

			<Responsive
				value={columnHide}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('columnHide', attributes, manifest)]: value,
					})
				}
				icon={icons.visibility}
				label={__('Visibility', '%g_textdomain%')}
				options={getOption('columnHide', attributes, manifest)}
				breakpoints={breakpointNames}
				breakpointData={breakpointData}
				noModeSelect
				inline
			>
				{({ currentValue, handleChange, options, isInlineCollapsedView, breakpoint }) => (
					<OptionSelect
						options={options}
						value={String(currentValue)}
						onChange={(value) => handleChange(value)}
						noItemLabel={isInlineCollapsedView}
						noItemIcon={!isInlineCollapsedView}
						aria-label={sprintf(__('Column: visibility - %s', '%g_textdomain%'), breakpoint)}
					/>
				)}
			</Responsive>
		</>
	);
};
