import { Router } from "express";
import { requireRoles } from "../middleware/authMiddleware.js";
import {
  cicloCerrar,
  config,
  descartes,
  intentoCreate,
  avisoDocumentoCreate,
  loteCerrar,
  loteCreate,
  loteDetail,
  loteNoEntregadasCreate,
  loteReabrir,
  loteRemove,
  loteUpdate,
  lotesList,
  noEntregadaDetail,
  noEntregadaRemove,
  noEntregadaUpdate,
  noEntregadasList,
  personalCreate,
  personalList,
  personalUpdate,
  reporteAnular,
  reporteCorreccion,
  reporteCreate,
  reporteDetail,
  reportePreview,
  repartoBarrioUpdate,
  repartoList,
  repartoLoteUpdate,
  repartoMapa,
  reportesList,
  resumen,
  avanceMes
} from "../controllers/entregasController.js";

const router = Router();

router.get("/config", config);
router.get("/resumen", resumen);
router.get("/avance-mes", avanceMes);
router.post("/ciclos/cerrar", requireRoles("admin"), cicloCerrar);
router.get("/descartes", requireRoles("admin", "gerente"), descartes);

router.get("/personal", personalList);
router.post("/personal", requireRoles("admin"), personalCreate);
router.patch("/personal/:id", requireRoles("admin"), personalUpdate);

router.get("/reparto", requireRoles("admin", "operator", "gerente"), repartoList);
router.get("/reparto/mapa", requireRoles("admin", "operator", "gerente"), repartoMapa);
router.put("/reparto/barrios/:codigo", requireRoles("admin", "operator"), repartoBarrioUpdate);
router.post("/reparto/lote", requireRoles("admin", "operator"), repartoLoteUpdate);

router.get("/lotes", lotesList);
router.post("/lotes", requireRoles("admin", "operator"), loteCreate);
router.get("/lotes/:id", loteDetail);
router.patch("/lotes/:id", loteUpdate);
router.post("/lotes/:id/cerrar", loteCerrar);
router.post("/lotes/:id/reabrir", requireRoles("admin"), loteReabrir);
router.delete("/lotes/:id", requireRoles("admin"), loteRemove);
router.post("/lotes/:id/no-entregadas", loteNoEntregadasCreate);

router.get("/no-entregadas", noEntregadasList);
router.get("/no-entregadas/:id", noEntregadaDetail);
router.patch("/no-entregadas/:id", noEntregadaUpdate);
router.delete("/no-entregadas/:id", noEntregadaRemove);
router.post("/no-entregadas/:id/intentos", intentoCreate);
router.post("/no-entregadas/:id/avisos", requireRoles("admin", "gerente"), avisoDocumentoCreate);

router.get("/reportes/semanales", requireRoles("admin", "operator", "gerente"), reportesList);
router.get("/reportes/semanales/preview", requireRoles("admin", "operator", "gerente"), reportePreview);
router.post("/reportes/semanales", requireRoles("admin", "operator"), reporteCreate);
router.get("/reportes/semanales/:id", requireRoles("admin", "operator", "gerente"), reporteDetail);
router.post("/reportes/semanales/:id/correccion", requireRoles("admin"), reporteCorreccion);
router.post("/reportes/semanales/:id/anular", requireRoles("admin"), reporteAnular);

export default router;
