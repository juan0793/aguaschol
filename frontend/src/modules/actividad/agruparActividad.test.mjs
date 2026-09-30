import test from "node:test";
import assert from "node:assert/strict";
import { agruparActividad, resumenTrabajo } from "./agruparActividad.js";

const ev = (id, actor_id, action, entity_type, entity_id, summary, hhmm, extra = {}) => ({ id, actor_id, actor_name: `Persona ${actor_id}`, action, entity_type, entity_id, summary, created_at: `2026-09-30T${hhmm}:00-06:00`, ...extra });

test("lo que una persona hace sobre la misma ficha en pocos minutos es un solo trabajo", () => {
  const trabajos = agruparActividad([
    ev(5, 2, "inmueble.internal_notes_updated", "inmueble", "77", "Observaciones internas actualizadas en 42-46-02", "14:38"),
    ev(4, 2, "inmueble.updated", "inmueble", "77", "Ficha 42-46-02 actualizada", "14:38"),
    ev(3, 2, "banco_clandestinos.sent_to_ficha", "inmueble", "77", "Banco → ficha 42-46-02 (clandestino)", "14:37", { final: true, enlace: { view: "records", fichaId: 77 } }),
    ev(2, 2, "inmueble.created", "inmueble", "77", "Ficha 42-46-02 creada", "14:37")
  ]);
  assert.equal(trabajos.length, 1);
  const [trabajo] = trabajos;
  assert.deepEqual([trabajo.titulo, trabajo.items.length, trabajo.final], ["42-46-02", 4, true]);
  assert.deepEqual(trabajo.enlace, { view: "records", fichaId: 77 });
  // Lo que cierra va primero y "creó la ficha" sobra si vino del banco.
  assert.equal(resumenTrabajo(trabajo), "pasó del banco a ficha · actualizó datos · escribió observaciones");
});

test("otra persona, otro registro o más de 30 minutos son trabajos aparte", () => {
  const trabajos = agruparActividad([
    ev(4, 3, "inmueble.updated", "inmueble", "77", "Ficha 42-46-02 actualizada", "15:20"),
    ev(3, 2, "inmueble.updated", "inmueble", "78", "Ficha 42-60-03 actualizada", "14:50"),
    ev(2, 2, "inmueble.updated", "inmueble", "77", "Ficha 42-46-02 actualizada", "14:45"),
    ev(1, 2, "inmueble.created", "inmueble", "77", "Ficha 42-46-02 creada", "14:00")
  ]);
  assert.deepEqual(trabajos.map((t) => t.items.map((i) => i.id)), [[4], [3], [2], [1]]);
  assert.equal(resumenTrabajo(trabajos[0]), "Ficha 42-46-02 actualizada");
});

test("sin registro (p. ej. verificar el banco) no se agrupa", () => {
  const trabajos = agruparActividad([
    ev(2, 2, "banco_clandestinos.verified", "banco_clandestinos", "0", "Banco verificado contra padrones", "14:36"),
    ev(1, 2, "banco_clandestinos.verified", "banco_clandestinos", "0", "Banco verificado contra padrones", "14:35")
  ]);
  assert.equal(trabajos.length, 2);
});
