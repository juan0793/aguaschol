import assert from "node:assert/strict";
import test from "node:test";
import {
  avanceDeResumen,
  avancePorResponsable,
  calculateDeliveryRate,
  getAttentionIndicators,
  groupByNeighborhood,
  groupByReason,
  groupByResponsible,
  groupSobrantesByLote,
  scaleSeries,
  sumLotes,
  trendDelta
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

test("trendDelta calcula el porcentaje de cambio frente al periodo anterior", () => {
  assert.deepEqual(trendDelta(110, 100), { direction: "up", label: "+10%" });
  assert.deepEqual(trendDelta(90, 100), { direction: "down", label: "-10%" });
  assert.deepEqual(trendDelta(50, 50), { direction: "flat", label: "sin cambio" });
});

test("trendDelta reporta 'nuevo' cuando el periodo anterior estaba en cero", () => {
  assert.deepEqual(trendDelta(5, 0), { direction: "up", label: "nuevo" });
  assert.deepEqual(trendDelta(0, 0), { direction: "flat", label: "sin cambio" });
});

const lotesDeHoy = [
  { responsable_id: 1, responsable_nombre: "Sayma Lorena", barrio_nombre: "El Hospital", total_asignadas: 82, total_sobrantes: 0, estado: "ABIERTO" },
  { responsable_id: 2, responsable_nombre: "Luis Herrera", barrio_nombre: "El Hospital", total_asignadas: 100, total_sobrantes: 20, estado: "CERRADO" },
  { responsable_id: 2, responsable_nombre: "Luis Herrera", barrio_nombre: "San Juan", total_asignadas: 50, total_sobrantes: 5, estado: "REVISADO" }
];

test("avancePorResponsable no da por entregado lo que sigue en un lote abierto", () => {
  const filas = avancePorResponsable(lotesDeHoy);
  assert.equal(filas.length, 2);

  // Primero quien sigue en ruta, aunque tenga menos asignadas.
  assert.equal(filas[0].responsable_nombre, "Sayma Lorena");
  assert.deepEqual(
    { confirmadas: filas[0].confirmadas, en_ruta: filas[0].en_ruta, avance: filas[0].avance, abiertos: filas[0].abiertos },
    { confirmadas: 0, en_ruta: 82, avance: 0, abiertos: 1 }
  );

  const luis = filas[1];
  assert.equal(luis.lotes, 2);
  assert.equal(luis.abiertos, 0);
  assert.equal(luis.cerrados, 2);
  assert.equal(luis.asignadas, 150);
  assert.equal(luis.confirmadas, 125);
  assert.equal(luis.no_entregadas, 25);
  assert.equal(luis.en_ruta, 0);
  assert.deepEqual(luis.barrios, ["El Hospital", "San Juan"]);
  assert.equal(luis.avance, 83.33);
});

test("avancePorResponsable reparte la barra en tres tramos que suman el total", () => {
  const [sayma, luis] = avancePorResponsable(lotesDeHoy);
  assert.deepEqual(sayma.tramos, { confirmadas: 0, no_entregadas: 0, en_ruta: 100 });
  assert.deepEqual(luis.tramos, { confirmadas: 83.33, no_entregadas: 16.67, en_ruta: 0 });
});

test("avanceDeResumen normaliza el resumen del backend y deduce lo que sigue en ruta", () => {
  const avance = avanceDeResumen({ total: 5, abiertos: 4, asignadas: 745, entregadas: 120, sobrantes: 10 });
  assert.equal(avance.lotes, 5);
  assert.equal(avance.cerrados, 1);
  assert.equal(avance.en_ruta, 615);
  assert.equal(avance.avance, 16.11);
});

test("avanceDeResumen tolera que todavia no haya datos cargados", () => {
  const vacio = avanceDeResumen(null);
  assert.equal(vacio.asignadas, 0);
  assert.equal(vacio.avance, 0);
  assert.deepEqual(vacio.tramos, { confirmadas: 0, no_entregadas: 0, en_ruta: 0 });
});

// --- Acta consolidada de sobrantes -----------------------------------------
{
  const filas = [
    { id: 3, lote_id: 57, fecha_lote: "2026-09-16", abonado_nombre: "Ana Paz", barrio_nombre: "Santa Lucia", responsable_nombre: "Ana Flores" },
    { id: 2, lote_id: 55, fecha_lote: "2026-09-15", abonado_nombre: "Zoila Reyes", barrio_nombre: "Porvenir", responsable_nombre: "Juan Mendoza" },
    { id: 1, lote_id: 55, fecha_lote: "2026-09-15", abonado_nombre: "Ana Flores", barrio_nombre: "Porvenir", responsable_nombre: "Juan Mendoza" }
  ];
  const grupos = groupSobrantesByLote(filas);
  assert.equal(grupos.length, 2, "un grupo por lote");
  assert.deepEqual(grupos.map((g) => g.lote_id), [55, 57], "los lotes van por fecha");
  assert.deepEqual(grupos[0].documentos.map((d) => d.id), [1, 2], "dentro del lote, por nombre");
  assert.equal(grupos[0].responsable_nombre, "Juan Mendoza");
  assert.equal(grupos[1].barrio_nombre, "Santa Lucia");
  // Una fila sin lote no puede romper el acta.
  assert.equal(groupSobrantesByLote([{ id: 9 }]).length, 0);
  assert.deepEqual(groupSobrantesByLote(), []);
}

// Un sobrante sin nombre capturado cierra la lista del lote, no la abre.
{
  const grupos = groupSobrantesByLote([
    { id: 1, lote_id: 55, fecha_lote: "2026-09-15", abonado_nombre: "" },
    { id: 2, lote_id: 55, fecha_lote: "2026-09-15", abonado_nombre: "Zoila Reyes" },
    { id: 3, lote_id: 55, fecha_lote: "2026-09-15", abonado_nombre: "Ana Flores" }
  ]);
  assert.deepEqual(grupos[0].documentos.map((d) => d.id), [3, 2, 1]);
}

// --- Detalle de lotes por responsable (avance de la jornada) ----------------
{
  const lotes = [
    { id: 85, responsable_id: 3, responsable_nombre: "Alfredo Carranza", barrio_nombre: "Col. Marcelo Gerin", estado: "REVISADO", fecha: "2026-09-21", total_asignadas: 101, total_entregadas: 96, total_sobrantes: 5 },
    { id: 83, responsable_id: 3, responsable_nombre: "Alfredo Carranza", barrio_nombre: "Col. Iberia", estado: "REVISADO", fecha: "2026-09-20", total_asignadas: 94, total_entregadas: 90, total_sobrantes: 4 },
    { id: 84, responsable_id: 1, responsable_nombre: "Luis Herrera", barrio_nombre: "Bo. El Porvenir", estado: "ABIERTO", fecha: "2026-09-21", total_asignadas: 540 }
  ];
  const filas = avancePorResponsable(lotes);
  const alfredo = filas.find((f) => f.responsable_id === 3);
  assert.equal(alfredo.lotes, 2, "la fila sigue sumando sus dos lotes");
  assert.deepEqual(alfredo.detalle.map((d) => d.id), [85, 83], "el detalle va del lote mas reciente al mas viejo");
  assert.equal(alfredo.detalle[0].barrio_nombre, "Col. Marcelo Gerin", "cada lote conserva su recorrido");
  assert.equal(alfredo.asignadas, 195, "la suma no cambia al guardar el detalle");

  // Un lote abierto encabeza el detalle de su persona: es lo que reclama accion.
  const mixto = avancePorResponsable([
    { id: 10, responsable_id: 9, responsable_nombre: "Ana", estado: "CERRADO", fecha: "2026-09-21", total_asignadas: 10, total_sobrantes: 1 },
    { id: 11, responsable_id: 9, responsable_nombre: "Ana", estado: "ABIERTO", fecha: "2026-09-19", total_asignadas: 5 }
  ]);
  assert.deepEqual(mixto[0].detalle.map((d) => d.id), [11, 10]);
  assert.equal(mixto[0].abiertos, 1);
}
