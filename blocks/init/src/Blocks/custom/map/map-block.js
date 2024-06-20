import React from 'react';
import { MapEditor } from './components/map-editor';
import { MapOptions } from './components/map-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Map = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={MapOptions}
			editor={MapEditor}
		/>
	);
};
