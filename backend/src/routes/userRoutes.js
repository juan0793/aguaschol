import { Router } from "express";
import {
  createUserHandler,
  deleteUserHandler,
  listAuditLogsHandler,
  listUsersHandler
} from "../controllers/userController.js";

const router = Router();

router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.delete("/:id", deleteUserHandler);
router.get("/audit-logs", listAuditLogsHandler);

export default router;
