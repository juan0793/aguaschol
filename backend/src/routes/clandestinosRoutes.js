import { Router } from "express";
import { compareFichas, config, createReport, evidence, fichaInternalNotes, fichaState, fichas, history, linkReport, reports, reportState } from "../controllers/clandestinosController.js";
import { imageUpload } from "../middleware/upload.js";

const router = Router();
router.get("/config", config);
router.get("/fichas", fichas);
router.post("/fichas/compare-padrones", compareFichas);
router.patch("/fichas/:id/state", fichaState);
router.patch("/fichas/:id/internal-notes", fichaInternalNotes);
router.get("/history/:entityType/:id", history);
router.get("/reportes", reports);
router.post("/reportes", createReport);
router.patch("/reportes/:id/state", reportState);
router.post("/reportes/:id/link", linkReport);
router.post("/reportes/:id/evidencias", imageUpload.single("evidence"), evidence);
export default router;
