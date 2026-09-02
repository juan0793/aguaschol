import test from "node:test";
import assert from "node:assert/strict";
import { activeServices, money, vinculoLabel } from "./loteTerritorial.js";

test("formatea mora cero como valor real", () => {
  assert.equal(money(0), "L 0.00");
});

test("servicios activos omiten claves inactivas", () => {
  assert.deepEqual(activeServices({ agua: "S", barrido: "N", desechos_peligrosos: "S" }), ["agua", "desechos peligrosos"]);
});

test("etiqueta vinculo ambiguo sin confirmarlo", () => {
  assert.equal(vinculoLabel("ambiguous"), "Vínculo ambiguo");
});
