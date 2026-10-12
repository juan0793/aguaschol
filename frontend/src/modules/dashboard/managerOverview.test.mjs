import test from "node:test";
import assert from "node:assert/strict";
import { buildManagerOverview, changeVersus, sinceLabel } from "./managerOverview.js";

const now = Date.parse("2026-10-12T20:00:00Z");
const snapshot = {
  inspections: { creadas_mes: 12, creadas_mes_anterior: 9, finalizadas_mes: 8, finalizadas_mes_anterior: 10, asignadas: 4, en_proceso: 3, seguimiento: 1, mas_antigua_asignada_dias: 12 },
  deliveries: { entregadas: 144, asignadas: 240, efectividad: 60, vencidas: 3, comparativo: { asignadas: 200, efectividad: 55.5 }, por_barrio: [{ barrio_nombre: "BO. EL CENTRO", asignadas: 40, entregadas: 30, efectividad: 75 }, { barrio_nombre: "COL. NUEVA", asignadas: 0, entregadas: 0, efectividad: 0 }] },
  fichas: { total: 78 },
  padron: { summary: { deuda: { total: 1000 } }, barrios: [{ barrio_colonia: "Bo. El Centro", total_registros: 50, deuda: { total: 300, deudores: 20 } }, { barrio_colonia: "Col. Otra", total_registros: 10, deuda: { total: 700, deudores: 5 } }] },
  team: { tecnicos: [{ id: 1, nombre: "Ana", hoy: 5, finalizados: 1, ultima: "2026-10-12T19:50:00Z" }, { id: 2, nombre: "Luis", hoy: 2, finalizados: 0, ultima: "2026-10-12T15:00:00Z" }, { id: 3, nombre: "Sin hoy", hoy: 0, ultima: "2026-10-10T15:00:00Z" }] }
};

test("compara con el mes anterior solo cuando hay base", () => {
  assert.equal(changeVersus(12, 9), 33);
  assert.equal(changeVersus(8, 10), -20);
  assert.equal(changeVersus(5, 0), null);
  assert.equal(changeVersus(5, null), null);
});

test("indicadores, estados y equipo salen del snapshot real", () => {
  const view = buildManagerOverview(snapshot, now);
  assert.equal(view.kpis.creadas.change, 33);
  assert.equal(view.kpis.pendientes.value, 8);
  assert.equal(view.kpis.pendientes.oldestDays, 12);
  assert.equal(view.kpis.efectividad.points, 4.5);
  assert.equal(view.kpis.equipo.value, 2);
  assert.equal(view.kpis.equipo.acciones, 7);
  assert.deepEqual(view.estados.items.map((item) => item.value), [4, 3, 1]);
  assert.deepEqual(view.equipo.map((person) => [person.nombre, person.status]), [["Ana", "now"], ["Luis", "today"]]);
  assert.deepEqual(view.efectividadBarrios.map((row) => row.barrio), ["BO. EL CENTRO"]);
});

test("el resumen por barrio une padrón y entregas sin inventar lo que falta", () => {
  const [first, second] = buildManagerOverview(snapshot, now).barrios;
  assert.equal(first.barrio, "Col. Otra");
  assert.equal(first.share, 70);
  assert.equal(first.asignadas, null);
  assert.equal(second.efectividad, 75);
  assert.equal(sinceLabel(5), "Hace 5 min");
  assert.equal(sinceLabel(125), "Hace 2 h");
  assert.equal(sinceLabel(null), "Sin registro");
});
