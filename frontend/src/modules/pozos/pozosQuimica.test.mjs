import assert from "node:assert/strict";
import test from "node:test";
import { conductividadDe, curvaCarbonato, especiacionCarbonato, lecturaDe, revisionesDelDato } from "./pozosQuimica.js";

test("la conductividad separa la de 25 °C de la de la muestra, en cualquier orden", () => {
  assert.deepEqual(conductividadDe({ conductividad: "346/296", tds_g_l: 0.192, temperatura_c: 34 }), { spc: 296, temperatura: 346, cuadra: true, esperadaSpc: 295 });
  assert.equal(conductividadDe({ conductividad: "937/1098", tds_g_l: 0.609, temperatura_c: 33.98 }).spc, 937);
  assert.equal(conductividadDe({ conductividad: "975/534", tds_g_l: 0.309, temperatura_c: 31.49 }).cuadra, false);
  assert.equal(conductividadDe({ conductividad: "" }), null);
});

test("el reparto del carbonato sigue al pH (Plummer y Busenberg)", () => {
  const promedio = especiacionCarbonato(5.93, 33);
  assert.equal(Math.round(promedio.co2), 71);
  assert.equal(Math.round(promedio.bicarbonato), 29);
  assert.equal(Math.round(especiacionCarbonato(4.9, 33).co2), 96);
  assert.equal(Math.round(especiacionCarbonato(8.3, 33).bicarbonato), 98);
  assert.equal(especiacionCarbonato(null), null);
  const curva = curvaCarbonato(25);
  assert.equal(curva.length, 61);
  curva.forEach((punto) => assert.ok(Math.abs(punto.co2 + punto.bicarbonato + punto.carbonato - 100) < 1e-9));
});

test("las lecturas dicen la regla y no inventan veredictos", () => {
  assert.equal(lecturaDe("ph", { ph: 6.3 }).estado, "fuera");
  assert.equal(lecturaDe("ph", { ph: 6.93 }).estado, "dentro");
  assert.equal(lecturaDe("tds_g_l", { tds_g_l: 0.8 }).estado, "atencion");
  assert.equal(lecturaDe("cloro_residual", { cloro_residual: 0.08 }).estado, "no_detectado");
  assert.equal(lecturaDe("salinidad", { salinidad: 0.3 }).estado, "info");
  assert.equal(lecturaDe("conductividad", { conductividad: "346/296", tds_g_l: 0.192 }).valor, 296);
  assert.equal(lecturaDe("ph", {}).estado, "sin");
  assert.equal(lecturaDe("nitratos", {}), null);
});

test("las revisiones del dato señalan capturas dudosas y nada en un pozo coherente", () => {
  assert.deepEqual(revisionesDelDato({ conductividad: "346/296", tds_g_l: 0.192, temperatura_c: 34, salinidad: 0.14, ph: 6.3 }), []);
  const avisos = revisionesDelDato({ conductividad: "975/534", tds_g_l: 0.309, temperatura_c: 37.9, salinidad: 0.23, ph: 4.89 }).map((aviso) => aviso.campo);
  assert.deepEqual(avisos, ["conductividad", "ph", "temperatura_c"]);
});
