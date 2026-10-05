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
