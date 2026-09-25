import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparPadronPorBarrio,
  armarReparto,
  codigoBarrioDeClave,
  nombreBarrioLegible,
  normalizarAsignacion
} from "./entregasRepartoRules.js";

test("codigoBarrioDeClave toma el primer segmento y descarta 00", () => {
  assert.equal(codigoBarrioDeClave("01-02-03-04"), "01");
  assert.equal(codigoBarrioDeClave("113-17-02-01"), "113");
  assert.equal(codigoBarrioDeClave("00-00-00-00"), "");
  assert.equal(codigoBarrioDeClave(""), "");
});

test("nombreBarrioLegible abrevia el prefijo y ordena mayusculas", () => {
  assert.equal(nombreBarrioLegible("BO.  SAN  JUAN BOSCO"), "Bo. San Juan Bosco");
  assert.equal(nombreBarrioLegible("COL. LAS ACACIAS II"), "Col. Las Acacias II");
  assert.equal(nombreBarrioLegible("RESIDENCIAL LOMAS DE CASIPULU"), "Res. Lomas de Casipulu");
});

test("agruparPadronPorBarrio cuenta claves y elige el nombre mas repetido", () => {
  const grupos = agruparPadronPorBarrio([
    { clave_catastral: "14-01-01-01", barrio_colonia: "BO. EL CENTRO" },
    { clave_catastral: "14-01-02-01", barrio_colonia: "BO. EL CENTRO" },
    { clave_catastral: "14-02-01-01", barrio_colonia: "CENTRO" },
    { clave_catastral: "00-00-00-00", barrio_colonia: "NO REGISTRADAS" },
    { clave_catastral: "22-37-01-01", barrio_colonia: "BO. CABAÑAS" }
  ]);
  assert.deepEqual(grupos.find((g) => g.codigo === "14"), { codigo: "14", claves: 3, nombre_padron: "BO. EL CENTRO" });
  assert.equal(grupos.length, 2);
});

test("armarReparto une padron, catalogo y asignaciones guardadas", () => {
  const barrios = armarReparto({
    padron: [
      { codigo: "14", claves: 869, nombre_padron: "BO. EL CENTRO" },
      { codigo: "113", claves: 1389, nombre_padron: "RESIDENCIAL MONTELIMAR 1 Y 2" }
    ],
    catalogo: [
      { codigo: "14", barrio: "Barrio El Centro", activo: true },
      { codigo: "100", barrio: "Stybis", activo: true }
    ],
    asignaciones: [
      { barrio_codigo: "14", responsable_id: 3, orden_ruta: 2 },
      { barrio_codigo: "96", responsable_id: 5, orden_ruta: null }
    ]
  });
  assert.deepEqual(barrios.map((b) => b.codigo), ["14", "96", "113"]);
  assert.equal(barrios[0].nombre, "Barrio El Centro");
  assert.equal(barrios[0].responsable_id, 3);
  assert.equal(barrios[0].orden_ruta, 2);
  // Un barrio asignado sin claves se conserva para no perder la asignacion.
  assert.equal(barrios[1].claves, 0);
  assert.equal(barrios[1].responsable_id, 5);
  assert.equal(barrios[2].nombre, "Res. Montelimar 1 y 2");
  assert.equal(barrios[2].responsable_id, null);
  // El catalogo no agrega codigos sin claves ni asignacion.
  assert.ok(!barrios.some((b) => b.codigo === "100"));
});

test("normalizarAsignacion valida codigo, responsable y orden", () => {
  assert.deepEqual(normalizarAsignacion({ responsable_id: "4", orden_ruta: "3" }, "22"), { barrio_codigo: "22", responsable_id: 4, orden_ruta: 3 });
  assert.deepEqual(normalizarAsignacion({ barrio_codigo: "41", responsable_id: "" }), { barrio_codigo: "41", responsable_id: null, orden_ruta: null });
  assert.throws(() => normalizarAsignacion({}, "x1"), /código de barrio/);
  assert.throws(() => normalizarAsignacion({ responsable_id: "-2" }, "14"), /responsable/);
  assert.throws(() => normalizarAsignacion({ responsable_id: "2", orden_ruta: "0" }, "14"), /orden de ruta/);
});
