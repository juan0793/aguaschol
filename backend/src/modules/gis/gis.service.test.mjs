import test from "node:test";
import assert from "node:assert/strict";
import { getGisConfig, GIS_DATASETS } from "./gis.service.js";
import { getGisPermissions } from "./gis.validation.js";

test("config SIG expone SRID canonico y datasets verificados", () => {
  const config = getGisConfig({ role: "admin" });
  assert.equal(config.srid.canonical, 32616);
  assert.equal(config.srid.web, 3857);
  assert.equal(config.srid.gps, 4326);
  assert.equal(GIS_DATASETS.some((item) => item.file === "Barrios.gpkg" && item.count === 82), true);
  assert.equal(GIS_DATASETS.some((item) => item.layer === "lotes_choluteca" && item.count === 15304), true);
  assert.equal(GIS_DATASETS.some((item) => item.layer === "numerolotes__texts" && item.count === 66443), true);
  assert.equal(GIS_DATASETS.some((item) => item.layer === "bd_catastrousuarios" && item.srid === 4326), true);
});

test("permisos SIG son por rol y backend decide", () => {
  assert.equal(getGisPermissions({ role: "admin" }).includes("import"), true);
  assert.equal(getGisPermissions({ role: "operator" }).includes("deletePoint"), false);
  assert.deepEqual(getGisPermissions({ role: "unknown" }), []);
});
