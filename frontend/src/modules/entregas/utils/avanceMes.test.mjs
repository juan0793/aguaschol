import test from "node:test";
import assert from "node:assert/strict";
import { gruposPorTecnico, listaAvance } from "./avanceMes.js";

test("agrupa los barrios por técnico y cuenta los entregados", () => {
  const grupos = gruposPorTecnico([
    { codigo: "14", responsable_id: 1, responsable_nombre: "Carlos", estado: "entregado" },
    { codigo: "24", responsable_id: 1, responsable_nombre: "Carlos", estado: "pendiente" },
    { codigo: "22", responsable_id: 2, responsable_nombre: "Luis", estado: "entregado" }
  ]);
  assert.deepEqual(grupos.map((grupo) => [grupo.nombre, grupo.barrios.length, grupo.entregados]), [["Carlos", 2, 1], ["Luis", 1, 1]]);
  assert.deepEqual(gruposPorTecnico([]), []);
});

test("la lista separa lo entregado de lo que falta, con lo abierto primero", () => {
  const barrios = [
    { codigo: "1", responsable_id: 1, estado: "pendiente" },
    { codigo: "2", responsable_id: 1, estado: "entregado" },
    { codigo: "3", responsable_id: 2, estado: "en_curso" },
    { codigo: "4", responsable_id: 2, estado: "pendiente" }
  ];
  const todos = listaAvance(barrios);
  assert.deepEqual(todos.entregados.map((b) => b.codigo), ["2"]);
  assert.deepEqual(todos.faltan.map((b) => b.codigo), ["3", "1", "4"]);
  assert.deepEqual(listaAvance(barrios, 2).faltan.map((b) => b.codigo), ["3", "4"]);
});
