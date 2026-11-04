import {
  compareAlcaldiaWithAguas,
  getAlcaldiaMetaInMemory,
  getAlcaldiaVersion,
  getClaveLookupMeta,
  getMasterRecords,
  getMasterVersion
} from "./claveLookupService.js";

// Barrios de Alcaldía que no aparecen en Aguas. La cobertura se mide por clave catastral
// (las claves de Alcaldía que coinciden con una clave de Aguas), igual que "Alcaldía vs Aguas".
// Como los nombres no siempre coinciden entre padrones, cada barrio lleva además el barrio de
// Aguas con el nombre más parecido: si existe, el barrio puede estar en Aguas con otras claves.

const PALABRAS_GENERICAS = new Set([
  "bo", "barrio", "col", "colonia", "res", "residencial", "lot", "lotificacion", "urb", "urbanizacion",
  "aldea", "caserio", "sector", "proyecto", "de", "del", "la", "las", "el", "los", "y", "san", "santa"
]);

export const normalizarNombreBarrio = (texto = "") => String(texto)
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9 ]+/g, " ")
  .split(/\s+/).filter((palabra) => palabra && !PALABRAS_GENERICAS.has(palabra));

const parecido = (a, b) => {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a), sb = new Set(b);
  const comunes = [...sa].filter((palabra) => sb.has(palabra)).length;
  if (!comunes) return 0;
  // Todas las palabras propias de uno están en el otro ("Montelimar" ⊂ "Montelimar 1 y 2").
  if (comunes === Math.min(sa.size, sb.size)) return 0.75 + 0.25 * (comunes / Math.max(sa.size, sb.size));
  return comunes / new Set([...sa, ...sb]).size;
};

export const buscarParecido = (nombre, barriosAguas) => {
  const palabras = normalizarNombreBarrio(nombre);
  let mejor = null;
  for (const barrio of barriosAguas) {
    const puntaje = parecido(palabras, barrio.palabras);
    // Entre nombres que se contienen gana el barrio con más usuarios ("Montelimar 1 y 2" antes que
    // un "Res. Montelimar" con un solo usuario mal escrito).
    const nivel = puntaje >= 0.75 ? 1 : puntaje;
    const nivelMejor = mejor ? (mejor.puntaje >= 0.75 ? 1 : mejor.puntaje) : -1;
    if (puntaje >= 0.6 && (nivel > nivelMejor || (nivel === nivelMejor && barrio.usuarios > mejor.usuarios))) {
      mejor = { nombre: barrio.nombre, usuarios: barrio.usuarios, puntaje: Number(puntaje.toFixed(2)) };
    }
  }
  return mejor;
};

const masFrecuente = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
const avaluoDe = (row) => Number(row.avaluo_terreno || 0) + Number(row.avaluo_edificacion || 0);
const sectorDe = (clave = "") => String(clave).split("-").slice(0, 2).join("-");

export const resumirBarriosAlcaldia = (filas = [], barrioStats = [], masterRecords = []) => {
  const usuariosAguas = new Map();
  for (const record of masterRecords) {
    const nombre = record.barrio_colonia || "";
    if (nombre) usuariosAguas.set(nombre, (usuariosAguas.get(nombre) || 0) + 1);
  }
  const barriosAguas = [...usuariosAguas].map(([nombre, usuarios]) => ({ nombre, usuarios, palabras: normalizarNombreBarrio(nombre) }));

  const extra = new Map();
  for (const row of filas) {
    const barrio = row.barrio_comparacion;
    if (!extra.has(barrio)) extra.set(barrio, { codigos: new Map(), sectores: new Map(), urbano: 0, rural: 0, avaluo: 0, con_pago: 0 });
    const item = extra.get(barrio);
    if (row.codigo_caserio) item.codigos.set(row.codigo_caserio, (item.codigos.get(row.codigo_caserio) || 0) + 1);
    const sector = sectorDe(row.clave_catastral);
    if (sector) item.sectores.set(sector, (item.sectores.get(sector) || 0) + 1);
    if (/rural/i.test(row.naturaleza || "")) item.rural += 1; else item.urbano += 1;
    item.avaluo += avaluoDe(row);
    if (String(row.ultimo_periodo_pagado || "").trim()) item.con_pago += 1;
  }

  return barrioStats.map((stat) => {
    const item = extra.get(stat.barrio_colonia) || { codigos: new Map(), sectores: new Map(), urbano: 0, rural: 0, avaluo: 0, con_pago: 0 };
    return {
      barrio: stat.barrio_colonia,
      codigo_caserio: masFrecuente(item.codigos),
      sectores: [...item.sectores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([sector]) => sector),
      claves: stat.alcaldia_total,
      en_aguas: stat.aguas_registradas,
      sin_registrar: stat.candidatas_clandestinas,
      cobertura: stat.cobertura_aguas_pct,
      urbano: item.urbano,
      rural: item.rural,
      avaluo: Math.round(item.avaluo * 100) / 100,
      con_pago_alcaldia: item.con_pago,
      mismo_nombre_en_aguas: usuariosAguas.has(stat.barrio_colonia),
      parecido: buscarParecido(stat.barrio_colonia, barriosAguas)
    };
  }).sort((a, b) => a.cobertura - b.cobertura || b.claves - a.claves || a.barrio.localeCompare(b.barrio, "es"));
};

let cache = { version: "", datos: null };

const cruce = async () => {
  const version = `${getMasterVersion()}|${getAlcaldiaVersion()}`;
  if (cache.version !== version) {
    const resultado = await compareAlcaldiaWithAguas();
    const filas = [...resultado.candidates, ...resultado.matched_by_base, ...resultado.matched_exact];
    cache = { version, datos: { resultado, filas, barrios: resumirBarriosAlcaldia(filas, resultado.barrio_stats, getMasterRecords()) } };
  }
  return cache.datos;
};

export const getBarriosSinAguas = async () => {
  const { resultado, barrios } = await cruce();
  const alcaldia = getAlcaldiaMetaInMemory();
  const aguas = (await getClaveLookupMeta()).meta;
  return {
    ok: true,
    generado_at: new Date().toISOString(),
    alcaldia: { archivo: alcaldia.file_name || "", actualizado: alcaldia.updated_at || null, claves: resultado.summary.alcaldia_records, barrios: barrios.length },
    aguas: { actualizado: aguas.updated_at || null, usuarios: resultado.summary.aguas_records },
    barrios
  };
};

export const getClavesDeBarrioAlcaldia = async (barrio = "") => {
  const nombre = String(barrio || "").trim();
  if (!nombre) throw Object.assign(new Error("Indica el barrio."), { status: 400 });
  const { filas } = await cruce();
  const claves = filas
    .filter((row) => row.barrio_comparacion === nombre)
    .map((row) => ({
      clave_catastral: row.clave_catastral,
      clave_aguas_formato: row.clave_aguas_formato || "",
      nombre: row.nombre || "",
      direccion: row.direccion || "",
      naturaleza: row.naturaleza || "",
      avaluo: avaluoDe(row),
      ultimo_periodo_pagado: row.ultimo_periodo_pagado || "",
      en_aguas: row.match_type !== "sin_coincidencia"
    }))
    .sort((a, b) => String(a.clave_catastral).localeCompare(String(b.clave_catastral), "es", { numeric: true }));
  return { ok: true, barrio: nombre, total: claves.length, claves };
};
