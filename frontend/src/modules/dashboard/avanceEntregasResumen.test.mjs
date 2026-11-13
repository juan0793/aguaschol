import assert from "node:assert/strict";
import test from "node:test";
import { plural, resumenEntregas } from "./avanceEntregasResumen.js";

const barrio = (codigo, responsable_id, estado, entregadas = 0) => ({
  codigo, responsable_id, responsable_nombre: `Técnico ${responsable_id}`, estado, entregadas
});

test("resume barrios, facturas y técnicos del ciclo", () => {
  const resumen = resumenEntregas({
    desde: "2026-11-01", total: 4, entregados: 2, en_curso: 1, documentos_entregados: 530,
    hoy: { lotes: 2, abiertos: 1, entregadas: 120 },
    barrios: [barrio("01", 7, "entregado", 300), barrio("02", 7, "en_curso"), barrio("03", 9, "entregado", 230), barrio("04", 9, "pendiente")]
  });
  assert.equal(resumen.facturas, 530);
  assert.equal(resumen.pendientes, 1);
  assert.equal(resumen.porcentaje, 50);
  assert.equal(resumen.enVivo, true);
  assert.deepEqual(resumen.tecnicos.map((fila) => [fila.id, fila.entregados, fila.total, fila.facturas]), [[7, 1, 2, 300], [9, 1, 2, 230]]);
  assert.equal(resumen.tecnicos[0].parteEnCurso, 50);
});

test("sin datos de hoy (servidor anterior) no marca reparto en vivo", () => {
  const resumen = resumenEntregas({ total: 0, entregados: 0, en_curso: 0, barrios: [] });
  assert.equal(resumen.enVivo, false);
  assert.equal(resumen.porcentaje, 0);
  assert.equal(resumenEntregas(null), null);
});

test("plural", () => {
  assert.equal(plural(1, "barrio", "barrios"), "1 barrio");
  assert.equal(plural(1200, "factura", "facturas"), "1,200 facturas");
});
