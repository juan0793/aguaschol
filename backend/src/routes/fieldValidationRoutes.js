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

router.get("/", requireRoles("admin", "validadora_campo", "gerente"), listFieldValidationPointsHandler);
router.post("/analytics", requireRoles("admin", "validadora_campo", "gerente"), fieldAnalyticsHandler);
// Hallazgos del levantamiento (Reportes de levantamiento, solo administración).
router.get("/findings", requireRoles("admin", "gerente"), fieldFindingsHandler);
router.post("/findings/banco", requireRoles("admin"), fieldFindingsToBancoHandler);
router.put("/:id", allowFieldValidation, validateFieldPointHandler);

export default router;
