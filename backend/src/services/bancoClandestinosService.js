import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { getAlcaldiaRecords, getMasterRecords, getMasterVersion } from "./claveLookupService.js";
import { createInmueble, getByClave } from "./inmuebleService.js";
import { likeValue } from "../utils/normalize.js";
import { emitProfileMessage } from "./profileRealtimeService.js";

// Banco de clandestinos: puntos levantados en campo que todavia no son fichas.
// Cada candidato se verifica contra el padron activo de Aguas y el de Alcaldia:
// si esta en Aguas no es clandestino; si solo aparece en Alcaldia, si lo es.

export const BANCO_DICTAMENES = ["clandestino", "probable", "sin_determinar", "registrado"];
export const BANCO_ESTADOS = ["pendiente", "enviado", "descartado"];
const MAX_IMPORT_ROWS = 5000;

const memoryBanco = [];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value) => String(value ?? "").trim();
const flag = (value) => (["1", "true", "si", "sí", "s", "yes"].includes(clean(value).toLowerCase()) ? 1 : 0);
const coord = (value) => {
  const number = Number(clean(value).replace(",", "."));
  return clean(value) && Number.isFinite(number) ? number : null;
};
// "BO. LA LIBERTAD" y "Barrio La Libertad" deben caer en el mismo filtro (estilo del padron de Alcaldia).
export const normalizarBarrio = (value = "") => clean(value)
  .replace(/^BO(\.\s*|\s+)/i, "Barrio ")
  .replace(/^COL(\.\s*|\s+)/i, "Colonia ")
  .replace(/^RES(\.\s*|\s+)/i, "Residencial ")
  .replace(/\s+/g, " ")
  .toLowerCase()
  .split(" ")
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(" ");
const canProcess = (user) => ["admin", "operator"].includes(user?.role);
// Quien reparte el trabajo; y quienes pueden recibirlo (los mismos de Inspecciones).
const canAssign = (user) => ["admin", "operator"].includes(user?.role);
export const TECNICO_ROLES = ["operator", "validadora_campo"];
// La validadora de campo solo trabaja los candidatos que le asignaron.
const canWork = (user, candidato) => canProcess(user) || (user?.role === "validadora_campo" && Number(candidato?.asignado_a) === Number(user?.id));

// "89-13-15", "89 13 15" o "089-13-15-1" -> bloques de al menos dos digitos; "" si no es clave.
export const normalizarClaveBanco = (value = "") => {
  const parts = clean(value).split(/\D+/).filter(Boolean);
  if (![3, 4].includes(parts.length) || parts.some((part) => part.length > 3)) return "";
  return parts.map((part) => part.padStart(2, "0")).join("-");
};
const baseDe = (clave) => clave.split("-").slice(0, 3).join("-");

// Indices de ambos padrones para verificar miles de claves en un solo pase.
export const buildPadronIndex = (aguasRows = [], alcaldiaRows = []) => {
  const aguasExacta = new Map();
  const aguasLote = new Map();
  const aguasAbonado = new Map();
  aguasRows.forEach((row) => {
    const clave = normalizarClaveBanco(row.clave_catastral);
    if (clave) {
      if (!aguasExacta.has(clave)) aguasExacta.set(clave, row);
      if (!aguasLote.has(baseDe(clave))) aguasLote.set(baseDe(clave), row);
    }
    const abonado = clean(row.abonado);
    if (abonado && !aguasAbonado.has(abonado)) aguasAbonado.set(abonado, row);
  });
  const alcaldiaExacta = new Map();
  const alcaldiaLote = new Map();
  alcaldiaRows.forEach((row) => {
    const clave = normalizarClaveBanco(row.clave_aguas_formato || row.clave_catastral);
    if (!clave) return;
    if (!alcaldiaExacta.has(clave)) alcaldiaExacta.set(clave, row);
    if (!alcaldiaLote.has(baseDe(clave))) alcaldiaLote.set(baseDe(clave), row);
  });
  return { aguasExacta, aguasLote, aguasAbonado, alcaldiaExacta, alcaldiaLote };
};

const snapshot = (aguas, alcaldia) => ({
  aguas_clave: clean(aguas?.clave_catastral),
  aguas_abonado: clean(aguas?.abonado),
  aguas_inquilino: clean(aguas?.inquilino || aguas?.nombre),
  alcaldia_clave: clean(alcaldia?.clave_catastral),
  alcaldia_propietario: clean(alcaldia?.nombre),
  alcaldia_caserio: clean(alcaldia?.caserio),
  alcaldia_direccion: clean(alcaldia?.direccion)
});

