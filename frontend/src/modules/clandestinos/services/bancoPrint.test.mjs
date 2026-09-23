import test from "node:test";
import assert from "node:assert/strict";
import { buildBancoListado, dictamenParaImprimir } from "./bancoPrint.js";

test("sin dictamen o con registrados se imprimen solo clandestinos", () => {
  assert.equal(dictamenParaImprimir(""), "clandestino");
  assert.equal(dictamenParaImprimir("registrado"), "clandestino");
  assert.equal(dictamenParaImprimir("probable"), "probable");
});

test("el listado agrupa por barrio, escapa texto y nunca lleva registrados en Aguas", () => {
  const html = buildBancoListado([
    { id: 1, dictamen: "clandestino", clave_catastral: "22-17-16", barrio_colonia: "Barrio Cabañas", alcaldia_propietario: "OSCAR <b>", comentario_campo: "3 locales", origen_ref: "1681", agua: true },
    { id: 2, dictamen: "registrado", clave_catastral: "22-36-39", barrio_colonia: "Barrio Cabañas", origen_ref: "2815" },
    { id: 3, dictamen: "clandestino", clave_catastral: "124-01-01", barrio_colonia: "Ciudad Valcanes", origen_ref: "2245" }
  ], { dictamen: "clandestino", asignadoNombre: "Juan Pérez" });
  assert.match(html, /2 candidatos/);
  assert.match(html, /Barrio Cabañas<\/strong><span>1 candidato</);
  assert.match(html, /Ciudad Valcanes/);
  assert.doesNotMatch(html, /22-36-39/);
  assert.match(html, /OSCAR &lt;b&gt;/);
  assert.match(html, /Juan Pérez/);
});
