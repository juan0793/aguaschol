import { Router } from "express";
import {
  createMapPointHandler,
  deleteMapPointHandler,
  exportMapPointsHandler,
  listMapPointDiaryGroupsHandler,
  listMapPointsHandler,
  mapPointContextsHandler,
  updateMapPointHandler
} from "../controllers/mapPointController.js";
import { requireAdmin, requireRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", listMapPointsHandler);
router.get("/diary-groups", listMapPointDiaryGroupsHandler);
router.get("/export", exportMapPointsHandler);
router.post("/context", requireRoles("admin", "gerente"), mapPointContextsHandler);
router.post("/", createMapPointHandler);
router.put("/:id", updateMapPointHandler);
router.delete("/:id", requireAdmin, deleteMapPointHandler);

export default router;
