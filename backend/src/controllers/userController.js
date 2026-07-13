import { exportAuditLogsCsv, listAuditLogs } from "../services/auditService.js";
import { createUser, deleteUser, listUsers, resetUserPassword, updateUserRole } from "../services/userService.js";
import {
  createTelegramChat,
  deleteTelegramChat,
  listTelegramChats,
  updateTelegramChatStatus
} from "../services/telegramChatService.js";

export const listTelegramChatsHandler = async (_req, res, next) => {
  try {
    res.json(await listTelegramChats());
  } catch (error) {
    next(error);
  }
};

export const createTelegramChatHandler = async (req, res, next) => {
  try {
    res.status(201).json(await createTelegramChat(req.body, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const updateTelegramChatHandler = async (req, res, next) => {
  try {
    res.json(await updateTelegramChatStatus(req.params.id, req.body?.status, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const deleteTelegramChatHandler = async (req, res, next) => {
  try {
    const chat = await deleteTelegramChat(req.params.id, req.authUser);
    if (!chat) return res.status(404).json({ message: "Chat de Telegram no encontrado." });
    res.json({ ok: true, chat });
  } catch (error) {
    next(error);
  }
};

export const listUsersHandler = async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const createUserHandler = async (req, res, next) => {
  try {
    const result = await createUser(req.body ?? {}, req.authUser);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteUserHandler = async (req, res, next) => {
  try {
    const user = await deleteUser(req.params.id, req.authUser);
    res.json({
      ok: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

export const resetUserPasswordHandler = async (req, res, next) => {
  try {
    const result = await resetUserPassword(req.params.id, req.authUser);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateUserRoleHandler = async (req, res, next) => {
  try {
    const user = await updateUserRole(req.params.id, req.body?.role, req.authUser);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const listAuditLogsHandler = async (req, res, next) => {
  try {
    const logs = await listAuditLogs({
      limit: req.query.limit ?? 100,
      action: req.query.action ?? "",
      entityType: req.query.entity_type ?? "",
      actor: req.query.actor ?? "",
      search: req.query.search ?? "",
      dateFrom: req.query.date_from ?? "",
      dateTo: req.query.date_to ?? ""
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const exportAuditLogsHandler = async (req, res, next) => {
  try {
    const csv = await exportAuditLogsCsv({
      limit: req.query.limit ?? 500,
      action: req.query.action ?? "",
      entityType: req.query.entity_type ?? "",
      actor: req.query.actor ?? "",
      search: req.query.search ?? "",
      dateFrom: req.query.date_from ?? "",
      dateTo: req.query.date_to ?? ""
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="bitacora-auditoria.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
