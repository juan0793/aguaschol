import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const DEFAULT_CENTER = [-87.1889, 13.3017];
const DEFAULT_ZOOM = 16;
const LIVE_TRACK_ZOOM = 18.3;
const TRANSPORT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const PLANNED_SOURCE_ID = "transport-planned-route";
const TRACKED_SOURCE_ID = "transport-tracked-route";
const POINTS_SOURCE_ID = "transport-route-points";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const toCoordinate = (point) => [Number(point.longitude), Number(point.latitude)];

const toFeatureCollection = (points = []) => ({
  type: "FeatureCollection",
  features: points.map((point, index) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: toCoordinate(point)
    },
    properties: {
      index,
      is_terminal: index === points.length - 1
    }
  }))
});

const toLineFeature = (points = []) => ({
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: points.map(toCoordinate)
  },
  properties: {}
});

const computeHeading = (fromPoint, toPoint) => {
  if (!fromPoint || !toPoint) return 0;

  const deltaLongitude = Number(toPoint.longitude) - Number(fromPoint.longitude);
  const deltaLatitude = Number(toPoint.latitude) - Number(fromPoint.latitude);
  if (!deltaLongitude && !deltaLatitude) return 0;

  return (Math.atan2(deltaLongitude, deltaLatitude) * 180) / Math.PI;
};

const buildVehicleElement = ({ isOnRoute = true, heading = 0 } = {}) => {
  const wrapper = document.createElement("div");
  wrapper.className = "transport-vehicle-shell";
  wrapper.innerHTML = `
    <div class="transport-vehicle ${isOnRoute ? "is-on-route" : "is-off-route"}" style="--vehicle-rotation:${heading}deg">
      <span class="transport-vehicle-pulse"></span>
      <span class="transport-vehicle-body">
        <span class="transport-vehicle-cabin"></span>
        <span class="transport-vehicle-mark"></span>
      </span>
    </div>
  `;
  return wrapper;
};

const paintVehicleElement = (element, { isOnRoute = true, heading = 0 } = {}) => {
  if (!element) return;
  element.className = "transport-vehicle-shell";
  element.innerHTML = buildVehicleElement({ isOnRoute, heading }).innerHTML;
};

