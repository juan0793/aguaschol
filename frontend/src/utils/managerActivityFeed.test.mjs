import test from "node:test";
import assert from "node:assert/strict";
import { activityKind, freshIds, relativeTime } from "./managerActivityFeed.js";

test("cada trabajo cerrado tiene nombre, icono y área", () => {
  assert.deepEqual(activityKind("inspeccion.finalized"), { label: "Inspección finalizada", icon: "checkCircle", tone: "green", area: "inspecciones" });
  assert.equal(activityKind("LOTE_CERRADO").area, "entregas");
  assert.equal(activityKind("algo.nuevo").label, "Trabajo cerrado");
});

test("solo cuenta como nuevo lo que llegó después de la primera carga", () => {
  const before = [{ id: 1 }, { id: 2 }];
  const after = [{ id: 3 }, { id: 1 }, { id: 2 }];
  assert.deepEqual(freshIds(before, after, false), [3]);
  assert.deepEqual(freshIds([], after, true), []);
});

test("el tiempo relativo es corto y legible", () => {
  const now = Date.parse("2026-10-12T20:00:00Z");
  assert.equal(relativeTime("2026-10-12T19:59:40Z", now), "Ahora");
  assert.equal(relativeTime("2026-10-12T19:48:00Z", now), "Hace 12 min");
  assert.equal(relativeTime("2026-10-12T17:00:00Z", now), "Hace 3 h");
});
