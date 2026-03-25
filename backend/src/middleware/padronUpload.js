import multer from "multer";

const allowedMimeTypes = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream"
]);

export const padronUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const lowerName = String(file.originalname ?? "").toLowerCase();
    const validExtension = lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx");
    const validMimeType = allowedMimeTypes.has(file.mimetype);

    if (validExtension || validMimeType) {
      cb(null, true);
      return;
    }

    cb(new Error("Solo se permiten archivos Excel .xls o .xlsx."));
  },
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

