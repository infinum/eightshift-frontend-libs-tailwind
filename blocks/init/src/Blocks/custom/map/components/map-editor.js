import { checkAttr } from '@eightshift/frontend-libs-tailwind/scripts';
import { Interactions, Layers, MapInteraction, OpenLayersMap, Controls, MapControl, processMapLayer } from './map-components';
import manifest from '../manifest.json';

export const MapEditor = ({ attributes }) => {
	const mapLayers = checkAttr('mapLayers', attributes, manifest);
	const mapCenterLat = checkAttr('mapCenterLat', attributes, manifest, true);
	const mapCenterLon = checkAttr('mapCenterLon', attributes, manifest, true);
	const mapZoom = checkAttr('mapZoom', attributes, manifest);
	const mapInteractions = checkAttr('mapInteractions', attributes, manifest);
	const mapControls = checkAttr('mapControls', attributes, manifest);

	return (
		<OpenLayersMap
			attributes={attributes}
			manifest={manifest}
			center={[mapCenterLon ?? 16.352532, mapCenterLat ?? 46.314045]}
			zoom={mapZoom}
		>
			<Layers key={mapLayers.map(({ id, type }) => `${id}-${type}`).join(',')}>{[...mapLayers].reverse().map((layer) => processMapLayer(layer))}</Layers>

			<Interactions>
				<MapInteraction
					key={Math.random()}
					type='defaults'
					options={mapInteractions}
				/>
			</Interactions>

			<Controls>
				{Object.entries(mapControls).map(([type, use]) => {
					if (!use) {
						return null;
					}

					return (
						<MapControl
							key={Math.random()}
							type={type}
						/>
					);
				})}
			</Controls>
		</OpenLayersMap>
	);
};
