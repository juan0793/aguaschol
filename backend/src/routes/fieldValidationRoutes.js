import { Router } from "express";
import {
  listFieldValidationPointsHandler,
  validateFieldPointHandler
} from "../controllers/fieldValidationController.js";
import { requireRoles } from "../middleware/authMiddleware.js";

const router = Router();
const allowFieldValidation = requireRoles("admin", "validadora_campo");

router.get("/", allowFieldValidation, listFieldValidationPointsHandler);
router.put("/:id", allowFieldValidation, validateFieldPointHandler);

export default router;
