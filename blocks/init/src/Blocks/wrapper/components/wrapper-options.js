import { __ } from '@wordpress/i18n';
import { checkAttr, getAttrKey, getHiddenOptions, getOption } from '@eightshift/frontend-libs-tailwind/scripts';
import {
	BaseControl,
	ButtonGroup,
	ColorPicker,
	ContainerPanel,
	OptionSelect,
	Spacer,
	Responsive,
	InputField,
} from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { clsx } from '@eightshift/ui-components/utilities';
import { getResponsiveData } from '@eightshift/frontend-libs-tailwind/scripts/helpers/breakpoints';
import { getColorOption, rotationClassName } from '../../assets/scripts/shared';
import manifest from './../manifest.json';

export const WrapperOptions = ({ attributes, setAttributes }) => {
	const wrapperUse = checkAttr('wrapperUse', attributes, manifest);
	const wrapperNoControls = checkAttr('wrapperNoControls', attributes, manifest);
	const wrapperNoWidthControls = checkAttr('wrapperNoWidthControls', attributes, manifest);

	const wrapperWidth = checkAttr('wrapperWidth', attributes, manifest);
	const wrapperContentWidth = checkAttr('wrapperContentWidth', attributes, manifest);

	const wrapperBackground = checkAttr('wrapperBackground', attributes, manifest);
	const wrapperGradientDirection = checkAttr('wrapperGradientDirection', attributes, manifest);

	const wrapperBorderRadius = checkAttr('wrapperBorderRadius', attributes, manifest);

	const wrapperMarginTop = checkAttr('wrapperMarginTop', attributes, manifest);
	const wrapperMarginBottom = checkAttr('wrapperMarginBottom', attributes, manifest);

	const wrapperPaddingTop = checkAttr('wrapperPaddingTop', attributes, manifest);
	const wrapperPaddingBottom = checkAttr('wrapperPaddingBottom', attributes, manifest);

	const wrapperHide = checkAttr('wrapperHide', attributes, manifest);

	const wrapperId = checkAttr('wrapperId', attributes, manifest);

	const wrapperDisabledOptions = checkAttr('wrapperDisabledOptions', attributes, manifest);

	const hiddenOptions = getHiddenOptions(wrapperDisabledOptions);

	if (wrapperNoControls || wrapperDisabledOptions === 'all') {
		return null;
	}

	let backgroundType = 'none';

	if (wrapperBackground?.startsWith('solid-')) {
		backgroundType = 'solid';
	} else if (wrapperBackground?.startsWith('gradient-')) {
		backgroundType = 'gradient';
	}

	const responsiveData = getResponsiveData(true);

	return (
		<ContainerPanel
			title={__('Wrapper', '%g_textdomain%')}
			use={wrapperUse}
			actions={
				<OptionSelect
					aria-label={__('Width', '%g_textdomain%')}
					value={wrapperWidth}
					onChange={(value) =>
						setAttributes({
							[getAttrKey('wrapperWidth', attributes, manifest)]: value,
							[getAttrKey('wrapperUse', attributes, manifest)]: value !== 'off',
						})
					}
					options={getOption('wrapperWidth', attributes, manifest)}
					hidden={wrapperNoWidthControls}
					type='menu'
					wrapperProps={{
						triggerProps: { size: 'small' },
					}}
					inline
				/>
			}
			closable
		>
			<Responsive
				value={wrapperContentWidth}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('wrapperContentWidth', attributes, manifest)]: value,
					})
				}
				icon={icons.containerWidth}
				label={__('Width', '%g_textdomain%')}
				options={getOption('wrapperContentWidth', attributes, manifest)}
				hidden={wrapperNoWidthControls || hiddenOptions?.width}
				noModeSelect
				inline
				{...responsiveData}
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

			<BaseControl
				icon={icons.backgroundType}
				label={__('Background', '%g_textdomain%')}
				hidden={hiddenOptions?.background}
				inline
			>
				<ButtonGroup>
					<OptionSelect
						options={getOption('wrapperBackground', attributes, manifest)}
						value={backgroundType}
						onChange={(value) => {
							if (value === 'none') {
								setAttributes({ [getAttrKey('wrapperBackground', attributes, manifest)]: undefined });
							} else {
								setAttributes({
									[getAttrKey('wrapperBackground', attributes, manifest)]: Object.keys(
										manifest.tailwind.options.wrapperBackground.twClasses,
									).find((key) => key.startsWith(value)),
								});
							}
						}}
						aria-label={__('Background type', '%g_textdomain%')}
						type='menu'
						hidden={hiddenOptions?.backgroundType}
						noItemIcon
					/>

					{backgroundType === 'solid' && (
						<ColorPicker
							colors={getColorOption('wrapperBackgroundSolid', manifest)}
							onChange={(value) =>
								setAttributes({ [getAttrKey('wrapperBackground', attributes, manifest)]: `solid-${value}` })
							}
							value={wrapperBackground?.replace('solid-', '')}
							aria-label={__('Background color', '%g_textdomain%')}
							hidden={hiddenOptions?.backgroundType}
						/>
					)}
					{backgroundType === 'gradient' && (
						<>
							<OptionSelect
								value={wrapperBackground}
								onChange={(value) => setAttributes({ [getAttrKey('wrapperBackground', attributes, manifest)]: value })}
								options={getOption('wrapperBackgroundGradient', attributes, manifest).map((option) => ({
									...option,
									icon: (
										<div
											className={clsx(
												'es-uic-size-5 es-uic-rounded es-uic-border es-uic-border-gray-300 bg-gradient-to-r',
												manifest.tailwind.options.wrapperBackground.twClasses[option.value],
											)}
										/>
									),
								}))}
								wrapperProps={{
									triggerIcon: (
										<div
											className={clsx(
												'es-uic-size-6 es-uic-rounded es-uic-border es-uic-border-gray-300 es-uic-shadow-sm bg-gradient-to-r',
												manifest.tailwind.options.wrapperBackground.twClasses[wrapperBackground],
											)}
										/>
									),
								}}
								aria-label={__('Gradient style', '%g_textdomain%')}
								hidden={hiddenOptions?.backgroundType}
								noTriggerLabel
								type='menu'
							/>
							<OptionSelect
								value={wrapperGradientDirection}
								onChange={(value) =>
									setAttributes({ [getAttrKey('wrapperGradientDirection', attributes, manifest)]: value })
								}
								options={getOption('wrapperGradientDirection', attributes, manifest)}
								wrapperProps={{
									triggerIcon: <div className={rotationClassName[wrapperGradientDirection]}>{icons.arrowUpCircle}</div>,
								}}
								aria-label={__('Gradient angle', '%g_textdomain%')}
								hidden={hiddenOptions?.backgroundType}
								noTriggerLabel
								type='menu'
							/>
						</>
					)}
				</ButtonGroup>
			</BaseControl>

			<OptionSelect
				icon={icons.roundedCorners}
				label={__('Rounded corners', '%g_textdomain%')}
				value={wrapperBorderRadius}
				onChange={(value) => setAttributes({ [getAttrKey('wrapperBorderRadius', attributes, manifest)]: value })}
				options={getOption('wrapperBorderRadius', attributes, manifest)}
				aria-label={__('Rounded corners', '%g_textdomain%')}
				type='menu'
				hidden={hiddenOptions?.roundedCorners}
				inline
			/>

			<Spacer />
			<Spacer
				icon={icons.containerSpacingH}
				text={__('Spacing', '%g_textdomain%')}
				border
			/>

			<Responsive
				value={wrapperMarginTop}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('wrapperMarginTop', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingTop}
				label={__('Top margin', '%g_textdomain%')}
				options={getOption('wrapperSpacing', attributes, manifest)}
				hidden={hiddenOptions?.marginTop}
				noModeSelect
				inline
				{...responsiveData}
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
				value={wrapperMarginBottom}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('wrapperMarginBottom', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingBottom}
				label={__('Bottom margin', '%g_textdomain%')}
				options={getOption('wrapperSpacing', attributes, manifest)}
				hidden={hiddenOptions?.marginBottom}
				noModeSelect
				inline
				{...responsiveData}
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
				value={wrapperPaddingTop}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('wrapperPaddingTop', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingTopIn}
				label={__('Top padding', '%g_textdomain%')}
				options={getOption('wrapperSpacing', attributes, manifest)}
				hidden={hiddenOptions?.paddingTop}
				noModeSelect
				inline
				{...responsiveData}
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
				value={wrapperPaddingBottom}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('wrapperPaddingBottom', attributes, manifest)]: value,
					})
				}
				icon={icons.spacingBottomIn}
				label={__('Bottom padding', '%g_textdomain%')}
				options={getOption('wrapperSpacing', attributes, manifest)}
				hidden={hiddenOptions?.paddingBottom}
				noModeSelect
				inline
				{...responsiveData}
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
			<Spacer
				icon={icons.moreHCircle}
				text={__('Advanced', '%g_textdomain%')}
				border
			/>

			<Responsive
				value={wrapperHide}
				onChange={(value) =>
					setAttributes({
						[getAttrKey('wrapperHide', attributes, manifest)]: value,
					})
				}
				icon={icons.visibility}
				label={__('Visibility', '%g_textdomain%')}
				options={getOption('wrapperHide', attributes, manifest)}
				hidden={hiddenOptions?.hide}
				noModeSelect
				inline
				{...responsiveData}
			>
				{({ currentValue, handleChange, options, isInlineCollapsedView }) => (
					<OptionSelect
						options={options}
						value={String(currentValue)}
						onChange={(value) => handleChange(value)}
						noItemLabel={isInlineCollapsedView}
						noItemIcon={!isInlineCollapsedView}
					/>
				)}
			</Responsive>

			<Spacer />

			<InputField
				icon={icons.id}
				label={__('Unique identifier', '%g_textdomain%')}
				value={wrapperId}
				onChange={(value) => setAttributes({ [getAttrKey('wrapperId', attributes, manifest)]: value })}
				className='es-uic-font-mono'
				hidden={hiddenOptions?.id}
			/>
		</ContainerPanel>
	);
};
