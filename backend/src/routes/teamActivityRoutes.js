import { Router } from "express";
import { listTeamActivity, markTeamActivitySeen } from "../services/teamActivityService.js";
import { mapaDelEquipo } from "../services/teamLocationService.js";

// Actividad del equipo (solo administración; el montaje en app.js exige admin).
const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { actor, categoria, desde, hasta, tz, pagina, antes, limit, resumen, hitos } = req.query;
    res.json(await listTeamActivity({ actor, categoria, desde, hasta, tz, pagina, antes, limit, resumen, hitos }, req.authUser));
  } catch (error) { next(error); }
});

// Mapa del equipo: ubicación de los técnicos y candidatos del banco asignados o revisados.
router.get("/mapa", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await mapaDelEquipo({ fecha: req.query.fecha, tz: req.query.tz }, req.authUser));
  } catch (error) { next(error); }
});

router.post("/seen", async (req, res, next) => {
  try { res.json(await markTeamActivitySeen(req.authUser)); } catch (error) { next(error); }
});

export default router;
