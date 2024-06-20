import React from 'react';
import { __ } from '@wordpress/i18n';
import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { VideoOptions as OptionsComponent } from '../../../components/video/components/video-options';

export const VideoOptions = ({ attributes, setAttributes }) => {
	return (
		<OptionsComponent
			{...props('video', attributes, { setAttributes })}
			controlOnly
		/>
	);
};
