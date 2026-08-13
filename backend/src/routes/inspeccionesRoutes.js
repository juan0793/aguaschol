import { Router } from "express";
import { requireRoles } from "../middleware/authMiddleware.js";
import {
  addTecnico,
  config,
  create,
  createGps,
  detail,
  estado,
  finalizar,
  gps,
  historial,
  list,
  printData,
  printEvent,
  printHistory,
  reasignar,
  remove,
  removeTecnico,
  resumen,
  stats,
  tecnicos,
  tecnicosDeInspeccion,
  update
} from "../controllers/inspeccionesController.js";

const router = Router();

router.get("/config", config);
router.get("/tecnicos", tecnicos);
router.get("/resumen", resumen);
router.get("/stats", requireRoles("admin"), stats);
router.get("/", list);
router.post("/", requireRoles("admin"), create);
router.get("/:id", detail);
router.patch("/:id", update);
router.delete("/:id", requireRoles("admin"), remove);
router.patch("/:id/estado", estado);
router.patch("/:id/finalizar", finalizar);
router.patch("/:id/reasignar", requireRoles("admin"), reasignar);
router.get("/:id/tecnicos", tecnicosDeInspeccion);
router.post("/:id/tecnicos", addTecnico);
router.delete("/:id/tecnicos/:tecnicoId", removeTecnico);
router.get("/:id/gps", gps);
router.post("/:id/gps", createGps);
router.get("/:id/historial", historial);
router.get("/:id/print-data", printData);
router.post("/:id/print-events", printEvent);
router.get("/:id/print-history", printHistory);

export default router;
