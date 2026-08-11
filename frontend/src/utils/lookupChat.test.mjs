import assert from "node:assert/strict";
import test from "node:test";
import { buildLookupChatResponse, buildLookupPrintMarkup, parseLookupChatMessage } from "./lookupChat.js";

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

test("mantiene consistente una vinculacion municipal con Aguas", () => {
  const response = buildLookupChatResponse({
    aguas: { matches: [] },
    alcaldia: { matches: [{ clave_catastral: "10-10-10", exists_in_aguas: true, clave_aguas_formato: "10-10-10" }] }
  });

  assert.equal(response.tone, "success");
  assert.equal(response.title, "Vinculación encontrada");
  assert.match(response.text, /figura vinculada al padrón de Aguas/);
  assert.equal(response.cards[0].fields.find(({ label }) => label === "Estado en Aguas")?.value, "Con registro asociado");
});

test("prepara todos los resultados para imprimir sin insertar HTML de los datos", () => {
  const markup = buildLookupPrintMarkup({
    title: "Dos resultados",
    cards: [
      { status: "En Aguas", fields: [{ label: "Clave", value: "10-10-10-10" }] },
      { status: "Solo Catastro", fields: [{ label: "Nombre", value: "<script>riesgo</script>" }] }
    ]
  });

  assert.match(markup, /10-10-10-10/);
  assert.match(markup, /Solo Catastro/);
  assert.match(markup, /lookup-chat-print-card/);
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;riesgo&lt;\/script&gt;/);
});
