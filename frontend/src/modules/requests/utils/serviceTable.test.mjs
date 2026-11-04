import assert from "node:assert/strict";
import test from "node:test";
import { buildServiceFocusRows, buildServiceRows, sortServiceFocusRows, sortServiceRows, sumServiceFocusRows, sumServiceRows } from "./serviceTable.js";

const barrios = [
  {
    barrio_colonia: "Barrio Cabañas",
    total_registros: 10,
    deuda: { capital: 900, intereses: 100, total: 1000, deudores: 4 },
    servicios: [
      { field: "agua", active: 9, percentage: 90, deuda: { total: 950 } },
      { field: "alcantarillado", active: 3, percentage: 30, deuda: { total: 400 } }
    ]
  },
  {
    barrio_colonia: "",
    total_registros: 5,
    deuda: { capital: 50, intereses: 0, total: 50, deudores: 1 },
    servicios: [{ field: "agua", active: 5, percentage: 100, deuda: { total: 50 } }]
  },
  { barrio_colonia: "Vacío", total_registros: 0, servicios: [] }
];

test("arma una fila por barrio con cada servicio y nombra el barrio vacío", () => {
  const rows = buildServiceRows(barrios);
  assert.deepEqual(rows.map((row) => row.name), ["Barrio Cabañas", "Sin barrio"]);
  assert.equal(rows[0].services.agua.active, 9);
  assert.equal(rows[0].services.barrido.active, 0);
  assert.equal(rows[1].deuda.total, 50);
});

test("ordena por usuarios, por deuda de un servicio o por nombre", () => {
  const rows = buildServiceRows(barrios);
  assert.deepEqual(sortServiceRows(rows, { key: "usuarios", dir: "asc" }).map((row) => row.name), ["Sin barrio", "Barrio Cabañas"]);
  assert.deepEqual(sortServiceRows(rows, { key: "agua", dir: "desc", view: "deuda" }).map((row) => row.name), ["Barrio Cabañas", "Sin barrio"]);
  assert.deepEqual(sortServiceRows(rows, { key: "name", dir: "asc" }).map((row) => row.name), ["Barrio Cabañas", "Sin barrio"]);
});

test("suma los barrios visibles y recalcula el porcentaje de cada servicio", () => {
  const totals = sumServiceRows(buildServiceRows(barrios));
  assert.equal(totals.usuarios, 15);
  assert.equal(totals.deuda.total, 1050);
  assert.equal(totals.deuda.deudores, 5);
  assert.equal(totals.services.agua.active, 14);
  assert.equal(totals.services.agua.percentage, 93.3);
  assert.equal(totals.services.alcantarillado.deuda, 400);
});

test("lee cada barrio desde un solo servicio: con, sin, deuda y su parte del total", () => {
  const rows = buildServiceRows([
    { barrio_colonia: "Cabañas", total_registros: 10, servicios: [{ field: "barrido", active: 4, percentage: 40, deuda: { total: 300, capital: 250, intereses: 50, deudores: 3 } }] },
    { barrio_colonia: "Centro", total_registros: 6, servicios: [{ field: "barrido", active: 6, percentage: 100, deuda: { total: 100, capital: 100, intereses: 0, deudores: 1 } }] },
    { barrio_colonia: "Monterrey", total_registros: 8, servicios: [] }
  ]);
  const focus = buildServiceFocusRows(rows, "barrido");
  const cabanas = focus.find((row) => row.name === "Cabañas");
  assert.equal(cabanas.sin, 6);
  assert.equal(cabanas.deudores, 3);
  assert.equal(cabanas.share, 75);
  assert.deepEqual(sortServiceFocusRows(focus, { key: "deuda", dir: "desc" }).map((row) => row.name), ["Cabañas", "Centro", "Monterrey"]);
  const totals = sumServiceFocusRows(focus);
  assert.equal(totals.active, 10);
  assert.equal(totals.barriosCon, 2);
  assert.equal(totals.percentage, 41.7);
  assert.equal(totals.deuda, 400);
});

