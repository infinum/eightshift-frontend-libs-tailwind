import { select } from '@wordpress/data';
import { STORE_NAME } from '../editor/store';

export const getGlobalManifest = () => select(STORE_NAME)?.getSettings();

export const getBreakpointNames = () => {
	const breakpoints = select(STORE_NAME)?.getSettings()?.globalVariables?.breakpoints;

	return Object.entries(breakpoints)
		.toSorted((a, b) => b[1] - a[1])
		.map(([name]) => name).toReversed();
};

export const getBreakpointData = (convertToPx = false) => {
	const breakpoints = select(STORE_NAME)?.getSettings()?.globalVariables?.breakpoints;

	if (convertToPx) {
		return Object.fromEntries(
			Object.entries(breakpoints)
				.map(([name, value]) => [
					name,
					value * 16,
				])
		);
	}

	return breakpoints;
};

export const getBreakpointUiData = () => select(STORE_NAME)?.getSettings()?.globalVariables?.breakpointData;

export const getResponsiveData = (convertToPx = false) => {
	const uiData = getBreakpointUiData();

	const baseData = {
		breakpoints: getBreakpointNames(),
		breakpointData: getBreakpointData(convertToPx),
	};

	if (!uiData) {
		return baseData;
	}

	return {
		...baseData,
		breakpointUiData: uiData,
	};
};
