import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_URL } from "../../../config/api";
import { captureLeafletMap, waitForMapTiles } from "../../../utils/leafletPrint";

const COLORS = { inicio: "#0d6efd", observado: "#7c3aed", derivacion: "#dc3545", cierre: "#198754" };

export default function InspeccionPrintMapCapture({ points = [], onCapture }) {
  const nodeRef = useRef(null);
  const validPoints = useMemo(
    () => points.filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))),
    [points]
  );

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !validPoints.length) {
      onCapture("");
      return undefined;
    }

    let cancelled = false;
    const map = L.map(node, { zoomControl: false, attributionControl: false, fadeAnimation: false, zoomAnimation: false });
    const tiles = L.tileLayer(`${API_URL}/map-tiles/{z}/{x}/{y}.png?layer=streets`, {
      crossOrigin: true,
      maxNativeZoom: 19,
      maxZoom: 21
    }).addTo(map);

    validPoints.forEach((point, index) => {
      const color = COLORS[point.tipo_punto] || "#1576d1";
      L.marker([Number(point.latitude), Number(point.longitude)], {
        icon: L.divIcon({
          className: "map-print-marker-shell",
          html: `<span class="map-print-marker" style="--marker-size:22px;--marker-color:${color};--outline-color:#ffffff;--outline-width:4px">${index + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }),
        keyboard: false
      }).addTo(map);
    });

    const bounds = L.latLngBounds(validPoints.map((point) => [Number(point.latitude), Number(point.longitude)]));
    if (validPoints.length === 1) map.setView(bounds.getCenter(), 18);
    else map.fitBounds(bounds, { padding: [70, 70], maxZoom: 19 });

    const prepare = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      map.invalidateSize(false);
      await waitForMapTiles(node, [tiles]);
      if (!cancelled) onCapture(captureLeafletMap(node, { connectMarkers: true }));
    };
    prepare();

    return () => {
      cancelled = true;
      map.remove();
    };
  }, [onCapture, validPoints]);

  return <div ref={nodeRef} className="ins-print-map-capture" aria-hidden="true" />;
}
