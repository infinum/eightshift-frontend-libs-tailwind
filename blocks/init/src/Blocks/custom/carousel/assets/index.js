import domReady from '@wordpress/dom-ready';
import manifest from '../manifest.json';
import EmblaCarousel from 'embla-carousel';
import { addPagination } from './pagination';
import { setUpNavigation } from './navigation';

domReady(async () => {
	const { blockJsClass } = manifest;

	const selector = `.${blockJsClass}`;
	const elements = document.querySelectorAll(selector);

	if (!elements.length) {
		return;
	}

	elements.forEach((element) => {
		const container = element.querySelector(`${selector}-container`);

		if (!container) {
			return;
		}

		const loop = element.hasAttribute('data-loop');

		const embla = EmblaCarousel(container, {
			loop: loop,
			skipSnaps: true,
		});

		const prevButton = element.querySelector(`${selector}-prev`);
		const nextButton = element.querySelector(`${selector}-next`);

		if (prevButton && nextButton) {
			const removeNavigationHandlers = setUpNavigation(embla, prevButton, nextButton);
			embla.on('destroy', removeNavigationHandlers);
		}

		const paginationContainer = element.querySelector(`${selector}-pagination`);

		if (paginationContainer) {
			const removePaginationHandlers = addPagination(embla, paginationContainer);
			embla.on('destroy', removePaginationHandlers);
		}
	});
});
