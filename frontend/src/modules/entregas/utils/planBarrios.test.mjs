import test from "node:test";
import assert from "node:assert/strict";
import { mismoPlan, opcionesPlan, resumenPlan, textoFechaPlan } from "./planBarrios.js";

const barrios = [
  { codigo: "1", nombre: "Centro", estado: "entregado", carga: { documentos: 900 } },
  { codigo: "2", nombre: "Alegría", estado: "pendiente", orden_ruta: 2, carga: { documentos: 300 } },
  { codigo: "3", nombre: "Las Vegas", estado: "pendiente", orden_ruta: 1, carga: { documentos: 150 } },
  { codigo: "4", nombre: "Gracias a Dios", estado: "en_curso", carga: { documentos: 400 } },
  { codigo: "5", nombre: "Cabañas", estado: "entregado", anotado: true, carga: { documentos: 100 } }
];

test("ofrece primero lo abierto y lo pendiente en orden de ruta", () => {
  assert.deepEqual(opcionesPlan(barrios).map((barrio) => barrio.codigo), ["4", "3", "2", "5"]);
});

test("el resumen suma la carga y dice si cabe otro barrio", () => {
  const ritmo = { documentos_por_jornada: 800 };
  assert.deepEqual(resumenPlan(["2", "3"], barrios, ritmo), { documentos: 450, jornadas: 0.5, pista: "Cabe otro barrio." });
  assert.equal(resumenPlan(["1", "4"], barrios, ritmo).pista, "Es más de una jornada.");
  assert.deepEqual(resumenPlan(["2"], barrios, null), { documentos: 300, jornadas: 0, pista: "" });
});

test("nombra el día del plan", () => {
  assert.equal(textoFechaPlan("2026-11-19", "2026-11-18"), "mañana");
  assert.equal(textoFechaPlan("2026-11-18", "2026-11-18"), "hoy");
  assert.equal(textoFechaPlan("2026-11-23", "2026-11-21"), "el lunes 23");
  assert.ok(mismoPlan(["1", "2"], ["2", "1"]));
  assert.ok(!mismoPlan(["1"], ["1", "2"]));
});
