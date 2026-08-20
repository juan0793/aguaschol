import assert from "node:assert/strict";
import test from "node:test";
import { parseBarrioLabel, stripGpkgHeader } from "./gisImportUtils.js";

test("parsea etiqueta CAD de barrio", () => {
  assert.deepEqual(parseBarrioLabel("BARRIO\nLAS COLINAS\n30\n"), {
    tipo: "BARRIO",
    nombre: "LAS COLINAS",
    clave: "30",
    claveSufijo: null,
    sourceText: "BARRIO\nLAS COLINAS\n30\n"
  });
});

test("parsea etiqueta compacta con clave de 2 o 3 digitos", () => {
  assert.deepEqual(parseBarrioLabel("COLONIA SANTA MARTA 37"), {
    tipo: "COLONIA",
    nombre: "SANTA MARTA",
    clave: "37",
    claveSufijo: null,
    sourceText: "COLONIA SANTA MARTA 37"
  });
  assert.deepEqual(parseBarrioLabel("RESIDENCIAL CRISTO DE ESQUIPULAS 136 I"), {
    tipo: "RESIDENCIAL",
    nombre: "CRISTO DE ESQUIPULAS",
    clave: "136",
    claveSufijo: "I",
    sourceText: "RESIDENCIAL CRISTO DE ESQUIPULAS 136 I"
  });
});

test("stripGpkgHeader conserva WKB despues del encabezado GeoPackage", () => {
  const wkb = Buffer.from([1, 2, 3, 4]);
  const header = Buffer.from([0x47, 0x50, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(stripGpkgHeader(Buffer.concat([header, wkb])), wkb);
});
