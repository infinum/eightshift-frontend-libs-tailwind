import React from 'react';
import { VideoEditor } from './components/video-editor';
import { VideoOptions } from './components/video-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const Video = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={VideoOptions}
			editor={VideoEditor}
		/>
	);
};
