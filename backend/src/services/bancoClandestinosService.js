import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { getAlcaldiaRecords, getMasterRecords, getMasterVersion } from "./claveLookupService.js";
import { createInmueble, getByClave } from "./inmuebleService.js";
import { likeValue } from "../utils/normalize.js";

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

const candidatoDesdeFila = (row) => ({
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
  longitude: row.longitude == null ? null : Number(row.longitude)
});

const getCandidato = async (id) => {
  if (env.useMemoryDb) return mapCandidato(memoryBanco.find((item) => item.id === Number(id))) || null;
  const [rows] = await getPool().query(
    "SELECT banco_clandestinos.*, COALESCE(app_users.full_name, app_users.username, '') AS procesado_por_nombre FROM banco_clandestinos LEFT JOIN app_users ON app_users.id = banco_clandestinos.procesado_por WHERE banco_clandestinos.id = ? LIMIT 1",
    [id]
  );
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

export const listBancoClandestinos = async ({ query = "", dictamen = "", estado = "pendiente", barrio = "", page = 1, limit = 25 } = {}) => {
  query = clean(query); dictamen = clean(dictamen); estado = clean(estado); barrio = clean(barrio);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 5), 200);
  const requestedPage = Math.max(Number(page) || 1, 1);

  if (env.useMemoryDb) {
    const term = query.toLowerCase();
    const scoped = memoryBanco.filter((item) => (!estado || item.estado === estado) && (!barrio || item.barrio_colonia === barrio) &&
      (!term || [item.clave_catastral, item.abonado_campo, item.barrio_colonia, item.alcaldia_propietario, item.comentario_campo].join(" ").toLowerCase().includes(term)));
    const filtered = scoped.filter((item) => !dictamen || item.dictamen === dictamen);
    const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
    const currentPage = Math.min(requestedPage, totalPages);
    return {
      items: filtered.slice((currentPage - 1) * safeLimit, currentPage * safeLimit).map(mapCandidato),
      total: filtered.length, page: currentPage, total_pages: totalPages,
      counts: Object.fromEntries(BANCO_DICTAMENES.map((key) => [key, scoped.filter((item) => item.dictamen === key).length])),
      estados: Object.fromEntries(BANCO_ESTADOS.map((key) => [key, memoryBanco.filter((item) => item.estado === key).length])),
      barrios: [...new Set(memoryBanco.map((item) => item.barrio_colonia).filter(Boolean))].sort()
    };
  }

  const pool = getPool();
  const searchWhere = "(? = '' OR estado = ?) AND (? = '' OR barrio_colonia = ?) AND (? = '' OR clave_catastral LIKE ? OR abonado_campo LIKE ? OR barrio_colonia LIKE ? OR alcaldia_propietario LIKE ? OR comentario_campo LIKE ?)";
  const searchParams = [estado, estado, barrio, barrio, query, ...Array(5).fill(likeValue(query))];
  const filteredWhere = `${searchWhere} AND (? = '' OR dictamen = ?)`;
  const filteredParams = [...searchParams, dictamen, dictamen];
  const [[countRows], [estadoRows], [barrioRows], [totalRows]] = await Promise.all([
    pool.query(`SELECT dictamen, COUNT(*) AS total FROM banco_clandestinos WHERE ${searchWhere} GROUP BY dictamen`, searchParams),
    pool.query("SELECT estado, COUNT(*) AS total FROM banco_clandestinos GROUP BY estado"),
    pool.query("SELECT DISTINCT barrio_colonia FROM banco_clandestinos WHERE barrio_colonia <> '' ORDER BY barrio_colonia"),
    pool.query(`SELECT COUNT(*) AS total FROM banco_clandestinos WHERE ${filteredWhere}`, filteredParams)
  ]);
  const total = Number(totalRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(requestedPage, totalPages);
  const [items] = await pool.query(
    `SELECT banco_clandestinos.*, COALESCE(app_users.full_name, app_users.username, '') AS procesado_por_nombre
     FROM banco_clandestinos LEFT JOIN app_users ON app_users.id = banco_clandestinos.procesado_por
     WHERE ${filteredWhere}
     ORDER BY FIELD(dictamen, 'clandestino', 'probable', 'sin_determinar', 'registrado'), barrio_colonia, clave_catastral
     LIMIT ? OFFSET ?`,
    [...filteredParams, safeLimit, (currentPage - 1) * safeLimit]
  );
  return {
    items: items.map(mapCandidato),
    total, page: currentPage, total_pages: totalPages,
    counts: Object.fromEntries(BANCO_DICTAMENES.map((key) => [key, Number(countRows.find((row) => row.dictamen === key)?.total || 0)])),
    estados: Object.fromEntries(BANCO_ESTADOS.map((key) => [key, Number(estadoRows.find((row) => row.estado === key)?.total || 0)])),
    barrios: barrioRows.map((row) => row.barrio_colonia)
  };
};

