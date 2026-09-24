import assert from "node:assert/strict";
import test from "node:test";
import { buildServiceRows, sortServiceRows, sumServiceRows } from "./serviceTable.js";

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
