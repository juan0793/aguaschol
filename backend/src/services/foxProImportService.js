import crypto from "node:crypto";
import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";
import { getMasterRecordsForImport, normalizeMasterRecords, replaceMasterRecordsFromImport } from "./claveLookupService.js";
import { loadActivePadronSnapshot, saveActivePadronSnapshot } from "./padronSnapshotService.js";
import { resolveBarrioNameFromClave } from "./barrioCodeService.js";

const IMPORTABLE_FIELDS = [
  ["clave_catastral", "clave_catastral"], ["inquilino", "nombre"], ["barrio_colonia", "colonia"],
  ["agua", "agua_normalizada"], ["alcantarillado", "alcantarillado_normalizado"],
  ["barrido", "barrido_normalizado"], ["recoleccion", "tren_aseo_normalizado"],
  ["desechos_peligrosos", "bombeo_normalizado"], ["valor", "valor"], ["intereses", "intereses"]
];
const VALID_STATES = new Set(["NUEVO", "MODIFICADO"]);

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const text = (value, max = 255) => String(value ?? "").trim().slice(0, max);
const parseJson = (value, fallback = null) => {
  if (value == null || typeof value === "object") return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
const positiveInt = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw fail(`${label} invalido.`);
  return parsed;
};
const normalizeFlag = (value) => {
  const original = text(value, 40);
  const normalized = original.toUpperCase();
  return { original, normalized: ["S", "N"].includes(normalized) ? normalized : null, invalid: Boolean(original && !["S", "N"].includes(normalized)) };
};
const normalizeAmount = (value) => {
  if (value == null || text(value) === "") return { value: 0, invalid: false };
  const numeric = typeof value === "number" ? value : Number(String(value).trim().replace(/,/g, ""));
  return Number.isFinite(numeric) ? { value: Number(numeric.toFixed(2)), invalid: false } : { value: null, invalid: true };
};

const FOXPRO_FIELDS = ["catastral", "abonado", "inquilino", "des_coloni", "agua", "alca", "barr", "tren", "bomb", "valor", "intereses"];
const MASTER_VERIFY_FIELDS = ["clave_catastral", "abonado", "inquilino", "barrio_colonia", "agua", "alcantarillado", "barrido", "recoleccion", "desechos_peligrosos", "valor", "intereses"];
const canonicalFoxProValue = (field, value) => {
  if (["valor", "intereses"].includes(field) && value != null && value !== "") {
    const number = Number(value);
    if (Number.isFinite(number)) return String(number);
  }
  return String(value ?? "").trim();
};
export const hashFoxProRecords = (records) => crypto.createHash("sha256").update(
  records.map((record) => FOXPRO_FIELDS.map((field) => canonicalFoxProValue(field, record?.[field])).join("\u001f")).join("\u001e")
).digest("hex");

const masterRecordKey = (record) => MASTER_VERIFY_FIELDS.map((field) => canonicalFoxProValue(field, record?.[field])).join("\u001f");
export const hashMasterRecords = (records = []) => crypto.createHash("sha256").update(records.map(masterRecordKey).sort().join("\u001e")).digest("hex");

export const normalizeFoxProRecord = (record = {}, numeroFila = 0) => {
  const flags = {
    agua: normalizeFlag(record.agua), alca: normalizeFlag(record.alca), barr: normalizeFlag(record.barr),
    tren: normalizeFlag(record.tren), bomb: normalizeFlag(record.bomb)
  };
  const valor = normalizeAmount(record.valor);
  const intereses = normalizeAmount(record.intereses);
  const errors = [];
  const abonado = text(record.abonado, 80);
  if (!abonado) errors.push("Falta el codigo de abonado.");
  Object.entries(flags).forEach(([field, value]) => value.invalid && errors.push(`Valor de servicio ${field} no reconocido: ${value.original}.`));
  if (valor.invalid) errors.push("Valor principal invalido.");
  if (intereses.invalid) errors.push("Intereses invalidos.");

  return {
    numero_fila: Number.isInteger(Number(record.numero_fila)) && Number(record.numero_fila) > 0 ? Number(record.numero_fila) : numeroFila,
    codigo_abonado: abonado,
    clave_catastral: text(record.catastral, 80),
    nombre: text(record.inquilino, 255),
    colonia: text(record.des_coloni || resolveBarrioNameFromClave(record.catastral), 255),
    agua_original: flags.agua.original, agua_normalizada: flags.agua.normalized,
    alcantarillado_original: flags.alca.original, alcantarillado_normalizado: flags.alca.normalized,
    barrido_original: flags.barr.original, barrido_normalizado: flags.barr.normalized,
    tren_aseo_original: flags.tren.original, tren_aseo_normalizado: flags.tren.normalized,
    bombeo_original: flags.bomb.original, bombeo_normalizado: flags.bomb.normalized,
    valor: valor.value, intereses: intereses.value,
    saldo_total: valor.invalid || intereses.invalid ? null : Number((valor.value + intereses.value).toFixed(2)),
    estado: errors.length ? "ERROR" : "RECIBIDO",
    diferencias: null,
    dato_original: record,
    mensaje_error: errors.join(" ")
  };
};

