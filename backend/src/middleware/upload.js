import multer from "multer";
import { env } from "../config/env.js";
import { hasImageMetadata, hasPdfMetadata } from "../utils/fileValidation.js";

const rejectFile = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const createUpload = (fileFilter) => multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: Math.max(env.uploadMaxFileSizeMb, 1) * 1024 * 1024
  }
});

const filterFile = (isAllowed, message) => (_req, file, callback) => {
  const allowed = isAllowed(file);
  callback(allowed ? null : rejectFile(message), allowed);
};

export const imageUpload = createUpload(
  filterFile(hasImageMetadata, "Solo se permiten imagenes JPEG, PNG, WebP o HEIC.")
);

export const pdfUpload = createUpload(
  filterFile(hasPdfMetadata, "Solo se permiten archivos PDF.")
);
