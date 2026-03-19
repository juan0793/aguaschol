import { Router } from "express";
import {
  create,
  getAviso,
  getByClaveHandler,
  list,
  previewAviso,
  update,
  uploadPhoto
} from "../controllers/inmuebleController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", list);
router.get("/clave/:clave", getByClaveHandler);
router.get("/:id/aviso", getAviso);
router.post("/aviso-preview", previewAviso);
router.post("/", create);
router.put("/:id", update);
router.post("/:id/foto", upload.single("foto"), uploadPhoto);

export default router;
