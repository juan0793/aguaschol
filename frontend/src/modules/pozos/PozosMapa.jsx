import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_URL } from "../../config/api";
import { escapeHtml } from "../../utils/html";
import { CALIDADES, calidadDe, formatoNumero } from "./pozosFiltros";

const CAPAS = {
  imagery: { label: "Satélite", attribution: "Esri, Maxar, Earthstar Geographics" },
  streets: { label: "Calles", attribution: "OpenStreetMap contributors" }
};
const CENTRO_CHOLUTECA = [13.3017, -87.1889];

const icono = (pozo, activo) => {
  const tono = `is-${calidadDe(pozo)}`;
  const tamano = activo ? 22 : 14;
  return L.divIcon({
    className: "pz-pin-shell",
    html: `<span class="pz-pin ${tono}${activo ? " is-activo" : ""}"></span>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2]
  });
};

// El color del punto es su calidad (la misma de la lista y los gráficos).
const lecturaDe = (pozo) => {
  const medidas = [pozo.ph != null ? `pH ${formatoNumero(pozo.ph, 2)}` : "", pozo.tds_g_l != null ? `TDS ${formatoNumero(pozo.tds_g_l, 3)} g/L` : ""].filter(Boolean).join(" · ");
  const calidad = CALIDADES.find((item) => item.clave === calidadDe(pozo))?.label;
  return `<strong>${escapeHtml(pozo.codigo)}</strong> · ${escapeHtml(pozo.nombre || "Sin nombre")}<br><span>${escapeHtml(medidas ? `${medidas} · ${calidad}` : calidad)}${pozo.en_uso ? "" : " · sin dato de uso"}</span>`;
};

// Mapa de la pantalla Pozos: mosaicos por /api/map-tiles (como Puntos GPS), un círculo por pozo
// y el elegido más grande. Al cambiar los filtros se encuadran los pozos visibles.
export default function PozosMapa({ pozos, seleccionadoId, onSeleccionar, compacto = false }) {
  const nodoRef = useRef(null);
  const mapaRef = useRef(null);
  const baseRef = useRef(null);
  const rotulosRef = useRef(null);
  const marcadoresRef = useRef(new Map());
  const grupoRef = useRef(null);
  const [capa, setCapa] = useState("imagery");

  useEffect(() => {
    const mapa = L.map(nodoRef.current, { center: CENTRO_CHOLUTECA, zoom: 14, maxZoom: 20, zoomControl: true, attributionControl: true });
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(mapa);
    grupoRef.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;
    const observador = new ResizeObserver(() => mapa.invalidateSize(false));
    observador.observe(nodoRef.current);
    return () => {
      observador.disconnect();
      mapa.remove();
      mapaRef.current = null;
      marcadoresRef.current = new Map();
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    baseRef.current?.remove();
    rotulosRef.current?.remove();
    baseRef.current = L.tileLayer(`${API_URL}/map-tiles/{z}/{x}/{y}.png?layer=${capa}`, {
      attribution: CAPAS[capa].attribution, crossOrigin: true, maxNativeZoom: 19, maxZoom: 20
    }).addTo(mapa);
    if (capa === "imagery") {
      rotulosRef.current = L.tileLayer(`${API_URL}/map-tiles/{z}/{x}/{y}.png?layer=labels`, {
        attribution: "Esri", crossOrigin: true, maxNativeZoom: 19, maxZoom: 20, pane: "overlayPane"
      }).addTo(mapa);
    }
  }, [capa]);

  // Marcadores: se rehacen solo cuando cambia la lista filtrada.
  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = grupoRef.current;
    if (!mapa || !grupo) return;
    grupo.clearLayers();
    const marcadores = new Map();
    pozos.forEach((pozo) => {
      const marcador = L.marker([pozo.latitud, pozo.longitud], { icon: icono(pozo, false), keyboard: false, riseOnHover: true });
      marcador.bindTooltip(lecturaDe(pozo), { direction: "top", offset: [0, -8], className: "pz-tooltip" });
      marcador.on("click", () => onSeleccionar(pozo.id));
      marcador.addTo(grupo);
      marcadores.set(pozo.id, { marcador, pozo });
    });
    marcadoresRef.current = marcadores;
    if (pozos.length > 1) {
      mapa.fitBounds(L.latLngBounds(pozos.map((pozo) => [pozo.latitud, pozo.longitud])), { padding: [36, 36], maxZoom: 17 });
    } else if (pozos.length === 1) {
      mapa.setView([pozos[0].latitud, pozos[0].longitud], 17);
    }
  }, [pozos, onSeleccionar]);

  // Elegido: más grande, encima de los demás y a la vista.
  useEffect(() => {
    marcadoresRef.current.forEach(({ marcador, pozo }, id) => {
      const activo = id === seleccionadoId;
      marcador.setIcon(icono(pozo, activo));
      marcador.setZIndexOffset(activo ? 1000 : 0);
      if (activo) {
        const mapa = mapaRef.current;
        const destino = L.latLng(pozo.latitud, pozo.longitud);
        if (mapa && !mapa.getBounds().pad(-0.15).contains(destino)) mapa.panTo(destino);
      }
    });
  }, [seleccionadoId, pozos]);

  return <div className={`pz-mapa${compacto ? " is-compacto" : ""}`}>
    <div ref={nodoRef} className="pz-mapa-lienzo" role="region" aria-label={compacto ? "Ubicación del pozo" : "Mapa de pozos"} />
    <div className="pz-capas" role="group" aria-label="Fondo del mapa">
      {Object.entries(CAPAS).map(([clave, info]) => <button type="button" key={clave} className={capa === clave ? "is-activo" : ""} aria-pressed={capa === clave} onClick={() => setCapa(clave)}>{info.label}</button>)}
    </div>
    {compacto ? null : <div className="pz-leyenda" aria-hidden="true">
      {CALIDADES.map((calidad) => <span key={calidad.clave}><i className={`pz-pin is-${calidad.clave}`} />{calidad.label}</span>)}
    </div>}
  </div>;
}
