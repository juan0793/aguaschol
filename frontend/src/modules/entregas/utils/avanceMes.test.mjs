import test from "node:test";
import assert from "node:assert/strict";
import { gruposPorTecnico } from "./avanceMes.js";

test("agrupa los barrios por técnico y cuenta los entregados", () => {
  const grupos = gruposPorTecnico([
    { codigo: "14", responsable_id: 1, responsable_nombre: "Carlos", estado: "entregado" },
    { codigo: "24", responsable_id: 1, responsable_nombre: "Carlos", estado: "pendiente" },
    { codigo: "22", responsable_id: 2, responsable_nombre: "Luis", estado: "entregado" }
  ]);
  assert.deepEqual(grupos.map((grupo) => [grupo.nombre, grupo.barrios.length, grupo.entregados]), [["Carlos", 2, 1], ["Luis", 1, 1]]);
  assert.deepEqual(gruposPorTecnico([]), []);
});
