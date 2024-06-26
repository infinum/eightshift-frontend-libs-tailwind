/**
 * Main entrypoint location for webpack config.
 *
 */

import { merge } from 'webpack-merge';
import { getConfig } from './helpers.js';
import baseConfig from './base.js';
import projectConfig from './project.js';
import productionConfig from './production.js';

export default (mode, optionsData = {}) => {
	// All config and default setting overrides must be provided using this object.
	const options = {
		config: {},
		overrides: [],
		...optionsData,
	};

	// Append project config using getConfig helper.
	options.config = getConfig(
		optionsData.config.projectDir,
		optionsData.config.projectPath,
		optionsData.config.assetsPath,
		optionsData.config.blocksAssetsPath,
		optionsData.config.outputPath,
		optionsData.config.blocksManifestSettingsPath,
	);

	options.config.mode = mode;
	options.config.filesOutput = mode === 'production' ? '[name]-[contenthash]' : '[name]';

	// Get all webpack partials.
	const base = baseConfig(options);
	const project = projectConfig(options);
	const production = productionConfig(options);

	// Default output that is going to be merged in any env.
	const outputDefault = merge(project, base);

	// Output development setup by default.
	const development = {
		devtool: false,
		watchOptions: {
			ignored: ['**/node_modules', '**/vendor', '**/public'],
		},
	};

	return merge(outputDefault, mode === 'production' ? production : development);
};