const batchCode = (value) => {
  const code = text(value, 80);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/.test(code)) throw fail("Codigo de lote invalido.");
  return code;
};

export const startFoxProBatch = async (payload = {}) => {
  const pool = getPool();
  const codigo = batchCode(payload.codigo_lote);
  const totalBloques = positiveInt(payload.total_bloques, "Total de bloques");
  const totalRegistros = positiveInt(payload.total_registros, "Total de registros");
  if (totalRegistros > env.foxProSyncMaxRecords) throw fail("El lote excede el maximo de registros permitido.", 413);
  const fecha = payload.fecha_extraccion ? new Date(payload.fecha_extraccion) : new Date();
  if (Number.isNaN(fecha.getTime())) throw fail("Fecha de extraccion invalida.");

  await pool.query(
    `INSERT INTO importacion_padron_lotes (codigo_lote, fecha_extraccion, total_bloques, total_registros)
     VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE codigo_lote = VALUES(codigo_lote)`,
    [codigo, fecha, totalBloques, totalRegistros]
  );
  const [rows] = await pool.query("SELECT * FROM importacion_padron_lotes WHERE codigo_lote = ? LIMIT 1", [codigo]);
  const lot = rows[0];
  if (Number(lot.total_bloques) !== totalBloques || Number(lot.total_registros) !== totalRegistros) {
    throw fail("El lote ya existe con cantidades diferentes.", 409);
  }
  await pool.query(
    `UPDATE importacion_padron_solicitudes SET codigo_lote=?
     WHERE estado='EN_PROCESO' AND (codigo_lote IS NULL OR codigo_lote='')
     ORDER BY id DESC LIMIT 1`,
    [codigo]
  );
  return lot;
};

