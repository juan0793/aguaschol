import { Router } from "express";
import {
  createMapPointHandler,
  deleteMapPointHandler,
  exportMapPointsHandler,
  listMapPointsHandler,
  mapPointContextsHandler
} from "../controllers/mapPointController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", listMapPointsHandler);
router.get("/export", exportMapPointsHandler);
router.post("/context", requireAdmin, mapPointContextsHandler);
router.post("/", createMapPointHandler);
router.delete("/:id", requireAdmin, deleteMapPointHandler);

export default router;
