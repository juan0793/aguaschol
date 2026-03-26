import fs from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

if (env.useCloudinary) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true
  });
}

const sanitizeBaseName = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "fotografia";

const inferExtension = (file) => {
  const originalExt = path.extname(file?.originalname ?? "");
  if (originalExt) return originalExt.toLowerCase();
  if (file?.mimetype === "image/png") return ".png";
  if (file?.mimetype === "image/webp") return ".webp";
  return ".jpg";
};

const inferMimeType = (file) => {
  if (file?.mimetype) return file.mimetype;
  const ext = inferExtension(file);
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
};

const buildCloudinaryPublicId = (file) => {
  const baseName = sanitizeBaseName(file?.originalname);
  return `${env.cloudinaryFolder}/${Date.now()}-${baseName}`;
};

const getCloudinaryPublicIdFromUrl = (photoPath = "") => {
  if (!env.useCloudinary || !/^https?:\/\//i.test(photoPath)) {
    return "";
  }

  try {
    const parsed = new URL(photoPath);
    if (!parsed.hostname.includes("res.cloudinary.com")) {
      return "";
    }

    const uploadIndex = parsed.pathname.indexOf("/upload/");
    if (uploadIndex === -1) {
      return "";
    }

    const afterUpload = parsed.pathname.slice(uploadIndex + "/upload/".length);
    const parts = afterUpload.split("/").filter(Boolean);
    const versionless = parts[0]?.match(/^v\d+$/) ? parts.slice(1) : parts;

    if (!versionless.length) {
      return "";
    }

    const last = versionless[versionless.length - 1];
    versionless[versionless.length - 1] = last.replace(/\.[^.]+$/, "");
    return versionless.join("/");
  } catch {
    return "";
  }
};

export const saveUploadedPhoto = async (file) => {
  if (!file?.buffer?.length) {
    const error = new Error("No se recibio una fotografia valida para guardar.");
    error.status = 400;
    throw error;
  }

  if (env.useCloudinary) {
    const publicId = buildCloudinaryPublicId(file);
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          overwrite: false
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(error ?? new Error("No fue posible subir la fotografia al almacenamiento persistente."));
            return;
          }

          resolve(result);
        }
      );

      stream.end(file.buffer);
    });

    return {
      photoPath: uploadResult.secure_url,
      storage: "cloudinary",
      publicId: uploadResult.public_id
    };
  }

  await fs.mkdir(env.uploadDir, { recursive: true });
  const extension = inferExtension(file);
  const fileName = `${Date.now()}-${sanitizeBaseName(file.originalname)}${extension}`;
  const absolutePath = path.join(env.uploadDir, fileName);
  await fs.writeFile(absolutePath, file.buffer);

  return {
    photoPath: `/uploads/${fileName}`,
    storage: "local",
    publicId: ""
  };
};

export const deleteStoredPhoto = async (photoPath = "") => {
  if (!photoPath) return;

  const cloudinaryPublicId = getCloudinaryPublicIdFromUrl(photoPath);
  if (cloudinaryPublicId) {
    await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: "image" }).catch(() => {});
    return;
  }

  if (/^https?:\/\//i.test(photoPath)) {
    return;
  }

  const relativePhotoPath = photoPath.startsWith("/") ? `.${photoPath}` : photoPath;
  const absolutePhotoPath = path.resolve(env.dbRoot, relativePhotoPath);
  await fs.unlink(absolutePhotoPath).catch(() => {});
};

export const getStorageModeLabel = () => (env.useCloudinary ? "cloudinary" : "local");

export const getDefaultPhotoMimeType = inferMimeType;
