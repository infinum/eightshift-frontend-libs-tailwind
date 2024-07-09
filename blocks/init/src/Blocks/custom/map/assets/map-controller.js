import { Map, View } from 'ol';
import { useGeographic } from 'ol/proj';
import { processMapInteraction, processMapLayer } from './utils';
import { defaults as OLDefaultInteractions } from 'ol/interaction/defaults';

export class MapController {
	constructor(options) {
		this.element = options.element;
	}

	init() {
		useGeographic();

		const parsedLayers = JSON.parse(this.element?.dataset?.mapLayers ?? '');
		const parsedControls = JSON.parse(this.element?.dataset?.mapControls ?? '');
		const parsedInteractions = JSON.parse(this.element?.dataset?.mapInteractions ?? '');

		const parsedLat = parseFloat(this.element?.dataset?.centerLat || '46.314045');
		const parsedLon = parseFloat(this.element?.dataset?.centerLon || '16.352532');
		const parsedZoom = parseFloat(this.element?.dataset?.centerZoom || '14');

		if (parsedLayers?.length < 1) {
			return;
		}

		const view = new View({
			center: [parsedLon, parsedLat],
			zoom: parsedZoom,
		});

		new Map({
			target: this.element,
			layers: parsedLayers.map((layer) => processMapLayer(layer)),
			view: view,
			interactions: OLDefaultInteractions(parsedInteractions).getArray(),
			controls: Object.entries(parsedControls)
				.filter(([_, v]) => v === true)
				.map(([name]) => processMapInteraction(name)),
		});
	}
}
