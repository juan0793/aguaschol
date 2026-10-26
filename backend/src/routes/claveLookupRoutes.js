import { Router } from "express";
import {
  compareAlcaldia,
  downloadPadron,
  getAlcaldiaMeta,
  getPadronBarrioAccounts,
  getPadronMeta,
  getPadronRequestMeta,
  getPadronServiceAccounts,
  getPadronServiceReport,
  reprocessPadron,
  runPadronRequest,
  searchAlcaldia,
  searchClave,
  syncPadron,
  uploadAlcaldia,
  uploadPadron
} from "../controllers/claveLookupController.js";
import { requireAdmin, requireAuth, requireRoles } from "../middleware/authMiddleware.js";
import { padronUpload } from "../middleware/padronUpload.js";

const router = Router();

router.get("/meta", requireRoles("admin", "gerente"), getPadronMeta);
router.get("/alcaldia/meta", requireRoles("admin", "gerente"), getAlcaldiaMeta);
router.get("/alcaldia/compare", requireRoles("admin", "gerente"), compareAlcaldia);
router.get("/alcaldia/search", searchAlcaldia);
router.get("/alcaldia/search/:clave", searchAlcaldia);
router.post("/alcaldia/upload", requireAdmin, padronUpload.single("padron"), uploadAlcaldia);
router.get("/requests/meta", requireRoles("admin", "gerente"), getPadronRequestMeta);
router.post("/requests/run", requireRoles("admin", "gerente"), runPadronRequest);
router.get("/services/report", requireRoles("admin", "gerente"), getPadronServiceReport);
router.get("/services/accounts", requireRoles("admin", "gerente"), getPadronServiceAccounts);
router.get("/services/barrio-accounts", requireRoles("admin", "gerente"), getPadronBarrioAccounts);
router.get("/download", requireAuth, downloadPadron);
router.post("/reprocess", requireAdmin, reprocessPadron);
router.post("/sync", requireAdmin, syncPadron);
router.get("/search", searchClave);
router.get("/search/:clave", searchClave);
router.post("/upload", requireAdmin, padronUpload.single("padron"), uploadPadron);

export default router;
