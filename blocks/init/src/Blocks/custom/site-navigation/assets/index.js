import domReady from '@wordpress/dom-ready';
import MicroModal from 'micromodal';

domReady(() => {
	MicroModal.init({
		disableScroll: true,
		awaitCloseAnimation: true,
	});
});
