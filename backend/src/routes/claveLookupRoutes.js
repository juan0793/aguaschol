import { Router } from "express";
import { searchClave } from "../controllers/claveLookupController.js";

const router = Router();

router.get("/search", searchClave);
router.get("/search/:clave", searchClave);

export default router;

