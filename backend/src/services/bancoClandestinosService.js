import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { getAlcaldiaRecords, getMasterRecords, getMasterVersion } from "./claveLookupService.js";
import { createInmueble, getByClave, listInmuebles } from "./inmuebleService.js";
import { likeValue } from "../utils/normalize.js";
import { emitProfileMessage } from "./profileRealtimeService.js";

// Banco de clandestinos: puntos levantados en campo que todavia no son fichas.
// Regla: clandestino es todo predio que no aparece en el padron de Aguas. Alcaldia
// no decide nada, solo aporta el propietario. Sin clave no se puede verificar.

export const BANCO_DICTAMENES = ["clandestino", "sin_determinar", "registrado"];
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
const manzanaDe = (clave) => clave.split("-").slice(0, 2).join("-");

// Palabras de un nombre para compararlo entre padrones (sin tildes ni palabras de relleno).
const RELLENO_NOMBRE = new Set(["DEL", "LOS", "LAS", "VDA", "VIUDA", "SUCESION", "HEREDEROS", "HDOS"]);
export const palabrasNombre = (value = "") => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  .replace(/[^A-Z ]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !RELLENO_NOMBRE.has(word));
// Mismo propietario con seguridad: 3 palabras en común, o el nombre más corto completo
// (al menos 2 palabras). Con 2 palabras sueltas había demasiados apellidos repetidos.
export const mismoPropietario = (a = [], b = []) => {
  const comunes = a.filter((word) => b.includes(word)).length;
  return comunes >= 3 || (comunes >= 2 && comunes === Math.min(a.length, b.length));
};

// Indices de ambos padrones para verificar miles de claves en un solo pase.
export const buildPadronIndex = (aguasRows = [], alcaldiaRows = []) => {
  const aguasExacta = new Map();
  const aguasLote = new Map();
  const aguasAbonado = new Map();
  const aguasManzana = new Map();
  aguasRows.forEach((row) => {
    const clave = normalizarClaveBanco(row.clave_catastral);
    if (clave) {
      if (!aguasExacta.has(clave)) aguasExacta.set(clave, row);
      if (!aguasLote.has(baseDe(clave))) aguasLote.set(baseDe(clave), row);
      const nombres = [palabrasNombre(row.nombre), palabrasNombre(row.inquilino)].filter((words) => words.length >= 2);
      if (nombres.length) aguasManzana.set(manzanaDe(clave), [...(aguasManzana.get(manzanaDe(clave)) || []), { row, nombres }]);
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
  return { aguasExacta, aguasLote, aguasAbonado, aguasManzana, alcaldiaExacta, alcaldiaLote };
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
  // Lote desmembrado en Alcaldía: el lote nuevo tiene otro número, pero Aguas sigue
  // cobrando con la cuenta del lote original. Si en la misma manzana hay una cuenta de
  // Aguas a nombre del mismo propietario, no se da por clandestino: queda sin determinar
  // con esa cuenta como pista, para confirmarlo en campo.
  const propietario = palabrasNombre(alcaldia?.nombre);
  if (!aguasLote && propietario.length >= 2) {
    const vecina = (index.aguasManzana?.get(manzanaDe(clave)) || []).find((item) => item.nombres.some((nombre) => mismoPropietario(propietario, nombre)));
    if (vecina) {
      const cuenta = vecina.row;
      return {
        dictamen: "sin_determinar",
        motivo_dictamen: `Posible desmembración: ${clean(alcaldia.nombre)} ya tiene cuenta en Aguas en la misma manzana (${clean(cuenta.clave_catastral)} · abonado ${clean(cuenta.abonado) || "sin número"}); confirmar en campo si es el mismo predio`,
        ...snapshot(cuenta, alcaldia)
      };
    }
  }
  // Una unidad sin cuenta dentro de un lote registrado también es clandestina; se guarda
  // la cuenta vecina del lote como pista (la persona puede pagar con otra unidad).
  const motivo = aguasLote
    ? `No aparece en Aguas; el lote ${baseDe(clave)} sí (${aguasLote.clave_catastral})`
    : alcaldia ? "No aparece en Aguas; sí en Alcaldía" : "No aparece en Aguas ni en Alcaldía";
  return { dictamen: "clandestino", motivo_dictamen: motivo, ...snapshot(aguasLote, alcaldia) };
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
  asignado_nombre: row.asignado_nombre || "",
  duplicado_de: row.duplicado_de == null ? null : Number(row.duplicado_de),
  duplicados: Number(row.duplicados ?? (env.useMemoryDb ? memoryBanco.filter((item) => item.duplicado_de === Number(row.id)).length : 0))
});

const CANDIDATO_SELECT = `SELECT banco_clandestinos.*,
    (SELECT COUNT(*) FROM banco_clandestinos AS copia WHERE copia.duplicado_de = banco_clandestinos.id) AS duplicados,
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
// Con "Todos" los estados (p. ej. lo de un técnico) lo pendiente va primero.
const ORDEN_BANCO = "ORDER BY FIELD(banco_clandestinos.estado, 'pendiente', 'enviado', 'descartado'), FIELD(banco_clandestinos.dictamen, 'clandestino', 'sin_determinar', 'registrado'), banco_clandestinos.barrio_colonia, banco_clandestinos.clave_catastral";

// Avance por técnico. Filas { asignado_a, nombre, estado, total } -> todo lo que se le
// asignó, cuánto le queda y cuánto ya trabajó (a ficha o descartado), en porcentaje.
// El porcentaje se redondea hacia abajo: 100 % solo cuando no queda ningún pendiente.
export const resumirAsignaciones = (rows = []) => {
  const porTecnico = new Map();
  for (const row of rows) {
    const id = Number(row.asignado_a);
    const entry = porTecnico.get(id) || { id, nombre: row.nombre || `Usuario #${id}`, pendientes: 0, enviados: 0, descartados: 0 };
    const total = Number(row.total || 0);
    if (row.estado === "pendiente") entry.pendientes += total;
    else if (row.estado === "enviado") entry.enviados += total;
    else if (row.estado === "descartado") entry.descartados += total;
    porTecnico.set(id, entry);
  }
  return [...porTecnico.values()]
    .map((entry) => {
      const total = entry.pendientes + entry.enviados + entry.descartados;
      const trabajados = entry.enviados + entry.descartados;
      return { ...entry, total, trabajados, avance: total ? Math.floor((trabajados / total) * 100) : 0 };
    })
    .sort((a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, "es"));
};

