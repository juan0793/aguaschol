import { Router } from "express";
import {
  buscarEntrega,
  cerrarReclamo,
  crearReclamo,
  eliminarReclamo,
  listReclamos,
  reabrirReclamo,
  responderReclamo,
  sobrantesReclamos,
  ubicacionesReclamos
} from "../services/entregasReclamosService.js";

// Reclamos de entrega: la oficina los registra, cierra o elimina; el equipo de campo
// los ve todos y responde qué pasó. Cada servicio valida el perfil.
const router = Router();
const handle = (fn, status = 200) => async (req, res, next) => {
  try { res.status(status).json(await fn(req)); } catch (error) { next(error); }
};

router.get("/", handle((req) => listReclamos(req.query, req.authUser)));
router.get("/buscar", handle((req) => buscarEntrega(req.query, req.authUser)));
router.get("/ubicaciones", handle((req) => ubicacionesReclamos(req.query, req.authUser)));
router.get("/sobrantes", handle((req) => sobrantesReclamos(req.query, req.authUser)));
router.post("/", handle((req) => crearReclamo(req.body, req.authUser), 201));
router.post("/:id/respuesta", handle((req) => responderReclamo(req.params.id, req.body, req.authUser)));
router.post("/:id/cerrar", handle((req) => cerrarReclamo(req.params.id, req.authUser)));
router.post("/:id/reabrir", handle((req) => reabrirReclamo(req.params.id, req.authUser)));
router.delete("/:id", handle((req) => eliminarReclamo(req.params.id, req.authUser)));

export default router;
