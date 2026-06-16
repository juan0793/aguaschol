import { Router } from "express";
import {
  assignPlanoBarrioHandler,
  createPlanoElementHandler,
  createPlanoBarrioHandler,
  deletePlanoElementHandler,
  listMyPlanoAssignmentsHandler,
  listPendingPlanoReviewsHandler,
  listPlanoElementsHandler,
  listPlanosBarriosHandler,
  listPlanoVersionsHandler,
  reviewPlanoVersionHandler,
  savePlanoDraftHandler,
  sendPlanoToReviewHandler,
  updatePlanoElementHandler,
  updatePlanoBarrioHandler
} from "../controllers/planosController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/barrios", listPlanosBarriosHandler);
router.post("/barrios", upload.single("pdf"), createPlanoBarrioHandler);
router.put("/barrios/:id", upload.single("pdf"), updatePlanoBarrioHandler);
router.post("/asignaciones", assignPlanoBarrioHandler);
router.get("/asignaciones/mias", listMyPlanoAssignmentsHandler);
router.get("/revision/pendientes", listPendingPlanoReviewsHandler);
router.get("/versiones", listPlanoVersionsHandler);
router.post("/versiones/:versionId/aprobar", reviewPlanoVersionHandler("aprobar"));
router.post("/versiones/:versionId/devolver", reviewPlanoVersionHandler("devolver"));
router.post("/versiones/:versionId/publicar", reviewPlanoVersionHandler("publicar"));
router.put("/elementos/:id", updatePlanoElementHandler);
router.delete("/elementos/:id", deletePlanoElementHandler);
router.get("/:barrioId/elementos", listPlanoElementsHandler);
router.post("/:barrioId/elementos", createPlanoElementHandler);
router.post("/:barrioId/guardar-borrador", savePlanoDraftHandler);
router.post("/:barrioId/enviar-revision", sendPlanoToReviewHandler);

export default router;