export const dictaminarCandidato = ({ clave_catastral = "", abonado_campo = "" } = {}, index) => {
  const clave = normalizarClaveBanco(clave_catastral);
  const abonado = clean(abonado_campo);
  const alcaldia = clave ? index.alcaldiaExacta.get(clave) || index.alcaldiaLote.get(baseDe(clave)) || null : null;

  const porAbonado = abonado ? index.aguasAbonado.get(abonado) : null;
  if (porAbonado) {
    return { dictamen: "registrado", motivo_dictamen: `El abonado ${abonado} existe en el padrón de Aguas`, ...snapshot(porAbonado, alcaldia) };
  }
  if (!clave) {
    return { dictamen: "sin_determinar", motivo_dictamen: "Sin clave catastral para verificar", ...snapshot(null, null) };
  }
  const esUnidad = clave.split("-").length === 4;
  const aguasExacta = index.aguasExacta.get(clave);
  const aguasLote = index.aguasLote.get(baseDe(clave));
  if (aguasExacta || (!esUnidad && aguasLote)) {
    const registro = aguasExacta || aguasLote;
    return { dictamen: "registrado", motivo_dictamen: `Registrado en Aguas: ${registro.clave_catastral} · abonado ${clean(registro.abonado) || "sin número"}`, ...snapshot(registro, alcaldia) };
  }
  if (aguasLote) {
    return { dictamen: "probable", motivo_dictamen: `El lote ${baseDe(clave)} está en Aguas, pero esta unidad no`, ...snapshot(aguasLote, alcaldia) };
  }
  if (alcaldia) {
    return { dictamen: "clandestino", motivo_dictamen: "Solo aparece en el padrón de Alcaldía", ...snapshot(null, alcaldia) };
  }
  return { dictamen: "sin_determinar", motivo_dictamen: "La clave no existe en ningún padrón", ...snapshot(null, null) };
};

const currentIndex = ({ reloadAlcaldia = false } = {}) =>
  buildPadronIndex(getMasterRecords(), getAlcaldiaRecords({ reload: reloadAlcaldia }));

// CSV simple (RFC 4180): comillas dobles, comas y saltos de linea dentro de comillas.
export const parseCsv = (text = "") => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text).charCodeAt(0) === 0xfeff ? String(text).slice(1) : String(text);
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  const [header = [], ...body] = rows;
  const keys = header.map((key) => clean(key).toLowerCase());
  return body.map((values) => Object.fromEntries(keys.map((key, position) => [key, values[position] ?? ""])));
};

export const candidatoDesdeFila = (row) => ({
  origen_ref: clean(row.origen_ref || row.fid || row.fid_qfield),
  clave_catastral: normalizarClaveBanco(row.clave_catastral || row.clave || row.clave_usada),
  clave_origen: clean(row.clave_origen || row.origen_clave).slice(0, 20),
  comentario_campo: clean(row.comentario_campo || row.comentario),
  abonado_campo: clean(row.abonado_campo || row.abonado).slice(0, 80),
  barrio_colonia: normalizarBarrio(row.barrio_colonia || row.colonia).slice(0, 180),
  agua: flag(row.agua),
  alcantarillado: flag(row.alcantarillado),
  desechos: flag(row.desechos),
  lote_baldio: flag(row.lote_baldio),
  latitude: coord(row.latitude ?? row.lat),
  longitude: coord(row.longitude ?? row.lon),
  nota_revision: clean(row.nota_revision).slice(0, 255)
});

const mapCandidato = (row) => row && ({
  ...row,
  id: Number(row.id),
  inmueble_id: row.inmueble_id == null ? null : Number(row.inmueble_id),
  agua: Boolean(Number(row.agua)),
  alcantarillado: Boolean(Number(row.alcantarillado)),
  desechos: Boolean(Number(row.desechos)),
  lote_baldio: Boolean(Number(row.lote_baldio)),
  latitude: row.latitude == null ? null : Number(row.latitude),
  longitude: row.longitude == null ? null : Number(row.longitude),
  asignado_a: row.asignado_a == null ? null : Number(row.asignado_a),
  asignado_nombre: row.asignado_nombre || ""
});

const CANDIDATO_SELECT = `SELECT banco_clandestinos.*,
    COALESCE(procesador.full_name, procesador.username, '') AS procesado_por_nombre,
    COALESCE(asignado.full_name, asignado.username, '') AS asignado_nombre
  FROM banco_clandestinos
  LEFT JOIN app_users AS procesador ON procesador.id = banco_clandestinos.procesado_por
  LEFT JOIN app_users AS asignado ON asignado.id = banco_clandestinos.asignado_a`;

const getCandidato = async (id) => {
  if (env.useMemoryDb) return mapCandidato(memoryBanco.find((item) => item.id === Number(id))) || null;
  const [rows] = await getPool().query(`${CANDIDATO_SELECT} WHERE banco_clandestinos.id = ? LIMIT 1`, [id]);
  return mapCandidato(rows[0]) || null;
};

// Largo maximo de cada columna del dictamen, para no romper en modo estricto con nombres largos.
const DICTAMEN_LIMITS = { dictamen: 30, motivo_dictamen: 255, aguas_clave: 40, aguas_abonado: 80, aguas_inquilino: 180, alcaldia_clave: 40, alcaldia_propietario: 180, alcaldia_caserio: 180, alcaldia_direccion: 255 };
const DICTAMEN_FIELDS = Object.keys(DICTAMEN_LIMITS);
const ajustarDictamen = (result) => Object.fromEntries(DICTAMEN_FIELDS.map((field) => [field, String(result[field] ?? "").slice(0, DICTAMEN_LIMITS[field])]));

