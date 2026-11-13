import assert from "node:assert/strict";
import test from "node:test";
import { textoLegible } from "./reclamosFormato.js";

test("textoLegible pasa a oraciones el texto escrito todo en mayúsculas", () => {
  assert.equal(textoLegible("LE ESTÁ LLEGANDO LA FACTURA CADA DOS MESES. DICE QUE NO."), "Le está llegando la factura cada dos meses. Dice que no.");
  assert.equal(textoLegible("¿NO LE LLEGÓ? ÑANDÚ"), "¿No le llegó? Ñandú");
});

test("textoLegible no toca texto con minúsculas, siglas cortas ni vacío", () => {
  assert.equal(textoLegible("La dejó con la vecina de la casa 12"), "La dejó con la vecina de la casa 12");
  assert.equal(textoLegible("OK 12"), "OK 12");
  assert.equal(textoLegible(""), "");
  assert.equal(textoLegible(null), "");
});
