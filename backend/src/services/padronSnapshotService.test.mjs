import assert from "node:assert/strict";
import test from "node:test";
import {
  loadActivePadronSnapshot,
  loadPreferredActivePadron,
  migrateMysqlSnapshotToR2,
  saveActivePadronSnapshot
} from "./padronSnapshotService.js";

test("guarda y valida el snapshot completo del padron", async () => {
  const records = [{ clave_catastral: "01-05-09-01", valor: 800, intereses: 0 }];
  let stored;
  const db = { query: async (sql, params) => {
    if (sql.startsWith("INSERT")) { stored = params; return [{ affectedRows: 1 }]; }
    return [[{ codigo_lote: stored[0], total_registros: stored[1], registros_json: stored[2], updated_at: new Date() }]];
  } };
  await saveActivePadronSnapshot(records, "FOXPRO-HOY", db);
  assert.match(stored[2], /^gzip:/);
  const snapshot = await loadActivePadronSnapshot(db);
  assert.equal(snapshot.codigo_lote, "FOXPRO-HOY");
  assert.deepEqual(snapshot.records, records);
});

test("prefiere el padron activo de R2", async () => {
  const records = [{ clave_catastral: "01-05-09-01", abonado: "1" }];
  const r2 = { configured: true, loadActive: async () => ({ records, codigo_lote: "R2-HOY" }) };
  const result = await loadPreferredActivePadron({ connection: { query: async () => { throw new Error("MySQL no debe consultarse"); } }, r2 });
  assert.equal(result.source, "r2");
  assert.deepEqual(result.records, records);
});

test("usa MySQL cuando R2 falla", async () => {
  const records = [{ clave_catastral: "01-05-09-01", abonado: "1" }];
  const db = { query: async () => [[{ codigo_lote: "MYSQL", total_registros: 1, registros_json: JSON.stringify(records) }]] };
  const r2 = { configured: true, loadActive: async () => { throw new Error("R2 no disponible"); } };
  const result = await loadPreferredActivePadron({ connection: db, r2 });
  assert.equal(result.source, "mysql");
  assert.match(result.r2_error, /no disponible/i);
  assert.deepEqual(result.records, records);
});

test("rechaza un snapshot MySQL incompleto", async () => {
  const db = { query: async () => [[{ codigo_lote: "MYSQL", total_registros: 2, registros_json: JSON.stringify([{ abonado: "1" }]) }]] };
  await assert.rejects(loadActivePadronSnapshot(db), /incompleto/i);
});

test("migra el historico con la fecha original del lote y no con la hora del clic", async () => {
  const records = [{ clave_catastral: "01-05-09-01", abonado: "1" }];
  const originalDate = new Date("2026-07-14T03:42:00Z");
  const db = { query: async (sql) => {
    if (sql.includes("FROM importacion_padron_lotes")) return [[{ historical_date: originalDate }]];
    if (sql.startsWith("INSERT")) return [{ affectedRows: 1 }];
    return [[{ codigo_lote: "FOXPRO-20260714", total_registros: 1, registros_json: JSON.stringify(records), updated_at: new Date("2026-07-20T10:00:00Z") }]];
  } };
  let uploadedDate;
  const r2 = {
    configured: true,
    uploadVersions: async (_records, _code, date) => {
      uploadedDate = date;
      return { historical: { key: "padron/historico/correcto.json.gz" }, active: { key: "padron/activo/padron-maestro.json.gz" } };
    },
    removeHistoricalDuplicates: async () => 2
  };

  const result = await migrateMysqlSnapshotToR2({ connection: db, r2 });
  assert.equal(new Date(uploadedDate).toISOString(), originalDate.toISOString());
  assert.equal(result.duplicates_removed, 2);
});
