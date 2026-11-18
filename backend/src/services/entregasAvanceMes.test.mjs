import assert from "node:assert/strict";
import test from "node:test";
import { armarAvanceMes, armarCargaHistorica, armarRitmoTecnicos, normalizarPlan, planesPorBarrio, proximaJornada } from "./entregasRules.js";

const barrios = [
  { codigo: "24", nombre: "Bo. La Libertad", claves: 944, responsable_id: 1 },
  { codigo: "14", nombre: "Bo. El Centro", claves: 869, responsable_id: 1 },
  { codigo: "22", nombre: "Bo. Cabañas", claves: 1285, responsable_id: 2 },
  { codigo: "41", nombre: "Bo. Iztoca", claves: 724, responsable_id: null }
];
const personal = [{ id: 1, nombre_completo: "Carlos Osorto" }, { id: 2, nombre_completo: "Luis Fernando" }];

test("un barrio se llena con un lote cerrado y sin lotes abiertos en el ciclo", () => {
  const avance = armarAvanceMes({ barrios, personal, desde: "2026-10-10", hasta: "2026-10-12", lotes: [
    { barrio_codigo: "24", estado: "CERRADO", lotes: 2, asignadas: 900, entregadas: 880, ids: "41,37" },
    { barrio_codigo: "22", estado: "CERRADO", lotes: 1, asignadas: 600, entregadas: 590 },
    { barrio_codigo: "22", estado: "ABIERTO", lotes: 1, asignadas: 500, entregadas: 0, ids: "52" }
  ] });
  assert.equal(avance.total, 3, "Iztoca no tiene responsable: queda fuera");
  assert.equal(avance.entregados, 1);
  assert.equal(avance.en_curso, 1);
  assert.equal(avance.pendientes, 1);
  assert.equal(avance.porcentaje, 33.3);
  assert.equal(avance.documentos_entregados, 1470);
  const libertad = avance.barrios.find((fila) => fila.codigo === "24");
  assert.deepEqual([libertad.lotes_cerrados, libertad.lotes_abiertos], [[41, 37], []]);
  assert.deepEqual(avance.barrios.find((fila) => fila.codigo === "22").lotes_abiertos, [52]);
  assert.deepEqual(avance.barrios.map((fila) => [fila.nombre, fila.estado, fila.responsable_nombre]), [
    ["Bo. El Centro", "pendiente", "Carlos Osorto"],
    ["Bo. La Libertad", "entregado", "Carlos Osorto"],
    ["Bo. Cabañas", "en_curso", "Luis Fernando"]
  ]);
});

test("sin reparto no inventa avance", () => {
  const avance = armarAvanceMes({ barrios: [], lotes: [] });
  assert.equal(avance.total, 0);
  assert.equal(avance.porcentaje, 0);
});

test("la carga promedia los últimos tres ciclos con entrega y separa por corte", () => {
  const carga = armarCargaHistorica({
    cortes: ["2026-09-19", "2026-10-19"],
    historial: [
      // Libertad: un ciclo por mes calendario (antes del primer corte) y dos por corte.
      { barrio_codigo: "24", fecha: "2026-06-03", documentos: 100 },
      { barrio_codigo: "24", fecha: "2026-07-05", documentos: 900 },
      { barrio_codigo: "24", fecha: "2026-08-25", documentos: 880 },
      { barrio_codigo: "24", fecha: "2026-09-25", documentos: 500 },
      { barrio_codigo: "24", fecha: "2026-09-26", documentos: 420 },
      // Centro: un día sin documentos no cuenta como jornada.
      { barrio_codigo: "14", fecha: "2026-10-02", documentos: 860 },
      { barrio_codigo: "14", fecha: "2026-09-30", documentos: 0 },
      { barrio_codigo: "", fecha: "2026-10-02", documentos: 50 }
    ]
  });
  const libertad = carga.get("24");
  assert.equal(libertad.ciclos, 3);
  assert.equal(libertad.ultimo, 920, "el ciclo que cierra el 19 de octubre suma sus dos jornadas");
  assert.equal(libertad.documentos, 900, "(920 + 880 + 900) / 3; junio queda fuera");
  assert.equal(libertad.jornadas, 1.3);
  assert.deepEqual(carga.get("14"), { documentos: 860, ultimo: 860, ciclos: 1, jornadas: 1, fuente: "historial" });
  assert.equal(carga.size, 2);
});