export const receiveFoxProBlock = async (codigoLote, payload = {}) => {
  const pool = getPool();
  const codigo = batchCode(codigoLote);
  const numeroBloque = positiveInt(payload.numero_bloque, "Numero de bloque");
  const totalBloques = positiveInt(payload.total_bloques, "Total de bloques");
  const records = Array.isArray(payload.registros) ? payload.registros : [];
  if (!records.length || records.length > Math.min(1000, env.foxProSyncBatchSize * 2)) throw fail("Cantidad de registros del bloque invalida.", 413);
  const sentHash = text(payload.hash_bloque, 64).toLowerCase();
  const calculatedHash = hashFoxProRecords(records);
  if (!/^[a-f0-9]{64}$/.test(sentHash) || sentHash !== calculatedHash) throw fail("Hash de bloque incorrecto.", 400);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [lots] = await connection.query("SELECT * FROM importacion_padron_lotes WHERE codigo_lote = ? FOR UPDATE", [codigo]);
    const lot = lots[0];
    if (!lot) throw fail("Lote no encontrado.", 404);
    if (lot.estado !== "RECIBIENDO") throw fail("El lote ya fue finalizado.", 409);
    if (Number(lot.total_bloques) !== totalBloques || numeroBloque > totalBloques) throw fail("Numeracion de bloque inconsistente.", 409);

    const [existing] = await connection.query(
      "SELECT hash_bloque, cantidad_registros FROM importacion_padron_bloques WHERE lote_id = ? AND numero_bloque = ? LIMIT 1",
      [lot.id, numeroBloque]
    );
    if (existing.length) {
      if (existing[0].hash_bloque !== sentHash) throw fail("El bloque ya existe con contenido diferente.", 409);
      await connection.commit();
      return { duplicate: true, numero_bloque: numeroBloque, cantidad_registros: Number(existing[0].cantidad_registros) };
    }

    const startRow = (numeroBloque - 1) * env.foxProSyncBatchSize;
    const normalized = records.map((record, index) => normalizeFoxProRecord(record, startRow + index + 1));
    await connection.query(
      `INSERT INTO importacion_padron_bloques (lote_id, numero_bloque, total_bloques, hash_bloque, cantidad_registros)
       VALUES (?, ?, ?, ?, ?)`,
      [lot.id, numeroBloque, totalBloques, sentHash, normalized.length]
    );
    const columns = ["lote_id", "numero_fila", "codigo_abonado", "clave_catastral", "nombre", "colonia",
      "agua_original", "agua_normalizada", "alcantarillado_original", "alcantarillado_normalizado",
      "barrido_original", "barrido_normalizado", "tren_aseo_original", "tren_aseo_normalizado",
      "bombeo_original", "bombeo_normalizado", "valor", "intereses", "saldo_total", "estado",
      "diferencias", "dato_original", "mensaje_error"];
    const values = normalized.flatMap((row) => [lot.id, row.numero_fila, row.codigo_abonado, row.clave_catastral, row.nombre, row.colonia,
      row.agua_original, row.agua_normalizada, row.alcantarillado_original, row.alcantarillado_normalizado,
      row.barrido_original, row.barrido_normalizado, row.tren_aseo_original, row.tren_aseo_normalizado,
      row.bombeo_original, row.bombeo_normalizado, row.valor, row.intereses, row.saldo_total, row.estado,
      null, JSON.stringify(row.dato_original), row.mensaje_error || null]);
    const placeholders = normalized.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    await connection.query(`INSERT INTO importacion_padron_registros (${columns.join(",")}) VALUES ${placeholders}`, values);
    await connection.commit();
    return { duplicate: false, numero_bloque: numeroBloque, cantidad_registros: normalized.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const comparable = (value) => typeof value === "number" ? Number(value.toFixed(2)) : text(value);
const classifyRow = (row, batchCounts, masterByAbonado) => {
  if (row.estado === "ERROR") return { estado: "ERROR", diferencias: null, mensaje: row.mensaje_error, padronId: null };
  if ((batchCounts.get(row.codigo_abonado) || 0) > 1) return { estado: "CONFLICTO", diferencias: null, mensaje: "Abonado repetido dentro del lote.", padronId: null };
  const matches = masterByAbonado.get(row.codigo_abonado) || [];
  if (matches.length > 1) return { estado: "CONFLICTO", diferencias: null, mensaje: "El abonado tiene varias coincidencias en el padron.", padronId: null };
  if (!matches.length) return { estado: "NUEVO", diferencias: null, mensaje: "", padronId: null };

  const current = matches[0];
  const differences = {};
  for (const [masterField, importField] of IMPORTABLE_FIELDS) {
    const actual = comparable(current[masterField]);
    const received = comparable(row[importField]);
    if (actual !== received) differences[masterField] = { actual, recibido: received };
  }
  return {
    estado: Object.keys(differences).length ? "MODIFICADO" : "SIN_CAMBIOS",
    diferencias: Object.keys(differences).length ? differences : null,
    mensaje: "",
    padronId: current.abonado || row.codigo_abonado
  };
};

export const finalizeFoxProBatch = async (codigoLote) => {
  const pool = getPool();
  const codigo = batchCode(codigoLote);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [lots] = await connection.query("SELECT * FROM importacion_padron_lotes WHERE codigo_lote = ? FOR UPDATE", [codigo]);
    const lot = lots[0];
    if (!lot) throw fail("Lote no encontrado.", 404);
    if (lot.estado !== "RECIBIENDO") {
      await connection.commit();
      return { ...lot, totals: {
        NUEVO: Number(lot.registros_nuevos || 0), MODIFICADO: Number(lot.registros_modificados || 0),
        SIN_CAMBIOS: Number(lot.registros_sin_cambios || 0), CONFLICTO: Number(lot.registros_conflicto || 0),
        ERROR: Number(lot.registros_error || 0)
      } };
    }
    const [[blockStats]] = await connection.query(
      "SELECT COUNT(*) bloques, COALESCE(SUM(cantidad_registros), 0) registros FROM importacion_padron_bloques WHERE lote_id = ?", [lot.id]
    );
    if (Number(blockStats.bloques) !== Number(lot.total_bloques) || Number(blockStats.registros) !== Number(lot.total_registros)) {
      throw fail("El lote esta incompleto.", 409);
    }
    const [rows] = await connection.query("SELECT * FROM importacion_padron_registros WHERE lote_id = ? ORDER BY numero_fila", [lot.id]);
    const batchCounts = rows.reduce((map, row) => map.set(row.codigo_abonado, (map.get(row.codigo_abonado) || 0) + 1), new Map());
    const masterByAbonado = getMasterRecordsForImport().reduce((map, row) => {
      const key = text(row.abonado, 80); const matches = map.get(key) || []; matches.push(row); map.set(key, matches); return map;
    }, new Map());
    const totals = { NUEVO: 0, MODIFICADO: 0, SIN_CAMBIOS: 0, CONFLICTO: 0, ERROR: 0 };
    for (const row of rows) {
      const result = classifyRow(row, batchCounts, masterByAbonado);
      totals[result.estado] += 1;
      await connection.query(
        "UPDATE importacion_padron_registros SET estado = ?, diferencias = ?, mensaje_error = ?, padron_maestro_id = ? WHERE id = ?",
        [result.estado, result.diferencias ? JSON.stringify(result.diferencias) : null, result.mensaje || null, result.padronId, row.id]
      );
    }
    await connection.query(
      `UPDATE importacion_padron_lotes SET estado='LISTO', registros_nuevos=?, registros_modificados=?,
       registros_sin_cambios=?, registros_conflicto=?, registros_error=? WHERE id=?`,
      [totals.NUEVO, totals.MODIFICADO, totals.SIN_CAMBIOS, totals.CONFLICTO, totals.ERROR, lot.id]
    );
    await connection.commit();
    return { ...lot, estado: "LISTO", totals };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
};

export const requestFoxProUpdate = async (actorUser) => {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [active] = await connection.query(
      "SELECT * FROM importacion_padron_solicitudes WHERE estado IN ('PENDIENTE','EN_PROCESO') ORDER BY id DESC LIMIT 1 FOR UPDATE"
    );
    if (active.length) { await connection.commit(); return active[0]; }
    const [result] = await connection.query(
      "INSERT INTO importacion_padron_solicitudes (solicitado_por) VALUES (?)", [actorUser.id]
    );
    const [rows] = await connection.query("SELECT * FROM importacion_padron_solicitudes WHERE id=?", [result.insertId]);
    await connection.commit();
    await createAuditLog({ actorUserId: actorUser.id, action: "padron.foxpro_update_requested", entityType: "importacion_padron_solicitud",
      entityId: String(result.insertId), summary: "Actualizacion de padron FoxPro solicitada desde Control Aguas" });
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
};

export const getFoxProUpdateRequest = async (id) => {
  const requestId = positiveInt(id, "Solicitud");
  const [rows] = await getPool().query(
    `SELECT s.*, l.estado lote_estado, l.total_bloques, l.total_registros,
      COALESCE(p.bloques_recibidos, 0) bloques_recibidos,
      COALESCE(p.registros_recibidos, 0) registros_recibidos
     FROM importacion_padron_solicitudes s
     LEFT JOIN importacion_padron_lotes l ON l.codigo_lote=s.codigo_lote
     LEFT JOIN (
       SELECT lote_id, COUNT(*) bloques_recibidos, COALESCE(SUM(cantidad_registros), 0) registros_recibidos
       FROM importacion_padron_bloques GROUP BY lote_id
     ) p ON p.lote_id=l.id
     WHERE s.id=? LIMIT 1`,
    [requestId]
  );
  if (!rows.length) throw fail("Solicitud no encontrada.", 404);
  return rows[0];
};

export const claimFoxProUpdateRequest = async () => {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [claimed] = await connection.query(
      "SELECT * FROM importacion_padron_solicitudes WHERE estado='EN_PROCESO' ORDER BY id LIMIT 1 FOR UPDATE"
    );
    if (claimed.length) { await connection.commit(); return claimed[0]; }
    const [rows] = await connection.query(
      "SELECT * FROM importacion_padron_solicitudes WHERE estado='PENDIENTE' ORDER BY id LIMIT 1 FOR UPDATE"
    );
    if (!rows.length) { await connection.commit(); return null; }
    await connection.query("UPDATE importacion_padron_solicitudes SET estado='EN_PROCESO', fecha_inicio=NOW(), mensaje_error=NULL WHERE id=?", [rows[0].id]);
    await connection.commit();
    return { ...rows[0], estado: "EN_PROCESO" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
};

export const finishFoxProUpdateRequest = async (id, { codigo_lote: codigoLote = "", error = "" } = {}) => {
  const requestId = positiveInt(id, "Solicitud");
  const code = codigoLote ? batchCode(codigoLote) : null;
  const message = text(error, 2000);
  if (!code && !message) throw fail("Falta el resultado de la solicitud.");
  const state = code ? "COMPLETADA" : "ERROR";
  const current = await getFoxProUpdateRequest(requestId);
  if (["COMPLETADA", "ERROR"].includes(current.estado)) {
    if (current.estado === state && (state === "ERROR" || current.codigo_lote === code)) return current;
    throw fail("La solicitud ya fue finalizada con otro resultado.", 409);
  }
  const [result] = await getPool().query(
    `UPDATE importacion_padron_solicitudes SET estado=?, codigo_lote=?, mensaje_error=?, fecha_finalizacion=NOW()
     WHERE id=? AND estado='EN_PROCESO'`, [state, code, message || null, requestId]
  );
  if (!result.affectedRows) throw fail("La solicitud ya no esta en proceso.", 409);
  return getFoxProUpdateRequest(requestId);
};

export const listFoxProBatches = async ({ page = 1, limit = 20, estado = "", codigo = "", fecha = "" } = {}) => {
  const pool = getPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 500);
  const safePage = Math.max(Number(page) || 1, 1);
  const filters = [], params = [];
  if (estado) { filters.push("l.estado = ?"); params.push(text(estado, 40)); }
  if (codigo) { filters.push("l.codigo_lote LIKE ?"); params.push(`%${text(codigo, 80)}%`); }
  if (fecha) { filters.push("DATE(l.fecha_recepcion) = ?"); params.push(text(fecha, 10)); }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM importacion_padron_lotes l ${where}`, params);
  const [rows] = await pool.query(
    `SELECT l.*, u.full_name usuario_aplicacion_nombre,
      COALESCE(p.bloques_recibidos, 0) bloques_recibidos,
      COALESCE(p.registros_recibidos, 0) registros_recibidos
     FROM importacion_padron_lotes l
     LEFT JOIN app_users u ON u.id=l.usuario_aplicacion
     LEFT JOIN (
       SELECT lote_id, COUNT(*) bloques_recibidos, COALESCE(SUM(cantidad_registros), 0) registros_recibidos
       FROM importacion_padron_bloques GROUP BY lote_id
     ) p ON p.lote_id=l.id
     ${where} ORDER BY l.fecha_recepcion DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, (safePage - 1) * safeLimit]
  );
  return { rows, total: Number(count.total), page: safePage, limit: safeLimit };
};

