// Extraccion de clave y barrio para los puntos de campo (map_points).
//
// IMPORTANTE: esta logica es el espejo exacto de frontend/src/utils/barrioCodes.js y de
// frontend/src/components/fieldControlUtils.js. map_points NO guarda la clave ni el barrio:
// ambos se derivan del texto de reference_note / description. Si estas funciones divergen de
// las del frontend, las metricas del panel dejaran de coincidir con lo que muestra el mapa.
// Cualquier cambio aqui debe replicarse alla (y viceversa) y quedar cubierto por claveField.test.mjs.

export const CLAVE_PATTERN = /\b\d{2,3}-\d{2}-\d{2}(?:-\d{2})?\b/;

// Distancia maxima para considerar dos registros de la misma clave como un duplicado de captura.
// Por encima de este umbral se reporta como posible inconsistencia territorial.
export const DUPLICATE_DISTANCE_METERS = 15;

export const GPS_ACCURACY_BUCKETS = [
  { id: "excelente", label: "Excelente", max: 5 },
  { id: "buena", label: "Buena", max: 10 },
  { id: "aceptable", label: "Aceptable", max: 20 },
  { id: "baja", label: "Baja", max: 30 },
  { id: "deficiente", label: "Deficiente", max: Infinity },
  { id: "sin_dato", label: "Sin dato de precision", max: null }
];

export const normalizeBarrioCode = (value = "") => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 2 ? digits.padStart(2, "0") : digits;
};

export const extractClaveFromText = (value = "") => String(value ?? "").match(CLAVE_PATTERN)?.[0] || "";

export const getPointClave = (point = {}) =>
  extractClaveFromText([point.reference_note, point.description].filter(Boolean).join(" "));

// Clave base = los tres primeros bloques. Es la unidad con la que el padron agrupa un inmueble
// (claveLookupService.buildBaseKey usa el mismo criterio).
export const buildClaveBase = (clave = "") => {
  const parts = String(clave ?? "").split("-").filter(Boolean);
  return parts.length >= 3 ? parts.slice(0, 3).join("-") : "";
};

export const getBarrioCodeFromClave = (clave = "") =>
  normalizeBarrioCode(String(clave ?? "").split("-").filter(Boolean)[0] || "");

export const normalizeBarrioName = (value = "") =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\s*(barrio|colonia|lotificacion|residencial)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const normalizeSearchText = (value = "") =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const buildBarrioCatalog = (barrios = []) =>
  Array.from(
    (Array.isArray(barrios) ? barrios : []).reduce((items, item) => {
      const codigo = normalizeBarrioCode(item?.codigo ?? item?.codigo_barrio);
      const barrio = String(item?.barrio ?? item?.nombre_barrio ?? "").trim();
      if (codigo && barrio && item?.activo !== false) items.set(codigo, { codigo, barrio });
      return items;
    }, new Map()).values()
  );

// Misma cascada que getFieldPointZone en el frontend: etiqueta explicita -> catalogo -> clave.
// Hoy map_points no persiste report_zone_label / suggested_zone / barrio_colonia, pero se conserva
// la rama para que un punto enriquecido (por ejemplo desde un cruce) se resuelva igual.
export const resolveFieldZone = (point = {}, catalog = []) => {
  const explicit = String(point.report_zone_label || point.suggested_zone || point.barrio_colonia || "")
    .split("|")[0]
    .trim();

  if (explicit) {
    const explicitCode = normalizeBarrioCode(explicit.match(/^\s*(\d{1,3})\s*-/)?.[1]);
    const explicitName = normalizeBarrioName(explicit.replace(/^\s*\d{1,3}\s*-\s*/, ""));
    const match = catalog.find(
      (item) => item.codigo === explicitCode || normalizeBarrioName(item.barrio) === explicitName
    );
    if (match) return { code: match.codigo, name: match.barrio, label: `${match.codigo} - ${match.barrio}` };
    if (explicitCode) {
      const name = explicit.replace(/^\s*\d{1,3}\s*-\s*/, "");
      return { code: explicitCode, name, label: `${explicitCode} - ${name}` };
    }
  }

  const clave = getPointClave(point);
  const code = getBarrioCodeFromClave(clave);
  const name = code ? catalog.find((item) => item.codigo === code)?.barrio || "" : "";

  if (name) return { code, name, label: `${code} - ${name}` };
  if (explicit) return { code, name: explicit, label: explicit };
  if (code) return { code, name: "", label: `${code} - Barrio sin nombre` };
  return { code: "", name: "", label: "Sin barrio" };
};

export const classifyGpsAccuracy = (value) => {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters <= 0) return "sin_dato";
  if (meters <= 5) return "excelente";
  if (meters <= 10) return "buena";
  if (meters <= 20) return "aceptable";
  if (meters <= 30) return "baja";
  return "deficiente";
};

const EARTH_RADIUS_METERS = 6371008.8;
const toRadians = (degrees) => (Number(degrees) * Math.PI) / 180;

// Number(null) es 0, asi que una coordenada ausente pasaria como valida: se normaliza a NaN.
const toCoordinate = (value) => (value === null || value === undefined || value === "" ? NaN : Number(value));

export const haversineMeters = (fromLat, fromLng, toLat, toLng) => {
  const lat1 = toCoordinate(fromLat);
  const lng1 = toCoordinate(fromLng);
  const lat2 = toCoordinate(toLat);
  const lng2 = toCoordinate(toLng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;

  return Number((2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))).toFixed(2));
};

export const median = (values = []) => {
  const numbers = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return 0;
  const middle = Math.floor(numbers.length / 2);
  const result = numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
  return Number(result.toFixed(2));
};

export const roundMoney = (value) => Number((Number(value) || 0).toFixed(2));
