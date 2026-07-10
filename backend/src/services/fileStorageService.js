import fs from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { assertUploadedImage } from "../utils/fileValidation.js";

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
  const imageType = assertUploadedImage(file);

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
  const extension = imageType.extension;
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