function TransportMap({
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
  const markerRef = useRef(null);
  const previousVehiclePointRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [mapReady, setMapReady] = useState(false);

  const safePlannedPath = useMemo(
    () => (plannedPath ?? []).filter((point) => isFiniteCoordinate(point.latitude) && isFiniteCoordinate(point.longitude)),
    [plannedPath]
  );
  const safeTrackedPath = useMemo(
    () => (trackedPath ?? []).filter((point) => isFiniteCoordinate(point.latitude) && isFiniteCoordinate(point.longitude)),
    [trackedPath]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TRANSPORT_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: 20.5,
      pitch: 28,
      bearing: -8,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      map.addSource(PLANNED_SOURCE_ID, {
        type: "geojson",
        data: toLineFeature([])
      });
      map.addSource(TRACKED_SOURCE_ID, {
        type: "geojson",
        data: toLineFeature([])
      });
      map.addSource(POINTS_SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection([])
      });

      map.addLayer({
        id: "transport-planned-route-outline",
        type: "line",
        source: PLANNED_SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 10,
            16, 16,
            19, 22
          ],
          "line-opacity": 0.95
        },
        layout: {
          "line-cap": "round",
          "line-join": "round"
        }
      });

      map.addLayer({
        id: "transport-planned-route",
        type: "line",
        source: PLANNED_SOURCE_ID,
        paint: {
          "line-color": "#1d5fd0",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 6,
            16, 10,
            19, 14
          ],
          "line-dasharray": editable ? [1.4, 1] : [1, 0],
          "line-opacity": 0.96
        },
        layout: {
          "line-cap": "round",
          "line-join": "round"
        }
      });

      map.addLayer({
        id: "transport-tracked-route-glow",
        type: "line",
        source: TRACKED_SOURCE_ID,
        paint: {
          "line-color": "rgba(30,179,86,0.26)",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 12,
            16, 18,
            19, 24
          ],
          "line-opacity": 1
        },
        layout: {
          "line-cap": "round",
          "line-join": "round"
        }
      });

      map.addLayer({
        id: "transport-tracked-route",
        type: "line",
        source: TRACKED_SOURCE_ID,
        paint: {
          "line-color": "#19b655",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 5,
            16, 9,
            19, 12
          ],
          "line-opacity": 0.98
        },
        layout: {
          "line-cap": "round",
          "line-join": "round"
        }
      });

      map.addLayer({
        id: "transport-route-points",
        type: "circle",
        source: POINTS_SOURCE_ID,
        paint: {
          "circle-radius": [
            "case",
            ["boolean", ["get", "is_terminal"], false],
            7,
            5
          ],
          "circle-color": [
            "case",
            ["boolean", ["get", "is_terminal"], false],
            "#f28c28",
            "#1d5fd0"
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });

      setMapReady(true);
      setZoomLevel(map.getZoom());
    });

    map.on("click", (event) => {
      if (!editable || !drawEnabled) return;
      onMapAddPoint?.({
        latitude: Number(event.lngLat.lat.toFixed(7)),
        longitude: Number(event.lngLat.lng.toFixed(7))
      });
    });

    map.on("zoomend", () => {
      setZoomLevel(map.getZoom());
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        map.resize();
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
  }, [drawEnabled, editable, onMapAddPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    map.getSource(PLANNED_SOURCE_ID)?.setData(toLineFeature(safePlannedPath));
    map.getSource(TRACKED_SOURCE_ID)?.setData(toLineFeature(safeTrackedPath));
    map.getSource(POINTS_SOURCE_ID)?.setData(toFeatureCollection(safePlannedPath));

    const latestFeaturePoint =
      latestPosition && isFiniteCoordinate(latestPosition.latitude) && isFiniteCoordinate(latestPosition.longitude)
        ? { latitude: Number(latestPosition.latitude), longitude: Number(latestPosition.longitude) }
        : safePlannedPath[0] ?? null;

    const bounds = new maplibregl.LngLatBounds();
    [...safePlannedPath, ...safeTrackedPath].forEach((point) => bounds.extend(toCoordinate(point)));
    if (latestFeaturePoint) {
      bounds.extend(toCoordinate(latestFeaturePoint));
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 70, right: 40, bottom: 70, left: 40 },
        duration: 0,
        maxZoom: latestPosition ? LIVE_TRACK_ZOOM : 17.6
      });
    }
  }, [focusKey, latestPosition, mapReady, safePlannedPath, safeTrackedPath]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const currentPoint =
      latestPosition && isFiniteCoordinate(latestPosition.latitude) && isFiniteCoordinate(latestPosition.longitude)
        ? { latitude: Number(latestPosition.latitude), longitude: Number(latestPosition.longitude) }
        : safePlannedPath[0] ?? null;

    if (!currentPoint) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const previousTrackedPoint = safeTrackedPath.length >= 2
      ? safeTrackedPath[safeTrackedPath.length - 2]
      : previousVehiclePointRef.current;
    const heading = computeHeading(previousTrackedPoint, currentPoint);
    const isOnRoute = latestPosition ? Boolean(latestPosition.is_on_route) : true;

    if (!markerRef.current) {
      const markerElement = buildVehicleElement({ isOnRoute, heading });
      markerRef.current = new maplibregl.Marker({
        element: markerElement,
        anchor: "center"
      })
        .setLngLat(toCoordinate(currentPoint))
        .addTo(map);
      previousVehiclePointRef.current = currentPoint;
      return;
    }

    paintVehicleElement(markerRef.current.getElement(), { isOnRoute, heading });

    const startPoint = previousVehiclePointRef.current ?? currentPoint;
    const startedAt = performance.now();
    const duration = latestPosition ? 1200 : 0;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = (now) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const nextLongitude =
        Number(startPoint.longitude) + ((Number(currentPoint.longitude) - Number(startPoint.longitude)) * eased);
      const nextLatitude =
        Number(startPoint.latitude) + ((Number(currentPoint.latitude) - Number(startPoint.latitude)) * eased);

      markerRef.current?.setLngLat([nextLongitude, nextLatitude]);

      if (latestPosition && !editable) {
        map.easeTo({
          center: [nextLongitude, nextLatitude],
          zoom: Math.max(map.getZoom(), LIVE_TRACK_ZOOM),
          duration: 0
        });
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      previousVehiclePointRef.current = currentPoint;
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [editable, latestPosition, mapReady, safePlannedPath, safeTrackedPath]);

  return (
    <div className="transport-map-shell">
      <div ref={containerRef} className="transport-map-canvas transport-maplibre-canvas" />
      <div className="transport-map-chip">
        <strong>Zoom {zoomLevel.toFixed(2)}</strong>
        <span>
          {drawEnabled
            ? "Haz clic para trazar la calle autorizada."
            : "Calles vectoriales, ruta autorizada ancha en azul y vehiculo visible aunque todavia no tenga reporte en vivo."}
        </span>
      </div>
    </div>
  );
}

export default TransportMap;