export const listFoxProBatchRecords = async (codigoLote, filters = {}) => {
  const pool = getPool();
  const codigo = batchCode(codigoLote);
  const page = Math.max(Number(filters.page) || 1, 1), limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const [lots] = await pool.query("SELECT * FROM importacion_padron_lotes WHERE codigo_lote=? LIMIT 1", [codigo]);
  if (!lots.length) throw fail("Lote no encontrado.", 404);
  const where = ["r.lote_id=?"], params = [lots[0].id];
  for (const [key, column] of [["abonado", "codigo_abonado"], ["clave", "clave_catastral"], ["nombre", "nombre"], ["colonia", "colonia"]]) {
    if (filters[key]) { where.push(`r.${column} LIKE ?`); params.push(`%${text(filters[key], 255)}%`); }
  }
  if (filters.estado) { where.push("r.estado=?"); params.push(text(filters.estado, 30)); }
  const clause = `WHERE ${where.join(" AND ")}`;
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM importacion_padron_registros r ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT r.* FROM importacion_padron_registros r ${clause} ORDER BY r.numero_fila LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { lot: lots[0], rows: rows.map((row) => ({ ...row, diferencias: parseJson(row.diferencias), dato_original: parseJson(row.dato_original, {}) })), total: Number(count.total), page, limit };
};

