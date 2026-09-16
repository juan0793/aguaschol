import { Router } from "express";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { categories, create, detail, duplicate, link, list, move, remove, restore, update } from "../controllers/notesController.js";

const router = Router();
const limitCreate = createRateLimit({ windowMs: 60_000, max: 60 });
const limitSearch = createRateLimit({ windowMs: 60_000, max: 180 });
const limitSearchOnly = (req, res, next) => (req.query.q ? limitSearch(req, res, next) : next());

// Modulo privado del administrador: el rol se valida aqui y el propietario en el servicio.
router.use(requireAdmin);

router.get("/", limitSearchOnly, list);
router.get("/categories", categories);
router.post("/", limitCreate, create);
router.get("/:id", detail);
router.patch("/:id", update);
router.patch("/:id/move", move);
router.post("/:id/duplicate", limitCreate, duplicate);
router.delete("/:id", remove);
router.post("/:id/restore", restore);
router.post("/:id/links", link);

export default router;
