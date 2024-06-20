// Based on Embla carousel docs.

const setUpNavigationStateChange = (emblaApi, prevBtn, nextBtn) => {
	const toggleNavigationState = () => {
		prevBtn.disabled = !emblaApi.canScrollPrev();
		nextBtn.disabled = !emblaApi.canScrollNext();
	};

	emblaApi.on('select', toggleNavigationState).on('init', toggleNavigationState).on('reInit', toggleNavigationState);

	return () => {
		prevBtn.removeAttribute('disabled');
		nextBtn.removeAttribute('disabled');
	};
};

export const setUpNavigation = (emblaApi, prevBtn, nextBtn) => {
	const scrollPrev = () => emblaApi.scrollPrev();
	const scrollNext = () => emblaApi.scrollNext();

	prevBtn.addEventListener('click', scrollPrev, false);
	nextBtn.addEventListener('click', scrollNext, false);

	const removeNavigationStateChangeEvents = setUpNavigationStateChange(emblaApi, prevBtn, nextBtn);

	return () => {
		removeNavigationStateChangeEvents();
		prevBtn.removeEventListener('click', scrollPrev, false);
		nextBtn.removeEventListener('click', scrollNext, false);
	};
};
