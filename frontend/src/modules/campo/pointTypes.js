// Tipos de punto de campo: un color y una forma por tipo, para que en el mapa se
// distingan aunque el color no se perciba bien (sol fuerte, daltonismo). Rojo y
// ámbar son los mismos de siempre porque el reporte impreso los usa para resaltar
// negocios y alertas (ver utils/mapReport.js).
import { ALERT_MAP_POINT_COLOR, COMMERCIAL_MAP_POINT_COLOR } from "../../constants/formsAndUi";

export const POINT_TYPE_STYLES = {
  caja_registro: { label: "Caja de registro", short: "Caja", color: "#1465d9", shape: "square" },
  descarga: { label: "Descarga", short: "Descarga", color: "#0f8a7e", shape: "drop" },
  pozo: { label: "Pozo de visita", short: "Pozo", color: "#0b3f73", shape: "ring" },
  negocio_local_comercial: { label: "Negocio / local comercial", short: "Negocio", color: COMMERCIAL_MAP_POINT_COLOR, shape: "diamond" },
  alerta: { label: "Alerta", short: "Alerta", color: ALERT_MAP_POINT_COLOR, shape: "triangle" },
  punto_observado: { label: "Punto observado", short: "Observado", color: "#8a4fb8", shape: "dot" }
};

export const POINT_TYPE_ORDER = Object.keys(POINT_TYPE_STYLES);
const FALLBACK = { label: "Punto", short: "Punto", color: "#1465d9", shape: "dot" };

export const getPointTypeStyle = (type) => POINT_TYPE_STYLES[type] || FALLBACK;

// Trazo de cada forma en una caja de 24×24. Sirve para el marcador del mapa
// (divIcon) y para las fichas de tipo, así ambos hablan el mismo idioma.
const SHAPE_PATHS = {
  square: '<rect x="5" y="5" width="14" height="14" rx="2.5"/>',
  drop: '<path d="M12 3.5c3.6 4.3 6 7.5 6 10.3a6 6 0 0 1-12 0c0-2.8 2.4-6 6-10.3z"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3" fill="#fff" stroke="none"/>',
  diamond: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>',
  triangle: '<path d="M12 4 21 19.5H3z"/><path d="M12 9.5v4.5M12 16.6v.4" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>',
  dot: '<circle cx="12" cy="12" r="6.5"/>'
};

export const pointShapeSvg = (type, { size = 22, pending = false, selected = false } = {}) => {
  const { color, shape } = getPointTypeStyle(type);
  const fill = pending ? "#ffffff" : color;
  const halo = selected ? `<circle cx="12" cy="12" r="11.2" fill="none" stroke="${color}" stroke-width="1.6" opacity=".55"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${halo}<g fill="${fill}" stroke="${pending ? color : "#ffffff"}" stroke-width="${pending ? 2.4 : 1.8}" stroke-linejoin="round"${pending ? ' stroke-dasharray="3 2"' : ""}>${SHAPE_PATHS[shape] || SHAPE_PATHS.dot}</g></svg>`;
};
