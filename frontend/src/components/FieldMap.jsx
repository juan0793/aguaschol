import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ALERT_MAP_POINT_COLOR,
  ALERT_MAP_POINT_TYPE,
  COMMERCIAL_MAP_POINT_COLOR,
  COMMERCIAL_MAP_POINT_TYPE
} from "../constants/formsAndUi";

const DEFAULT_CENTER = [13.3017, -87.1889];
const DEFAULT_ZOOM = 14;
const MAX_NATIVE_ZOOM = 19;
const MAX_INTERACTION_ZOOM = 21;
const TILE_CACHE_BUSTER = "osm-20260407";
const MOBILE_MEDIA_QUERY = "(max-width: 768px), (pointer: coarse)";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));
const getDraftMarkerColor = (draft = {}) => {
  if (draft.point_type === COMMERCIAL_MAP_POINT_TYPE) return COMMERCIAL_MAP_POINT_COLOR;
  if (draft.point_type === ALERT_MAP_POINT_TYPE) return ALERT_MAP_POINT_COLOR;
  return draft.marker_color || "#f8b043";
};

function FieldMap({
  apiUrl,
  isActive,
  mapDraft,
  mapFocusRequest,
  mapPoints,
  onDraftChange,
  onEditPoint,
  onSelectPoint,
  onStatusChange,
  selectedMapPointId
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const pointLayerRef = useRef(null);
  const draftMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const statusTimerRef = useRef(null);
  const pointerDownRef = useRef(null);
  const pointerMovedRef = useRef(false);
  const [isMobileMap, setIsMobileMap] = useState(() => window.matchMedia?.(MOBILE_MEDIA_QUERY).matches ?? false);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const tileTemplate = useMemo(
    () => `${apiUrl}/map-tiles/{z}/{x}/{y}.png?v=${encodeURIComponent(TILE_CACHE_BUSTER)}`,
    [apiUrl]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(MOBILE_MEDIA_QUERY);
    if (!mediaQuery) return undefined;

    const handleChange = () => setIsMobileMap(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: MAX_INTERACTION_ZOOM,
      zoomSnap: isMobileMap ? 0.5 : 0.25,
      zoomDelta: isMobileMap ? 0.75 : 0.5,
      wheelPxPerZoomLevel: 90,
      zoomControl: true,
      preferCanvas: true,
      doubleClickZoom: false,
      tapTolerance: isMobileMap ? 10 : 15,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      bounceAtZoomLimits: false
    });
    setZoomLevel(map.getZoom());
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    const tileLayer = L.tileLayer(tileTemplate, {
      attribution: "OpenStreetMap contributors",
      maxNativeZoom: MAX_NATIVE_ZOOM,
      maxZoom: MAX_INTERACTION_ZOOM,
      keepBuffer: isMobileMap ? 1 : 3,
      updateWhenIdle: true,
      updateWhenZooming: false,
      updateInterval: isMobileMap ? 360 : 220
    });

    tileLayer.on("loading", () => {
      if (statusTimerRef.current) return;
      statusTimerRef.current = window.setTimeout(() => {
        statusTimerRef.current = null;
        onStatusChange((current) => (current === "Sin conexion" ? current : "Cargando mapa"));
      }, 180);
    });

    tileLayer.on("load", () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
      onStatusChange((current) => (current === "GPS listo" ? current : "Sincronizado"));
    });

    tileLayer.on("tileerror", () => {
      onStatusChange("Mapa sin capa base");
    });

    tileLayer.addTo(map);
    const updateDraftFromLatLng = (latlng) => {
      onDraftChange((current) => ({
        ...current,
        latitude: Number(latlng.lat).toFixed(6),
        longitude: Number(latlng.lng).toFixed(6),
        accuracy_meters: current.accuracy_meters || ""
      }));
    };

    map.on("movestart", () => {
      pointerMovedRef.current = true;
    });
    map.on("click", (event) => {
      if (isMobileMap && pointerMovedRef.current) {
        pointerMovedRef.current = false;
        return;
      }
      updateDraftFromLatLng(event.latlng);
      const precisionZoom = Math.max(map.getZoom(), 19.25);
      if (map.getZoom() < precisionZoom) {
        map.setView(event.latlng, precisionZoom, { animate: false });
      } else {
        map.panTo(event.latlng, { animate: true, duration: 0.3, easeLinearity: 0.25 });
      }
    });
    const handlePointerDown = (event) => {
      if (!isMobileMap) return;
      pointerDownRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      };
      pointerMovedRef.current = false;
    };
    const handlePointerUp = (event) => {
      if (!isMobileMap || !pointerDownRef.current) return;
      const start = pointerDownRef.current;
      pointerDownRef.current = null;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      const elapsed = Date.now() - start.time;
      if (distance > 10 || elapsed > 700) {
        return;
      }

      const latlng = map.mouseEventToLatLng(event);
      updateDraftFromLatLng(latlng);
      map.panTo(latlng, { animate: false });
    };
    L.DomEvent.on(containerRef.current, "pointerdown", handlePointerDown);
    L.DomEvent.on(containerRef.current, "pointerup", handlePointerUp);
    map.on("zoomend", () => {
      setZoomLevel(map.getZoom());
    });

    mapRef.current = map;
    tileLayerRef.current = tileLayer;
    pointLayerRef.current = L.layerGroup().addTo(map);

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        map.invalidateSize(false);
      });
    });

    resizeObserver.observe(containerRef.current);
    window.setTimeout(() => map.invalidateSize(false), 120);

    return () => {
      resizeObserver.disconnect();
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
      if (containerRef.current) {
        L.DomEvent.off(containerRef.current, "pointerdown", handlePointerDown);
        L.DomEvent.off(containerRef.current, "pointerup", handlePointerUp);
      }
      draftMarkerRef.current?.remove();
      accuracyCircleRef.current?.remove();
      pointLayerRef.current?.clearLayers();
      pointLayerRef.current?.remove();
      tileLayerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      pointLayerRef.current = null;
      draftMarkerRef.current = null;
      accuracyCircleRef.current = null;
      statusTimerRef.current = null;
    };
  }, [isMobileMap, onDraftChange, onStatusChange, tileTemplate]);

  useEffect(() => {
    if (!isActive || !mapRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize(false);
    });
  }, [isActive]);

  useEffect(() => {
    if (!pointLayerRef.current) {
      return;
    }

    pointLayerRef.current.clearLayers();

    mapPoints.forEach((point) => {
      if (!isFiniteCoordinate(point.latitude) || !isFiniteCoordinate(point.longitude)) {
        return;
      }

      const markerColor = String(point.marker_color || "#1576d1");
      const isSelected = point.id === selectedMapPointId;
      const isTerminalPoint = Boolean(point.is_terminal_point);
      const marker = isTerminalPoint
        ? L.marker([Number(point.latitude), Number(point.longitude)], {
            icon: L.divIcon({
              className: "field-map-pin-shell",
              html: `
                <div class="field-map-pin ${isSelected ? "is-selected" : ""}" style="--pin-color:${markerColor}">
                  <span></span>
                </div>
              `,
              iconSize: [22, 30],
              iconAnchor: [11, 26]
            })
          })
        : L.circleMarker([Number(point.latitude), Number(point.longitude)], {
            radius: isSelected ? 10 : 8,
            color: "#ffffff",
            weight: 2,
            fillColor: markerColor,
            fillOpacity: 0.95
          });

      marker.on("click", () => {
        onSelectPoint(point.id);
      });
      marker.on("dblclick", () => {
        onEditPoint?.(point.id);
      });

      marker.addTo(pointLayerRef.current);
    });
  }, [mapPoints, onEditPoint, onSelectPoint, selectedMapPointId]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const latitude = Number(mapDraft.latitude);
    const longitude = Number(mapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      draftMarkerRef.current?.remove();
      accuracyCircleRef.current?.remove();
      draftMarkerRef.current = null;
      accuracyCircleRef.current = null;
      return;
    }

    const accuracyMeters = Number(mapDraft.accuracy_meters);

    if (!draftMarkerRef.current) {
      draftMarkerRef.current = L.circleMarker([latitude, longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: getDraftMarkerColor(mapDraft),
        fillOpacity: 0.95
      }).addTo(mapRef.current);
    } else {
      draftMarkerRef.current.setLatLng([latitude, longitude]);
      draftMarkerRef.current.setStyle({
        fillColor: getDraftMarkerColor(mapDraft)
      });
    }

    if (Number.isFinite(accuracyMeters) && accuracyMeters > 0) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle([latitude, longitude], {
          radius: accuracyMeters,
          color: "#1576d1",
          weight: 1.5,
          fillColor: "#25c7f0",
          fillOpacity: 0.12
        }).addTo(mapRef.current);
      } else {
        accuracyCircleRef.current.setLatLng([latitude, longitude]);
        accuracyCircleRef.current.setRadius(accuracyMeters);
      }
    } else {
      accuracyCircleRef.current?.remove();
      accuracyCircleRef.current = null;
    }
  }, [mapDraft.accuracy_meters, mapDraft.latitude, mapDraft.longitude, mapDraft.point_type]);

  useEffect(() => {
    if (!mapRef.current || !mapFocusRequest) {
      return;
    }

    const latitude = Number(mapFocusRequest.latitude);
    const longitude = Number(mapFocusRequest.longitude);
    const zoom = Number(mapFocusRequest.zoom);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const targetZoom = Number.isFinite(zoom)
      ? Math.min(Math.max(zoom, DEFAULT_ZOOM), MAX_INTERACTION_ZOOM)
      : mapRef.current.getZoom();
    if (mapRef.current.getZoom() !== targetZoom) {
      mapRef.current.setZoom(targetZoom, { animate: false });
    }
    mapRef.current.panTo([latitude, longitude], {
      animate: true,
      duration: 0.45,
      easeLinearity: 0.25
    });
    window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize(false);
    });
    window.setTimeout(() => {
      mapRef.current?.invalidateSize(false);
    }, 260);
  }, [mapFocusRequest]);

  const handleSetDraftToMapCenter = () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    onDraftChange((current) => ({
      ...current,
      latitude: Number(center.lat).toFixed(6),
      longitude: Number(center.lng).toFixed(6),
      accuracy_meters: current.accuracy_meters || ""
    }));
    onStatusChange("Punto fijado");
  };

  return (
    <div className="map-canvas-shell">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-precision-overlay" aria-hidden="true">
        <span className="map-precision-crosshair" />
      </div>
      <div className="map-precision-chip">
        <strong>Zoom {zoomLevel.toFixed(2)}</strong>
        <span>{zoomLevel >= 19 ? "Modo precision activo" : "Acerca un poco mas para afinar la casa"}</span>
      </div>
      {isMobileMap ? (
        <button type="button" className="map-center-pin-button" onClick={handleSetDraftToMapCenter}>
          Fijar punto aqui
        </button>
      ) : null}
    </div>
  );
}

export default FieldMap;
