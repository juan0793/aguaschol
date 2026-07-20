import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { r2PadronService, validatePadronRecords } from "./r2PadronService.js";

const snapshotColumns = `codigo_lote, total_registros, registros_json, updated_at,
  r2_active_key, r2_active_etag, r2_active_verified_at,
  r2_history_key, r2_history_etag, r2_history_verified_at`;

const getDb = (connection = null) => connection || getPool();

const parseSnapshotRow = (row) => {
  if (!row) return null;
  let records;
  try {
    records = JSON.parse(String(row.registros_json));
  } catch {
    throw new Error("El snapshot MySQL del padron maestro no contiene JSON valido.");
  }
  validatePadronRecords(records, Number(row.total_registros));
  return { ...row, records };
};

export const saveActivePadronSnapshot = async (records, codigoLote = "", connection = null, r2 = {}) => {
  validatePadronRecords(records);
  if (env.useMemoryDb && !connection) return { saved: false, total: records.length, r2 };
  await getDb(connection).query(
    `INSERT INTO padron_maestro_snapshot (
       id, codigo_lote, total_registros, registros_json,
       r2_active_key, r2_active_etag, r2_active_verified_at,
       r2_history_key, r2_history_etag, r2_history_verified_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE codigo_lote=VALUES(codigo_lote), total_registros=VALUES(total_registros),
       registros_json=VALUES(registros_json), r2_active_key=VALUES(r2_active_key),
       r2_active_etag=VALUES(r2_active_etag), r2_active_verified_at=VALUES(r2_active_verified_at),
       r2_history_key=VALUES(r2_history_key), r2_history_etag=VALUES(r2_history_etag),
       r2_history_verified_at=VALUES(r2_history_verified_at)`,
    [
      codigoLote,
      records.length,
      JSON.stringify(records),
      r2.active?.key || null,
      r2.active?.etag || null,
      r2.active?.verified_at ? new Date(r2.active.verified_at) : null,
      r2.historical?.key || null,
      r2.historical?.etag || null,
      r2.historical?.verified_at ? new Date(r2.historical.verified_at) : null
    ]
  );
  return { saved: true, total: records.length, r2 };
};

export const loadActivePadronSnapshot = async (connection = null) => {
  if (env.useMemoryDb && !connection) return null;
  const [rows] = await getDb(connection).query(`SELECT ${snapshotColumns} FROM padron_maestro_snapshot WHERE id=1 LIMIT 1`);
  return parseSnapshotRow(rows[0]);
};

export const getActivePadronStorageMeta = async (connection = null) => {
  if (env.useMemoryDb && !connection) return null;
  const [rows] = await getDb(connection).query(
    `SELECT codigo_lote, total_registros, updated_at, r2_active_key, r2_active_etag, r2_active_verified_at,
      r2_history_key, r2_history_etag, r2_history_verified_at FROM padron_maestro_snapshot WHERE id=1 LIMIT 1`
  );
  return rows[0] || null;
};

export const persistActivePadron = async (
  records,
  codigoLote,
  { connection = null, r2 = r2PadronService, date = new Date() } = {}
) => {
  validatePadronRecords(records);
  const r2Result = r2.configured ? await r2.uploadVersions(records, codigoLote, date) : {};
  await saveActivePadronSnapshot(records, codigoLote, connection, r2Result);
  return { total_records: records.length, r2: r2Result, r2_verified: Boolean(r2Result.active && r2Result.historical) };
};

export const loadPreferredActivePadron = async ({ connection = null, r2 = r2PadronService } = {}) => {
  let r2Error = null;
  if (r2.configured) {
    try {
      const active = await r2.loadActive();
      return { ...active, source: "r2", r2_error: null };
    } catch (error) {
      r2Error = error;
    }
  }

  try {
    const snapshot = await loadActivePadronSnapshot(connection);
    if (snapshot) return { ...snapshot, source: "mysql", r2_error: r2Error?.message || null };
  } catch (mysqlError) {
    if (r2Error) mysqlError.cause = r2Error;
    throw mysqlError;
  }
  return { source: "none", records: null, r2_error: r2Error?.message || null };
};

export const migrateMysqlSnapshotToR2 = async ({ connection = null, r2 = r2PadronService, date = null } = {}) => {
  if (!r2.configured) throw Object.assign(new Error("Cloudflare R2 no esta configurado."), { status: 503 });
  const snapshot = await loadActivePadronSnapshot(connection);
  if (!snapshot) throw Object.assign(new Error("No existe un snapshot MySQL para migrar."), { status: 404 });
  const codigoLote = snapshot.codigo_lote || "MIGRACION-INICIAL";
  const [lots] = await getDb(connection).query(
    "SELECT COALESCE(fecha_extraccion, fecha_recepcion) historical_date FROM importacion_padron_lotes WHERE codigo_lote=? LIMIT 1",
    [codigoLote]
  );
  const historicalDate = date || lots[0]?.historical_date || snapshot.updated_at || new Date();
  const r2Result = await r2.uploadVersions(snapshot.records, codigoLote, historicalDate);
  const duplicatesRemoved = r2.removeHistoricalDuplicates
    ? await r2.removeHistoricalDuplicates(codigoLote, r2Result.historical.key)
    : 0;
  await saveActivePadronSnapshot(snapshot.records, codigoLote, connection, r2Result);
  return { migrated: true, total_records: snapshot.records.length, codigo_lote: snapshot.codigo_lote, duplicates_removed: duplicatesRemoved, r2: r2Result };
};