export const listBancoClandestinos = async (filters = {}) => {
  await agruparSiToca();
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
    const asignados = memoryBanco.filter((item) => item.asignado_a != null);
    const porTecnico = [...new Set(asignados.map((item) => `${item.asignado_a}|${item.estado}`))].map((key) => {
      const [id, estado] = key.split("|");
      return { asignado_a: Number(id), estado, total: asignados.filter((item) => Number(item.asignado_a) === Number(id) && item.estado === estado).length };
    });
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
    pool.query(`SELECT banco_clandestinos.asignado_a, banco_clandestinos.estado, COALESCE(app_users.full_name, app_users.username, '') AS nombre, COUNT(*) AS total
      FROM banco_clandestinos LEFT JOIN app_users ON app_users.id = banco_clandestinos.asignado_a
      WHERE banco_clandestinos.asignado_a IS NOT NULL
      GROUP BY banco_clandestinos.asignado_a, banco_clandestinos.estado, app_users.full_name, app_users.username`),
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
// ---------- Duplicados: la misma clave más de una vez en el banco ----------
// Pasa cuando dos técnicos levantan la misma casa en QField, o cuando una clave ya llegó
// desde Alcaldía y luego llega un punto de campo con ella. Sin agrupar, cada copia se
// repartía por separado y el técnico (o dos técnicos) visitaba la misma clave dos veces.
// Por clave, uno queda como principal y las demás copias pendientes pasan a descartadas
// con duplicado_de = principal: no se reparten ni cuentan en el avance, su comentario
// de campo viaja a la ficha del principal y se pueden devolver si no eran duplicados.
const pesoPrincipal = (item) =>
  (item.estado === "enviado" ? 8 : 0) + (item.asignado_a != null ? 4 : 0) + (item.latitude != null ? 2 : 0) + (clean(item.comentario_campo) ? 1 : 0);

// rows: candidatos pendientes o enviados con clave. Devuelve [{ id, principal, clave }]
// con las copias pendientes que hay que agrupar.
export const planDuplicados = (rows = []) => {
  const porClave = new Map();
  for (const row of rows) {
    const clave = clean(row.clave_catastral);
    if (!clave || Number(row.no_duplicado) || !["pendiente", "enviado"].includes(row.estado)) continue;
    porClave.set(clave, [...(porClave.get(clave) || []), row]);
  }
  const plan = [];
  for (const [clave, grupo] of porClave) {
    if (grupo.length < 2) continue;
    const principal = [...grupo].sort((a, b) => pesoPrincipal(b) - pesoPrincipal(a) || Number(a.id) - Number(b.id))[0];
    grupo
      .filter((item) => item !== principal && item.estado === "pendiente")
      .forEach((item) => plan.push({ id: Number(item.id), principal: Number(principal.id), clave }));
  }
  return plan;
};

export const agruparDuplicadosBanco = async () => {
  const rows = env.useMemoryDb
    ? memoryBanco.filter((item) => ["pendiente", "enviado"].includes(item.estado) && item.clave_catastral)
    : (await getPool().query(
      `SELECT id, clave_catastral, estado, asignado_a, latitude, comentario_campo, no_duplicado
         FROM banco_clandestinos
        WHERE estado IN ('pendiente', 'enviado') AND clave_catastral <> '' AND no_duplicado = 0
          AND clave_catastral IN (
            SELECT clave_catastral FROM (
              SELECT clave_catastral FROM banco_clandestinos
               WHERE estado IN ('pendiente', 'enviado') AND clave_catastral <> '' AND no_duplicado = 0
               GROUP BY clave_catastral HAVING COUNT(*) > 1
            ) AS repetidas
          )`
    ))[0];
  const plan = planDuplicados(rows);
  for (const { id, principal } of plan) {
    const motivo = `Duplicado: misma clave que el candidato #${principal}`;
    if (env.useMemoryDb) {
      const item = memoryBanco.find((candidate) => candidate.id === id);
      Object.assign(item, { estado: "descartado", duplicado_de: principal, motivo_descarte: motivo, asignado_a: null, asignado_por: null, asignado_at: null, procesado_at: new Date().toISOString() });
      continue;
    }
    await getPool().query(
      `UPDATE banco_clandestinos
          SET estado = 'descartado', duplicado_de = ?, motivo_descarte = ?, asignado_a = NULL, asignado_por = NULL, asignado_at = NULL, procesado_at = CURRENT_TIMESTAMP
        WHERE id = ? AND estado = 'pendiente'`,
      [principal, motivo, id]
    );
  }
  if (plan.length && !env.useMemoryDb) {
    await createAuditLog({ actorUserId: null, action: "banco_clandestinos.duplicados", entityType: "banco_clandestinos", entityId: 0, summary: `${plan.length} ${plan.length === 1 ? "candidato repetido agrupado" : "candidatos repetidos agrupados"} por misma clave`, details: { grupos: plan.slice(0, 200) } });
  }
  return plan.length;
};

// Los datos que ya estaban en el banco se agrupan la primera vez que se abre (y luego
// a lo sumo cada 10 minutos); lo nuevo, al importar o verificar.
let ultimaAgrupacion = 0;
const agruparSiToca = async () => {
  if (Date.now() - ultimaAgrupacion < 10 * 60 * 1000) return;
  ultimaAgrupacion = Date.now();
  try { await agruparDuplicadosBanco(); } catch (error) { ultimaAgrupacion = 0; console.error("No se pudieron agrupar duplicados del banco:", error.message); }
};

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
  summary.duplicados = await agruparDuplicadosBanco();
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.imported", entityType: "banco_clandestinos", entityId: 0, summary: `Banco de clandestinos: ${summary.nuevos} nuevos, ${summary.actualizados} actualizados (${lote || origen})`, details: summary });
  return { ...summary, padron_version: getMasterVersion() };
};

