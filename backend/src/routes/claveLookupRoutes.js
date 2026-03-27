import { Router } from "express";
import { downloadPadron, getPadronMeta, searchClave, uploadPadron } from "../controllers/claveLookupController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { padronUpload } from "../middleware/padronUpload.js";

const router = Router();

router.get("/meta", requireAdmin, getPadronMeta);
router.get("/download", requireAdmin, downloadPadron);
router.get("/search", searchClave);
router.get("/search/:clave", searchClave);
router.post("/upload", requireAdmin, padronUpload.single("padron"), uploadPadron);

export default router;