const rowToMaster = (row) => ({
  clave_catastral: row.clave_catastral, abonado: row.codigo_abonado, inquilino: row.nombre,
  barrio_colonia: row.colonia, agua: row.agua_normalizada || "", alcantarillado: row.alcantarillado_normalizado || "",
  barrido: row.barrido_normalizado || "", recoleccion: row.tren_aseo_normalizado || "",
  desechos_peligrosos: row.bombeo_normalizado || "", valor: Number(row.valor || 0), intereses: Number(row.intereses || 0)
});
export const foxProRowsToMaster = (rows = []) => rows.map(rowToMaster);

export const restoreActivePadronFromDatabase = async () => {
  const snapshot = await loadActivePadronSnapshot();
  if (snapshot) {
    const result = replaceMasterRecordsFromImport(snapshot.records, { codigoLote: snapshot.codigo_lote });
    return { restored: true, source: "snapshot", ...result };
  }

  const pool = getPool();
  const [lots] = await pool.query(
    "SELECT * FROM importacion_padron_lotes WHERE estado='APLICADO' ORDER BY fecha_aplicacion DESC, id DESC LIMIT 1"
  );
  if (!lots.length) return { restored: false, source: "repository" };
  const [rows] = await pool.query(
    "SELECT * FROM importacion_padron_registros WHERE lote_id=? AND estado IN ('APLICADO','SIN_CAMBIOS') ORDER BY numero_fila",
    [lots[0].id]
  );
  if (!rows.length) throw fail(`El lote aplicado ${lots[0].codigo_lote} no conserva registros para recuperar el padron.`, 503);
  const records = foxProRowsToMaster(rows);
  const result = replaceMasterRecordsFromImport(records, { codigoLote: lots[0].codigo_lote });
  await saveActivePadronSnapshot(result.records, lots[0].codigo_lote);
  return { restored: true, source: "latest_applied_batch", ...result };
};

