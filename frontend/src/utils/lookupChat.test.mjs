import assert from "node:assert/strict";
import test from "node:test";
import { buildLookupChatResponse, parseLookupChatMessage } from "./lookupChat.js";

test("reconoce una clave historica con bloques de tres digitos", () => {
  assert.deepEqual(
    parseLookupChatMessage("buscar clave 22-37-116-03"),
    { mode: "clave", query: "22-37-116-03", originalText: "buscar clave 22-37-116-03", intent: "general" }
  );
});

test("no repite el mismo nombre como abonado e inquilino", () => {
  const response = buildLookupChatResponse({
    aguas: { matches: [{ abonado: "22414", nombre: "", inquilino: "SELIMSA" }] }
  });

  const labels = response.cards[0].fields.map(({ label }) => label);
  assert.equal(labels.filter((label) => label === "Abonado").length, 1);
  assert.equal(labels.includes("Inquilino"), false);
});
