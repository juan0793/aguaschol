import { Router } from "express";
import {
  createUserHandler,
  deleteUserHandler,
  exportAuditLogsHandler,
  listAuditLogsHandler,
  listUsersHandler,
  resetUserPasswordHandler
} from "../controllers/userController.js";

const router = Router();

router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.post("/:id/reset-password", resetUserPasswordHandler);
router.delete("/:id", deleteUserHandler);
router.get("/audit-logs", listAuditLogsHandler);
router.get("/audit-logs/export", exportAuditLogsHandler);

export default router;
