import assert from "node:assert/strict";
import test from "node:test";
import { armarPaginasLote, mapEnOrden, resumenLoteHtml, tituloLote } from "./loteImpresion.js";

test("mapEnOrden respeta el orden y el límite de trabajos a la vez", async () => {
  let activos = 0;
  let maximo = 0;
  const avances = [];
  const result = await mapEnOrden([30, 5, 20, 1, 10], 2, async (ms, index) => {
    activos += 1;
    maximo = Math.max(maximo, activos);
    await new Promise((resolve) => setTimeout(resolve, ms));
    activos -= 1;
    return `r${index}`;
  }, ({ done, total }) => avances.push(`${done}/${total}`));
  assert.deepEqual(result, ["r0", "r1", "r2", "r3", "r4"]);
  assert.equal(maximo, 2);
  assert.deepEqual(avances.at(-1), "5/5");
  assert.deepEqual(await mapEnOrden([], 4, async () => 1), []);
});

test("intercala ficha (horizontal) y aviso (vertical) por inmueble", () => {
  const html = armarPaginasLote([{ ficha: "F1", aviso: "A1" }, { ficha: "", aviso: "A2" }, { ficha: "F3", aviso: "" }]);
  const orden = [...html.matchAll(/<section class="([^"]+)">(\w+)<\/section>/g)].map((match) => `${match[2]}:${match[1].includes("lote-ficha") ? "h" : "v"}`);
  assert.deepEqual(orden, ["F1:h", "A1:v", "A2:v", "F3:h"]);
  assert.match(html, /print-ficha lote-ficha/);
});

test("título y resumen del lote", () => {
  assert.equal(tituloLote({ total: 3, avisos: true, fichas: true }), "Avisos y fichas técnicas · 3 inmuebles");
  assert.equal(tituloLote({ total: 1, avisos: true, fichas: false }), "Avisos · 1 inmueble");
  const escape = (value) => String(value).replace(/</g, "&lt;");
  const html = resumenLoteHtml([{ clave_catastral: "10-22-23", abonado: "<b>Ana</b>", barrio_colonia: "Centro" }], { avisos: true, fichas: false, plazo: "24 horas" }, escape);
  assert.match(html, /10-22-23/);
  assert.match(html, /&lt;b>Ana/);
  assert.match(html, /Plazo del aviso: 24 horas/);
});
