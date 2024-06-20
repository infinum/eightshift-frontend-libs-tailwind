import React from 'react';
import { useSelect } from '@wordpress/data';
import { overrideInnerBlockAttributes } from '@eightshift/frontend-libs-tailwind/scripts/editor';
import { ModalEditor } from './components/modal-editor';

export const Modal = (props) => {
	useSelect((select) => {
		overrideInnerBlockAttributes(select, props.clientId, {
			wrapperNoWidthControls: true,
			wrapperWidth: 'none',
		});
	});

	return <ModalEditor {...props} />;
};
