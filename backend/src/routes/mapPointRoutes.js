import { Router } from "express";
import {
  createMapPointHandler,
  deleteMapPointHandler,
  exportMapPointsHandler,
  listMapPointsHandler,
  mapPointContextsHandler,
  updateMapPointHandler
} from "../controllers/mapPointController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", listMapPointsHandler);
router.get("/export", exportMapPointsHandler);
router.post("/context", requireAdmin, mapPointContextsHandler);
router.post("/", createMapPointHandler);
router.put("/:id", requireAdmin, updateMapPointHandler);
router.delete("/:id", requireAdmin, deleteMapPointHandler);

export default router;
