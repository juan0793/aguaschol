import { Router } from "express";
import {
  createUserHandler,
  deleteUserHandler,
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

export default router;
