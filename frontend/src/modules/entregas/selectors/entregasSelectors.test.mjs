import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDeliveryRate,
  getAttentionIndicators,
  groupByNeighborhood,
  groupByReason,
  groupByResponsible,
  scaleSeries,
  sumLotes
} from "./entregasSelectors.js";

const lotes = [
  { responsable_id: 1, responsable_nombre: "Carlos Martínez", barrio_codigo: "05", barrio_nombre: "Campo Sol", total_asignadas: 100, total_sobrantes: 10, estado: "CERRADO" },
  { responsable_id: 1, responsable_nombre: "Carlos Martínez", barrio_codigo: "05", barrio_nombre: "Campo Sol", total_asignadas: 60, total_sobrantes: 0, estado: "ABIERTO" },
  { responsable_id: 2, responsable_nombre: "José Reyes", barrio_codigo: "10", barrio_nombre: "San Juan Bosco", total_asignadas: 40, total_sobrantes: 8, estado: "CERRADO" }
];

const noEntregadas = [
  { motivo: "CASA_CERRADA", motivo_etiqueta: "Casa cerrada", estado: "PENDIENTE", dias_pendiente: 9, intentos: 3 },
  { motivo: "CASA_CERRADA", motivo_etiqueta: "Casa cerrada", estado: "PENDIENTE", dias_pendiente: 4, intentos: 1 },
  { motivo: "PREDIO_DESHABITADO", motivo_etiqueta: "Predio deshabitado", estado: "REENTREGADA", dias_pendiente: 2, intentos: 1 }
];

test("calculateDeliveryRate protege la división entre cero", () => {
  assert.equal(calculateDeliveryRate(90, 100), 90);
  assert.equal(calculateDeliveryRate(0, 0), 0);
  assert.equal(calculateDeliveryRate(3516, 3842), 91.51);
});

test("sumLotes acumula asignadas, entregadas y lotes abiertos", () => {
  assert.deepEqual(sumLotes(lotes), { lotes: 3, asignadas: 200, sobrantes: 18, entregadas: 182, abiertos: 1 });
});

test("groupByResponsible agrupa y ordena por volumen asignado", () => {
  const filas = groupByResponsible(lotes);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].responsable_nombre, "Carlos Martínez");
  assert.equal(filas[0].asignadas, 160);
  assert.equal(filas[0].entregadas, 150);
  assert.equal(filas[0].efectividad, 93.75);
});

test("groupByNeighborhood agrupa por código de barrio", () => {
  const filas = groupByNeighborhood(lotes);
  assert.deepEqual(filas.map((fila) => fila.barrio_codigo), ["05", "10"]);
  assert.equal(filas[1].efectividad, 80);
});

test("groupByReason calcula porcentajes", () => {
  const filas = groupByReason(noEntregadas);
  assert.equal(filas[0].motivo, "CASA_CERRADA");
  assert.equal(filas[0].total, 2);
  assert.equal(filas[0].porcentaje, 66.7);
});

test("getAttentionIndicators solo mira los pendientes", () => {
  assert.deepEqual(getAttentionIndicators(noEntregadas, lotes), {
    pendientes: 2,
    mas_3_dias: 2,
    mas_7_dias: 1,
    multiples_intentos: 1,
    lotes_abiertos: 1
  });
});

test("scaleSeries normaliza las barras a porcentaje del máximo", () => {
  const filas = scaleSeries([{ a: 5, b: 10 }, { a: 0, b: 0 }], ["a", "b"]);
  assert.equal(filas[0]._escala.b, 100);
  assert.equal(filas[0]._escala.a, 50);
  assert.equal(filas[1]._escala.a, 0);
});
