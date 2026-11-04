import { Router } from "express";
import { requireRoles } from "../middleware/authMiddleware.js";
import { listarPozos } from "../services/pozosService.js";
import { agregarSituacionLegal, guardarSituacionLegal, presentarSituacionLegal } from "../services/pozosLegalService.js";

// Pozos de Choluteca: consulta para administración y Gerencia.
const router = Router();
router.use(requireRoles("admin", "gerente"), (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
router.get("/", async (_req, res, next) => {
  try { res.json(await agregarSituacionLegal(await listarPozos())); } catch (error) { next(error); }
});

router.put("/:id/legal", requireRoles("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const inventario = await listarPozos();
    const pozo = inventario.pozos.find((item) => Number(item.id) === id);
    if (!pozo) return res.status(404).json({ message: "Pozo no encontrado." });
    const legal = await guardarSituacionLegal(id, req.body, req.authUser);
    return res.json({ ...pozo, legal: presentarSituacionLegal(legal, pozo) });
  } catch (error) {
    return next(error);
  }
});

export default router;
