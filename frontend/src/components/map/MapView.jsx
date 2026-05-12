import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [13.3017, -87.1889];
const DEFAULT_ZOOM = 15;
const MAX_NATIVE_ZOOM = 19;
const MAX_ZOOM = 21;
const TILE_CACHE_BUSTER = "osm-20260407";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

function BoundsTracker({ onBoundsChange, onMapClick }) {
  const timeoutRef = useRef(null);
  const map = useMapEvents({
    click(event) {
      onMapClick?.({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6))
      });
    },
    moveend() {
      if (!onBoundsChange) return;
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        const bounds = map.getBounds();
        onBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      }, 180);
    }
  });

  useEffect(() => {
    map.fire("moveend");
    return () => window.clearTimeout(timeoutRef.current);
  }, [map]);

  return null;
}

function MapFocus({ request }) {
  const map = useMap();

  useEffect(() => {
    if (!request || !isFiniteCoordinate(request.latitude) || !isFiniteCoordinate(request.longitude)) return;
    map.setView(
      [Number(request.latitude), Number(request.longitude)],
      Number.isFinite(Number(request.zoom)) ? Number(request.zoom) : map.getZoom(),
      { animate: true }
    );
  }, [map, request]);

  return null;
}

function MapView({
  apiUrl,
  focusRequest,
  mapDraft,
  points,
  selectedPointId,
  onBoundsChange,
  onMapClick,
  onSelectPoint
}) {
  const tileTemplate = useMemo(
    () => `${apiUrl}/map-tiles/{z}/{x}/{y}.png?v=${encodeURIComponent(TILE_CACHE_BUSTER)}`,
    [apiUrl]
  );

  return (
    <MapContainer
      className="field-map-view"
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      maxZoom={MAX_ZOOM}
      zoomControl={false}
      preferCanvas
      attributionControl={false}
      tapTolerance={24}
    >
      <TileLayer
        url={tileTemplate}
        attribution="OpenStreetMap"
        maxNativeZoom={MAX_NATIVE_ZOOM}
        maxZoom={MAX_ZOOM}
        keepBuffer={1}
        updateWhenIdle
        updateWhenZooming={false}
      />
      <BoundsTracker onBoundsChange={onBoundsChange} onMapClick={onMapClick} />
      <MapFocus request={focusRequest} />
      {points.map((point) => {
        if (!isFiniteCoordinate(point.latitude) || !isFiniteCoordinate(point.longitude)) return null;
        const isSelected = selectedPointId === point.id;
        return (
          <CircleMarker
            key={point.id}
            center={[Number(point.latitude), Number(point.longitude)]}
            radius={isSelected ? 9 : 6}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: point.marker_color || "#1576d1",
              fillOpacity: 0.95
            }}
            eventHandlers={{ click: () => onSelectPoint(point.id) }}
          />
        );
      })}
      {isFiniteCoordinate(mapDraft?.latitude) && isFiniteCoordinate(mapDraft?.longitude) ? (
        <CircleMarker
          center={[Number(mapDraft.latitude), Number(mapDraft.longitude)]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: "#f59e0b",
            fillOpacity: 0.95
          }}
        />
      ) : null}
    </MapContainer>
  );
}

export default MapView;
