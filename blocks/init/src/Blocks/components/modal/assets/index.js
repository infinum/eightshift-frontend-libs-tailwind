import domReady from '@wordpress/dom-ready';
import MicroModal from 'micromodal';
import manifest from '../manifest.json';

domReady(() => {
	const selector = `.${manifest.componentJsClass}`;
	const elements = document.querySelectorAll(selector);

	if (elements?.length < 1) {
		return;
	}

	elements.forEach((element) => {
		document.querySelectorAll(`[href=":open-modal-${element.id}:"],[data-micromodal-trigger="${element.id}"]`).forEach((trigger) => {
			trigger.addEventListener('click', (event) => {
				event.preventDefault();

				MicroModal.show(element.id, {
					disableScroll: true,
					awaitCloseAnimation: true,
				});
			});
		});
	});
});
