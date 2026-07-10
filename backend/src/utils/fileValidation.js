import path from "node:path";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

const fileError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

export const hasImageMetadata = (file = {}) =>
  IMAGE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase()) ||
  IMAGE_EXTENSIONS.has(path.extname(String(file.originalname || "")).toLowerCase());

export const hasPdfMetadata = (file = {}) =>
  String(file.mimetype || "").toLowerCase() === "application/pdf" ||
  path.extname(String(file.originalname || "")).toLowerCase() === ".pdf";

export const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: ".jpg", mimeType: "image/jpeg" };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: ".png", mimeType: "image/png" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { extension: ".webp", mimeType: "image/webp" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (HEIC_BRANDS.has(brand)) return { extension: ".heic", mimeType: "image/heic" };
  }
  return null;
};

export const assertUploadedImage = (file) => {
  const type = detectImageType(file?.buffer);
  if (!file?.buffer?.length || !hasImageMetadata(file) || !type) {
    throw fileError("Solo se permiten imagenes JPEG, PNG, WebP o HEIC validas.");
  }
  return type;
};

export const assertUploadedPdf = (file) => {
  const header = Buffer.isBuffer(file?.buffer) ? file.buffer.subarray(0, 1024).toString("latin1") : "";
  if (!file?.buffer?.length || !hasPdfMetadata(file) || !header.includes("%PDF-")) {
    throw fileError("Solo se permiten archivos PDF validos.");
  }
};
