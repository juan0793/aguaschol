import assert from "node:assert/strict";
import test from "node:test";
import {
  createTelegramChat,
  listTelegramChats,
  normalizeTelegramChatId,
  touchTelegramChat,
  updateTelegramChatStatus
} from "./telegramChatService.js";

test("registra, autoriza y revoca un chat sin redespliegue", async () => {
  assert.throws(() => normalizeTelegramChatId("abc"), /ID de Telegram/);
  const pending = await touchTelegramChat({ id: 987654, first_name: "Operador", type: "private" });
  assert.equal(pending.status, "pending");
  assert.equal((await updateTelegramChatStatus(pending.id, "allowed", { id: 1 })).is_allowed, true);
  assert.equal((await updateTelegramChatStatus(pending.id, "revoked", { id: 1 })).status, "revoked");
  assert.ok((await listTelegramChats()).some((chat) => chat.chat_id === "987654"));
  assert.equal((await createTelegramChat({ chat_id: "123456", display_name: "Supervisor" }, { id: 1 })).status, "allowed");
});
