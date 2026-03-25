import { Router } from "express";
import {
  archive,
  create,
  deleteArchived,
  getAviso,
  getByClaveHandler,
  getHistory,
  list,
  previewAviso,
  restore,
  update,
  uploadPhoto
} from "../controllers/inmuebleController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", list);
router.get("/clave/:clave", getByClaveHandler);
router.get("/:id/history", getHistory);
router.get("/:id/aviso", getAviso);
router.post("/aviso-preview", previewAviso);
router.post("/", create);
router.put("/:id", update);
router.post("/:id/archive", archive);
router.post("/:id/restore", requireAdmin, restore);
router.delete("/:id", requireAdmin, deleteArchived);
router.post("/:id/foto", upload.single("foto"), uploadPhoto);

export default router;
