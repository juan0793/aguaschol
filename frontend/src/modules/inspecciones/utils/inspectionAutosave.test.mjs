import assert from "node:assert/strict";
import test from "node:test";
import { createInspectionAutosave } from "./inspectionAutosave.js";

test("combina cambios y serializa los que llegan mientras guarda", async () => {
  const saved = [];
  let releaseFirst;
  const first = new Promise((resolve) => { releaseFirst = resolve; });
  const autosave = createInspectionAutosave(async (patch) => {
    saved.push(patch);
    if (saved.length === 1) await first;
  });

  autosave.enqueue({ seguimiento_detalle: "Visitar de nuevo" });
  const flushing = autosave.flush();
  autosave.enqueue({ seguimiento_fecha_sugerida: "2026-08-20" });
  assert.deepEqual(autosave.getPending(), {
    seguimiento_detalle: "Visitar de nuevo",
    seguimiento_fecha_sugerida: "2026-08-20"
  });
  assert.equal(autosave.flush(), flushing);
  releaseFirst();
  await flushing;

  assert.deepEqual(saved, [
    { seguimiento_detalle: "Visitar de nuevo" },
    { seguimiento_fecha_sugerida: "2026-08-20" }
  ]);
});

test("conserva el cambio pendiente cuando falla el guardado", async () => {
  let attempts = 0;
  const autosave = createInspectionAutosave(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("sin conexión");
  });

  autosave.enqueue({ seguimiento_detalle: "No borrar" });
  await assert.rejects(autosave.flush(), /sin conexión/);
  await autosave.flush();
  assert.equal(attempts, 2);
});
