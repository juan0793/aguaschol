import assert from "node:assert/strict";
import test from "node:test";
import {
  cierreTieneCambiosPendientes,
  clearEntregaDraft,
  falloEntregaAmbiguo,
  readEntregaDraft,
  saveEntregaDraft
} from "./entregaDraftStorage.js";
import { formatCount } from "./entregasFormatters.js";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test("delivery drafts are isolated by user and draft id and can be cleared", () => {
  const storage = memoryStorage();
  assert.equal(saveEntregaDraft(7, "lote-nuevo", { total_asignadas: "20" }, storage), true);
  assert.deepEqual(readEntregaDraft(7, "lote-nuevo", storage), { total_asignadas: "20" });
  assert.equal(readEntregaDraft(8, "lote-nuevo", storage), null);
  assert.equal(readEntregaDraft(7, "cierre-12", storage), null);
  clearEntregaDraft(7, "lote-nuevo", storage);
  assert.equal(readEntregaDraft(7, "lote-nuevo", storage), null);
});

test("draft storage failure does not throw and close dirtiness includes all unsent fields", () => {
  const brokenStorage = { getItem: () => "invalid{", setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } };
  assert.equal(readEntregaDraft(7, "lote-nuevo", brokenStorage), null);
  assert.equal(saveEntregaDraft(7, "lote-nuevo", {}, brokenStorage), false);
  assert.doesNotThrow(() => clearEntregaDraft(7, "lote-nuevo", brokenStorage));
  assert.equal(cierreTieneCambiosPendientes({ sobrantes: "", observacion: "", observacionInicial: "", nuevas: [], pegado: "" }), false);
  assert.equal(cierreTieneCambiosPendientes({ sobrantes: "0", observacion: "", observacionInicial: "", nuevas: [], pegado: "" }), true);
  assert.equal(cierreTieneCambiosPendientes({ sobrantes: "", observacion: "nota nueva", observacionInicial: "", nuevas: [], pegado: "" }), true);
  assert.equal(cierreTieneCambiosPendientes({ sobrantes: "", observacion: "", observacionInicial: "", nuevas: [], pegado: "10245" }), true);
  assert.equal(falloEntregaAmbiguo(new Error("sin conexión")), true);
  assert.equal(falloEntregaAmbiguo(Object.assign(new Error("conflicto"), { status: 409 })), false);
  assert.equal(falloEntregaAmbiguo(Object.assign(new Error("error del servidor"), { status: 500 })), true);
  assert.equal(falloEntregaAmbiguo(Object.assign(new Error("validación"), { avisado: true })), false);
});

test("count labels use the matching Spanish singular or plural", () => {
  assert.equal(formatCount(1, "documento"), "1 documento");
  assert.equal(formatCount(2, "documento"), "2 documentos");
  assert.equal(formatCount(2, "fila faltante", "filas faltantes"), "2 filas faltantes");
});
