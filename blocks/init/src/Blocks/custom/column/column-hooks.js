import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import globalManifest from '../../manifest.json';
import manifest from './manifest.json';
import { getTwClasses } from '@eightshift/frontend-libs-tailwind/scripts';

const { namespace } = globalManifest;

const { blockName } = manifest;
const fullBlockName = `${namespace}/${blockName}`;

// Add options to the Gutenberg markup.
const parentComponentBlock = createHigherOrderComponent((BlockListBlock) => {
	return (innerProps) => {
		const { name, attributes } = innerProps;

		let updatedProps = { ...innerProps };

		if (name === fullBlockName) {
			updatedProps = {
				...innerProps,
				className: getTwClasses(attributes, manifest, '[&_>_.wp-block]:!mx-0 !m-0'),
			};
		}

		return <BlockListBlock {...updatedProps} />;
	};
}, 'parentComponentBlock');

export const hooks = () => {
	addFilter('editor.BlockListBlock', fullBlockName, parentComponentBlock);
};
