import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMessage } from "./profileService.js";

// getProfile enlaza cada aviso con su lote (tabla entrega_recordatorios) antes
// de mapear. El mapeo se comia ese campo, asi que la campana no distinguia un
// aviso de lote de un mensaje entre personas y abria el perfil del remitente.
test("normalizeMessage conserva el lote del aviso de entregas", () => {
  const salida = normalizeMessage({
    id: 12,
    sender_user_id: 4,
    recipient_user_id: 7,
    body: "Lote aperturado por Juan. Lote #55.",
    entrega_lote_id: 55,
    read_at: null,
    created_at: "2026-09-21T10:00:00.000Z"
  });
  assert.equal(salida.entrega_lote_id, 55);
});

test("un mensaje normal entre personas no trae lote", () => {
  const salida = normalizeMessage({
    id: 13,
    sender_user_id: 4,
    recipient_user_id: 7,
    body: "Pasame el informe.",
    read_at: null,
    created_at: "2026-09-21T10:05:00.000Z"
  });
  assert.equal(salida.entrega_lote_id, null);
});

// El id llega como numero desde MySQL, pero un 0 no es un lote valido y un
// null tampoco: ambos tienen que dejar la notificacion en el camino normal.
test("un lote en cero no se toma como aviso de entregas", () => {
  assert.equal(normalizeMessage({ id: 14, entrega_lote_id: 0 }).entrega_lote_id, 0);
  assert.equal(normalizeMessage({ id: 15, entrega_lote_id: null }).entrega_lote_id, null);
  assert.equal(normalizeMessage({ id: 16 }).entrega_lote_id, null);
});

test("los campos que ya viajaban siguen viajando", () => {
  const salida = normalizeMessage({ id: 17, body: "Hola", sender_user_id: 2, recipient_user_id: 3 });
  assert.equal(salida.id, 17);
  assert.equal(salida.body, "Hola");
  assert.equal(salida.sender_user_id, 2);
  assert.equal(salida.recipient_user_id, 3);
  assert.equal(salida.sender_name, "Sistema");
  assert.equal(salida.sender_role, "");
  assert.equal(salida.recipient_name, "");
});
