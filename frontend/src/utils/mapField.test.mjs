import assert from "node:assert/strict";
import test from "node:test";
import { isValidMapPointCoordinate } from "./mapField.js";

test("acepta puntos de Honduras y descarta coordenadas que alejan el mapa", () => {
  assert.equal(isValidMapPointCoordinate({ latitude: 13.3017, longitude: -87.1889 }), true);
  assert.equal(isValidMapPointCoordinate({ latitude: 13.3017, longitude: 0 }), false);
  assert.equal(isValidMapPointCoordinate({ latitude: -87.1889, longitude: 13.3017 }), false);
  assert.equal(isValidMapPointCoordinate({ latitude: "", longitude: "" }), false);
});
