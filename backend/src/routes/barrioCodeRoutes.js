import { Router } from "express";
import {
  deleteBarrioCodeHandler,
  listBarrioCodesHandler,
  lookupBarrioByClaveHandler,
  saveBarrioCodeHandler
} from "../controllers/barrioCodeController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", listBarrioCodesHandler);
router.get("/lookup", lookupBarrioByClaveHandler);
router.get("/lookup/:clave", lookupBarrioByClaveHandler);
router.post("/", requireAdmin, saveBarrioCodeHandler);
router.put("/:codigo", requireAdmin, saveBarrioCodeHandler);
router.delete("/:codigo", requireAdmin, deleteBarrioCodeHandler);

export default router;