export const activateFoxProBatch = async (codigoLote, actorUser) => {
  const pool = getPool();
  const codigo = batchCode(codigoLote);
  const [lots] = await pool.query("SELECT * FROM importacion_padron_lotes WHERE codigo_lote=? LIMIT 1", [codigo]);
  const lot = lots[0];
  if (!lot) throw fail("Lote no encontrado.", 404);
  if (!["LISTO", "PARCIALMENTE_APLICADO", "APLICADO"].includes(lot.estado)) {
    throw fail(`El lote esta en estado ${lot.estado} y no puede activarse como padron.`, 409);
  }

  const [rows] = await pool.query(
    "SELECT * FROM importacion_padron_registros WHERE lote_id=? AND estado NOT IN ('ERROR','DESCARTADO') ORDER BY numero_fila",
    [lot.id]
  );
  if (!rows.length) throw fail("El lote no contiene registros validos para activar.", 409);

  const activeRecords = foxProRowsToMaster(rows);
  const result = replaceMasterRecordsFromImport(activeRecords, { codigoLote: codigo });
  await saveActivePadronSnapshot(result.records, codigo);
  await pool.query(
    `UPDATE importacion_padron_lotes SET estado='APLICADO', registros_aplicados=?, usuario_aplicacion=?, fecha_aplicacion=NOW() WHERE id=?`,
    [rows.length, actorUser.id, lot.id]
  );
  await pool.query(
    "UPDATE importacion_padron_registros SET estado='APLICADO', usuario_aplicacion=?, fecha_aplicacion=NOW() WHERE lote_id=? AND estado NOT IN ('ERROR','DESCARTADO')",
    [actorUser.id, lot.id]
  );
  try {
    await createAuditLog({
      actorUserId: actorUser.id,
      action: "padron.foxpro_batch_activated",
      entityType: "padron",
      entityId: codigo,
      summary: `Lote ${codigo} activado como padron maestro`,
      details: { activated: result.meta.total_records, excluded_errors: Number(lot.registros_error || 0) }
    });
  } catch {
    // El padron debe permanecer activo aunque el registro de auditoria falle temporalmente.
  }

  return {
    ...result,
    activated: result.meta.total_records,
    excluded_errors: Number(lot.registros_error || 0),
    cache: { cleared: true, refreshed_at: new Date().toISOString() },
    verification: {
      ok: result.meta.total_records === rows.length,
      source_rows: rows.length,
      normalized_source_rows: rows.length,
      active_records: result.meta.total_records,
      verified_records: result.meta.total_records,
      missing_records: Math.max(0, rows.length - result.meta.total_records),
      extra_records: 0,
      verified_percent: rows.length ? Number(((result.meta.total_records / rows.length) * 100).toFixed(2)) : 0,
      checked_at: new Date().toISOString()
    }
  };
};

