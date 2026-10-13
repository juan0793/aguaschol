import { Router } from "express";
import { createRateLimit } from "../middleware/rateLimit.js";
import { listarFallas, marcarFallasRevisadas, registrarFallasDispositivo } from "../services/fallasService.js";

// Fallas del equipo: cualquier cuenta envía las que su teléfono guardó sin señal;
// administración y Gerencia las consultan; solo administración las marca revisadas.
const router = Router();
const envioLimit = createRateLimit({ windowMs: 60000, max: 30 });

router.post("/", envioLimit, async (req, res, next) => {
  try { res.status(201).json(await registrarFallasDispositivo(req.body, req.authUser)); } catch (error) { next(error); }
});
router.get("/", async (req, res, next) => {
  try { res.json(await listarFallas(req.query, req.authUser)); } catch (error) { next(error); }
});
router.post("/revisadas", async (req, res, next) => {
  try { res.json(await marcarFallasRevisadas(req.body, req.authUser)); } catch (error) { next(error); }
});

export default router;
