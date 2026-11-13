import { Router } from "express";
import {
  awardProfileAchievementHandler,
  deleteGeneralProfileMessageHandler,
  getProfileHandler,
  markGeneralProfileMessagesReadHandler,
  markProfileMessageReadHandler,
  sendGeneralProfileMessageHandler,
  sendProfileMessageHandler,
  updateGeneralProfileMessagePinHandler
} from "../controllers/profileController.js";
import { imageUpload } from "../middleware/upload.js";
import { borrarSuscripcion, estadoPush, guardarSuscripcion } from "../services/pushService.js";
import { registrarUbicacion } from "../services/teamLocationService.js";

const router = Router();

router.get("/", getProfileHandler);
router.post("/messages", sendProfileMessageHandler);
router.post("/messages/general", imageUpload.single("image"), sendGeneralProfileMessageHandler);
router.patch("/messages/general/:id/pin", updateGeneralProfileMessagePinHandler);
router.delete("/messages/general/:id", deleteGeneralProfileMessageHandler);
router.patch("/messages/general/read", markGeneralProfileMessagesReadHandler);
router.patch("/messages/:id/read", markProfileMessageReadHandler);
router.post("/achievements", awardProfileAchievementHandler);
// GPS del teléfono del técnico para el mapa del equipo (el servicio valida el rol).
router.post("/ubicacion", async (req, res, next) => {
  try { res.json(await registrarUbicacion(req.body, req.authUser)); } catch (error) { next(error); }
});

// Avisos con la app cerrada (Web Push): clave pública, alta y baja de este dispositivo.
router.get("/push", (req, res) => res.json(estadoPush(req.authUser)));
router.post("/push/subscription", async (req, res, next) => {
  try { res.status(201).json(await guardarSuscripcion(req.authUser, req.body, req.get("user-agent"))); } catch (error) { next(error); }
});
router.delete("/push/subscription", async (req, res, next) => {
  try { res.json(await borrarSuscripcion(req.authUser, req.body)); } catch (error) { next(error); }
});

export default router;
