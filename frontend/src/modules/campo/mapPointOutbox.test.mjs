import assert from "node:assert/strict";
import test from "node:test";
import {
  UNDO_WINDOW_MS,
  classifySendFailure,
  createOutboxItem,
  diaryKeyFor,
  getOutboxSyncState,
  isOutboxId,
  isReadyToSend,
  mergeOutboxItems,
  outboxItemToPoint,
  retryDelay
} from "./mapPointOutbox.js";

const now = Date.parse("2026-10-08T22:30:00Z");
const item = createOutboxItem({
  payload: { point_type: "caja_registro", latitude: 13.3, longitude: -87.19, reference: "Bo. Suyapa", housing_units: 2 },
  userId: 7,
  now,
  random: () => 0.5
});

test("el punto lleva su referencia de celular y la hora de captura", () => {
  assert.ok(isOutboxId(item.localId));
  assert.equal(item.payload.client_ref, item.localId);
  assert.equal(item.payload.captured_at, "2026-10-08T22:30:00.000Z");
  assert.equal(item.sendAfter, now + UNDO_WINDOW_MS);
  assert.equal(isOutboxId(42), false);
});

test("no se envía durante la ventana de deshacer ni si fue rechazado", () => {
  assert.equal(isReadyToSend(item, now + 1000), false);
  assert.equal(isReadyToSend(item, now + UNDO_WINDOW_MS), true);
  assert.equal(isReadyToSend({ ...item, status: "rechazado" }, now + 60000), false);
  assert.equal(isReadyToSend({ ...item, nextAttemptAt: now + 90000 }, now + 60000), false);
});

test("se ve como un punto más, en la jornada de su captura (hora de Honduras)", () => {
  const point = outboxItemToPoint(item);
  assert.equal(point.pending, true);
  assert.equal(point.reference_note, "Bo. Suyapa");
  assert.equal(point.diary_date, "2026-10-08");
  assert.equal(diaryKeyFor("2026-10-09T05:00:00Z"), "2026-10-08");
});

test("clasifica fallas y espera más en cada reintento", () => {
  assert.equal(classifySendFailure({}), "sin-senal");
  assert.equal(classifySendFailure({ status: 401 }), "sesion");
  assert.equal(classifySendFailure({ status: 503 }), "servidor");
  assert.equal(classifySendFailure({ status: 400 }), "rechazado");
  assert.equal(retryDelay(1), 15000);
  assert.equal(retryDelay(3), 60000);
  assert.equal(retryDelay(20), 5 * 60 * 1000);
});

test("recupera los puntos del respaldo local y prefiere su versión más nueva", () => {
  const localOnly = { localId: "cel-local", createdAt: 2, status: "pendiente" };
  const stale = { localId: "cel-same", createdAt: 1, updatedAt: 1, status: "pendiente" };
  const current = { ...stale, updatedAt: 3, status: "rechazado" };
  assert.deepEqual(mergeOutboxItems([stale], [localOnly, current]), [current, localOnly]);
  assert.deepEqual(mergeOutboxItems([current], [stale]), [current]);
});

test("muestra a la vez pendientes, rechazados y falta de señal", () => {
  assert.deepEqual(getOutboxSyncState({ outboxCount: 3, outboxRejectedCount: 1, outboxOnline: false }), {
    text: "2 puntos por enviar · 1 punto rechazado · sin señal",
    tone: "is-rejected"
  });
  assert.deepEqual(getOutboxSyncState({ outboxCount: 1, outboxRejectedCount: 0, outboxOnline: true }), {
    text: "1 punto por enviar",
    tone: "is-pending"
  });
  assert.deepEqual(getOutboxSyncState({ outboxCount: 0, outboxOnline: false }), {
    text: "sin señal",
    tone: "is-offline"
  });
});
