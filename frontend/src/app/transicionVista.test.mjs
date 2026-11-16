import test from "node:test";
import assert from "node:assert/strict";
import { esEntradaCorta, suavizarCambioDeVista } from "./transicionVista.js";

test("solo se terminan las entradas finitas y cortas", () => {
  assert.equal(esEntradaCorta({ iterations: 1, endTime: 360 }), true);
  assert.equal(esEntradaCorta({ iterations: 1, endTime: 640 }), true);
  assert.equal(esEntradaCorta({ iterations: Infinity, endTime: Infinity }), false, "spinner o pulso");
  assert.equal(esEntradaCorta({ iterations: 1, endTime: 5200 }), false, "animación larga");
  assert.equal(esEntradaCorta({ iterations: 1, endTime: 0 }), false);
  assert.equal(esEntradaCorta(null), false);
});

test("sin armazón o sin getAnimations no hace nada", () => {
  const limpiar = suavizarCambioDeVista({ doc: { querySelector: () => null }, view: {} });
  assert.equal(typeof limpiar, "function");
  limpiar();
});
