import React from 'react';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { VideoEditor as EditorComponent } from '../../../components/video/components/video-editor';

export const VideoEditor = ({ attributes, setAttributes }) => {
	return <EditorComponent {...props('video', attributes, { setAttributes })} />;
};
