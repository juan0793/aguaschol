import { Router } from "express";
import {
  createUserHandler,
  createReportAuditLogHandler,
  createTelegramChatHandler,
  deleteTelegramChatHandler,
  deleteUserHandler,
  exportAuditLogsHandler,
  getReportArchiveHandler,
  listAuditLogsHandler,
  listUsersHandler,
  listTelegramChatsHandler,
  resetUserPasswordHandler,
  updateTelegramChatHandler,
  updateUserRoleHandler
} from "../controllers/userController.js";

const router = Router();

router.get("/telegram-chats", listTelegramChatsHandler);
router.post("/telegram-chats", createTelegramChatHandler);
router.patch("/telegram-chats/:id", updateTelegramChatHandler);
router.delete("/telegram-chats/:id", deleteTelegramChatHandler);
router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.patch("/:id/role", updateUserRoleHandler);
router.post("/:id/reset-password", resetUserPasswordHandler);
router.delete("/:id", deleteUserHandler);
router.get("/audit-logs", listAuditLogsHandler);
router.post("/audit-logs", createReportAuditLogHandler);
router.get("/audit-logs/reports/:reportId", getReportArchiveHandler);
router.get("/audit-logs/export", exportAuditLogsHandler);

export default router;
