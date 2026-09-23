import test from "node:test";
import assert from "node:assert/strict";
import { buildFindingsPrint } from "./findingsPrint.js";

const items = [
  { base: "10-01-01", clave: "10-01-01", barrio: "10 - Barrio <San>", puntos: [7, 9], cuentas: [
    { abonado: "1", clave: "10-01-01-01", nombre: "ANA", agua: true, alcantarillado: false, deuda: 120.5 },
    { abonado: "2", clave: "10-01-01-02", nombre: "LUIS", agua: false, alcantarillado: false, deuda: 0 }
  ] }
];

test("cobro lista solo las cuentas que deben", () => {
  const html = buildFindingsPrint(items, { tipo: "cobro", periodo: "Septiembre 2026", total: 120.5 });
  assert.match(html, /ANA/);
  assert.doesNotMatch(html, /LUIS/);
  assert.match(html, /L 120\.50/);
});

test("facturación lista todas las cuentas del predio, con los puntos GPS y texto escapado", () => {
  const html = buildFindingsPrint(items, { tipo: "facturacion", periodo: "Septiembre 2026" });
  assert.match(html, /ANA/);
  assert.match(html, /LUIS/);
  assert.match(html, /#7 #9/);
  assert.match(html, /Barrio &lt;San&gt;/);
});
