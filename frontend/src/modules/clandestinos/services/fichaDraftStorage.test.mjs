import test from "node:test";
import assert from "node:assert/strict";
import { clearFichaDraft, readFichaDraft, saveFichaDraft } from "./fichaDraftStorage.js";

const storage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
};

test("recupera un borrador de ficha solo si sigue basado en la misma versión", () => {
  const local = storage();
  const record = { id: 8, updated_at: "2026-11-03T16:00:00.000Z" };
  const form = { id: 8, hallazgo: "Conexión visible" };
  saveFichaDraft(7, record, form, local);
  assert.deepEqual(readFichaDraft(7, record, local), form);
  assert.equal(readFichaDraft(7, { ...record, updated_at: "2026-11-03T16:01:00.000Z" }, local), null);
  clearFichaDraft(7, record, local);
  assert.equal(readFichaDraft(7, record, local), null);
});
