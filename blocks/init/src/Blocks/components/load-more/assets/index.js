import domReady from '@wordpress/dom-ready';
import manifest from './../manifest.json';

domReady(async () => {
	const selectors = `.${manifest.componentJsClass}`;
	const elements = document.querySelectorAll(selectors);

	if (!elements.length) {
		return;
	}

	const { LoadMore } = await import('./load-more');

	elements.forEach((element) => {
		new LoadMore({
			element,
		}).init();
	});
});
