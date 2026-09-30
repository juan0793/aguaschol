import test from "node:test";
import assert from "node:assert/strict";
import { buildBancoListado, dictamenParaImprimir } from "./bancoPrint.js";

test("sin dictamen o con registrados se imprimen solo clandestinos", () => {
  assert.equal(dictamenParaImprimir(""), "clandestino");
  assert.equal(dictamenParaImprimir("registrado"), "clandestino");
  assert.equal(dictamenParaImprimir("sin_determinar"), "sin_determinar");
  assert.equal(dictamenParaImprimir("probable"), "clandestino");
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
  assert.doesNotMatch(html, /bl-avance/);
});

test("lo de un técnico lleva su avance y marca lo ya trabajado", () => {
  const html = buildBancoListado([
    { id: 1, dictamen: "clandestino", estado: "pendiente", clave_catastral: "14-08-02-07", origen_ref: "760" },
    { id: 2, dictamen: "clandestino", estado: "enviado", clave_catastral: "14-08-02-08", origen_ref: "761" },
    { id: 3, dictamen: "clandestino", estado: "descartado", motivo_descarte: "Punto duplicado", clave_catastral: "14-08-02-13", origen_ref: "767" }
  ], { asignadoNombre: "Sindy", avance: { total: 3, trabajados: 2, enviados: 1, descartados: 1, pendientes: 1, avance: 66 } });
  assert.match(html, /Avance 66%/);
  assert.match(html, /2 de 3 trabajados/);
  assert.match(html, /class="bl-hecho">Ficha</);
  assert.match(html, /class="bl-hecho">Descartado<\/td><td>Punto duplicado/);
  assert.equal((html.match(/class="bl-chk"/g) || []).length, 1);
});