export const importBancoClandestinos = async ({ csv = "", origen = "qfield", lote = "" } = {}, user) => {
  if (user?.role !== "admin") throw fail("Solo administración puede importar al banco.", 403);
  const rows = parseCsv(csv).map(candidatoDesdeFila);
  if (!rows.length) throw fail("El archivo no trae filas.");
  if (rows.length > MAX_IMPORT_ROWS) throw fail(`El banco admite hasta ${MAX_IMPORT_ROWS} filas por importación.`, 413);
  const sinReferencia = rows.filter((row) => !row.origen_ref).length;
  if (sinReferencia) throw fail(`${sinReferencia} filas no traen origen_ref (id del punto). Sin él no se puede evitar duplicados.`);
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
export const verificarBancoClandestinos = async (user) => {
  if (!canProcess(user)) throw fail("Tu rol no puede verificar el banco.", 403);
  const index = currentIndex({ reloadAlcaldia: true });
  const pendientes = env.useMemoryDb
    ? memoryBanco.filter((item) => item.estado === "pendiente")
    : (await getPool().query("SELECT id, clave_catastral, abonado_campo, dictamen FROM banco_clandestinos WHERE estado = 'pendiente'"))[0];
  const cambios = {};
  for (const item of pendientes) {
    const result = dictaminarCandidato(item, index);
    if (result.dictamen !== item.dictamen) {
      const key = `${item.dictamen} → ${result.dictamen}`;
      cambios[key] = (cambios[key] || 0) + 1;
    }
    await guardarDictamen(item.id, result);
  }
  const summary = { verificados: pendientes.length, cambiaron: Object.values(cambios).reduce((sum, value) => sum + value, 0), cambios, padron_version: getMasterVersion() };
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.verified", entityType: "banco_clandestinos", entityId: 0, summary: `Banco verificado contra padrones: ${summary.verificados} candidatos, ${summary.cambiaron} cambiaron`, details: summary });
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
  if (!canProcess(user)) throw fail("Tu rol no puede enviar candidatos a ficha.", 403);
  const candidato = await getCandidato(id);
  if (!candidato) throw fail("Candidato no encontrado.", 404);
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
  if (!canProcess(user)) throw fail("Tu rol no puede descartar candidatos.", 403);
  if (!clean(motivo)) throw fail("Indica el motivo del descarte.");
  const candidato = await getCandidato(id);
  if (!candidato) throw fail("Candidato no encontrado.", 404);
  if (candidato.estado !== "pendiente") throw fail("Este candidato ya fue procesado.", 409);
  await marcarProcesado(id, { estado: "descartado", motivo_descarte: clean(motivo).slice(0, 255) }, user);
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "banco_clandestinos.discarded", entityType: "banco_clandestinos", entityId: Number(id), summary: `Candidato ${candidato.clave_catastral || `#${candidato.origen_ref}`} descartado`, details: { motivo: clean(motivo) } });
  return getCandidato(id);
};

export const restaurarCandidato = async (id, user) => {
  if (!canProcess(user)) throw fail("Tu rol no puede restaurar candidatos.", 403);
  const candidato = await getCandidato(id);
  if (!candidato) throw fail("Candidato no encontrado.", 404);
  if (candidato.estado !== "descartado") throw fail("Solo se pueden devolver al banco los candidatos descartados.", 409);
  await marcarProcesado(id, { estado: "pendiente" }, user);
  return getCandidato(id);
};