// Clave de Alcaldía sin coincidencia en Aguas -> candidato del banco. origen_ref es
// la clave tal como viene en Alcaldía, así reenviarla no la duplica.
export const candidatoDesdeAlcaldia = (row = {}) => candidatoDesdeFila({
  origen_ref: clean(row.clave_catastral),
  clave_catastral: row.clave_aguas_formato || row.clave_catastral,
  comentario_campo: "Clave de Alcaldía sin coincidencia en Aguas (Consultas del padrón)",
  barrio_colonia: row.caserio || row.direccion
});

// Claves (normalizadas) que ya tienen trabajo: en el banco por otro origen (GPS,
// QField) o con ficha activa. Una consulta por tabla, no una por clave.
const clavesConTrabajo = async (claves = [], origen = "") => {
  const wanted = [...new Set(claves.filter(Boolean))];
  const enBanco = new Set();
  const conFicha = new Set();
  if (!wanted.length) return { enBanco, conFicha };
  const buscadas = new Set(wanted);
  if (env.useMemoryDb) {
    memoryBanco.forEach((item) => { if (item.origen !== origen && buscadas.has(item.clave_catastral)) enBanco.add(item.clave_catastral); });
    (await listInmuebles()).forEach((ficha) => { const clave = normalizarClaveBanco(ficha.clave_catastral); if (buscadas.has(clave)) conFicha.add(clave); });
    return { enBanco, conFicha };
  }
  const [bancoRows] = await getPool().query("SELECT DISTINCT clave_catastral FROM banco_clandestinos WHERE origen <> ? AND clave_catastral IN (?)", [origen, wanted]);
  bancoRows.forEach((row) => enBanco.add(row.clave_catastral));
  // Las fichas guardan la clave tal cual se escribió ("302-6-1" o "302-06-01"):
  // un IN exacto no las encontraría. Se traen las claves activas y se comparan
  // normalizadas (el banco ya guarda las suyas normalizadas).
  const [fichaRows] = await getPool().query("SELECT DISTINCT clave_catastral FROM inmuebles_clandestinos WHERE archived_at IS NULL AND clave_catastral <> ''");
  fichaRows.forEach((row) => { const clave = normalizarClaveBanco(row.clave_catastral); if (buscadas.has(clave)) conFicha.add(clave); });
  return { enBanco, conFicha };
};

