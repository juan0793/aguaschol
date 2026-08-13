import { extractClaveFromText, getBarrioCodeFromClave, getBarrioNameFromClave } from "../utils/barrioCodes.js";

export const getFieldPointDate = (point = {}) =>
  String(point.diary_date || point.created_at || "").slice(0, 10);

export const getFieldPointClave = (point = {}) =>
  extractClaveFromText([point.reference_note, point.description].filter(Boolean).join(" "));

export const getFieldPointZone = (point = {}, barrios = []) => {
  const explicit = String(point.report_zone_label || point.suggested_zone || point.barrio_colonia || "").trim();
  if (explicit) return explicit;
  const clave = getFieldPointClave(point);
  const code = getBarrioCodeFromClave(clave);
  const name = getBarrioNameFromClave(clave, barrios);
  return name ? `${code} - ${name}` : code ? `${code} - Barrio sin nombre` : "Sin barrio";
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
