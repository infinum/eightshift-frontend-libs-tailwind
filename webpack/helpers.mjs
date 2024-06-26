/**
 * File holding webpack helpers used to create project webpack build setup.
 *
 */

import path from 'path';

/**
 * Generate all paths required for Webpack build to work.
 *
 * @param {string} projectDir Current project directory absolute path.
 * @param {string} projectPathConfig Project path relative to project root.
 * @param {string} assetsPathConfig Assets path after projectPath location.
 * @param {string} blocksAssetsPathConfig Path of the block assets.
 * @param {string} outputPathConfig Public output path after projectPath location.
 * @param {string} blocksManifestSettingsPath Main global settings manifest.json path after projectPath location.
 *
 */
function getConfig(
	projectDir,
	projectPathConfig,
	assetsPathConfig = 'assets',
	blocksAssetsPathConfig = 'src/Blocks/assets',
	outputPathConfig = 'public',
	blocksManifestSettingsPath = 'src/Blocks/manifest.json',
) {
	if (typeof projectDir === 'undefined') {
		throw Error('projectDir parameter is empty, please provide. This key represents: Current project directory absolute path. For example: __dirname');
	}

	if (typeof projectPathConfig === 'undefined') {
		throw Error(
			'projectPath parameter is empty, please provide. This key represents: Project path relative to project root. For example: wp-content/themes/eightshift-boilerplate',
		);
	}

	// Clear all slashes from user config.
	const projectPathConfigClean = projectPathConfig.replace(/^\/|\/$/g, '');
	const assetsPathConfigClean = assetsPathConfig.replace(/^\/|\/$/g, '');
	const blocksAssetsPathConfigClean = blocksAssetsPathConfig.replace(/^\/|\/$/g, '');
	const outputPathConfigClean = outputPathConfig.replace(/^\/|\/$/g, '');
	const blocksManifestSettingsPathClean = blocksManifestSettingsPath.replace(/^\/|\/$/g, '');

	// Create absolute path from the projects relative path.
	const absolutePath = `${projectDir}`;

	return {
		absolutePath,

		// Output files absolute location.
		outputPath: path.resolve(absolutePath, outputPathConfigClean),

		// Output files relative location, added before every output file in manifest.json. Should start and end with "/".
		publicPath: path.join('/', projectPathConfigClean, outputPathConfigClean, '/'),

		// Source files entries absolute locations.
		applicationEntry: path.resolve(absolutePath, assetsPathConfigClean, 'application.js'),
		applicationAdminEntry: path.resolve(absolutePath, assetsPathConfigClean, 'application-admin.js'),
		applicationBlocksEntry: path.resolve(absolutePath, blocksAssetsPathConfigClean, 'application-blocks.js'),
		applicationBlocksEditorEntry: path.resolve(absolutePath, blocksAssetsPathConfigClean, 'application-blocks-editor.js'),
		applicationBlocksFrontendEntry: path.resolve(absolutePath, blocksAssetsPathConfigClean, 'application-blocks-frontend.js'),

		blocksManifestSettingsPath: path.resolve(absolutePath, blocksManifestSettingsPathClean),
	};
}

export { getConfig };
