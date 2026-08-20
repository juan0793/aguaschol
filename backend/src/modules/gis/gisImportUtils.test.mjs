import assert from "node:assert/strict";
import test from "node:test";
import { parseBarrioLabel, stripGpkgHeader } from "./gisImportUtils.js";

test("parsea etiqueta CAD de barrio", () => {
  assert.deepEqual(parseBarrioLabel("BARRIO\nLAS COLINAS\n30\n"), {
    tipo: "BARRIO",
    nombre: "LAS COLINAS",
    clave: "30",
    sourceText: "BARRIO\nLAS COLINAS\n30\n"
  });
});

test("stripGpkgHeader conserva WKB despues del encabezado GeoPackage", () => {
  const wkb = Buffer.from([1, 2, 3, 4]);
  const header = Buffer.from([0x47, 0x50, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(stripGpkgHeader(Buffer.concat([header, wkb])), wkb);
});
