import assert from "node:assert/strict";
import test from "node:test";
import { buildClavesIndex, claveBarrio, filterClavesIndex, groupClavesByBarrio } from "./alcaldiaClaves.js";

const rows = [
  { clave_catastral: "02-10-10", nombre: "María Núñez", barrio_comparacion: "Residencial Villa Bertilia" },
  { clave_catastral: "02-10-9", nombre: "José Andino", barrio_comparacion: "Residencial Villa Bertilia" },
  { clave_catastral: "05-01-01", nombre: "Ana Núñez", barrio_comparacion: "Barrio Brisas Del Rio" },
  { clave_catastral: "09-09-09", nombre: "Sin datos", caserio: "", direccion: "" }
];

test("agrupa por barrio de mayor a menor y ordena las claves como números", () => {
  const groups = groupClavesByBarrio(rows);
  assert.deepEqual(groups.map((group) => [group.barrio, group.rows.length]), [
    ["Residencial Villa Bertilia", 2],
    ["Barrio Brisas Del Rio", 1],
    ["Sin barrio", 1]
  ]);
  assert.deepEqual(groups[0].rows.map((row) => row.clave_catastral), ["02-10-9", "02-10-10"]);
});

test("busca sin tildes, con varias palabras en cualquier orden, y conserva el total", () => {
  const index = buildClavesIndex(rows);
  const nunez = filterClavesIndex(index, "NUÑEZ");
  assert.equal(nunez.length, 2);
  const [group] = filterClavesIndex(index, "bertilia   nunez");
  assert.equal(group.barrio, "Residencial Villa Bertilia");
  assert.equal(group.rows.length, 1);
  assert.equal(group.total, 2);
  assert.equal(filterClavesIndex(index, "brisas")[0].rows.length, 1);
  assert.deepEqual(filterClavesIndex(index, "no-existe"), []);
  assert.equal(claveBarrio(rows[3]), "Sin barrio");
});
