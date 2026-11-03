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

export default router;
