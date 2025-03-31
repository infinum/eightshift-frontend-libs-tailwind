import { register, createReduxStore, select, dispatch } from '@wordpress/data';

// Store name defined by build version so we can have multiple themes and plugins.
export const BUILD_VERSION = process.env.VERSION;
export const STORE_NAME = `eightshift/${BUILD_VERSION}`;

// Set default store state.
const DEFAULT_STATE = {
	blocks: {},
	components: {},
	config: {
		useWrapper: true,
		useLegacyComponents: false,
	},
	wrapper: {},
	variations: {},
	settings: {},
	styles: [],
	hasStylesUpdated: false,
};

// Define selectors - only getters.
const selectors = {
	getBlocks(state) {
		return state.blocks;
	},
	getBlock(state, blockName) {
		return state.blocks.find((block) => block.blockName === blockName);
	},
	getComponents(state) {
		return state.components;
	},
	getComponent(state, componentName) {
		return state.components.find((component) => component.componentName === componentName);
	},
	getVariations(state) {
		return state.variations;
	},
	getVariation(state, name) {
		return state.variations.find((variation) => variation.name === name);
	},
	getConfig(state) {
		return state.config;
	},
	getConfigUseWrapper(state) {
		return state.config.useWrapper;
	},
	getConfigUseLegacyComponents(state) {
		return state.config.useLegacyComponents;
	},
	getWrapper(state) {
		return state.wrapper;
	},
	getSettings(state) {
		return state.settings;
	},
	getSettingsNamespace(state) {
		return state.settings.namespace;
	},
	getSettingsGlobalVariables(state) {
		return state.settings.globalVariables;
	},
	getSettingsGlobalVariablesCustomBlockName(state) {
		return state.settings.globalVariables.customBlocksName;
	},
	getSettingsGlobalVariablesBreakpoints(state) {
		return state.settings.globalVariables.breakpoints;
	},
};

// Define actions - getters and setters.
const actions = {
	setBlocks(blocks) {
		return {
			type: 'SET_BLOCKS',
			blocks,
		};
	},
	setComponents(components) {
		return {
			type: 'SET_COMPONENTS',
			components,
		};
	},
	setVariations(variations) {
		return {
			type: 'SET_VARIATIONS',
			variations,
		};
	},
	setConfigUseWrapper(config) {
		return {
			type: 'SET_CONFIG_USE_WRAPPER',
			config,
		};
	},
	setConfigUseLegacyComponents(config) {
		return {
			type: 'SET_CONFIG_USE_LEGACY_COMPONENTS',
			config,
		};
	},
	setWrapper(wrapper) {
		return {
			type: 'SET_WRAPPER',
			wrapper,
		};
	},
	setSettings(settings) {
		return {
			type: 'SET_SETTINGS',
			settings,
		};
	},
	setSettingsGlobalVariablesBreakpoints(breakpoints) {
		return {
			type: 'SET_SETTINGS_GLOBAL_VARIABLES_BREAKPOINTS',
			breakpoints,
		};
	},
};

// Define reducers - only setters.
const reducer = (state = DEFAULT_STATE, action) => {
	switch (action.type) {
		case 'SET_BLOCKS': {
			return {
				...state,
				blocks: action.blocks,
			};
		}
		case 'SET_COMPONENTS': {
			return {
				...state,
				components: action.components,
			};
		}
		case 'SET_VARIATIONS': {
			return {
				...state,
				variations: action.variations,
			};
		}
		case 'SET_CONFIG_USE_WRAPPER': {
			return {
				...state,
				config: {
					...state.config,
					useWrapper: action.config,
				},
			};
		}
		case 'SET_CONFIG_USE_LEGACY_COMPONENTS': {
			return {
				...state,
				config: {
					...state.config,
					useLegacyComponents: action.config,
				},
			};
		}
		case 'SET_WRAPPER': {
			return {
				...state,
				wrapper: action.wrapper,
			};
		}
		case 'SET_SETTINGS': {
			return {
				...state,
				settings: action.settings,
			};
		}
		case 'SET_SETTINGS_GLOBAL_VARIABLES_BREAKPOINTS': {
			return {
				...state,
				settings: {
					...state.settings,
					globalVariables: {
						...state.settings.globalVariables,
						breakpoints: action.breakpoints,
					},
				},
			};
		}
		default: {
			return state;
		}
	}
};

// Register the store.
export const setStore = () => {
	if (typeof window?.eightshift === 'undefined') {
		window.eightshift = {};
	}

	register(
		createReduxStore(STORE_NAME, {
			selectors,
			actions,
			reducer,
		}),
	);
};

/**
 * Set features config flag set in the global manifest settings.
 *
 * @access private
 *
 * @returns {void}
 */
export const setConfigFlags = () => {
	const config = select(STORE_NAME).getSettings()?.config;

	if (typeof config !== 'undefined') {
		// useWrapper
		if (typeof config?.useWrapper === 'boolean') {
			dispatch(STORE_NAME).setConfigUseWrapper(config.useWrapper);
		}
	}
};

// Set global window data for easier debugging.
export const setStoreGlobalWindow = () => {
	if (typeof window?.eightshift?.store === 'undefined') {
		window.eightshift.store = {};
	}

	window.eightshift.store[select(STORE_NAME).getSettingsNamespace()] = STORE_NAME;
};
