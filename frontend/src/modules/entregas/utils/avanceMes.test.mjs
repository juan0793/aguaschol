import test from "node:test";
import assert from "node:assert/strict";
import { anotadosPara, cargaDe, cargaMaxima, cargaPendiente, gruposPorTecnico, jornadasNecesarias, listaAvance, ritmoPorTecnico, textoJornadas } from "./avanceMes.js";

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

test("la carga se mide en documentos y en jornadas del técnico", () => {
  const barrios = [{ carga: { documentos: 900 } }, { carga: { documentos: 300 } }, {}];
  assert.equal(cargaMaxima(barrios), 900);
  assert.equal(cargaDe(barrios[2]), 0);
  const ritmo = { documentos_por_jornada: 1200 };
  assert.equal(jornadasNecesarias(300, ritmo), 0.25);
  assert.equal(jornadasNecesarias(40, ritmo), 0.25, "nunca menos de un cuarto");
  assert.equal(jornadasNecesarias(900, null), 0);
  assert.deepEqual(cargaPendiente(barrios, ritmo), { documentos: 1200, barrios: 3, jornadas: 1 });
  assert.deepEqual(["", "¼ jornada", "½ jornada", "1 jornada", "1¾ jornadas", "3 jornadas"],
    [0, 0.25, 0.5, 1, 1.75, 3].map(textoJornadas));
  assert.equal(ritmoPorTecnico([{ responsable_id: 4, documentos_por_jornada: 800 }]).get(4).documentos_por_jornada, 800);
});

test("lo anotado para la próxima jornada va después de lo abierto", () => {
  const barrios = [
    { codigo: "1", responsable_id: 1, estado: "pendiente" },
    { codigo: "2", responsable_id: 1, estado: "pendiente", plan: { fecha: "2026-11-20" } },
    { codigo: "3", responsable_id: 1, estado: "en_curso" },
    { codigo: "4", responsable_id: 1, estado: "pendiente", plan: { fecha: "2026-11-19" } }
  ];
  assert.deepEqual(listaAvance(barrios).faltan.map((b) => b.codigo), ["3", "4", "2", "1"]);
  assert.deepEqual(anotadosPara(barrios, "2026-11-19").map((b) => b.codigo), ["4"]);
  assert.deepEqual(anotadosPara(barrios, ""), []);
});
