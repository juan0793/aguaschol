import { Router } from "express";
import {
  compareAlcaldia,
  downloadPadron,
  getAlcaldiaMeta,
  getPadronMeta,
  getPadronRequestMeta,
  reprocessPadron,
  runPadronRequest,
  searchAlcaldia,
  searchClave,
  uploadAlcaldia,
  uploadPadron
} from "../controllers/claveLookupController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { padronUpload } from "../middleware/padronUpload.js";

const router = Router();

router.get("/meta", requireAdmin, getPadronMeta);
router.get("/alcaldia/meta", requireAdmin, getAlcaldiaMeta);
router.get("/alcaldia/compare", requireAdmin, compareAlcaldia);
router.get("/alcaldia/search", searchAlcaldia);
router.get("/alcaldia/search/:clave", searchAlcaldia);
router.post("/alcaldia/upload", requireAdmin, padronUpload.single("padron"), uploadAlcaldia);
router.get("/requests/meta", requireAdmin, getPadronRequestMeta);
router.post("/requests/run", requireAdmin, runPadronRequest);
router.get("/download", requireAuth, downloadPadron);
router.post("/reprocess", requireAdmin, reprocessPadron);
router.get("/search", searchClave);
router.get("/search/:clave", searchClave);
router.post("/upload", requireAdmin, padronUpload.single("padron"), uploadPadron);

export default router;
