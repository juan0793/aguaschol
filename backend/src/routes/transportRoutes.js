import { Router } from "express";
import {
  addTransportRoutePositionHandler,
  completeTransportRouteHandler,
  createTransportRouteHandler,
  listTransportRoutesHandler,
  startTransportRouteHandler,
  updateTransportRouteHandler
} from "../controllers/transportController.js";
import { requireAdmin, requireRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", requireRoles("admin", "transport"), listTransportRoutesHandler);
router.post("/", requireAdmin, createTransportRouteHandler);
router.put("/:id", requireAdmin, updateTransportRouteHandler);
router.post("/:id/start", requireRoles("admin", "transport"), startTransportRouteHandler);
router.post("/:id/complete", requireRoles("admin", "transport"), completeTransportRouteHandler);
router.post("/:id/positions", requireRoles("admin", "transport"), addTransportRoutePositionHandler);

export default router;
