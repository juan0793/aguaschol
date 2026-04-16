import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [13.3017, -87.1889];
const DEFAULT_ZOOM = 16;
const LIVE_TRACK_ZOOM = 18.2;
const MAX_NATIVE_ZOOM = 19;
const MAX_INTERACTION_ZOOM = 21;
const TILE_CACHE_BUSTER = "transport-live-20260416";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const toLatLng = (point) => [Number(point.latitude), Number(point.longitude)];

const computeHeading = (fromPoint, toPoint) => {
  if (!fromPoint || !toPoint) {
    return 0;
  }

  const deltaLongitude = Number(toPoint.longitude) - Number(fromPoint.longitude);
  const deltaLatitude = Number(toPoint.latitude) - Number(fromPoint.latitude);
  if (!deltaLongitude && !deltaLatitude) {
    return 0;
  }

  return (Math.atan2(deltaLongitude, deltaLatitude) * 180) / Math.PI;
};

const buildVehicleIcon = (heading = 0, isOnRoute = true) =>
  L.divIcon({
    className: "transport-vehicle-shell",
    html: `
      <div class="transport-vehicle ${isOnRoute ? "is-on-route" : "is-off-route"}" style="--vehicle-rotation:${heading}deg">
        <span class="transport-vehicle-pulse"></span>
        <span class="transport-vehicle-body">
          <span class="transport-vehicle-cabin"></span>
          <span class="transport-vehicle-mark"></span>
        </span>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });

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
  const routeLayerRef = useRef(null);
  const trackedLayerRef = useRef(null);
  const draftPointLayerRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const previousVehiclePointRef = useRef(null);
  const animationFrameRef = useRef(null);
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
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true
    });

    setZoomLevel(map.getZoom());
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    L.tileLayer(tileTemplate, {
      attribution: "OpenStreetMap contributors",
      maxNativeZoom: MAX_NATIVE_ZOOM,
      maxZoom: MAX_INTERACTION_ZOOM,
      keepBuffer: 4,
      updateWhenIdle: true,
      className: "transport-base-tile"
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

    routeLayerRef.current = L.layerGroup().addTo(map);
    trackedLayerRef.current = L.layerGroup().addTo(map);
    draftPointLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        map.invalidateSize(false);
      });
    });

    resizeObserver.observe(containerRef.current);
    window.setTimeout(() => map.invalidateSize(false), 120);

    return () => {
      resizeObserver.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      routeLayerRef.current?.clearLayers();
      trackedLayerRef.current?.clearLayers();
      draftPointLayerRef.current?.clearLayers();
      vehicleMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      trackedLayerRef.current = null;
      draftPointLayerRef.current = null;
      vehicleMarkerRef.current = null;
    };
  }, [drawEnabled, editable, onMapAddPoint, tileTemplate]);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const trackedLayer = trackedLayerRef.current;
    const draftLayer = draftPointLayerRef.current;
    if (!map || !routeLayer || !trackedLayer || !draftLayer) {
      return;
    }

    routeLayer.clearLayers();
    trackedLayer.clearLayers();
    draftLayer.clearLayers();

    const plannedLatLngs = (plannedPath ?? [])
      .filter((point) => isFiniteCoordinate(point.latitude) && isFiniteCoordinate(point.longitude))
      .map(toLatLng);
    const trackedLatLngs = (trackedPath ?? [])
      .filter((point) => isFiniteCoordinate(point.latitude) && isFiniteCoordinate(point.longitude))
      .map(toLatLng);

    if (plannedLatLngs.length) {
      L.polyline(plannedLatLngs, {
        color: "#ffffff",
        weight: 18,
        opacity: 0.94,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(routeLayer);

      L.polyline(plannedLatLngs, {
        color: "#1f5da9",
        weight: 10,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round",
        dashArray: editable ? "14 10" : null
      }).addTo(routeLayer);

      plannedLatLngs.forEach((latLng, index) => {
        L.circleMarker(latLng, {
          radius: index === 0 || index === plannedLatLngs.length - 1 ? 8 : 5,
          color: "#ffffff",
          weight: 2,
          fillColor: index === plannedLatLngs.length - 1 ? "#f28c28" : "#1f5da9",
          fillOpacity: 1
        }).addTo(draftLayer);
      });
    }

    if (trackedLatLngs.length) {
      L.polyline(trackedLatLngs, {
        color: "rgba(34,165,82,0.28)",
        weight: 18,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(trackedLayer);

      L.polyline(trackedLatLngs, {
        color: "#1eb356",
        weight: 9,
        opacity: 0.98,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(trackedLayer);
    }

    const allLatLngs = [...plannedLatLngs, ...trackedLatLngs];
    if (!latestPosition && allLatLngs.length) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds.pad(0.16), { animate: false, maxZoom: 17.5 });
    }
  }, [editable, focusKey, latestPosition, plannedPath, trackedPath]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !latestPosition || !isFiniteCoordinate(latestPosition.latitude) || !isFiniteCoordinate(latestPosition.longitude)) {
      return;
    }

    const currentPoint = {
      latitude: Number(latestPosition.latitude),
      longitude: Number(latestPosition.longitude)
    };
    const trackedPoints = (trackedPath ?? []).filter(
      (point) => isFiniteCoordinate(point.latitude) && isFiniteCoordinate(point.longitude)
    );
    const previousTrackedPoint = trackedPoints.length >= 2 ? trackedPoints[trackedPoints.length - 2] : previousVehiclePointRef.current;
    const heading = computeHeading(previousTrackedPoint, currentPoint);

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker(toLatLng(currentPoint), {
        icon: buildVehicleIcon(heading, Boolean(latestPosition.is_on_route)),
        zIndexOffset: 2000
      }).addTo(map);
      previousVehiclePointRef.current = currentPoint;
      map.setView(toLatLng(currentPoint), Math.max(map.getZoom(), LIVE_TRACK_ZOOM), { animate: false });
      return;
    }

    const startPoint = previousVehiclePointRef.current ?? currentPoint;
    const startLat = Number(startPoint.latitude);
    const startLng = Number(startPoint.longitude);
    const targetLat = Number(currentPoint.latitude);
    const targetLng = Number(currentPoint.longitude);
    const startedAt = performance.now();
    const duration = 1400;

    vehicleMarkerRef.current.setIcon(buildVehicleIcon(heading, Boolean(latestPosition.is_on_route)));

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const nextLat = startLat + ((targetLat - startLat) * eased);
      const nextLng = startLng + ((targetLng - startLng) * eased);

      vehicleMarkerRef.current?.setLatLng([nextLat, nextLng]);
      if (!editable) {
        map.panTo([nextLat, nextLng], { animate: false });
        if (map.getZoom() < LIVE_TRACK_ZOOM) {
          map.setZoom(LIVE_TRACK_ZOOM, { animate: false });
        }
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      previousVehiclePointRef.current = currentPoint;
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [editable, latestPosition, trackedPath]);

  return (
    <div className="transport-map-shell">
      <div ref={containerRef} className="map-canvas transport-map-canvas" />
      <div className="transport-map-chip">
        <strong>Zoom {zoomLevel.toFixed(2)}</strong>
        <span>{drawEnabled ? "Haz clic para trazar la calle autorizada." : "La ruta va ancha en azul, el recorrido real en verde y el vehiculo se anima en vivo."}</span>
      </div>
    </div>
  );
}

export default TransportMap;
