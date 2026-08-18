import { Router } from "express";
import { requireRoles } from "../middleware/authMiddleware.js";
import {
  config,
  intentoCreate,
  loteCerrar,
  loteCreate,
  loteDetail,
  loteNoEntregadasCreate,
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
  reportesList,
  resumen
} from "../controllers/entregasController.js";

const router = Router();

router.get("/config", config);
router.get("/resumen", resumen);

router.get("/personal", personalList);
router.post("/personal", requireRoles("admin"), personalCreate);
router.patch("/personal/:id", requireRoles("admin"), personalUpdate);

router.get("/lotes", lotesList);
router.post("/lotes", requireRoles("admin", "operator"), loteCreate);
router.get("/lotes/:id", loteDetail);
router.patch("/lotes/:id", requireRoles("admin", "operator"), loteUpdate);
router.post("/lotes/:id/cerrar", loteCerrar);
router.post("/lotes/:id/no-entregadas", loteNoEntregadasCreate);

router.get("/no-entregadas", noEntregadasList);
router.get("/no-entregadas/:id", noEntregadaDetail);
router.patch("/no-entregadas/:id", noEntregadaUpdate);
router.delete("/no-entregadas/:id", noEntregadaRemove);
router.post("/no-entregadas/:id/intentos", intentoCreate);

router.get("/reportes/semanales", requireRoles("admin", "operator"), reportesList);
router.get("/reportes/semanales/preview", requireRoles("admin", "operator"), reportePreview);
router.post("/reportes/semanales", requireRoles("admin", "operator"), reporteCreate);
router.get("/reportes/semanales/:id", requireRoles("admin", "operator"), reporteDetail);
router.post("/reportes/semanales/:id/correccion", requireRoles("admin"), reporteCorreccion);
router.post("/reportes/semanales/:id/anular", requireRoles("admin"), reporteAnular);

export default router;
