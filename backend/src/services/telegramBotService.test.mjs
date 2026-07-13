import assert from "node:assert/strict";
import test from "node:test";
import { formatInmuebleForTelegram, splitTelegramMessage } from "./telegramBotService.js";
import { findByAbonadoOrClave } from "./inmuebleService.js";

test("formatea la ficha y divide mensajes sin perder contenido", () => {
  const text = formatInmuebleForTelegram({ clave_catastral: "10-22-23", abonado: "456" });
  const chunks = splitTelegramMessage(text, 120);
  assert.match(text, /Clave catastral: 10-22-23/);
  assert.match(text, /Abonado: 456/);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => chunk.length <= 120));
});

test("encuentra la misma ficha por abonado o clave", async () => {
  const byAbonado = await findByAbonadoOrClave("12345");
  const byClave = await findByAbonadoOrClave("10-22-23");
  assert.equal(byAbonado[0].id, byClave[0].id);
});
