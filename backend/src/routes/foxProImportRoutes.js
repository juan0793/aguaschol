import express, { Router } from "express";
import {
  applyBatchHandler, discardRecordsHandler, finalizeBatchHandler, listBatchRecordsHandler,
  listBatchesHandler, receiveBlockHandler, startBatchHandler
} from "../controllers/foxProImportController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { requireFoxProSyncKey } from "../middleware/foxProSyncAuth.js";

const router = Router();
router.use(express.json({ limit: "2mb" }));

router.post("/lotes/iniciar", requireFoxProSyncKey, startBatchHandler);
router.post("/lotes/:codigoLote/bloques", requireFoxProSyncKey, receiveBlockHandler);
router.post("/lotes/:codigoLote/finalizar", requireFoxProSyncKey, finalizeBatchHandler);

router.get("/lotes", requireAuth, requireAdmin, listBatchesHandler);
router.get("/lotes/:codigoLote/registros", requireAuth, requireAdmin, listBatchRecordsHandler);
router.post("/lotes/:codigoLote/aplicar", requireAuth, requireAdmin, applyBatchHandler);
router.post("/lotes/:codigoLote/descartar", requireAuth, requireAdmin, discardRecordsHandler);

export default router;
