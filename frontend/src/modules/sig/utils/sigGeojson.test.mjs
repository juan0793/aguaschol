import assert from "node:assert/strict";
import test from "node:test";
import { geometryBounds } from "./sigGeojson.js";

test("calcula bbox de MultiPolygon para fitBounds", () => {
  const geometry = {
    type: "MultiPolygon",
    coordinates: [[[
      [-87.2, 13.1],
      [-87.1, 13.1],
      [-87.1, 13.3],
      [-87.2, 13.3],
      [-87.2, 13.1]
    ]]]
  };
  assert.deepEqual(geometryBounds(geometry), [[-87.2, 13.1], [-87.1, 13.3]]);
});
