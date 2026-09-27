import { Router } from "express";
import { getRailwayUsage } from "../services/railwayUsageService.js";

const router = Router();

router.get("/usage", async (_req, res) => {
  try {
    res.json(await getRailwayUsage());
  } catch (error) {
    res.status(error.status || 502).json({ message: error.message || "No se pudo consultar Railway." });
  }
});

export default router;
