// Based on Embla carousel docs.

export const addPagination = (emblaApi, dotsNode) => {
	let dotNodes = [];

	const addDots = () => {
		dotsNode.innerHTML = '';

		dotNodes = emblaApi.scrollSnapList().map((_, index) => {
			const elem = document.createElement('button');
			elem.className =
				'size-2.5 rounded-full border border-gray-500 transition hover:scale-105 focus:outline-none focus-visible:ring focus-visible:ring-navy-500/30';

			elem.addEventListener('click', () => emblaApi.scrollTo(index), false);
			dotsNode.appendChild(elem);
			return elem;
		});
	};

	const toggleDotBtnsActive = () => {
		const previous = emblaApi.previousScrollSnap();
		const selected = emblaApi.selectedScrollSnap();
		['border-navy-500', 'bg-navy-500', 'shadow-sm', 'shadow-navy-500/30'].forEach((className) => {
			dotNodes[previous].classList.remove(className);
			dotNodes[selected].classList.add(className);
		});
	};

	emblaApi
		.on('init', addDots)
		.on('reInit', addDots)
		.on('init', toggleDotBtnsActive)
		.on('reInit', toggleDotBtnsActive)
		.on('select', toggleDotBtnsActive);

	return () => {
		dotsNode.innerHTML = '';
	};
};
