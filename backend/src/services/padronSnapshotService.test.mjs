import assert from "node:assert/strict";
import test from "node:test";
import { loadActivePadronSnapshot, saveActivePadronSnapshot } from "./padronSnapshotService.js";

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
