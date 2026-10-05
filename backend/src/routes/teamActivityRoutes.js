import { Router } from "express";
import { listTeamActivity, markTeamActivitySeen } from "../services/teamActivityService.js";

// Actividad del equipo (solo administración; el montaje en app.js exige admin).
const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { actor, categoria, desde, hasta, tz, pagina, antes, limit, resumen } = req.query;
    res.json(await listTeamActivity({ actor, categoria, desde, hasta, tz, pagina, antes, limit, resumen }, req.authUser));
  } catch (error) { next(error); }
});

router.post("/seen", async (req, res, next) => {
  try { res.json(await markTeamActivitySeen(req.authUser)); } catch (error) { next(error); }
});

export default router;