test("el ritmo del técnico promedia lo que reparte por jornada", () => {
  const ritmo = armarRitmoTecnicos([
    { responsable_id: 1, fecha: "2026-10-01", documentos: 900, barrios: 1 },
    { responsable_id: 1, fecha: "2026-10-02", documentos: 1200, barrios: 3 },
    { responsable_id: 2, fecha: "2026-10-02", documentos: 0, barrios: 0 }
  ]);
  assert.deepEqual(ritmo, [{ responsable_id: 1, jornadas: 2, documentos_por_jornada: 1050, maximo_jornada: 1200, barrios_por_jornada: 2 }]);
});

test("sin historial la carga sale de las claves del padrón", () => {
  const avance = armarAvanceMes({
    barrios,
    personal,
    lotes: [],
    carga: new Map([["24", { documentos: 900, ultimo: 920, ciclos: 3, jornadas: 1, fuente: "historial" }]]),
    ritmo: [{ responsable_id: 1, documentos_por_jornada: 1000 }]
  });
  assert.equal(avance.barrios.find((fila) => fila.codigo === "24").carga.fuente, "historial");
  assert.deepEqual(avance.barrios.find((fila) => fila.codigo === "14").carga, { documentos: 869, ultimo: null, ciclos: 0, jornadas: null, fuente: "padron" });
  assert.equal(avance.ritmo_tecnicos.length, 1);
});

test("la próxima jornada salta el domingo", () => {
  assert.equal(proximaJornada("2026-11-18"), "2026-11-19", "miércoles → jueves");
  assert.equal(proximaJornada("2026-11-21"), "2026-11-23", "sábado → lunes");
  assert.equal(proximaJornada("2026-11-30"), "2026-12-01");
});

test("el plan solo acepta barrios del reparto y fechas cercanas", () => {
  const opciones = { hoy: "2026-11-18", permitidos: ["24", "14"] };
  assert.deepEqual(normalizarPlan({ barrios: ["24", " 24", "14", ""] }, opciones), { fecha: "2026-11-19", barrios: ["24", "14"] });
  assert.deepEqual(normalizarPlan({ fecha: "2026-11-18", barrios: [] }, opciones), { fecha: "2026-11-18", barrios: [] });
  assert.throws(() => normalizarPlan({ barrios: ["22"] }, opciones), /no está en el reparto/);
  assert.throws(() => normalizarPlan({ fecha: "2026-11-17", barrios: [] }, opciones), /próximos 7 días/);
  assert.throws(() => normalizarPlan({ fecha: "2026-11-26", barrios: [] }, opciones), /próximos 7 días/);
});

test("el avance marca el plan más próximo y no lo muestra en lo ya entregado", () => {
  const planes = planesPorBarrio([
    { barrio_codigo: "14", fecha: "2026-11-20", responsable_id: 1, anotado_por_nombre: "Carlos" },
    { barrio_codigo: "14", fecha: "2026-11-19", responsable_id: 1, anotado_por_nombre: "Carlos" },
    { barrio_codigo: "24", fecha: "2026-11-19", responsable_id: 1 },
    { barrio_codigo: "22", fecha: "2026-11-10", responsable_id: 2 }
  ], "2026-11-18");
  assert.equal(planes.get("14").fecha, "2026-11-19");
  assert.equal(planes.has("22"), false, "un plan pasado no cuenta");
  const avance = armarAvanceMes({ barrios, personal, planes, lotes: [{ barrio_codigo: "24", estado: "CERRADO", lotes: 1, asignadas: 900, entregadas: 890 }] });
  assert.equal(avance.barrios.find((fila) => fila.codigo === "14").plan.anotado_por_nombre, "Carlos");
  assert.equal(avance.barrios.find((fila) => fila.codigo === "24").plan, null);
});
