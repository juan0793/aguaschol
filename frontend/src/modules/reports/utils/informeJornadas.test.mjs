import assert from "node:assert/strict";
import test from "node:test";
import { nombreArchivoInforme, textoJornadas, unirBarriosDeJornadas } from "./informeJornadas.js";

test("las jornadas se dicen en una frase, sin repetir mes ni año", () => {
  assert.equal(textoJornadas(["2026-10-15"]), "15 de octubre de 2026");
  assert.equal(textoJornadas(["2026-10-15", "2026-10-13", "2026-10-14"]), "13, 14 y 15 de octubre de 2026");
  assert.equal(textoJornadas(["2026-09-30", "2026-10-01"]), "30 de septiembre y 1 de octubre de 2026");
  assert.equal(textoJornadas(["2025-12-31", "2026-01-02"]), "31 de diciembre de 2025 y 2 de enero de 2026");
  assert.equal(textoJornadas([]), "Sin jornada");
});

test("el archivo lleva la fecha de la jornada, no la del día en que se genera", () => {
  assert.equal(nombreArchivoInforme("reporte-campo", ["2026-10-15"]), "reporte-campo-2026-10-15.pdf");
  assert.equal(nombreArchivoInforme("reporte-censo", ["2026-10-15", "2026-10-13"]), "reporte-censo-2026-10-13-al-2026-10-15.pdf");
});

test("los barrios de varias jornadas se suman en una sola lista", () => {
  const jornada = (zonas) => ({ data: { zones: zonas.map(([clave, nombre, puntos]) => ({ overrideKey: clave, displayName: nombre, zone: nombre, items: Array.from({ length: puntos }) })) } });
  const barrios = unirBarriosDeJornadas([
    jornada([["cabanas", "Barrio Cabañas", 2], ["cortijo", "Barrio El Cortijo", 1]]),
    jornada([["cabanas", "Barrio Cabañas", 3]])
  ]);
  assert.deepEqual(barrios.map((barrio) => [barrio.displayName, barrio.total, barrio.dias]), [["Barrio Cabañas", 5, 2], ["Barrio El Cortijo", 1, 1]]);
});
