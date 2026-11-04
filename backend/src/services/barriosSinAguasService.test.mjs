import assert from "node:assert/strict";
import test from "node:test";
import { buscarParecido, normalizarNombreBarrio, resumirBarriosAlcaldia } from "./barriosSinAguasService.js";

const aguas = (nombre, usuarios) => ({ nombre, usuarios, palabras: normalizarNombreBarrio(nombre) });

test("encuentra el barrio de Aguas con nombre parecido", () => {
  const lista = [aguas("RESIDENCIAL MONTELIMAR 1 Y 2", 1399), aguas("BO. EL CENTRO", 872), aguas("COL. MONTE VERDE", 40)];
  assert.equal(buscarParecido("Residencial Montelimar", lista)?.nombre, "RESIDENCIAL MONTELIMAR 1 Y 2");
  assert.equal(buscarParecido("Barrio El Centro", lista)?.nombre, "BO. EL CENTRO");
  assert.equal(buscarParecido("Colonia Stybys", lista), null);
});

test("resume cada barrio de Alcaldía con su cobertura y datos del predio", () => {
  const filas = [
    { barrio_comparacion: "Colonia Stybys", clave_catastral: "70-10-01", codigo_caserio: "060", naturaleza: "Urbano", avaluo_terreno: 100, avaluo_edificacion: 50, ultimo_periodo_pagado: "2025" },
    { barrio_comparacion: "Colonia Stybys", clave_catastral: "70-10-02", codigo_caserio: "060", naturaleza: "Rural", avaluo_terreno: 10, avaluo_edificacion: 0, ultimo_periodo_pagado: "" }
  ];
  const stats = [{ barrio_colonia: "Colonia Stybys", alcaldia_total: 2, aguas_registradas: 0, candidatas_clandestinas: 2, cobertura_aguas_pct: 0 }];
  const [b] = resumirBarriosAlcaldia(filas, stats, [{ barrio_colonia: "BO. EL CENTRO" }]);
  assert.deepEqual([b.claves, b.en_aguas, b.urbano, b.rural, b.avaluo, b.con_pago_alcaldia, b.codigo_caserio], [2, 0, 1, 1, 160, 1, "060"]);
  assert.deepEqual(b.sectores, ["70-10"]);
  assert.equal(b.parecido, null);
});
