import assert from "node:assert/strict";
import test from "node:test";
import { clearMapPointEditDraft, loadMapPointEditDraft, saveMapPointEditDraft } from "./mapPointEditRecovery.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test("recupera el borrador por usuario y punto, y lo limpia al cerrar o guardar", () => {
  const storage = createStorage();
  const draft = { reference: "Frente a la escuela", latitude: "13.3" };
  assert.equal(saveMapPointEditDraft(storage, 7, 42, draft), true);
  assert.deepEqual(loadMapPointEditDraft(storage, 7, 42), draft);
  assert.equal(loadMapPointEditDraft(storage, 8, 42), null);
  assert.equal(loadMapPointEditDraft(storage, 7, 43), null);
  clearMapPointEditDraft(storage, 7, 42);
  assert.equal(loadMapPointEditDraft(storage, 7, 42), null);
});

test("si el almacenamiento está bloqueado no afirma que el borrador se guardó", () => {
  const unavailableStorage = { setItem() { throw new Error("lleno"); }, getItem() { throw new Error("bloqueado"); } };
  assert.equal(saveMapPointEditDraft(unavailableStorage, 7, 42, {}), false);
  assert.equal(loadMapPointEditDraft(unavailableStorage, 7, 42), null);
});
