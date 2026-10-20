import { Router } from "express";
import { requireRoles } from "../middleware/authMiddleware.js";
import { listarPozos } from "../services/pozosService.js";

// Pozos de Choluteca: consulta para administración y Gerencia.
const router = Router();
router.use(requireRoles("admin", "gerente"), (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
router.get("/", async (_req, res, next) => {
  try { res.json(await listarPozos()); } catch (error) { next(error); }
});

export default router;
