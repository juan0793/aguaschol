import test from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { correctSpelling } from "./llmService.js";

const configure = (apiKey) => {
  env.llmProvider = "openrouter";
  env.cerebrasApiKey = "";
  env.llmApiKey = apiKey;
};

const mockCompletion = (content) => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  };
  return calls;
};

test("sin IA configurada responde 503 para que el frontend use la corrección local", async () => {
  configure("");
  await assert.rejects(() => correctSpelling("Disen los vecino q"), (error) => error.status === 503);
});

test("devuelve el texto corregido y envía el original sin alterar", async () => {
  configure("test-key");
  const calls = mockCompletion("\"Dicen los vecinos que no está culminado el alcantarillado.\"");
  const result = await correctSpelling("Disen los vecino q no esta culminado el alcantarillado");
  assert.equal(result.text, "Dicen los vecinos que no está culminado el alcantarillado.");
  assert.equal(result.changed, true);
  assert.equal(calls[0].body.temperature, 0);
  assert.equal(calls[0].body.messages[1].content, "Disen los vecino q no esta culminado el alcantarillado");
});

test("descarta una respuesta que reescribe el texto en lugar de corregirlo", async () => {
  configure("test-key");
  mockCompletion("Según lo informado por los vecinos durante la visita de campo realizada, el sistema de alcantarillado sanitario de aguas negras del sector aún no ha sido culminado por la municipalidad.");
  await assert.rejects(() => correctSpelling("Disen los vecino q no esta culminado"), (error) => error.status === 422);
});

test("un texto vacío no llama a la IA", async () => {
  configure("test-key");
  const calls = mockCompletion("x");
  assert.deepEqual(await correctSpelling("   "), { text: "", changed: false, provider: "none" });
  assert.equal(calls.length, 0);
});
