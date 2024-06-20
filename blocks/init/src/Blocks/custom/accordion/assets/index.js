import domReady from '@wordpress/dom-ready';

domReady(async () => {
	const selector = '.js-block-accordion';
	const elements = document.querySelectorAll(selector);

	if (elements?.length < 1) {
		return;
	}

	elements.forEach((element) => {
		let activeElement;

		const accordionTriggers = element.querySelectorAll('[data-accordion-header]');

		const closeAdjacent = element.hasAttribute('data-close-adjacent');

		accordionTriggers.forEach((trigger) => {
			const target = trigger.nextElementSibling;

			trigger.addEventListener('click', () => {
				if (closeAdjacent) {
					if (activeElement) {
						activeElement.setAttribute('aria-expanded', false);
						activeElement.nextElementSibling.hidden = true;
					}

					activeElement = trigger;
				}

				const expanded = trigger.getAttribute('aria-expanded') === 'true' ?? false;
				trigger.setAttribute('aria-expanded', !expanded);
				target.hidden = expanded;
			});
		});
	});
});
