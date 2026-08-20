import test from "node:test";
import assert from "node:assert/strict";
import { sigVisibleLayerGroups } from "./sigZoomRules.js";

test("reglas de zoom SIG no cargan detalle fino antes de z17", () => {
  assert.deepEqual(sigVisibleLayerGroups(11), ["cobertura", "barrios_simplificados"]);
  assert.equal(sigVisibleLayerGroups(15).includes("usuarios"), false);
  assert.equal(sigVisibleLayerGroups(15).includes("lotes_simplificados"), true);
  assert.equal(sigVisibleLayerGroups(16).includes("puntos_agrupados"), true);
  assert.equal(sigVisibleLayerGroups(17).includes("numeros_lote"), true);
  assert.equal(sigVisibleLayerGroups(17).includes("usuarios"), true);
});
