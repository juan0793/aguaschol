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
  updateUserNameHandler,
  updateUserRoleHandler,
  listUserAccesosHandler,
  saveUserAccesoHandler,
  deleteUserAccesoHandler
} from "../controllers/userController.js";

const router = Router();

router.get("/telegram-chats", listTelegramChatsHandler);
router.post("/telegram-chats", createTelegramChatHandler);
router.patch("/telegram-chats/:id", updateTelegramChatHandler);
router.delete("/telegram-chats/:id", deleteTelegramChatHandler);
router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.patch("/:id/role", updateUserRoleHandler);
router.patch("/:id/name", updateUserNameHandler);
router.get("/:id/accesos", listUserAccesosHandler);
router.put("/:id/accesos/:clave", saveUserAccesoHandler);
router.delete("/:id/accesos/:clave", deleteUserAccesoHandler);
router.post("/:id/reset-password", resetUserPasswordHandler);
router.delete("/:id", deleteUserHandler);
router.get("/audit-logs", listAuditLogsHandler);
router.post("/audit-logs", createReportAuditLogHandler);
router.get("/audit-logs/reports/:reportId", getReportArchiveHandler);
router.get("/audit-logs/export", exportAuditLogsHandler);

export default router;
