import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [13.3017, -87.1889];
const DEFAULT_ZOOM = 14;
const MAX_NATIVE_ZOOM = 19;
const MAX_INTERACTION_ZOOM = 21;
const TILE_CACHE_BUSTER = "transport-20260416";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

function TransportMap({
  apiUrl,
  drawEnabled,
  editable,
  focusKey,
  latestPosition,
  onMapAddPoint,
  plannedPath,
  trackedPath
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const tileTemplate = useMemo(
    () => `${apiUrl}/map-tiles/{z}/{x}/{y}.png?v=${encodeURIComponent(TILE_CACHE_BUSTER)}`,
    [apiUrl]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: MAX_INTERACTION_ZOOM,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      zoomControl: true,
      preferCanvas: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false
    });

    setZoomLevel(map.getZoom());
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    L.tileLayer(tileTemplate, {
      attribution: "OpenStreetMap contributors",
      maxNativeZoom: MAX_NATIVE_ZOOM,
      maxZoom: MAX_INTERACTION_ZOOM,
      keepBuffer: 4,
      updateWhenIdle: true
    }).addTo(map);

    map.on("click", (event) => {
      if (!editable || !drawEnabled) return;
      onMapAddPoint?.({
        latitude: Number(event.latlng.lat.toFixed(7)),
        longitude: Number(event.latlng.lng.toFixed(7))
      });
    });

    map.on("zoomend", () => {
      setZoomLevel(map.getZoom());
    });

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        map.invalidateSize(false);
      });
    });

    resizeObserver.observe(containerRef.current);
    window.setTimeout(() => map.invalidateSize(false), 120);

    return () => {
      resizeObserver.disconnect();
      layerRef.current?.clearLayers();
      layerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [drawEnabled, editable, onMapAddPoint, tileTemplate]);

  useEffect(() => {
    if (!layerRef.current) {
      return;
    }

    const map = mapRef.current;
    const layer = layerRef.current;
    layer.clearLayers();

    const plannedLatLngs = (plannedPath ?? [])
      .filter((point) => isFiniteCoordinate(point.latitude) && isFiniteCoordinate(point.longitude))
      .map((point) => [Number(point.latitude), Number(point.longitude)]);
    const trackedLatLngs = (trackedPath ?? [])
      .filter((point) => isFiniteCoordinate(point.latitude) && isFiniteCoordinate(point.longitude))
      .map((point) => [Number(point.latitude), Number(point.longitude)]);

    if (plannedLatLngs.length) {
      L.polyline(plannedLatLngs, {
        color: "#1f5da9",
        weight: 5,
        opacity: 0.9,
        dashArray: "10 8"
      }).addTo(layer);

      L.circleMarker(plannedLatLngs[0], {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#1f5da9",
        fillOpacity: 1
      }).addTo(layer);

      L.circleMarker(plannedLatLngs[plannedLatLngs.length - 1], {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#f28c28",
        fillOpacity: 1
      }).addTo(layer);
    }

    if (trackedLatLngs.length) {
      L.polyline(trackedLatLngs, {
        color: "#22a552",
        weight: 6,
        opacity: 0.95
      }).addTo(layer);
    }

    if (latestPosition && isFiniteCoordinate(latestPosition.latitude) && isFiniteCoordinate(latestPosition.longitude)) {
      const markerColor = latestPosition.is_on_route ? "#22a552" : "#cb3f3f";

      L.circleMarker([Number(latestPosition.latitude), Number(latestPosition.longitude)], {
        radius: 11,
        color: "#ffffff",
        weight: 3,
        fillColor: markerColor,
        fillOpacity: 1
      }).addTo(layer);
    }

    const allLatLngs = [...plannedLatLngs, ...trackedLatLngs];
    if (allLatLngs.length && map) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds.pad(0.18), { animate: false, maxZoom: plannedLatLngs.length <= 1 ? 18 : 17 });
    }
  }, [focusKey, latestPosition, plannedPath, trackedPath]);

  return (
    <div className="transport-map-shell">
      <div ref={containerRef} className="map-canvas transport-map-canvas" />
      <div className="transport-map-chip">
        <strong>Zoom {zoomLevel.toFixed(2)}</strong>
        <span>{drawEnabled ? "Haz clic para trazar la calle autorizada." : "Ruta autorizada en azul y recorrido en verde."}</span>
      </div>
    </div>
  );
}

export default TransportMap;
