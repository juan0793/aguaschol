import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ALERT_MAP_POINT_COLOR,
  ALERT_MAP_POINT_TYPE,
  COMMERCIAL_MAP_POINT_COLOR,
  COMMERCIAL_MAP_POINT_TYPE
} from "../constants/formsAndUi";
import { buildTileTemplate, createCachedTileLayer } from "../modules/campo/offlineTiles";
import { pointShapeSvg } from "../modules/campo/pointTypes";

const DEFAULT_CENTER = [13.3017, -87.1889];
const DEFAULT_ZOOM = 14;
const MAX_NATIVE_ZOOM = 19;
const MAX_INTERACTION_ZOOM = 21;
const MOBILE_MEDIA_QUERY = "(max-width: 768px), (pointer: coarse)";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));
// Leaflet borra _mapPane en map.remove(); invalidar un mapa ya destruido lanza '_leaflet_pos'.
const safeInvalidate = (map) => {
  if (map?._mapPane) map.invalidateSize(false);
};
const invalidateSoon = (map) => {
  const frame = window.requestAnimationFrame(() => safeInvalidate(map));
  const timers = [80, 280].map((delay) => window.setTimeout(() => safeInvalidate(map), delay));
  return () => {
    window.cancelAnimationFrame(frame);
    timers.forEach((timer) => window.clearTimeout(timer));
  };
};
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
  getMarkerColor,
  onDraftChange,
  onEditPoint,
  onSelectPoint,
  onStatusChange,
  selectedMapPointId,
  // Modo visor (Puntos GPS): la mira la dibuja la pantalla; aquí el mapa avisa su
  // centro, guarda los mosaicos para usarlos sin señal y muestra el GPS en vivo.
  visor = false,
  onAimChange,
  onReady,
  userLocation = null,
  flashPointId = null
}) {
  const onAimChangeRef = useRef(onAimChange);
  const onReadyRef = useRef(onReady);
  onAimChangeRef.current = onAimChange;
  onReadyRef.current = onReady;
  const userLayerRef = useRef(null);
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
  const tileTemplate = useMemo(() => buildTileTemplate(apiUrl), [apiUrl]);

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
      zoomControl: !visor,
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

    const tileOptions = {
      attribution: "OpenStreetMap contributors",
      maxNativeZoom: MAX_NATIVE_ZOOM,
      maxZoom: MAX_INTERACTION_ZOOM,
      keepBuffer: isMobileMap ? 1 : 3,
      updateWhenIdle: true,
      updateWhenZooming: false,
      updateInterval: isMobileMap ? 360 : 220
    };
    const tileLayer = visor ? createCachedTileLayer(L, tileTemplate, tileOptions) : L.tileLayer(tileTemplate, tileOptions);

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
    // En el visor, tocar un lugar lleva la mira ahí (y acerca si hace falta).
    const aimAt = (latlng) => {
      if (map.getZoom() < 18) map.setView(latlng, 19, { animate: true });
      else map.panTo(latlng, { animate: true, duration: 0.3, easeLinearity: 0.25 });
    };
    const emitAim = () => {
      const center = map.getCenter();
      onAimChangeRef.current?.({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() });
    };
    if (visor) {
      map.on("moveend zoomend", emitAim);
      emitAim();
    }

    map.on("click", (event) => {
      if (isMobileMap && pointerMovedRef.current) {
        pointerMovedRef.current = false;
        return;
      }
      if (visor) {
        aimAt(event.latlng);
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
      if (visor) {
        aimAt(latlng);
        return;
      }
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
    userLayerRef.current = L.layerGroup().addTo(map);
    onReadyRef.current?.({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      flyTo: (latitude, longitude, zoom = map.getZoom()) => map.flyTo([latitude, longitude], zoom, { duration: 0.6 }),
      getZoom: () => map.getZoom(),
      getBounds: () => {
        const bounds = map.getBounds();
        return { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() };
      }
    });

    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => safeInvalidate(map));
    });

    resizeObserver.observe(containerRef.current);
    const cancelInvalidate = invalidateSoon(map);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(resizeFrame);
      cancelInvalidate();
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
      if (containerRef.current) {
        L.DomEvent.off(containerRef.current, "pointerdown", handlePointerDown);
        L.DomEvent.off(containerRef.current, "pointerup", handlePointerUp);
      }
      draftMarkerRef.current?.remove();
      accuracyCircleRef.current?.remove();
      userLayerRef.current?.remove();
      userLayerRef.current = null;
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
  }, [isMobileMap, onDraftChange, onStatusChange, tileTemplate, visor]);

  useEffect(() => {
    if (!isActive || !mapRef.current) {
      return;
    }

    return invalidateSoon(mapRef.current);
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

      const markerColor = String(getMarkerColor?.(point) || point.marker_color || "#1576d1");
      const isSelected = point.id === selectedMapPointId;
      const isTerminalPoint = Boolean(point.is_terminal_point);
      if (visor) {
        const size = isSelected ? 34 : 24;
        const visorMarker = L.marker([Number(point.latitude), Number(point.longitude)], {
          keyboard: false,
          zIndexOffset: isSelected ? 1000 : point.pending ? 500 : 0,
          icon: L.divIcon({
            className: `pg-marker${point.id === flashPointId ? " is-new" : ""}${point.pending ? " is-pending" : ""}`,
            html: pointShapeSvg(point.point_type, { size, pending: point.pending, selected: isSelected }),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          })
        });
        visorMarker.on("click", () => onSelectPoint(point.id));
        visorMarker.addTo(pointLayerRef.current);
        return;
      }
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
            radius: isSelected ? 11 : 7.5,
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
  }, [flashPointId, getMarkerColor, mapPoints, onEditPoint, onSelectPoint, selectedMapPointId, visor]);

  // GPS en vivo: punto azul y círculo de precisión.
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const latitude = Number(userLocation?.latitude);
    const longitude = Number(userLocation?.longitude);
    if (!visor || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const accuracy = Number(userLocation.accuracy);
    if (Number.isFinite(accuracy) && accuracy > 0) {
      L.circle([latitude, longitude], {
        radius: accuracy,
        color: "#1465d9",
        weight: 1,
        fillColor: "#1465d9",
        fillOpacity: 0.1,
        interactive: false
      }).addTo(layer);
    }
    L.circleMarker([latitude, longitude], {
      radius: 7,
      color: "#ffffff",
      weight: 3,
      fillColor: "#1465d9",
      fillOpacity: 1,
      interactive: false
    }).addTo(layer);
  }, [userLocation?.accuracy, userLocation?.latitude, userLocation?.longitude, visor]);

  useEffect(() => {
    if (!mapRef.current || visor) {
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
  }, [mapDraft.accuracy_meters, mapDraft.latitude, mapDraft.longitude, mapDraft.point_type, visor]);

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
    const frame = window.requestAnimationFrame(() => safeInvalidate(mapRef.current));
    const timer = window.setTimeout(() => safeInvalidate(mapRef.current), 260);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
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

  if (visor) {
    return <div ref={containerRef} className="pg-map-canvas" />;
  }

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
