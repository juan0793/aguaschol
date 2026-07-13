import { Router } from "express";
import {
  createUserHandler,
  createTelegramChatHandler,
  deleteTelegramChatHandler,
  deleteUserHandler,
  exportAuditLogsHandler,
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
router.get("/audit-logs/export", exportAuditLogsHandler);

export default router;