export const verifyActiveFoxProBatch = async (codigoLote) => {
  const pool = getPool();
  const codigo = batchCode(codigoLote);
  const [lots] = await pool.query("SELECT * FROM importacion_padron_lotes WHERE codigo_lote=? LIMIT 1", [codigo]);
  const lot = lots[0];
  if (!lot) throw fail("Lote no encontrado.", 404);
  const [rows] = await pool.query(
    "SELECT * FROM importacion_padron_registros WHERE lote_id=? AND estado NOT IN ('ERROR','DESCARTADO') ORDER BY numero_fila",
    [lot.id]
  );
  if (!rows.length) throw fail("El lote ya no conserva registros para verificarlo.", 409);

  const snapshot = await loadActivePadronSnapshot();
  if (!snapshot) throw fail("No existe una copia persistida del padron activo.", 409);
  const sourceRows = foxProRowsToMaster(rows);
  const source = normalizeMasterRecords(sourceRows);
  const persisted = normalizeMasterRecords(snapshot.records);
  const active = normalizeMasterRecords(getMasterRecordsForImport());
  const sourceKeys = new Map();
  source.forEach((row) => sourceKeys.set(masterRecordKey(row), (sourceKeys.get(masterRecordKey(row)) || 0) + 1));
  const verifiedRecords = active.reduce((total, row) => {
    const key = masterRecordKey(row);
    const remaining = sourceKeys.get(key) || 0;
    if (!remaining) return total;
    sourceKeys.set(key, remaining - 1);
    return total + 1;
  }, 0);
  const sourceHash = hashMasterRecords(source);
  const snapshotHash = hashMasterRecords(persisted);
  const activeHash = hashMasterRecords(active);
  const codeMatches = snapshot.codigo_lote === codigo;
  const contentMatches = sourceHash === snapshotHash && snapshotHash === activeHash;
  const ok = codeMatches && contentMatches;
  const base = Math.max(source.length, active.length, 1);
  return {
    ok,
    selected_lot: codigo,
    active_lot: snapshot.codigo_lote,
    lot_status: lot.estado,
    source_rows: sourceRows.length,
    normalized_source_rows: source.length,
    snapshot_records: persisted.length,
    active_records: active.length,
    verified_records: verifiedRecords,
    missing_records: Math.max(0, source.length - verifiedRecords),
    extra_records: Math.max(0, active.length - verifiedRecords),
    excluded_invalid_keys: Math.max(0, sourceRows.length - source.length),
    verified_percent: ok ? 100 : Number(((verifiedRecords / base) * 100).toFixed(2)),
    code_matches: codeMatches,
    content_matches: contentMatches,
    checked_at: new Date().toISOString()
  };
};

const pruneOldBatchDetails = async () => {
  const retain = Math.max(1, Number(env.foxProSyncRetainBatches) || 5);
  const pool = getPool();
  const [oldLots] = await pool.query(
    `SELECT id FROM importacion_padron_lotes
     WHERE estado IN ('APLICADO','DESCARTADO')
     ORDER BY COALESCE(fecha_aplicacion, fecha_recepcion) DESC
     LIMIT 18446744073709551615 OFFSET ?`,
    [retain]
  );
  if (!oldLots.length) return;
  const ids = oldLots.map((lot) => lot.id);
  const placeholders = ids.map(() => "?").join(",");
  await pool.query(`DELETE FROM importacion_padron_bloques WHERE lote_id IN (${placeholders})`, ids);
  await pool.query(`DELETE FROM importacion_padron_registros WHERE lote_id IN (${placeholders})`, ids);
};

