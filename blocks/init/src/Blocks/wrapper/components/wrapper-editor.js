import React, { useRef, useMemo, useState, useEffect } from 'react';
import { checkAttr, getTwClasses } from '@eightshift/frontend-libs-tailwind/scripts';
import manifest from './../manifest.json';

export const WrapperEditor = ({ attributes, children }) => {
	const wrapperUse = checkAttr('wrapperUse', attributes, manifest);

	if (!wrapperUse) {
		return children;
	}

	// First letter of WrapperTag variable is capitalized on purpose. That way it can be used as a dynamic tag.
	const WrapperTag = checkAttr('wrapperTag', attributes, manifest);

	return <WrapperTag className={getTwClasses(attributes, manifest)}>{children}</WrapperTag>;
};
