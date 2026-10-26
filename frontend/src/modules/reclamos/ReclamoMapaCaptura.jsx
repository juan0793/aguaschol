import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_URL } from "../../config/api";
import { captureLeafletMap, waitForMapTiles } from "../../utils/leafletPrint";

// Arma fuera de la vista un mapa de calles centrado en la clave y lo devuelve como
// imagen: la ficha impresa lleva la foto, no el mapa vivo. Si algo falla devuelve "".
export default function ReclamoMapaCaptura({ clave, ubicacion, onCapture }) {
  const nodoRef = useRef(null);
  const { lat, lng } = ubicacion;

  useEffect(() => {
    const nodo = nodoRef.current;
    if (!nodo) return undefined;
    let cancelado = false;
    const mapa = L.map(nodo, { zoomControl: false, attributionControl: false, fadeAnimation: false, zoomAnimation: false });
    const calles = L.tileLayer(`${API_URL}/map-tiles/{z}/{x}/{y}.png?layer=streets`, {
      crossOrigin: true,
      maxNativeZoom: 19,
      maxZoom: 21
    }).addTo(mapa);
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: "map-print-marker-shell",
        html: '<span class="map-print-marker" style="--marker-size:14px;--marker-color:#d62828;--outline-color:#ffffff;--outline-width:3px"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }),
      keyboard: false
    }).addTo(mapa);
    mapa.setView([lat, lng], 17);

    const capturar = async () => {
      let imagen = "";
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        mapa.invalidateSize(false);
        await waitForMapTiles(nodo, [calles]);
        imagen = captureLeafletMap(nodo);
      } catch {
        imagen = "";
      }
      if (!cancelado) onCapture(clave, imagen);
    };
    capturar();

    return () => {
      cancelado = true;
      mapa.remove();
    };
  }, [clave, lat, lng, onCapture]);

  return <div ref={nodoRef} className="rc-imp-mapa-captura" aria-hidden="true" />;
}
