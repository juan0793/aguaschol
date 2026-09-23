import { Router } from "express";
import {
  fieldAnalyticsHandler,
  fieldFindingsHandler,
  fieldFindingsToBancoHandler,
  listFieldValidationPointsHandler,
  validateFieldPointHandler
} from "../controllers/fieldValidationController.js";
import { requireRoles } from "../middleware/authMiddleware.js";

const router = Router();
const allowFieldValidation = requireRoles("admin", "validadora_campo");

router.get("/", allowFieldValidation, listFieldValidationPointsHandler);
router.post("/analytics", allowFieldValidation, fieldAnalyticsHandler);
// Hallazgos del levantamiento (Reportes de levantamiento, solo administración).
router.get("/findings", requireRoles("admin"), fieldFindingsHandler);
router.post("/findings/banco", requireRoles("admin"), fieldFindingsToBancoHandler);
router.put("/:id", allowFieldValidation, validateFieldPointHandler);

export default router;