// ---------- Combinación de servicios ----------
import { ATAJOS_COMBINACION, buildCombinacionRows, combinacionDe, cumpleCombinacion, fraseCombinacion, mismaCombinacion, servicioUnico } from "./serviceTable.js";

const conCombinaciones = buildServiceRows([
  {
    barrio_colonia: "Bo. Prueba",
    total_registros: 6,
    servicios: [{ field: "agua", active: 5, deuda: { total: 600, deudores: 3 } }],
    combinaciones: [
      { clave: "10000", usuarios: 2, deudores: 1, capital: 90, intereses: 10, total: 100 },
      { clave: "11110", usuarios: 3, deudores: 2, capital: 450, intereses: 50, total: 500 },
      { clave: "01000", usuarios: 1, deudores: 0, capital: 0, intereses: 0, total: 0 }
    ]
  },
  {
    barrio_colonia: "Col. Ejemplo",
    total_registros: 4,
    servicios: [{ field: "agua", active: 4, deuda: { total: 300, deudores: 2 } }],
    combinaciones: [{ clave: "11000", usuarios: 4, deudores: 2, capital: 280, intereses: 20, total: 300 }]
  }
]);

test("la frase de la combinación se lee en español", () => {
  assert.equal(fraseCombinacion(ATAJOS_COMBINACION[0].combinacion), "con agua y sin alcantarillado, barrido, recolección ni desechos peligrosos");
  assert.equal(fraseCombinacion(combinacionDe({ agua: "con", alcantarillado: "sin" })), "con agua y sin alcantarillado");
  assert.equal(fraseCombinacion(combinacionDe({ agua: "con", barrido: "con" })), "con agua y barrido");
  assert.equal(fraseCombinacion(combinacionDe({})), "");
});

test("un solo servicio con lo demás en da igual se lee como hoy", () => {
  assert.equal(servicioUnico(combinacionDe({ agua: "con" })), "agua");
  assert.equal(servicioUnico(combinacionDe({ agua: "sin" })), "");
  assert.equal(servicioUnico(combinacionDe({ agua: "con", alcantarillado: "sin" })), "");
  assert.ok(mismaCombinacion(combinacionDe({ agua: "con" }), { agua: "con" }));
});

test("cumple: con exige el servicio, sin lo excluye y da igual no mira", () => {
  const soloAgua = ATAJOS_COMBINACION[0].combinacion;
  assert.equal(cumpleCombinacion(soloAgua, (campo) => campo === "agua"), true);
  assert.equal(cumpleCombinacion(soloAgua, (campo) => ["agua", "barrido"].includes(campo)), false);
  assert.equal(cumpleCombinacion(combinacionDe({ agua: "con" }), (campo) => ["agua", "barrido"].includes(campo)), true);
});

test("las filas de una combinación suman solo los usuarios que la cumplen", () => {
  const { rows } = buildCombinacionRows(conCombinaciones, ATAJOS_COMBINACION[0].combinacion);
  const prueba = rows.find((row) => row.name === "Bo. Prueba");
  assert.deepEqual([prueba.active, prueba.sin, prueba.deudores, prueba.deuda, prueba.capital], [2, 4, 1, 100, 90]);
  assert.equal(rows.find((row) => row.name === "Col. Ejemplo").active, 0);
  assert.equal(prueba.share, 100);
  const agua = buildCombinacionRows(conCombinaciones, combinacionDe({ agua: "con" })).rows;
  assert.deepEqual(agua.map((row) => row.active), [5, 4]);
  assert.deepEqual(agua.map((row) => row.deuda), [600, 300]);
});

test("sin las combinaciones del backend solo responde un servicio a la vez", () => {
  const viejas = buildServiceRows(barrios);
  assert.equal(buildCombinacionRows(viejas, ATAJOS_COMBINACION[1].combinacion).rows, null);
  assert.equal(buildCombinacionRows(viejas, combinacionDe({ agua: "con" })).rows[0].active, 9);
});
