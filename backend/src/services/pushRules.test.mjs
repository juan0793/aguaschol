import assert from "node:assert/strict";
import test from "node:test";
import { avisoPushDe, enlaceDeAviso, normalizarSuscripcion, suscripcionVencida } from "./pushRules.js";

test("avisoPushDe arma el aviso del técnico de Entregas con su enlace", () => {
  const aviso = avisoPushDe({ id: 51, sender_user_id: 1, sender_name: "Oficina", recipient_user_id: 7, body: "Revisa el documento   #9", entrega_documento_id: 9 });
  assert.deepEqual(aviso, {
    userId: 7,
    payload: { title: "Aviso de Control de entregas", body: "Revisa el documento #9", url: "/entregas#entregas/pendientes?documento=9", tag: "aviso-51", message_id: 51 }
  });
});

test("avisoPushDe cubre reclamos, lotes, banco y mensajes directos", () => {
  assert.equal(avisoPushDe({ id: 1, recipient_user_id: 3, body: "x", entrega_reclamo_id: 4 }).payload.url, "/reclamos");
  assert.equal(avisoPushDe({ id: 1, recipient_user_id: 3, body: "x", entrega_lote_id: 8 }).payload.url, "/entregas#entregas/lotes?lote=8");
  assert.equal(avisoPushDe({ id: 1, recipient_user_id: 3, body: "x", banco_asignacion: true }).payload.url, "/clandestinos#clandestinos/banco");
  const directo = avisoPushDe({ id: 2, sender_user_id: 5, sender_name: "Ana Prueba", recipient_user_id: 3, body: "Hola" });
  assert.equal(directo.payload.title, "Mensaje de Ana Prueba");
  assert.equal(directo.payload.url, "/perfil");
});

test("avisoPushDe ignora chat general, recibos, borrados, leídos y mensajes a uno mismo", () => {
  assert.equal(avisoPushDe({ id: 1, is_general: true, recipient_user_id: 3, body: "x" }), null);
  assert.equal(avisoPushDe({ id: 1, read_receipt: true, is_general: true }), null);
  assert.equal(avisoPushDe({ is_general: true, deleted_id: 4 }), null);
  assert.equal(avisoPushDe({ id: 1, recipient_user_id: 3, body: "x", read_at: "2026-11-13T10:00:00Z" }), null);
  assert.equal(avisoPushDe({ id: 1, sender_user_id: 3, recipient_user_id: 3, body: "x" }), null);
  assert.equal(avisoPushDe({ id: 1, recipient_user_id: 3, body: "   " }), null);
  assert.equal(avisoPushDe(null), null);
});

test("avisoPushDe recorta textos largos", () => {
  const aviso = avisoPushDe({ id: 1, recipient_user_id: 3, body: "a".repeat(400) });
  assert.equal(aviso.payload.body.length, 240);
  assert.ok(aviso.payload.body.endsWith("…"));
});

test("enlaceDeAviso no acepta ids inválidos", () => {
  assert.equal(enlaceDeAviso({ entrega_documento_id: "1; drop" }), "/perfil");
});

test("normalizarSuscripcion valida endpoint https y claves", () => {
  const buena = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: "c".repeat(22) } };
  assert.deepEqual(normalizarSuscripcion(buena), { endpoint: buena.endpoint, p256dh: "B".repeat(87), auth: "c".repeat(22) });
  assert.equal(normalizarSuscripcion({ ...buena, endpoint: "http://inseguro/x" }), null);
  assert.equal(normalizarSuscripcion({ ...buena, keys: { p256dh: "corta", auth: "c".repeat(22) } }), null);
  assert.equal(normalizarSuscripcion({}), null);
});

test("suscripcionVencida solo con 404 y 410", () => {
  assert.equal(suscripcionVencida(410), true);
  assert.equal(suscripcionVencida(404), true);
  assert.equal(suscripcionVencida(500), false);
  assert.equal(suscripcionVencida(429), false);
});
