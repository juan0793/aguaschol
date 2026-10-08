import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ZONE_TILES, latToTileY, lngToTileX, planZoneDownload, tileUrl, tilesForBounds } from "./offlineTiles.js";

// Centro de Choluteca.
const lat = 13.3017;
const lng = -87.1889;

test("convierte coordenadas al mosaico XYZ correcto", () => {
  assert.equal(lngToTileX(lng, 15), 8447);
  assert.equal(latToTileY(lat, 15), 15162);
  assert.equal(tileUrl("/t/{z}/{x}/{y}.png", { z: 15, x: 8447, y: 15162 }), "/t/15/8447/15162.png");
});

test("cuenta todos los mosaicos de una zona en cada zoom", () => {
  const bounds = { north: lat + 0.005, south: lat - 0.005, east: lng + 0.005, west: lng - 0.005 };
  const tiles = tilesForBounds(bounds, 16, 16);
  assert.ok(tiles.length >= 4 && tiles.length <= 9);
  assert.ok(tiles.every((tile) => tile.z === 16));
});

test("guardar zona baja solo la vista general (14 a 16) y frena zonas enormes", () => {
  const barrio = { north: lat + 0.008, south: lat - 0.008, east: lng + 0.008, west: lng - 0.008 };
  const plan = planZoneDownload(barrio);
  assert.equal(plan.zMin, 14);
  assert.equal(plan.zMax, 16);
  assert.ok(plan.tiles.every((tile) => tile.z <= 16));
  assert.equal(plan.tooLarge, false);
  const departamento = { north: lat + 0.4, south: lat - 0.4, east: lng + 0.4, west: lng - 0.4 };
  assert.equal(planZoneDownload(departamento).tooLarge, true);
  assert.ok(MAX_ZONE_TILES <= 400);
});
