import test from "node:test";
import assert from "node:assert/strict";
import { getGisConfig, GIS_DATASETS } from "./gis.service.js";
import { getGisPermissions } from "./gis.validation.js";
import { deriveLoteVinculo } from "./gis.lote.js";

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

test("vinculo de lote no confirma claves ambiguas", () => {
  assert.equal(deriveLoteVinculo({ catastro: [{ id: 1 }, { id: 2 }] }).estado, "ambiguous");
  assert.equal(deriveLoteVinculo({ lote: { clave_catastral: "25-10" }, catastro: [], padron: null }).estado, "partial");
  assert.equal(deriveLoteVinculo({ lote: {}, catastro: [], padron: null }).estado, "unlinked");
});
