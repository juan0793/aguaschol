import { Router } from "express";
import { assistRecord, getAiStatus } from "../controllers/aiController.js";

const router = Router();

router.get("/status", getAiStatus);
router.post("/record-assist", assistRecord);

export default router;
