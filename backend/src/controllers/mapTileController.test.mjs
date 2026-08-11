import assert from "node:assert/strict";
import test from "node:test";
import { getTileProviders } from "./mapTileController.js";

test("selects printable map layers and falls back to streets", () => {
  assert.match(getTileProviders("imagery")[0], /World_Imagery/);
  assert.match(getTileProviders("relief")[0], /World_Topo_Map/);
  assert.match(getTileProviders("labels")[0], /World_Boundaries_and_Places/);
  assert.deepEqual(getTileProviders("unknown"), getTileProviders("streets"));
});
