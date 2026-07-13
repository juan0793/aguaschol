import assert from "node:assert/strict";
import test from "node:test";
import {
  findPadronForTelegram,
  formatInmuebleForTelegram,
  formatPadronForTelegram,
  splitTelegramMessage
} from "./telegramBotService.js";

test("formatea la ficha y divide mensajes sin perder contenido", () => {
  const text = formatInmuebleForTelegram({ clave_catastral: "10-22-23", abonado: "456" });
  const chunks = splitTelegramMessage(text, 120);
  assert.match(text, /Clave catastral: 10-22-23/);
  assert.match(text, /Abonado: 456/);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => chunk.length <= 120));
});

test("consulta el padrón real por abonado o clave", async () => {
  const byAbonado = await findPadronForTelegram("1223");
  const byClave = await findPadronForTelegram("09-02-03");
  assert.equal(byAbonado[0].clave_catastral, "10-24-06-02");
  assert.ok(byClave.some((record) => record.abonado === "3421"));
  assert.match(formatPadronForTelegram(byAbonado[0]), /Total:.*1[,.]430/);
});
