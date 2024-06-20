import React from 'react';
import { TableOfContentsEditor } from './components/table-of-contents-editor';
import { TableOfContentsOptions } from './components/table-of-contents-options';
import { GutenbergBlock } from '@eightshift/frontend-libs-tailwind/scripts';

export const TableOfContents = (props) => {
	return (
		<GutenbergBlock
			{...props}
			options={TableOfContentsOptions}
			editor={TableOfContentsEditor}
		/>
	);
};
