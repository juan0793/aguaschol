import express, { Router } from "express";
import {
  applyBatchHandler, claimUpdateRequestHandler, discardRecordsHandler, finalizeBatchHandler,
  finishUpdateRequestHandler, getUpdateRequestHandler, listBatchRecordsHandler,
  listBatchesHandler, receiveBlockHandler, requestUpdateHandler, startBatchHandler
} from "../controllers/foxProImportController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { requireFoxProSyncKey } from "../middleware/foxProSyncAuth.js";

const router = Router();
router.use(express.json({ limit: "2mb" }));

router.get("/conexion", requireFoxProSyncKey, (_req, res) => res.json({ ok: true }));
router.post("/solicitudes/tomar", requireFoxProSyncKey, claimUpdateRequestHandler);
router.post("/solicitudes/:id/finalizar", requireFoxProSyncKey, finishUpdateRequestHandler);
router.post("/lotes/iniciar", requireFoxProSyncKey, startBatchHandler);
router.post("/lotes/:codigoLote/bloques", requireFoxProSyncKey, receiveBlockHandler);
router.post("/lotes/:codigoLote/finalizar", requireFoxProSyncKey, finalizeBatchHandler);

router.get("/lotes", requireAuth, requireAdmin, listBatchesHandler);
router.post("/solicitudes", requireAuth, requireAdmin, requestUpdateHandler);
router.get("/solicitudes/:id", requireAuth, requireAdmin, getUpdateRequestHandler);
router.get("/lotes/:codigoLote/registros", requireAuth, requireAdmin, listBatchRecordsHandler);
router.post("/lotes/:codigoLote/aplicar", requireAuth, requireAdmin, applyBatchHandler);
router.post("/lotes/:codigoLote/descartar", requireAuth, requireAdmin, discardRecordsHandler);

export default router;
