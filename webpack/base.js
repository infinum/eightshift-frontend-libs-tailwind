/**
 * Project Base overrides used in production and development build.
 *
 */

import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import DependencyExtractionWebpackPlugin from '@wordpress/dependency-extraction-webpack-plugin';

export default (options) => {
	// All Plugins used in production and development build.
	const plugins = [];

	// Provide global variables to window object.
	if (!options.overrides.includes('providePlugin')) {
		plugins.push(
			new webpack.ProvidePlugin({
				$: 'jquery',
				jQuery: 'jquery',
			}),
		);
	}

	// Provide variables to code build.
	if (!options.overrides.includes('definePlugin')) {
		plugins.push(
			new webpack.DefinePlugin({
				'process.env.VERSION': JSON.stringify(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)),
				'process.browser': true,
			}),
		);
	}

	// Output css from Js.
	if (!options.overrides.includes('miniCssExtractPlugin')) {
		plugins.push(
			new MiniCssExtractPlugin({
				filename: `${options.config.filesOutput}.css`,
			}),
		);
	}

	// Create manifest.json file.
	if (!options.overrides.includes('webpackManifestPlugin')) {
		plugins.push(new WebpackManifestPlugin());
	}

	// Enable export for all WordPress related packages
	if (!options.overrides.includes('dependencyExtractionWebpackPlugin')) {
		plugins.push(
			new DependencyExtractionWebpackPlugin({
				outputFormat: 'json',
				requestToExternal: function (request) {
					// eslint-disable-line consistent-return
					if (request === '@wordpress/dom-ready') {
						return '';
					}
				},
			}),
		);
	}

	// All module used in production and development build.
	const module = {
		rules: [],
	};

	// Module for JS and JSX.
	if (!options.overrides.includes('js')) {
		module.rules.push({
			test: /\.(js|jsx)$/,
			exclude: /node_modules[\\/](?!@eightshift)/,
			use: {
				loader: 'swc-loader',
			},
		});
	}

	// Module for Images.
	if (!options.overrides.includes('images')) {
		module.rules.push({
			test: /\.(png|svg|jpg|jpeg|gif|ico|webp)$/i,
			exclude: [/fonts/, /node_modules/],
			use: 'file-loader?name=[name].[ext]',
		});
	}

	// Module for Fonts.
	if (!options.overrides.includes('fonts')) {
		module.rules.push({
			test: /\.(otf|ttf|woff2)$/,
			exclude: [/images/, /node_modules/],
			use: 'file-loader?name=[name].[ext]',
		});
	}

	// Module for CSS.
	if (!options.overrides.includes('css')) {
		module.rules.push({
			test: /\.css$/,
			exclude: /node_modules/,
			use: [
				MiniCssExtractPlugin.loader,
				{
					loader: 'css-loader',
				},
				{
					loader: 'postcss-loader',
				},
			],
		});

		module.rules.push({
			test: /\.css$/,
			include: /node_modules/,
			use: [
				{
					loader: 'css-loader',
				},
			],
		});
	}

	const resolve = {
		symlinks: false,
	};

	return {
		plugins,
		module,
		resolve,
	};
};