/**
 * Manda al banco las claves de Alcaldía elegidas en Consultas del padrón.
 * Omite las que ya están en el banco por otro origen o ya tienen ficha, para
 * no darle a los técnicos el mismo predio dos veces.
 * El cliente solo dice qué claves: los datos salen del padrón de Alcaldía cargado
 * (registros se puede inyectar en pruebas).
 */
export const enviarClavesAlcaldiaAlBanco = async ({ claves = [] } = {}, user, { registros } = {}) => {
  if (!canProcess(user)) throw fail("Tu rol no puede enviar al banco.", 403);
  const elegidas = new Set((Array.isArray(claves) ? claves : []).map(clean).filter(Boolean));
  if (!elegidas.size) throw fail("Elige al menos una clave.");
  if (elegidas.size > MAX_IMPORT_ROWS) throw fail(`Se pueden enviar hasta ${MAX_IMPORT_ROWS} claves a la vez.`, 413);
  // El padrón de Alcaldía trae claves repetidas: una fila por clave, la primera.
  const porClave = new Map();
  (registros || getAlcaldiaRecords()).forEach((row) => {
    const clave = clean(row.clave_catastral);
    if (elegidas.has(clave) && !porClave.has(clave)) porClave.set(clave, row);
  });
  const encontrados = [...porClave.values()];
  if (!encontrados.length) throw fail("Ninguna de esas claves está en el padrón de Alcaldía cargado.", 404);
  const candidatos = encontrados.map(candidatoDesdeAlcaldia);
  const { enBanco, conFicha } = await clavesConTrabajo(candidatos.map((candidato) => candidato.clave_catastral), "alcaldia");
  const aGuardar = candidatos.filter((candidato) => !enBanco.has(candidato.clave_catastral) && !conFicha.has(candidato.clave_catastral));
  const ya_en_banco = candidatos.filter((candidato) => enBanco.has(candidato.clave_catastral)).length;
  const con_ficha = candidatos.filter((candidato) => !enBanco.has(candidato.clave_catastral) && conFicha.has(candidato.clave_catastral)).length;
  const omitidos = elegidas.size - encontrados.length;
  if (!aGuardar.length) return { total: 0, nuevos: 0, actualizados: 0, sin_cambios_procesados: 0, enviados: 0, omitidos, ya_en_banco, con_ficha };
  const lote = `Cruce Alcaldía ${new Date().toISOString().slice(0, 10)}`;
  const resumen = await guardarCandidatos(aGuardar, { origen: "alcaldia", lote }, user);
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.from_alcaldia", entityType: "banco_clandestinos", entityId: 0, summary: `${resumen.nuevos} claves de Alcaldía enviadas al banco (${lote})`, details: { claves: aGuardar.map((candidato) => candidato.origen_ref).slice(0, 500), total: aGuardar.length, ya_en_banco, con_ficha } });
  return { ...resumen, enviados: aGuardar.length, omitidos, ya_en_banco, con_ficha };
};

