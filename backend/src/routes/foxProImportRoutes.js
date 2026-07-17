import express, { Router } from "express";
import {
  activateBatchHandler, applyBatchHandler, checkR2ConnectionHandler, claimUpdateRequestHandler, discardRecordsHandler,
  finalizeBatchHandler, finishUpdateRequestHandler, getR2PadronStatusHandler, getUpdateRequestHandler,
  listBatchRecordsHandler, listBatchesHandler, migratePadronToR2Handler, receiveBlockHandler,
  requestUpdateHandler, restoreHistoricalPadronHandler, startBatchHandler, verifyBatchHandler
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
router.get("/lotes/:codigoLote/verificar", requireAuth, requireAdmin, verifyBatchHandler);
router.post("/lotes/:codigoLote/activar", requireAuth, requireAdmin, activateBatchHandler);
router.post("/lotes/:codigoLote/aplicar", requireAuth, requireAdmin, applyBatchHandler);
router.post("/lotes/:codigoLote/descartar", requireAuth, requireAdmin, discardRecordsHandler);
router.get("/r2/conexion", requireAuth, requireAdmin, checkR2ConnectionHandler);
router.get("/r2/padron", requireAuth, requireAdmin, getR2PadronStatusHandler);
router.post("/r2/migrar", requireAuth, requireAdmin, migratePadronToR2Handler);
router.post("/r2/restaurar", requireAuth, requireAdmin, restoreHistoricalPadronHandler);

export default router;