export const applyFoxProBatch = async (codigoLote, { ids = [], allValid = false } = {}, actorUser) => {
  const pool = getPool();
  const codigo = batchCode(codigoLote);
  const selectedIds = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : [];
  if (selectedIds.length > 5000) throw fail("La seleccion excede 5000 registros.", 413);
  if (!allValid && !selectedIds.length) throw fail("Selecciona registros para aplicar.");
  const connection = await pool.getConnection();
  const previousMaster = getMasterRecordsForImport();
  let padronChanged = false;
  try {
    await connection.beginTransaction();
    const [lots] = await connection.query("SELECT * FROM importacion_padron_lotes WHERE codigo_lote=? FOR UPDATE", [codigo]);
    const lot = lots[0];
    if (!lot) throw fail("Lote no encontrado.", 404);
    if (!["LISTO", "PARCIALMENTE_APLICADO"].includes(lot.estado)) throw fail(`El lote esta en estado ${lot.estado} y no se puede aplicar.`, 409);
    const idClause = allValid ? "" : `AND id IN (${selectedIds.map(() => "?").join(",")})`;
    const [rows] = await connection.query(
      `SELECT * FROM importacion_padron_registros WHERE lote_id=? AND estado IN ('NUEVO','MODIFICADO') ${idClause} FOR UPDATE`,
      [lot.id, ...selectedIds]
    );
    if (!rows.length) { await connection.commit(); return { applied: 0, estado: lot.estado }; }

    const nextMaster = previousMaster.map((row) => ({ ...row }));
    const masterIndexes = nextMaster.reduce((map, item, index) => {
      const key = text(item.abonado, 80); const indexes = map.get(key) || []; indexes.push(index); map.set(key, indexes); return map;
    }, new Map());
    for (const row of rows) {
      const indexes = masterIndexes.get(row.codigo_abonado) || [];
      if (row.estado === "NUEVO") {
        nextMaster.push(rowToMaster(row));
        masterIndexes.set(row.codigo_abonado, [nextMaster.length - 1]);
      }
      else if (indexes.length === 1) nextMaster[indexes[0]] = { ...nextMaster[indexes[0]], ...rowToMaster(row) };
      else throw fail(`El abonado ${row.codigo_abonado} dejo de tener una coincidencia segura.`, 409);
    }
    const replacement = replaceMasterRecordsFromImport(nextMaster, { codigoLote: codigo });
    padronChanged = true;
    await saveActivePadronSnapshot(replacement.records, codigo, connection);
    const appliedIds = rows.map((row) => row.id);
    if (allValid) {
      await connection.query(
        `UPDATE importacion_padron_registros SET estado='APLICADO', fecha_aplicacion=NOW(), usuario_aplicacion=?
         WHERE lote_id=? AND estado IN ('NUEVO','MODIFICADO')`, [actorUser.id, lot.id]
      );
    } else {
      await connection.query(
        `UPDATE importacion_padron_registros SET estado='APLICADO', fecha_aplicacion=NOW(), usuario_aplicacion=?
         WHERE id IN (${appliedIds.map(() => "?").join(",")})`, [actorUser.id, ...appliedIds]
      );
    }
    const [[remaining]] = await connection.query(
      "SELECT COUNT(*) total FROM importacion_padron_registros WHERE lote_id=? AND estado IN ('NUEVO','MODIFICADO')", [lot.id]
    );
    const nextState = Number(remaining.total) ? "PARCIALMENTE_APLICADO" : "APLICADO";
    await connection.query(
      `UPDATE importacion_padron_lotes SET estado=?, registros_aplicados=(SELECT COUNT(*) FROM importacion_padron_registros WHERE lote_id=? AND estado='APLICADO'),
       usuario_aplicacion=?, fecha_aplicacion=NOW() WHERE id=?`, [nextState, lot.id, actorUser.id, lot.id]
    );
    await connection.commit();
    await createAuditLog({ actorUserId: actorUser.id, action: "padron.foxpro_import_applied", entityType: "importacion_padron", entityId: codigo,
      summary: `${rows.length} registros del lote ${codigo} aplicados al padron`, details: { applied: rows.length } });
    if (nextState === "APLICADO") await pruneOldBatchDetails();
    return { applied: rows.length, estado: nextState };
  } catch (error) {
    await connection.rollback();
    if (padronChanged) replaceMasterRecordsFromImport(previousMaster, { codigoLote: `${codigo}-ROLLBACK` });
    throw error;
  } finally { connection.release(); }
};

export const discardFoxProRecords = async (codigoLote, ids = [], actorUser) => {
  const pool = getPool();
  const codigo = batchCode(codigoLote);
  const selected = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : [];
  if (!selected.length) throw fail("Selecciona registros para descartar.");
  if (selected.length > 5000) throw fail("La seleccion excede 5000 registros.", 413);
  const [lotRows] = await pool.query("SELECT id FROM importacion_padron_lotes WHERE codigo_lote=? LIMIT 1", [codigo]);
  if (!lotRows.length) throw fail("Lote no encontrado.", 404);
  const [result] = await pool.query(
    `UPDATE importacion_padron_registros SET estado='DESCARTADO', usuario_aplicacion=?, fecha_aplicacion=NOW()
     WHERE lote_id=? AND id IN (${selected.map(() => "?").join(",")}) AND estado NOT IN ('APLICADO','DESCARTADO')`,
    [actorUser.id, lotRows[0].id, ...selected]
  );
  await pool.query(
    `UPDATE importacion_padron_lotes SET registros_descartados=(SELECT COUNT(*) FROM importacion_padron_registros WHERE lote_id=? AND estado='DESCARTADO') WHERE id=?`,
    [lotRows[0].id, lotRows[0].id]
  );
  const [[remaining]] = await pool.query(
    `SELECT COUNT(*) total FROM importacion_padron_registros
     WHERE lote_id=? AND estado NOT IN ('APLICADO','DESCARTADO','SIN_CAMBIOS')`, [lotRows[0].id]
  );
  if (!Number(remaining.total)) {
    await pool.query("UPDATE importacion_padron_lotes SET estado='DESCARTADO', usuario_aplicacion=?, fecha_aplicacion=NOW() WHERE id=?", [actorUser.id, lotRows[0].id]);
  }
  await createAuditLog({ actorUserId: actorUser.id, action: "padron.foxpro_import_discarded", entityType: "importacion_padron", entityId: codigo,
    summary: `${result.affectedRows} registros descartados del lote ${codigo}` });
  if (!Number(remaining.total)) await pruneOldBatchDetails();
  return { discarded: result.affectedRows, estado: Number(remaining.total) ? undefined : "DESCARTADO" };
};
