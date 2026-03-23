import { Router } from "express";
import {
  createUserHandler,
  listAuditLogsHandler,
  listUsersHandler
} from "../controllers/userController.js";

const router = Router();

router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.get("/audit-logs", listAuditLogsHandler);

export default router;
