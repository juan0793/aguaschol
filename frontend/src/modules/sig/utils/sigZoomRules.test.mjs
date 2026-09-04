import test from "node:test";
import assert from "node:assert/strict";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { loteLineWidth, sigVisibleLayerGroups } from "./sigZoomRules.js";

test("reglas de zoom SIG no cargan detalle fino antes de z17", () => {
  assert.deepEqual(sigVisibleLayerGroups(11), ["cobertura", "barrios_simplificados"]);
  assert.equal(sigVisibleLayerGroups(15).includes("usuarios"), false);
  assert.equal(sigVisibleLayerGroups(15).includes("lotes_simplificados"), true);
  assert.equal(sigVisibleLayerGroups(16).includes("puntos_agrupados"), true);
  assert.equal(sigVisibleLayerGroups(17).includes("numeros_lote"), true);
  assert.equal(sigVisibleLayerGroups(17).includes("usuarios"), true);
});

test("el borde de lotes es válido para MapLibre con zoom y selección", () => {
  const errors = validateStyleMin({
    version: 8,
    sources: { lotes: { type: "geojson", data: { type: "FeatureCollection", features: [] } } },
    layers: [{ id: "lotes-line", type: "line", source: "lotes", paint: { "line-width": loteLineWidth } }]
  });
  assert.deepEqual(errors, []);
});
