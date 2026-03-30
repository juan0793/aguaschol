import { Router } from "express";
import { createMapPointHandler, deleteMapPointHandler, listMapPointsHandler } from "../controllers/mapPointController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", listMapPointsHandler);
router.post("/", createMapPointHandler);
router.delete("/:id", requireAdmin, deleteMapPointHandler);

export default router;