const guardarDictamen = async (id, result) => {
  if (env.useMemoryDb) {
    const item = memoryBanco.find((candidate) => candidate.id === Number(id));
    Object.assign(item, ajustarDictamen(result), { verificado_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return;
  }
  await getPool().query(
    `UPDATE banco_clandestinos SET ${DICTAMEN_FIELDS.map((field) => `${field} = ?`).join(", ")}, verificado_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...Object.values(ajustarDictamen(result)), id]
  );
};

// Filas { barrio_colonia, dictamen, total } -> todos los barrios, de más a menos candidatos,
// cada uno con su desglose por dictamen.
export const resumirBarrios = (rows = []) => {
  const byBarrio = new Map();
  for (const row of rows) {
    const barrio = row.barrio_colonia;
    if (!barrio) continue;
    const entry = byBarrio.get(barrio) || { barrio, total: 0, ...Object.fromEntries(BANCO_DICTAMENES.map((key) => [key, 0])) };
    const total = Number(row.total || 0);
    entry.total += total;
    if (row.dictamen in entry) entry[row.dictamen] += total;
    byBarrio.set(barrio, entry);
  }
  return [...byBarrio.values()].sort((a, b) => b.total - a.total || a.barrio.localeCompare(b.barrio, "es"));
};

// Filtros del banco. `skip` deja fuera alguno (p. ej. los barrios del gráfico no
// se filtran por el barrio elegido). asignado: "" todos, "none" sin asignar, o un id.
const bancoFilter = ({ query, dictamen, estado, barrio, asignado }, skip = []) => {
  const use = (key) => !skip.includes(key);
  const parts = [];
  const params = [];
  const checks = [];
  if (use("estado") && estado) { parts.push("banco_clandestinos.estado = ?"); params.push(estado); checks.push((item) => item.estado === estado); }
  if (use("barrio") && barrio) { parts.push("banco_clandestinos.barrio_colonia = ?"); params.push(barrio); checks.push((item) => item.barrio_colonia === barrio); }
  if (use("dictamen") && dictamen) { parts.push("banco_clandestinos.dictamen = ?"); params.push(dictamen); checks.push((item) => item.dictamen === dictamen); }
  if (asignado === "none") { parts.push("banco_clandestinos.asignado_a IS NULL"); checks.push((item) => item.asignado_a == null); }
  else if (Number(asignado) > 0) { parts.push("banco_clandestinos.asignado_a = ?"); params.push(Number(asignado)); checks.push((item) => Number(item.asignado_a) === Number(asignado)); }
  if (query) {
    const columns = ["clave_catastral", "abonado_campo", "barrio_colonia", "alcaldia_propietario", "comentario_campo"];
    parts.push(`(${columns.map((column) => `banco_clandestinos.${column} LIKE ?`).join(" OR ")})`);
    params.push(...columns.map(() => likeValue(query)));
    const term = query.toLowerCase();
    checks.push((item) => columns.map((column) => item[column] || "").join(" ").toLowerCase().includes(term));
  }
  return { where: parts.length ? parts.join(" AND ") : "1 = 1", params, test: (item) => checks.every((check) => check(item)) };
};

const cleanFilters = ({ query = "", dictamen = "", estado = "pendiente", barrio = "", asignado = "" } = {}) =>
  ({ query: clean(query), dictamen: clean(dictamen), estado: clean(estado), barrio: clean(barrio), asignado: clean(asignado) });
const ORDEN_BANCO = "ORDER BY FIELD(banco_clandestinos.dictamen, 'clandestino', 'probable', 'sin_determinar', 'registrado'), banco_clandestinos.barrio_colonia, banco_clandestinos.clave_catastral";

// Carga pendiente por técnico (lo que les queda por convertir en ficha).
const resumirAsignaciones = (rows) => rows
  .map((row) => ({ id: Number(row.asignado_a), nombre: row.nombre || `Usuario #${row.asignado_a}`, pendientes: Number(row.total || 0) }))
  .sort((a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, "es"));

export const listBancoClandestinos = async (filters = {}) => {
  const { query, dictamen, estado, barrio, asignado } = cleanFilters(filters);
  const safeLimit = Math.min(Math.max(Number(filters.limit) || 25, 5), 200);
  const requestedPage = Math.max(Number(filters.page) || 1, 1);
  const values = { query, dictamen, estado, barrio, asignado };
  const scopedFilter = bancoFilter(values, ["dictamen"]);
  const fullFilter = bancoFilter(values);
  const barrioFilter = bancoFilter(values, ["barrio"]);

  if (env.useMemoryDb) {
    const scoped = memoryBanco.filter(scopedFilter.test);
    const filtered = memoryBanco.filter(fullFilter.test);
    const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
    const currentPage = Math.min(requestedPage, totalPages);
    const pendientesAsignados = memoryBanco.filter((item) => item.estado === "pendiente" && item.asignado_a != null);
    const porTecnico = [...new Set(pendientesAsignados.map((item) => item.asignado_a))].map((id) => ({ asignado_a: id, total: pendientesAsignados.filter((item) => item.asignado_a === id).length }));
    return {
      items: filtered.slice((currentPage - 1) * safeLimit, currentPage * safeLimit).map(mapCandidato),
      total: filtered.length, page: currentPage, total_pages: totalPages,
      counts: Object.fromEntries(BANCO_DICTAMENES.map((key) => [key, scoped.filter((item) => item.dictamen === key).length])),
      estados: Object.fromEntries(BANCO_ESTADOS.map((key) => [key, memoryBanco.filter((item) => item.estado === key).length])),
      barrios: [...new Set(memoryBanco.map((item) => item.barrio_colonia).filter(Boolean))].sort(),
      barrio_counts: resumirBarrios(memoryBanco.filter((item) => item.barrio_colonia && barrioFilter.test(item)).map((item) => ({ barrio_colonia: item.barrio_colonia, dictamen: item.dictamen, total: 1 }))),
      asignaciones: resumirAsignaciones(porTecnico),
      sin_asignar: memoryBanco.filter((item) => item.estado === "pendiente" && item.asignado_a == null && item.dictamen !== "registrado").length
    };
  }

  const pool = getPool();
  const [[countRows], [estadoRows], [barrioRows], [totalRows], [barrioCountRows], [asignacionRows], [sinAsignarRows]] = await Promise.all([
    pool.query(`SELECT dictamen, COUNT(*) AS total FROM banco_clandestinos WHERE ${scopedFilter.where} GROUP BY dictamen`, scopedFilter.params),
    pool.query("SELECT estado, COUNT(*) AS total FROM banco_clandestinos GROUP BY estado"),
    pool.query("SELECT DISTINCT barrio_colonia FROM banco_clandestinos WHERE barrio_colonia <> '' ORDER BY barrio_colonia"),
    pool.query(`SELECT COUNT(*) AS total FROM banco_clandestinos WHERE ${fullFilter.where}`, fullFilter.params),
    pool.query(`SELECT barrio_colonia, dictamen, COUNT(*) AS total FROM banco_clandestinos WHERE ${barrioFilter.where} AND barrio_colonia <> '' GROUP BY barrio_colonia, dictamen`, barrioFilter.params),
    pool.query(`SELECT banco_clandestinos.asignado_a, COALESCE(app_users.full_name, app_users.username, '') AS nombre, COUNT(*) AS total
      FROM banco_clandestinos LEFT JOIN app_users ON app_users.id = banco_clandestinos.asignado_a
      WHERE banco_clandestinos.estado = 'pendiente' AND banco_clandestinos.asignado_a IS NOT NULL
      GROUP BY banco_clandestinos.asignado_a, app_users.full_name, app_users.username`),
    pool.query("SELECT COUNT(*) AS total FROM banco_clandestinos WHERE estado = 'pendiente' AND asignado_a IS NULL AND dictamen <> 'registrado'")
  ]);
  const total = Number(totalRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(requestedPage, totalPages);
  const [items] = await pool.query(
    `${CANDIDATO_SELECT} WHERE ${fullFilter.where} ${ORDEN_BANCO} LIMIT ? OFFSET ?`,
    [...fullFilter.params, safeLimit, (currentPage - 1) * safeLimit]
  );
  return {
    items: items.map(mapCandidato),
    total, page: currentPage, total_pages: totalPages,
    counts: Object.fromEntries(BANCO_DICTAMENES.map((key) => [key, Number(countRows.find((row) => row.dictamen === key)?.total || 0)])),
    estados: Object.fromEntries(BANCO_ESTADOS.map((key) => [key, Number(estadoRows.find((row) => row.estado === key)?.total || 0)])),
    barrios: barrioRows.map((row) => row.barrio_colonia),
    barrio_counts: resumirBarrios(barrioCountRows),
    asignaciones: resumirAsignaciones(asignacionRows),
    sin_asignar: Number(sinAsignarRows[0]?.total || 0)
  };
};

// Todos los candidatos que cumplen el filtro, sin paginar: para imprimir el
// listado y para "seleccionar todos". Ordenados por barrio y clave.
const MAX_LISTADO = 3000;
export const listadoBancoClandestinos = async (filters = {}) => {
  const values = cleanFilters(filters);
  const { where, params, test } = bancoFilter(values);
  const porBarrio = (a, b) => (a.barrio_colonia || "").localeCompare(b.barrio_colonia || "", "es") || (a.clave_catastral || "").localeCompare(b.clave_catastral || "", "es", { numeric: true });
  if (env.useMemoryDb) return { items: memoryBanco.filter(test).sort(porBarrio).slice(0, MAX_LISTADO).map(mapCandidato), limite: MAX_LISTADO };
  const [items] = await getPool().query(
    `${CANDIDATO_SELECT} WHERE ${where} ORDER BY banco_clandestinos.barrio_colonia, banco_clandestinos.clave_catastral LIMIT ?`,
    [...params, MAX_LISTADO]
  );
  return { items: items.map(mapCandidato), limite: MAX_LISTADO };
};

// Técnicos que pueden recibir candidatos, con lo que ya tienen pendiente.
export const listTecnicosBanco = async (user) => {
  if (!canAssign(user)) throw fail("Tu rol no puede asignar candidatos.", 403);
  if (env.useMemoryDb) return [];
  const [rows] = await getPool().query(
    `SELECT app_users.id, app_users.full_name, app_users.username, app_users.role,
        COUNT(banco_clandestinos.id) AS pendientes
     FROM app_users
     LEFT JOIN banco_clandestinos ON banco_clandestinos.asignado_a = app_users.id AND banco_clandestinos.estado = 'pendiente'
     WHERE app_users.is_active = 1 AND app_users.role IN (?)
     GROUP BY app_users.id, app_users.full_name, app_users.username, app_users.role
     ORDER BY app_users.full_name`,
    [TECNICO_ROLES]
  );
  return rows.map((row) => ({ id: Number(row.id), nombre: row.full_name || row.username, role: row.role, pendientes: Number(row.pendientes || 0) }));
};

// Reparte en bloques contiguos por barrio y clave: a cada técnico le tocan
// predios vecinos y la carga queda pareja (difieren en uno como máximo).
export const repartirCandidatos = (candidatos = [], tecnicoIds = []) => {
  if (!tecnicoIds.length) return [];
  const orden = [...candidatos].sort((a, b) =>
    (a.barrio_colonia || "").localeCompare(b.barrio_colonia || "", "es")
    || (a.clave_catastral || "").localeCompare(b.clave_catastral || "", "es", { numeric: true })
    || Number(a.id) - Number(b.id));
  const base = Math.floor(orden.length / tecnicoIds.length);
  const extra = orden.length % tecnicoIds.length;
  let inicio = 0;
  return tecnicoIds.map((tecnicoId, index) => {
    const size = base + (index < extra ? 1 : 0);
    const items = orden.slice(inicio, inicio + size);
    inicio += size;
    return { tecnico_id: Number(tecnicoId), items };
  });
};

const resumenBarrios = (items) => {
  const conteo = new Map();
  items.forEach((item) => conteo.set(item.barrio_colonia || "Sin barrio", (conteo.get(item.barrio_colonia || "Sin barrio") || 0) + 1));
  return [...conteo.entries()].map(([barrio, total]) => ({ barrio, total })).sort((a, b) => b.total - a.total || a.barrio.localeCompare(b.barrio, "es"));
};

const idsLimpios = (ids, max) => [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, max);

/**
 * Asigna candidatos a uno o varios técnicos para que los conviertan en ficha.
 * Con varios técnicos se reparten (ver repartirCandidatos). Cada técnico recibe
 * una notificación con cuántos le tocaron y de qué barrios. Con preview no guarda.
 */
export const asignarCandidatos = async ({ ids = [], tecnico_ids = [], preview = false } = {}, user) => {
  if (!canAssign(user)) throw fail("Tu rol no puede asignar candidatos.", 403);
  const candidatoIds = idsLimpios(ids, MAX_LISTADO);
  const tecnicoIds = idsLimpios(tecnico_ids, 30);
  if (!candidatoIds.length) throw fail("Selecciona al menos un candidato.");
  if (!tecnicoIds.length) throw fail("Elige al menos un técnico.");

  const tecnicos = env.useMemoryDb
    ? tecnicoIds.map((id) => ({ id, nombre: `Técnico #${id}` }))
    : (await getPool().query("SELECT id, COALESCE(full_name, username) AS nombre FROM app_users WHERE is_active = 1 AND role IN (?) AND id IN (?)", [TECNICO_ROLES, tecnicoIds]))[0]
      .map((row) => ({ id: Number(row.id), nombre: row.nombre }));
  if (tecnicos.length !== tecnicoIds.length) throw fail("Alguno de los técnicos elegidos no está activo o no es técnico.", 422);

  const candidatos = env.useMemoryDb
    ? memoryBanco.filter((item) => candidatoIds.includes(item.id))
    : (await getPool().query("SELECT id, clave_catastral, barrio_colonia, estado, dictamen, asignado_a FROM banco_clandestinos WHERE id IN (?)", [candidatoIds]))[0];
  // Solo se reparte lo que todavía hay que convertir en ficha.
  const asignables = candidatos.filter((item) => item.estado === "pendiente" && item.dictamen !== "registrado");
  const omitidos = candidatoIds.length - asignables.length;
  if (!asignables.length) throw fail("Ninguno de los seleccionados está pendiente de ficha (ya enviados, descartados o registrados en Aguas).", 409);

  const nombres = new Map(tecnicos.map((item) => [item.id, item.nombre]));
  const plan = repartirCandidatos(asignables, tecnicoIds).map(({ tecnico_id, items }) => ({
    tecnico: { id: tecnico_id, nombre: nombres.get(tecnico_id) },
    total: items.length,
    barrios: resumenBarrios(items),
    ids: items.map((item) => Number(item.id)),
    reasignados: items.filter((item) => item.asignado_a != null && Number(item.asignado_a) !== tecnico_id).length
  }));
  const resumen = { plan: plan.map(({ ids: _ids, ...rest }) => rest), asignables: asignables.length, omitidos };
  if (preview) return resumen;

  if (env.useMemoryDb) {
    const ahora = new Date().toISOString();
    plan.forEach(({ tecnico, ids: grupo }) => memoryBanco.filter((item) => grupo.includes(item.id)).forEach((item) => Object.assign(item, { asignado_a: tecnico.id, asignado_por: user?.id || null, asignado_at: ahora })));
    return { ...resumen, notificados: 0 };
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  const mensajes = [];
  try {
    await connection.beginTransaction();
    for (const { tecnico, total, barrios, ids: grupo } of plan) {
      if (!grupo.length) continue;
      await connection.query("UPDATE banco_clandestinos SET asignado_a = ?, asignado_por = ?, asignado_at = CURRENT_TIMESTAMP WHERE id IN (?) AND estado = 'pendiente'", [tecnico.id, user?.id || null, grupo]);
      if (Number(tecnico.id) === Number(user?.id)) continue;
      const detalle = barrios.slice(0, 6).map((item) => `${item.barrio} (${item.total})`).join(", ") + (barrios.length > 6 ? ` y ${barrios.length - 6} barrios más` : "");
      const body = `${user?.full_name || "Administración"} te asignó ${total} ${total === 1 ? "candidato" : "candidatos"} del banco de clandestinos para hacer ficha: ${detalle}. Ábrelos en Clandestinos › Banco › Mis asignaciones.`;
      const [result] = await connection.query("INSERT INTO user_profile_messages (sender_user_id, recipient_user_id, body) VALUES (?, ?, ?)", [user?.id || null, tecnico.id, body.slice(0, 2000)]);
      await connection.query("INSERT INTO banco_asignacion_avisos (message_id, recipient_user_id, total) VALUES (?, ?, ?)", [result.insertId, tecnico.id, total]);
      mensajes.push({ id: result.insertId, sender_user_id: user?.id || null, sender_name: user?.full_name || "Administración", recipient_user_id: tecnico.id, recipient_name: tecnico.nombre, body, banco_asignacion: true, read_at: null, created_at: new Date().toISOString() });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  mensajes.forEach(emitProfileMessage);
  await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.assigned", entityType: "banco_clandestinos", entityId: 0, summary: `${asignables.length} candidatos asignados a ${plan.map((item) => `${item.tecnico.nombre} (${item.total})`).join(", ")}`, details: resumen });
  return { ...resumen, notificados: mensajes.length };
};

export const quitarAsignacion = async ({ ids = [] } = {}, user) => {
  if (!canAssign(user)) throw fail("Tu rol no puede cambiar asignaciones.", 403);
  const candidatoIds = idsLimpios(ids, MAX_LISTADO);
  if (!candidatoIds.length) throw fail("Selecciona al menos un candidato.");
  if (env.useMemoryDb) {
    const items = memoryBanco.filter((item) => candidatoIds.includes(item.id) && item.estado === "pendiente" && item.asignado_a != null);
    items.forEach((item) => Object.assign(item, { asignado_a: null, asignado_por: null, asignado_at: null }));
    return { liberados: items.length };
  }
  const [result] = await getPool().query("UPDATE banco_clandestinos SET asignado_a = NULL, asignado_por = NULL, asignado_at = NULL WHERE id IN (?) AND estado = 'pendiente' AND asignado_a IS NOT NULL", [candidatoIds]);
  await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.unassigned", entityType: "banco_clandestinos", entityId: 0, summary: `${result.affectedRows} candidatos sin asignar`, details: { ids: candidatoIds } });
  return { liberados: result.affectedRows };
};

export const importBancoClandestinos = async ({ csv = "", origen = "qfield", lote = "" } = {}, user) => {
  if (user?.role !== "admin") throw fail("Solo administración puede importar al banco.", 403);
  const rows = parseCsv(csv).map(candidatoDesdeFila);
  if (!rows.length) throw fail("El archivo no trae filas.");
  if (rows.length > MAX_IMPORT_ROWS) throw fail(`El banco admite hasta ${MAX_IMPORT_ROWS} filas por importación.`, 413);
  const sinReferencia = rows.filter((row) => !row.origen_ref).length;
  if (sinReferencia) throw fail(`${sinReferencia} filas no traen origen_ref (id del punto). Sin él no se puede evitar duplicados.`);
  return guardarCandidatos(rows, { origen, lote }, user);
};

// Guarda candidatos ya armados (CSV de QField o hallazgos de puntos GPS):
// dictamina cada uno contra los padrones y no toca los ya enviados o descartados.
export const guardarCandidatos = async (rows, { origen = "qfield", lote = "" } = {}, user) => {
  origen = clean(origen).slice(0, 40) || "qfield";
  lote = clean(lote).slice(0, 120);
  const index = currentIndex({ reloadAlcaldia: true });
  const summary = { total: rows.length, nuevos: 0, actualizados: 0, sin_cambios_procesados: 0 };
  const existingEstados = new Map(env.useMemoryDb
    ? memoryBanco.filter((item) => item.origen === origen).map((item) => [item.origen_ref, item.estado])
    : (await getPool().query("SELECT origen_ref, estado FROM banco_clandestinos WHERE origen = ?", [origen]))[0].map((item) => [item.origen_ref, item.estado]));

  for (const row of rows) {
    const estadoActual = existingEstados.get(row.origen_ref);
    // Los candidatos ya enviados o descartados no se tocan: el trabajo del tecnico manda.
    if (estadoActual && estadoActual !== "pendiente") { summary.sin_cambios_procesados += 1; continue; }
    const dictamen = ajustarDictamen(dictaminarCandidato(row, index));
    const barrio = normalizarBarrio(dictamen.alcaldia_caserio) || row.barrio_colonia;
    const record = { ...row, ...dictamen, barrio_colonia: barrio.slice(0, 180), origen, lote_importacion: lote };
    if (estadoActual) summary.actualizados += 1;
    else summary.nuevos += 1;
    existingEstados.set(row.origen_ref, "pendiente");
    if (env.useMemoryDb) {
      const existing = memoryBanco.find((item) => item.origen === origen && item.origen_ref === row.origen_ref);
      if (existing) Object.assign(existing, record, { verificado_at: new Date().toISOString() });
      else memoryBanco.push({ id: memoryBanco.length + 1, ...record, estado: "pendiente", inmueble_id: null, motivo_descarte: "", verificado_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      continue;
    }
    const columns = Object.keys(record);
    const updatable = columns.filter((column) => !["origen", "origen_ref"].includes(column));
    await getPool().query(
      `INSERT INTO banco_clandestinos (${columns.join(", ")}, verificado_at) VALUES (${columns.map(() => "?").join(", ")}, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE ${updatable.map((column) => `${column} = IF(estado = 'pendiente', VALUES(${column}), ${column})`).join(", ")},
         verificado_at = IF(estado = 'pendiente', CURRENT_TIMESTAMP, verificado_at)`,
      columns.map((column) => record[column])
    );
  }
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.imported", entityType: "banco_clandestinos", entityId: 0, summary: `Banco de clandestinos: ${summary.nuevos} nuevos, ${summary.actualizados} actualizados (${lote || origen})`, details: summary });
  return { ...summary, padron_version: getMasterVersion() };
};

// Vuelve a dictaminar los candidatos pendientes con los padrones cargados en este momento.
// Verifica los pendientes contra los padrones actuales. Regla: si el predio
// aparece en Aguas no es clandestino, así que sale del banco como descartado
// (se puede devolver a mano si hiciera falta).
export const verificarBancoClandestinos = async (user, { index } = {}) => {
  if (!canProcess(user)) throw fail("Tu rol no puede verificar el banco.", 403);
  index ||= currentIndex({ reloadAlcaldia: true });
  const pendientes = env.useMemoryDb
    ? memoryBanco.filter((item) => item.estado === "pendiente")
    : (await getPool().query("SELECT id, clave_catastral, abonado_campo, dictamen FROM banco_clandestinos WHERE estado = 'pendiente'"))[0];
  const cambios = {};
  let descartados = 0;
  for (const item of pendientes) {
    const result = dictaminarCandidato(item, index);
    if (result.dictamen !== item.dictamen) {
      const key = `${item.dictamen} → ${result.dictamen}`;
      cambios[key] = (cambios[key] || 0) + 1;
    }
    await guardarDictamen(item.id, result);
    if (result.dictamen === "registrado") {
      await marcarProcesado(item.id, { estado: "descartado", motivo_descarte: `Aparece en Aguas (verificación automática): ${result.motivo_dictamen}`.slice(0, 255) }, user);
      descartados += 1;
    }
  }
  const summary = { verificados: pendientes.length, cambiaron: Object.values(cambios).reduce((sum, value) => sum + value, 0), descartados, cambios, padron_version: getMasterVersion() };
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.verified", entityType: "banco_clandestinos", entityId: 0, summary: `Banco verificado contra padrones: ${summary.verificados} candidatos, ${summary.cambiaron} cambiaron, ${descartados} descartados por aparecer en Aguas`, details: summary });
  return summary;
};

const marcarProcesado = async (id, { estado, inmueble_id = null, motivo_descarte = "", clave_catastral }, user) => {
  if (env.useMemoryDb) {
    const item = memoryBanco.find((candidate) => candidate.id === Number(id));
    Object.assign(item, { estado, inmueble_id, motivo_descarte, procesado_por: user?.id || null, procesado_at: estado === "pendiente" ? null : new Date().toISOString(), updated_at: new Date().toISOString() }, clave_catastral ? { clave_catastral } : {});
    return;
  }
  await getPool().query(
    `UPDATE banco_clandestinos SET estado = ?, inmueble_id = ?, motivo_descarte = ?, procesado_por = ?, procesado_at = ${estado === "pendiente" ? "NULL" : "CURRENT_TIMESTAMP"}${clave_catastral ? ", clave_catastral = ?" : ""} WHERE id = ?`,
    [estado, inmueble_id, motivo_descarte, user?.id || null, ...(clave_catastral ? [clave_catastral] : []), id]
  );
};

const fichaDesdeCandidato = (candidato, clave) => {
  const hallazgos = [
    candidato.comentario_campo && `Hallazgo de campo: ${candidato.comentario_campo}`,
    candidato.lote_baldio && "Marcado como lote baldío en campo.",
    candidato.latitude != null && `Coordenadas: ${candidato.latitude}, ${candidato.longitude}`,
    `Dictamen de padrones: ${candidato.motivo_dictamen}`,
    `Origen: banco de clandestinos (${candidato.origen} #${candidato.origen_ref})`
  ].filter(Boolean);
  return {
    clave_catastral: clave,
    abonado: "",
    nombre_catastral: candidato.alcaldia_propietario,
    barrio_colonia: candidato.barrio_colonia || candidato.alcaldia_caserio,
    comentarios: hallazgos.join("\n"),
    estado_padron: "clandestino",
    clave_alcaldia: candidato.alcaldia_clave,
    nombre_alcaldia: candidato.alcaldia_propietario,
    barrio_alcaldia: candidato.alcaldia_caserio,
    conexion_agua: candidato.agua ? "Si" : "No",
    conexion_alcantarillado: candidato.alcantarillado ? "Si" : "No",
    recoleccion_desechos: candidato.desechos ? "Si" : "No",
    uso_suelo: candidato.lote_baldio ? "Lote baldío" : ""
  };
};

// El tecnico da clic: se re-verifica contra los padrones y, si procede, nace la ficha.
export const enviarCandidatoAFicha = async (id, { clave_catastral = "" } = {}, user) => {
  const candidato = await getCandidato(id);
  if (!candidato) throw fail("Candidato no encontrado.", 404);
  if (!canWork(user, candidato)) throw fail("Tu rol no puede enviar candidatos a ficha.", 403);
  if (candidato.estado !== "pendiente") throw fail("Este candidato ya fue procesado.", 409);
  const clave = normalizarClaveBanco(clave_catastral) || candidato.clave_catastral;
  if (clean(clave_catastral) && !normalizarClaveBanco(clave_catastral)) throw fail("La clave debe tener 3 o 4 bloques numéricos, por ejemplo 89-13-15.");
  if (!clave) throw fail("Escribe la clave catastral antes de enviarlo a ficha.");

  const verificacion = dictaminarCandidato({ ...candidato, clave_catastral: clave }, currentIndex());
  await guardarDictamen(id, verificacion);
  if (verificacion.dictamen === "registrado") {
    throw fail(`No se envió: ${verificacion.motivo_dictamen}. Si no corresponde, descártalo.`, 409);
  }
  const actualizado = { ...candidato, ...verificacion };

  const existente = await getByClave(clave);
  if (existente) {
    await marcarProcesado(id, { estado: "enviado", inmueble_id: existente.id, clave_catastral: clave }, user);
    return { candidato: await getCandidato(id), ficha: existente, ficha_existente: true };
  }
  let ficha;
  try {
    ficha = await createInmueble(fichaDesdeCandidato(actualizado, clave), { actorUserId: user?.id });
  } catch (error) {
    if (error.status === 409 || error.code === "ER_DUP_ENTRY") throw fail(`Ya existe una ficha archivada con la clave ${clave}. Restáurala desde archivados.`, 409);
    throw error;
  }
  await marcarProcesado(id, { estado: "enviado", inmueble_id: ficha.id, clave_catastral: clave }, user);
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.sent_to_ficha", entityType: "inmueble", entityId: ficha.id, summary: `Banco → ficha ${clave} (${verificacion.dictamen})`, details: { candidato_id: Number(id), dictamen: verificacion.dictamen } });
  return { candidato: await getCandidato(id), ficha, ficha_existente: false };
};

export const descartarCandidato = async (id, { motivo = "" } = {}, user) => {
  if (!clean(motivo)) throw fail("Indica el motivo del descarte.");
  const candidato = await getCandidato(id);
  if (!candidato) throw fail("Candidato no encontrado.", 404);
  if (!canWork(user, candidato)) throw fail("Tu rol no puede descartar candidatos.", 403);
  if (candidato.estado !== "pendiente") throw fail("Este candidato ya fue procesado.", 409);
  await marcarProcesado(id, { estado: "descartado", motivo_descarte: clean(motivo).slice(0, 255) }, user);
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.discarded", entityType: "banco_clandestinos", entityId: Number(id), summary: `Candidato ${candidato.clave_catastral || `#${candidato.origen_ref}`} descartado`, details: { motivo: clean(motivo) } });
  return getCandidato(id);
};

// Deshacer un descarte por error: quien puede descartar un candidato tambien puede devolverlo.
export const restaurarCandidato = async (id, user) => {
  const candidato = await getCandidato(id);
  if (!candidato) throw fail("Candidato no encontrado.", 404);
  if (!canWork(user, candidato)) throw fail("Tu rol no puede devolver este candidato al banco.", 403);
  if (candidato.estado !== "descartado") throw fail("Solo se pueden devolver al banco los candidatos descartados.", 409);
  await marcarProcesado(id, { estado: "pendiente" }, user);
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.restored", entityType: "banco_clandestinos", entityId: Number(id), summary: `Candidato ${candidato.clave_catastral || `#${candidato.origen_ref}`} devuelto al banco`, details: { motivo_descarte: candidato.motivo_descarte } });
  return getCandidato(id);
};
