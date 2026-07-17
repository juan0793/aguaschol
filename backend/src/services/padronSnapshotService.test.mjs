import assert from "node:assert/strict";
import test from "node:test";
import {
  loadActivePadronSnapshot,
  loadPreferredActivePadron,
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
