import assert from "node:assert/strict";
import test from "node:test";
import { buildLookupChatResponse } from "./lookupChat.js";

test("no repite el mismo nombre como abonado e inquilino", () => {
  const response = buildLookupChatResponse({
    aguas: { matches: [{ abonado: "22414", nombre: "", inquilino: "SELIMSA" }] }
  });

  const labels = response.cards[0].fields.map(({ label }) => label);
  assert.equal(labels.filter((label) => label === "Abonado").length, 1);
  assert.equal(labels.includes("Inquilino"), false);
});
