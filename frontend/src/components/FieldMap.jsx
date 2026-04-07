import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [13.3017, -87.1889];
const DEFAULT_ZOOM = 14;
const TILE_CACHE_BUSTER = "osm-20260407";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

function FieldMap({
  apiUrl,
  isActive,
  mapDraft,
  mapFocusRequest,
  mapPoints,
  onDraftChange,
  onSelectPoint,
  onStatusChange,
  selectedMapPointId
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const pointLayerRef = useRef(null);
  const draftMarkerRef = useRef(null);
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
      zoomControl: true,
      preferCanvas: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false
    });

    const tileLayer = L.tileLayer(tileTemplate, {
      attribution: "OpenStreetMap contributors",
      maxZoom: 19
    });

    tileLayer.on("loading", () => {
      onStatusChange((current) => (current === "Sin conexion" ? current : "Cargando mapa"));
    });

    tileLayer.on("load", () => {
      onStatusChange((current) => (current === "GPS listo" ? current : "Sincronizado"));
    });

    tileLayer.on("tileerror", () => {
      onStatusChange("Mapa sin capa base");
    });

    tileLayer.addTo(map);
    map.on("click", (event) => {
      onDraftChange((current) => ({
        ...current,
        latitude: Number(event.latlng.lat).toFixed(6),
        longitude: Number(event.latlng.lng).toFixed(6),
        accuracy_meters: current.accuracy_meters || ""
      }));
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
      draftMarkerRef.current?.remove();
      pointLayerRef.current?.clearLayers();
      pointLayerRef.current?.remove();
      tileLayerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      pointLayerRef.current = null;
      draftMarkerRef.current = null;
    };
  }, [onDraftChange, onStatusChange, tileTemplate]);

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

      const marker = L.circleMarker([Number(point.latitude), Number(point.longitude)], {
        radius: point.id === selectedMapPointId ? 10 : 8,
        color: "#ffffff",
        weight: 2,
        fillColor: point.id === selectedMapPointId ? "#25c7f0" : "#1576d1",
        fillOpacity: 0.95
      });

      marker.on("click", () => {
        onSelectPoint(point.id);
      });

      marker.addTo(pointLayerRef.current);
    });
  }, [mapPoints, onSelectPoint, selectedMapPointId]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const latitude = Number(mapDraft.latitude);
    const longitude = Number(mapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }

    if (!draftMarkerRef.current) {
      draftMarkerRef.current = L.circleMarker([latitude, longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: "#f8b043",
        fillOpacity: 0.95
      }).addTo(mapRef.current);
    } else {
      draftMarkerRef.current.setLatLng([latitude, longitude]);
    }
  }, [mapDraft.latitude, mapDraft.longitude]);

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

    mapRef.current.setView([latitude, longitude], Number.isFinite(zoom) ? zoom : mapRef.current.getZoom(), {
      animate: false
    });
    window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize(false);
    });
  }, [mapFocusRequest]);

  return <div ref={containerRef} className="map-canvas" />;
}

export default FieldMap;
