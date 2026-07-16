import { getPool } from "../config/db.js";
import { env } from "../config/env.js";

export const saveActivePadronSnapshot = async (records, codigoLote = "", connection = null) => {
  if (env.useMemoryDb && !connection) return { saved: false, total: records.length };
  const db = connection || getPool();
  await db.query(
    `INSERT INTO padron_maestro_snapshot (id, codigo_lote, total_registros, registros_json)
     VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE codigo_lote=VALUES(codigo_lote),
     total_registros=VALUES(total_registros), registros_json=VALUES(registros_json)`,
    [codigoLote, records.length, JSON.stringify(records)]
  );
  return { saved: true, total: records.length };
};

export const loadActivePadronSnapshot = async (connection = null) => {
  if (env.useMemoryDb && !connection) return null;
  const db = connection || getPool();
  const [rows] = await db.query("SELECT codigo_lote, total_registros, registros_json, updated_at FROM padron_maestro_snapshot WHERE id=1 LIMIT 1");
  if (!rows.length) return null;
  const records = JSON.parse(String(rows[0].registros_json));
  if (!Array.isArray(records) || records.length !== Number(rows[0].total_registros)) {
    throw new Error("El snapshot del padron maestro esta incompleto.");
  }
  return { ...rows[0], records };
};
