import test from "node:test";
import assert from "node:assert/strict";
import { ACCIONES_EXCLUIDAS, categoriaDe, esFinal, listTeamActivity, mapActividad } from "./teamActivityService.js";

test("cerrar un trabajo es final; el resto solo llega a la campana", () => {
  assert.equal(esFinal("banco_clandestinos.sent_to_ficha"), true);
  assert.equal(esFinal("banco_clandestinos.discarded"), true);
  assert.equal(esFinal("inspeccion.finalized"), true);
  assert.equal(esFinal("DOCUMENTO_REENTREGADO"), true);
  assert.equal(esFinal("inmueble.state_changed", { next: "regularized" }), true);
  assert.equal(esFinal("inmueble.state_changed", { next: "visit" }), false);
  assert.equal(esFinal("inmueble.updated"), false);
});

test("cada acción cae en su área del sistema", () => {
  assert.equal(categoriaDe("banco_clandestinos.sent_to_ficha", "inmueble"), "fichas");
  assert.equal(categoriaDe("inspeccion.gps_registered", "inspeccion"), "inspecciones");
  assert.equal(categoriaDe("DOCUMENTO_REENTREGADO", "entrega"), "entregas");
  assert.equal(categoriaDe("map_point.created", "map_point"), "campo");
  assert.equal(categoriaDe("padron.updated", "padron"), "padron");
  assert.equal(categoriaDe("report.generated", "report"), "otros");
});

test("sesiones y chat no cuentan como actividad", () => {
  for (const action of ["auth.login", "auth.logout", "profile.message_sent"]) assert.ok(ACCIONES_EXCLUIDAS.includes(action));
});

test("el evento lleva a la ficha o al lote de entregas", () => {
  const ficha = mapActividad({ id: 9, actor_user_id: 5, actor_name: "Sindy", action: "banco_clandestinos.sent_to_ficha", entity_type: "inmueble", entity_id: "1823", summary: "Banco → ficha 14-08-02-07", details_json: '{"candidato_id":7}', created_at: "2026-09-30T15:00:00Z" });
  assert.deepEqual([ficha.final, ficha.categoria, ficha.enlace], [true, "fichas", { view: "records", fichaId: 1823 }]);
  const lote = mapActividad({ id: 10, actor_user_id: 5, action: "LOTE_CERRADO", entity_type: "entrega", entity_id: "12", summary: "Lote #12 cerrado", created_at: "2026-09-30T15:00:00Z" });
  assert.deepEqual(lote.enlace, { view: "entregas", loteId: 12 });
});

test("solo administración consulta la actividad", async () => {
  await assert.rejects(() => listTeamActivity({}, { id: 2, role: "operator" }), (error) => error.status === 403);
  const vacio = await listTeamActivity({}, { id: 1, role: "admin" });
  assert.deepEqual(vacio.items, []);
});
