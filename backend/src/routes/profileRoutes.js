import { Router } from "express";
import {
  awardProfileAchievementHandler,
  deleteGeneralProfileMessageHandler,
  getProfileHandler,
  markProfileMessageReadHandler,
  sendGeneralProfileMessageHandler,
  sendProfileMessageHandler,
  updateGeneralProfileMessagePinHandler
} from "../controllers/profileController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", getProfileHandler);
router.post("/messages", sendProfileMessageHandler);
router.post("/messages/general", upload.single("image"), sendGeneralProfileMessageHandler);
router.patch("/messages/general/:id/pin", updateGeneralProfileMessagePinHandler);
router.delete("/messages/general/:id", deleteGeneralProfileMessageHandler);
router.patch("/messages/:id/read", markProfileMessageReadHandler);
router.post("/achievements", awardProfileAchievementHandler);

export default router;
