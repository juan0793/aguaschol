// Claves de Alcaldía que no aparecen en Aguas, agrupadas por barrio. El barrio
// es barrio_comparacion (lo pone el backend), el mismo con el que se calcula la
// brecha de cada barrio, así que los conteos cuadran con barrio_stats.
//
// Son decenas de miles de claves: el índice (grupos, orden y texto de búsqueda
// ya normalizado) se arma una sola vez; buscar solo recorre textos listos.

export const normalizeText = (value = "") =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const claveBarrio = (row = {}) =>
  String(row.barrio_comparacion || row.caserio || row.direccion || "").trim() || "Sin barrio";

const byClave = (left, right) => String(left.row.clave_catastral).localeCompare(String(right.row.clave_catastral), "es", { numeric: true });

/** Índice por barrio, de más claves a menos. Cada entrada guarda su texto de búsqueda. */
export const buildClavesIndex = (rows = []) => {
  const groups = new Map();
  rows.forEach((row) => {
    const barrio = claveBarrio(row);
    const group = groups.get(barrio) ?? { barrio, entries: [] };
    group.entries.push({
      row,
      text: normalizeText([row.clave_catastral, row.clave_aguas_formato, row.nombre, row.identificador, row.direccion, barrio].filter(Boolean).join(" "))
    });
    groups.set(barrio, group);
  });
  return [...groups.values()]
    .map((group) => ({ barrio: group.barrio, total: group.entries.length, entries: group.entries.sort(byClave) }))
    .sort((left, right) => right.total - left.total || left.barrio.localeCompare(right.barrio, "es"));
};

/**
 * Filtra el índice. Todas las palabras de la búsqueda deben aparecer (en
 * cualquier orden): "nunez bertilia" encuentra a Núñez en Villa Bertilia.
 * Devuelve { barrio, total, rows } solo de los barrios con coincidencias.
 */
export const filterClavesIndex = (index = [], query = "") => {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (!words.length) return index.map((group) => ({ barrio: group.barrio, total: group.total, rows: group.entries.map((entry) => entry.row) }));
  const result = [];
  index.forEach((group) => {
    const rows = [];
    group.entries.forEach((entry) => { if (words.every((word) => entry.text.includes(word))) rows.push(entry.row); });
    if (rows.length) result.push({ barrio: group.barrio, total: group.total, rows });
  });
  return result.sort((left, right) => right.rows.length - left.rows.length || left.barrio.localeCompare(right.barrio, "es"));
};

export const groupClavesByBarrio = (rows = [], { query = "" } = {}) => filterClavesIndex(buildClavesIndex(rows), query);
