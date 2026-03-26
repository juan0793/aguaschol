import multer from "multer";
import { env } from "../config/env.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(env.uploadMaxFileSizeMb, 1) * 1024 * 1024
  }
});