// Qué claves de un origen ya están en el banco y en qué estado (para marcarlas en la lista).
export const listarRefsBanco = async ({ origen = "" } = {}, user) => {
  if (!canProcess(user)) throw fail("Tu rol no puede consultar el banco.", 403);
  origen = clean(origen).slice(0, 40);
  if (!origen) throw fail("Indica el origen.");
  const rows = env.useMemoryDb
    ? memoryBanco.filter((item) => item.origen === origen)
    : (await getPool().query("SELECT origen_ref, estado FROM banco_clandestinos WHERE origen = ?", [origen]))[0];
  return { origen, items: rows.map((row) => ({ origen_ref: row.origen_ref, estado: row.estado })) };
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
  const duplicados = await agruparDuplicadosBanco();
  const summary = { verificados: pendientes.length, cambiaron: Object.values(cambios).reduce((sum, value) => sum + value, 0), descartados, duplicados, cambios, padron_version: getMasterVersion() };
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

// Quién levantó la ficha ("Responsable" y "Levantamiento de datos" en la ficha técnica):
// el técnico que la manda a ficha. Si la manda administración y el candidato estaba
// asignado, cuenta el técnico asignado, que es quien hizo el trabajo de campo.
export const responsableDeFicha = (candidato, user) => {
  if (user?.role === "admin" && clean(candidato?.asignado_nombre)) return clean(candidato.asignado_nombre).slice(0, 180);
  return clean(user?.full_name || user?.username).slice(0, 180);
};

const fichaDesdeCandidato = (candidato, clave, responsable = "", copias = []) => {
  const hallazgos = [
    candidato.comentario_campo && `Hallazgo de campo: ${candidato.comentario_campo}`,
    ...copias.map((copia) => `También levantado (${copia.origen} #${copia.origen_ref})${clean(copia.comentario_campo) ? `: ${clean(copia.comentario_campo)}` : ""}`),
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
    uso_suelo: candidato.lote_baldio ? "Lote baldío" : "",
    levantamiento_datos: responsable
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

  const responsable = responsableDeFicha(candidato, user);
  const existente = await getByClave(clave);
  if (existente) {
    // La ficha ya existía: si nadie figura como responsable, queda quien la trabajó desde el banco.
    if (responsable && !clean(existente.levantamiento_datos)) {
      if (env.useMemoryDb) existente.levantamiento_datos = responsable;
      else await getPool().query("UPDATE inmuebles_clandestinos SET levantamiento_datos = ? WHERE id = ? AND levantamiento_datos = ''", [responsable, existente.id]);
    }
    await marcarProcesado(id, { estado: "enviado", inmueble_id: existente.id, clave_catastral: clave }, user);
    return { candidato: await getCandidato(id), ficha: existente, ficha_existente: true };
  }
  let ficha;
  try {
    const copias = env.useMemoryDb
      ? memoryBanco.filter((item) => item.duplicado_de === Number(id))
      : (await getPool().query("SELECT origen, origen_ref, comentario_campo FROM banco_clandestinos WHERE duplicado_de = ? ORDER BY id", [id]))[0];
    ficha = await createInmueble(fichaDesdeCandidato(actualizado, clave, responsable, copias), { actorUserId: user?.id });
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
  if (candidato.duplicado_de != null) {
    // Quien lo devuelve dice que no era el mismo predio: no se vuelve a agrupar solo.
    if (env.useMemoryDb) Object.assign(memoryBanco.find((item) => item.id === Number(id)), { duplicado_de: null, no_duplicado: 1 });
    else await getPool().query("UPDATE banco_clandestinos SET duplicado_de = NULL, no_duplicado = 1 WHERE id = ?", [id]);
  }
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.restored", entityType: "banco_clandestinos", entityId: Number(id), summary: `Candidato ${candidato.clave_catastral || `#${candidato.origen_ref}`} devuelto al banco`, details: { motivo_descarte: candidato.motivo_descarte } });
  return getCandidato(id);
};
