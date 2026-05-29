import { Router } from "express";
import {
  createUserHandler,
  deleteUserHandler,
  exportAuditLogsHandler,
  listAuditLogsHandler,
  listUsersHandler,
  resetUserPasswordHandler,
  updateUserRoleHandler
} from "../controllers/userController.js";

const router = Router();

router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.patch("/:id/role", updateUserRoleHandler);
router.post("/:id/reset-password", resetUserPasswordHandler);
router.delete("/:id", deleteUserHandler);
router.get("/audit-logs", listAuditLogsHandler);
router.get("/audit-logs/export", exportAuditLogsHandler);

export default router;
