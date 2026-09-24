// Claves de Alcaldía que no aparecen en Aguas, agrupadas por barrio. El barrio
// es barrio_comparacion (lo pone el backend), el mismo con el que se calcula la
// brecha de cada barrio, así que los conteos cuadran con barrio_stats.

export const normalizeText = (value = "") =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const claveBarrio = (row = {}) =>
  String(row.barrio_comparacion || row.caserio || row.direccion || "").trim() || "Sin barrio";

const searchText = (row) =>
  row.search_target || normalizeText([row.clave_catastral, row.clave_aguas_formato, row.nombre, row.identificador, row.direccion, row.caserio].filter(Boolean).join(" "));

/**
 * Agrupa las claves por barrio, de más claves a menos (y por nombre).
 * - query: filtra por clave, nombre, identidad, dirección o barrio.
 * - barrio: deja solo ese barrio.
 * Cada grupo trae total (todas las claves del barrio) y rows (las que pasan el filtro).
 */
export const groupClavesByBarrio = (rows = [], { query = "", barrio = "" } = {}) => {
  const text = normalizeText(query);
  const groups = new Map();
  rows.forEach((row) => {
    const name = claveBarrio(row);
    if (barrio && name !== barrio) return;
    const group = groups.get(name) ?? { barrio: name, total: 0, rows: [] };
    group.total += 1;
    if (!text || searchText(row).includes(text) || normalizeText(name).includes(text)) group.rows.push(row);
    groups.set(name, group);
  });
  return [...groups.values()]
    .filter((group) => group.rows.length)
    .map((group) => ({ ...group, rows: group.rows.sort((left, right) => String(left.clave_catastral).localeCompare(String(right.clave_catastral), "es")) }))
    .sort((left, right) => right.rows.length - left.rows.length || left.barrio.localeCompare(right.barrio, "es"));
};
