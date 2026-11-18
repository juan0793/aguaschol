import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorTecnico, criteriosPara, filtrarPrioridad, resumenPrioridad, textoCarga, textoFiltros, textoUltimaEntrega } from "./prioridadBarrios.js";
import { equipoHoy, sinPlanParaManana, textoComparacion } from "./resumenEntregas.js";

const barrios = [
  { codigo: "22", nombre: "Bo. Cabañas", responsable_id: 1, responsable_nombre: "Luis", estado: "en_curso", nivel: "alta", carga: { documentos: 1240, fuente: "historial" }, mora: { mora: 100 } },
  { codigo: "24", nombre: "Bo. La Libertad", responsable_id: 2, responsable_nombre: "Carlos", estado: "pendiente", nivel: "alta", carga: { documentos: 930, fuente: "padron" }, mora: { mora: 50.5 } },
  { codigo: "30", nombre: "Bo. San Antonio", responsable_id: 1, responsable_nombre: "Luis", estado: "pendiente", nivel: "media", carga: { documentos: 340, fuente: "historial" } }
];

test("filtrar, agrupar y resumir la lista de prioridad", () => {
  assert.deepEqual(filtrarPrioridad(barrios, { tecnicoId: 1 }).map((b) => b.codigo), ["22", "30"]);
  assert.deepEqual(filtrarPrioridad(barrios, { sinAbiertos: true }).map((b) => b.codigo), ["24", "30"]);
  const grupos = agruparPorTecnico(barrios);
  assert.deepEqual(grupos.map((g) => [g.nombre, g.barrios.length, g.documentos]), [["Luis", 2, 1580], ["Carlos", 1, 930]]);
  assert.deepEqual(resumenPrioridad(barrios), { barrios: 3, documentos: 2510, alta: 2, media: 1, baja: 0, en_curso: 1, mora: 150.5 });
});

test("textos de la lista", () => {
  assert.equal(textoCarga(barrios[0], (n) => n.toLocaleString("en-US")), "≈1,240");
  assert.equal(textoCarga(barrios[1]), "~930");
  assert.equal(textoCarga({}), "—");
  assert.equal(textoUltimaEntrega({ ultima_entrega: "2026-10-15" }), "Última entrega: 15/10/2026");
  assert.equal(textoUltimaEntrega({}), "Sin entregas registradas");
  assert.equal(textoFiltros({ criterio: "dias", tecnicoNombre: "Luis", agrupar: true }), "Orden: más días sin entrega · Técnico: Luis · Agrupado por técnico");
  assert.deepEqual(criteriosPara(false).map((c) => c.valor), ["combinado", "dias", "carga", "ruta"]);
  assert.equal(criteriosPara(true).length, 5);
});

test("quién no anotó plan para la próxima jornada", () => {
  const mes = {
    proxima_jornada: "2026-11-19",
    barrios: [
      { responsable_id: 1, responsable_nombre: "Luis", estado: "pendiente", plan: { fecha: "2026-11-19" } },
      { responsable_id: 2, responsable_nombre: "Carlos", estado: "pendiente", plan: null },
      { responsable_id: 2, responsable_nombre: "Carlos", estado: "en_curso", plan: { fecha: "2026-11-25" } },
      { responsable_id: 3, responsable_nombre: "Elmer", estado: "entregado", plan: null }
    ]
  };
  assert.deepEqual(sinPlanParaManana(mes).map((fila) => fila.nombre), ["Carlos"]);
  assert.deepEqual(sinPlanParaManana(null), []);
});

test("el equipo hoy junta lotes del día y lo anotado", () => {
  const filas = equipoHoy({
    proxima: "2026-11-19",
    barrios: [
      { responsable_id: 1, responsable_nombre: "Luis", nombre: "Bo. Cabañas", estado: "en_curso", plan: { fecha: "2026-11-19" } },
      { responsable_id: 2, responsable_nombre: "Carlos", nombre: "Bo. La Libertad", estado: "pendiente" },
      { responsable_id: 3, responsable_nombre: "Elmer", nombre: "Col. Iberia", estado: "entregado" }
    ],
    lotesHoy: [
      { id: 7, responsable_id: 1, responsable_nombre: "Luis", barrio_nombre: "Bo. Cabañas", estado: "ABIERTO", total_asignadas: 410 },
      { id: 8, responsable_id: 3, responsable_nombre: "Elmer", barrio_nombre: "Col. Iberia", estado: "CERRADO", total_asignadas: 111, total_sobrantes: 9 }
    ]
  });
  assert.deepEqual(filas.map((fila) => [fila.nombre, fila.estado]), [["Luis", "abierto"], ["Elmer", "cerrado"], ["Carlos", "sin_lote"]]);
  assert.deepEqual(filas[0].manana, ["Bo. Cabañas"]);
  assert.equal(filas[1].entregadas, 102);
});

test("texto de la comparación con la semana pasada", () => {
  assert.equal(textoComparacion({ fecha_inicio: "2026-11-09", fecha_fin: "2026-11-11", parcial: true }), "frente a lun–mié de la semana pasada");
  assert.equal(textoComparacion({ fecha_inicio: "2026-11-09", fecha_fin: "2026-11-09", parcial: true }), "frente al lun de la semana pasada");
  assert.equal(textoComparacion({ fecha_inicio: "2026-11-09", fecha_fin: "2026-11-13" }), "frente al periodo anterior");
  assert.equal(textoComparacion(null), "");
});
