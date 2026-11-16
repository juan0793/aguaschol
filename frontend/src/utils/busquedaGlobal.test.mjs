import test from "node:test";
import assert from "node:assert/strict";
import { pedirBusqueda, tomarBusquedaPendiente } from "./busquedaGlobal.js";

const memoria = () => {
  const datos = new Map();
  return { setItem: (k, v) => datos.set(k, String(v)), getItem: (k) => (datos.has(k) ? datos.get(k) : null), removeItem: (k) => datos.delete(k) };
};

test("el texto pedido se toma una sola vez", () => {
  const storage = memoria();
  assert.equal(pedirBusqueda("  14-02-06-03 ", { storage, target: null }), true);
  assert.equal(tomarBusquedaPendiente({ storage }), "14-02-06-03");
  assert.equal(tomarBusquedaPendiente({ storage }), "");
});

test("un texto vacío no deja nada pendiente", () => {
  const storage = memoria();
  assert.equal(pedirBusqueda("   ", { storage, target: null }), false);
  assert.equal(tomarBusquedaPendiente({ storage }), "");
});

test("sin almacenamiento no falla", () => {
  assert.equal(tomarBusquedaPendiente({ storage: null }), "");
  assert.equal(pedirBusqueda("Hospital", { storage: null, target: null }), true);
});
