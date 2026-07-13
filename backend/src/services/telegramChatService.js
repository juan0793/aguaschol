import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";

const memoryChats = [];
const validStatuses = new Set(["pending", "allowed", "revoked"]);

export const normalizeTelegramChatId = (value) => {
  const chatId = String(value ?? "").trim();
  if (!/^-?\d{3,20}$/.test(chatId)) {
    const error = new Error("El ID de Telegram debe contener entre 3 y 20 digitos.");
    error.status = 400;
    throw error;
  }
  return chatId;
};

const mapChat = (chat) => ({
  ...chat,
  id: Number(chat.id),
  chat_id: String(chat.chat_id),
  is_allowed: chat.status === "allowed"
});

const sortChats = (items) =>
  [...items].sort(
    (left, right) =>
      ["pending", "allowed", "revoked"].indexOf(left.status) -
        ["pending", "allowed", "revoked"].indexOf(right.status) ||
      new Date(right.last_seen_at) - new Date(left.last_seen_at)
  );

export const listTelegramChats = async () => {
  if (env.useMemoryDb) return sortChats(memoryChats).map(mapChat);
  const [rows] = await getPool().query(
    `SELECT telegram_chat_access.*, app_users.full_name AS allowed_by_name
     FROM telegram_chat_access
     LEFT JOIN app_users ON app_users.id = telegram_chat_access.allowed_by
     ORDER BY FIELD(telegram_chat_access.status, 'pending', 'allowed', 'revoked'), last_seen_at DESC`
  );
  return rows.map(mapChat);
};

export const touchTelegramChat = async (chat = {}) => {
  const chatId = normalizeTelegramChatId(chat.id);
  const displayName = String(chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || "Chat de Telegram").trim();
  const username = String(chat.username ?? "").trim();
  const chatType = String(chat.type ?? "private").trim();

  if (env.useMemoryDb) {
    let record = memoryChats.find((item) => item.chat_id === chatId);
    if (!record) {
      record = {
        id: memoryChats.length + 1,
        chat_id: chatId,
        display_name: displayName,
        username,
        chat_type: chatType,
        status: env.telegramAllowedChatIds.has(chatId) ? "allowed" : "pending",
        allowed_by: null,
        allowed_at: null,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryChats.push(record);
    } else {
      Object.assign(record, { display_name: displayName, username, chat_type: chatType, last_seen_at: new Date().toISOString() });
    }
    return mapChat(record);
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO telegram_chat_access (chat_id, display_name, username, chat_type, status, allowed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), username = VALUES(username),
       chat_type = VALUES(chat_type), last_seen_at = CURRENT_TIMESTAMP`,
    [
      chatId,
      displayName,
      username,
      chatType,
      env.telegramAllowedChatIds.has(chatId) ? "allowed" : "pending",
      env.telegramAllowedChatIds.has(chatId) ? new Date() : null
    ]
  );
  const [rows] = await pool.query("SELECT * FROM telegram_chat_access WHERE chat_id = ? LIMIT 1", [chatId]);
  return mapChat(rows[0]);
};

export const createTelegramChat = async (payload = {}, actorUser) => {
  const chatId = normalizeTelegramChatId(payload.chat_id);
  const displayName = String(payload.display_name ?? "Acceso manual").trim() || "Acceso manual";

  if (env.useMemoryDb) {
    const existing = memoryChats.find((item) => item.chat_id === chatId);
    if (existing) {
      Object.assign(existing, { display_name: displayName, status: "allowed", allowed_by: actorUser?.id ?? null, allowed_at: new Date().toISOString() });
      return mapChat(existing);
    }
    const record = await touchTelegramChat({ id: chatId, first_name: displayName, type: "private" });
    return updateTelegramChatStatus(record.id, "allowed", actorUser);
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO telegram_chat_access (chat_id, display_name, status, allowed_by, allowed_at)
     VALUES (?, ?, 'allowed', ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), status = 'allowed',
       allowed_by = VALUES(allowed_by), allowed_at = CURRENT_TIMESTAMP`,
    [chatId, displayName, actorUser?.id ?? null]
  );
  const [rows] = await pool.query("SELECT * FROM telegram_chat_access WHERE chat_id = ? LIMIT 1", [chatId]);
  await createAuditLog({
    actorUserId: actorUser?.id,
    action: "telegram_chat.allowed",
    entityType: "telegram_chat",
    entityId: chatId,
    summary: `Chat de Telegram ${chatId} autorizado`
  });
  return mapChat(rows[0]);
};

export const updateTelegramChatStatus = async (id, status, actorUser) => {
  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0 || !validStatuses.has(status) || status === "pending") {
    const error = new Error("Solicitud de acceso de Telegram invalida.");
    error.status = 400;
    throw error;
  }

  if (env.useMemoryDb) {
    const record = memoryChats.find((item) => item.id === targetId);
    if (!record) {
      const error = new Error("Chat de Telegram no encontrado.");
      error.status = 404;
      throw error;
    }
    Object.assign(record, {
      status,
      allowed_by: status === "allowed" ? actorUser?.id ?? null : null,
      allowed_at: status === "allowed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    });
    return mapChat(record);
  }

  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE telegram_chat_access SET status = ?, allowed_by = ?, allowed_at = ? WHERE id = ?`,
    [status, status === "allowed" ? actorUser?.id ?? null : null, status === "allowed" ? new Date() : null, targetId]
  );
  if (!result.affectedRows) {
    const error = new Error("Chat de Telegram no encontrado.");
    error.status = 404;
    throw error;
  }
  const [rows] = await pool.query("SELECT * FROM telegram_chat_access WHERE id = ? LIMIT 1", [targetId]);
  await createAuditLog({
    actorUserId: actorUser?.id,
    action: `telegram_chat.${status}`,
    entityType: "telegram_chat",
    entityId: rows[0].chat_id,
    summary: `Chat de Telegram ${rows[0].chat_id} ${status === "allowed" ? "autorizado" : "revocado"}`
  });
  return mapChat(rows[0]);
};

export const deleteTelegramChat = async (id, actorUser) => {
  const targetId = Number(id);
  if (env.useMemoryDb) {
    const index = memoryChats.findIndex((item) => item.id === targetId);
    if (index < 0) return null;
    return mapChat(memoryChats.splice(index, 1)[0]);
  }
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM telegram_chat_access WHERE id = ? LIMIT 1", [targetId]);
  if (!rows.length) return null;
  await pool.query("DELETE FROM telegram_chat_access WHERE id = ?", [targetId]);
  await createAuditLog({
    actorUserId: actorUser?.id,
    action: "telegram_chat.deleted",
    entityType: "telegram_chat",
    entityId: rows[0].chat_id,
    summary: `Chat de Telegram ${rows[0].chat_id} eliminado`
  });
  return mapChat(rows[0]);
};
