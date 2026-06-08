import { Router } from "express";
import {
  awardProfileAchievementHandler,
  getProfileHandler,
  markProfileMessageReadHandler,
  sendProfileMessageHandler
} from "../controllers/profileController.js";

const router = Router();

router.get("/", getProfileHandler);
router.post("/messages", sendProfileMessageHandler);
router.patch("/messages/:id/read", markProfileMessageReadHandler);
router.post("/achievements", awardProfileAchievementHandler);

export default router;
