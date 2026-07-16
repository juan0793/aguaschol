import { Router } from "express";
import {
  archive,
  create,
  deleteArchived,
  getAviso,
  getByClaveHandler,
  getHistory,
  list,
  markPrinted,
  previewAviso,
  restore,
  update,
  uploadPhoto
} from "../controllers/inmuebleController.js";
import { requireAdmin, requireRoles } from "../middleware/authMiddleware.js";
import { imageUpload } from "../middleware/upload.js";

const router = Router();

router.get("/", list);
router.get("/clave/:clave", getByClaveHandler);
router.get("/:id/history", getHistory);
router.get("/:id/aviso", getAviso);
router.post("/aviso-preview", previewAviso);
router.post("/", requireRoles("admin", "operator"), create);
router.put("/:id", requireRoles("admin", "operator"), update);
router.post("/:id/mark-printed", requireRoles("admin", "operator"), markPrinted);
router.post("/:id/archive", requireRoles("admin", "operator"), archive);
router.post("/:id/restore", requireAdmin, restore);
router.delete("/:id", requireAdmin, deleteArchived);
router.post("/:id/foto", requireRoles("admin", "operator"), imageUpload.single("foto"), uploadPhoto);

export default router;
