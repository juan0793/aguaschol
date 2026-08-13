import { extractClaveFromText, getBarrioCodeFromClave, getBarrioNameFromClave, normalizeBarrioCode } from "../utils/barrioCodes.js";

const normalizeBarrioName = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/^\s*(barrio|colonia|lotificacion|residencial)\s+/, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const mergeFieldBarrioCatalog = (...catalogs) => Array.from(catalogs.reduce((items, catalog) => {
  (Array.isArray(catalog) ? catalog : []).forEach((item) => {
    const codigo = normalizeBarrioCode(item?.codigo ?? item?.codigo_barrio);
    const barrio = String(item?.barrio ?? item?.nombre_barrio ?? "").trim();
    if (codigo && barrio && item?.activo !== false) items.set(codigo, { codigo, barrio, activo: true });
  });
  return items;
}, new Map()).values());

export const getFieldPointDate = (point = {}) =>
  String(point.diary_date || point.created_at || "").slice(0, 10);

export const getFieldPointClave = (point = {}) =>
  extractClaveFromText([point.reference_note, point.description].filter(Boolean).join(" "));

export const getFieldPointZone = (point = {}, barrios = []) => {
  const explicit = String(point.report_zone_label || point.suggested_zone || point.barrio_colonia || "").split("|")[0].trim();
  if (explicit) {
    const explicitCode = normalizeBarrioCode(explicit.match(/^\s*(\d{1,3})\s*-/)?.[1]);
    const explicitName = normalizeBarrioName(explicit.replace(/^\s*\d{1,3}\s*-\s*/, ""));
    const match = barrios.find((item) =>
      item.activo !== false && (item.codigo === explicitCode || normalizeBarrioName(item.barrio) === explicitName)
    );
    if (match) return `${match.codigo} - ${match.barrio}`;
    if (explicitCode) return `${explicitCode} - ${explicit.replace(/^\s*\d{1,3}\s*-\s*/, "")}`;
  }
  const clave = getFieldPointClave(point);
  const code = getBarrioCodeFromClave(clave);
  const name = getBarrioNameFromClave(clave, barrios);
  return name ? `${code} - ${name}` : explicit || (code ? `${code} - Barrio sin nombre` : "Sin barrio");
};

export const buildFieldZoneGroups = (points = [], barrios = []) =>
  Array.from(
    points.reduce((groups, point) => {
      const zone = getFieldPointZone(point, barrios);
      const current = groups.get(zone) || [];
      current.push(point);
      groups.set(zone, current);
      return groups;
    }, new Map()),
    ([zone, items]) => ({ zone, items, total: items.length })
  ).sort((left, right) => left.zone.localeCompare(right.zone, "es"));

export const summarizeFieldPoints = (points = [], barrios = []) => ({
  points: points.length,
  zones: new Set(points.map((point) => getFieldPointZone(point, barrios))).size,
  keys: new Set(points.map(getFieldPointClave).filter(Boolean)).size,
  technicians: new Set(points.map((point) => point.created_by_name || point.created_by_username).filter(Boolean)).size
});
