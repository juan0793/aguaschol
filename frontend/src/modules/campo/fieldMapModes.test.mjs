import assert from "node:assert/strict";
import test from "node:test";
import { buildLegend, resolveMarkerColor } from "./fieldMapModes.js";

test("tipo conserva exactamente el color persistido", () => {
  assert.equal(resolveMarkerColor({ marker_color: "#abcdef" }, "tipo", { debt: 90000 }), "#abcdef");
});

test("cartera usa cortes visuales sin modificar el punto", () => {
  const point = { marker_color: "#1576d1" };
  assert.equal(resolveMarkerColor(point, "cartera", { debt: 0 }), "#94a3b8");
  assert.equal(resolveMarkerColor(point, "cartera", { debt: 5001 }), "#eab308");
  assert.equal(resolveMarkerColor(point, "cartera", { debt: 50001 }), "#7f1d1d");
  assert.equal(point.marker_color, "#1576d1");
});

test("comercial reserva rojo para negocios", () => {
  assert.equal(resolveMarkerColor({}, "comercial", { business: true }), "#ef4444");
  assert.notEqual(resolveMarkerColor({}, "comercial", { business: false }), "#ef4444");
});

test("la leyenda de cartera declara que representa deuda", () => {
  assert.ok(buildLegend("cartera").every((entry) => /deuda/i.test(entry.label)));
});
