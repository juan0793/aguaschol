import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { assertUploadedImage, assertUploadedPdf } from "../utils/fileValidation.js";

const R2_UPLOAD_PREFIX = "uploads/";

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
    .replace(/^-+|-+$/g, "") || "archivo";

const buildCloudinaryPublicId = (file, config) =>
  `${config.cloudinaryFolder}/${Date.now()}-${sanitizeBaseName(file?.originalname)}`;

const getCloudinaryPublicIdFromUrl = (photoPath = "", config = env) => {
  if (!config.useCloudinary || !/^https?:\/\//i.test(photoPath)) return "";

  try {
    const parsed = new URL(photoPath);
    if (!parsed.hostname.includes("res.cloudinary.com")) return "";
    const uploadIndex = parsed.pathname.indexOf("/upload/");
    if (uploadIndex === -1) return "";
    const parts = parsed.pathname.slice(uploadIndex + 8).split("/").filter(Boolean);
    const versionless = parts[0]?.match(/^v\d+$/) ? parts.slice(1) : parts;
    if (!versionless.length) return "";
    versionless[versionless.length - 1] = versionless.at(-1).replace(/\.[^.]+$/, "");
    return versionless.join("/");
  } catch {
    return "";
  }
};

const fileNameFromPath = (filePath = "") => {
  if (!/^\/(?:api\/)?uploads\/[^/]+$/.test(String(filePath))) return "";
  return path.basename(filePath);
};

const contentTypeFromName = (fileName = "") => ({
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf"
}[path.extname(fileName).toLowerCase()] || "application/octet-stream");

const bodyToBuffer = async (body) => {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body?.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body || []) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const notFound = (error) => ["NoSuchKey", "NotFound"].includes(error?.name) || error?.$metadata?.httpStatusCode === 404;
const fail = (message, status = 503) => Object.assign(new Error(message), { status });

export const createFileStorageService = ({ config = env, client = null } = {}) => {
  let r2 = client;
  const getR2 = () => {
    if (!config.useR2) throw fail("Cloudflare R2 no esta configurado.");
    if (!r2) {
      r2 = new S3Client({
        region: config.r2Region || "auto",
        endpoint: config.r2Endpoint,
        credentials: { accessKeyId: config.r2AccessKeyId, secretAccessKey: config.r2SecretAccessKey }
      });
    }
    return r2;
  };

  const putR2 = async (fileName, buffer, contentType, verifyContent = false) => {
    const key = `${R2_UPLOAD_PREFIX}${fileName}`;
    await getR2().send(new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "private, max-age=300"
    }));
    const head = await getR2().send(new HeadObjectCommand({ Bucket: config.r2Bucket, Key: key }));
    if (Number(head.ContentLength) !== buffer.length) throw fail(`R2 no verifico el archivo ${fileName}.`);
    if (verifyContent) {
      const downloaded = await getR2().send(new GetObjectCommand({ Bucket: config.r2Bucket, Key: key }));
      if (!buffer.equals(await bodyToBuffer(downloaded.Body))) {
        throw fail(`R2 devolvio contenido distinto para ${fileName}.`);
      }
    }
    return key;
  };

  const saveFile = async (file, extension, contentType) => {
    const fileName = `${Date.now()}-${sanitizeBaseName(file.originalname)}${extension}`;

    if (config.useR2) {
      await putR2(fileName, file.buffer, contentType);
      return { photoPath: `/uploads/${fileName}`, storage: "r2", publicId: `${R2_UPLOAD_PREFIX}${fileName}` };
    }

    if (config.useCloudinary && contentType.startsWith("image/")) {
      const publicId = buildCloudinaryPublicId(file, config);
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { public_id: publicId, resource_type: "image", overwrite: false },
          (error, result) => error || !result?.secure_url
            ? reject(error ?? fail("No fue posible subir la fotografia al almacenamiento persistente."))
            : resolve(result)
        );
        stream.end(file.buffer);
      });
      return { photoPath: uploadResult.secure_url, storage: "cloudinary", publicId: uploadResult.public_id };
    }

    await fs.mkdir(config.uploadDir, { recursive: true });
    await fs.writeFile(path.join(config.uploadDir, fileName), file.buffer);
    return { photoPath: `/uploads/${fileName}`, storage: "local", publicId: "" };
  };

  const readStoredFile = async (filePath) => {
    const fileName = fileNameFromPath(filePath);
    if (!fileName) throw fail("Ruta de archivo no valida.", 400);

    if (config.useR2) {
      try {
        const result = await getR2().send(new GetObjectCommand({
          Bucket: config.r2Bucket,
          Key: `${R2_UPLOAD_PREFIX}${fileName}`
        }));
        return {
          buffer: await bodyToBuffer(result.Body),
          contentType: result.ContentType || contentTypeFromName(fileName),
          etag: result.ETag || "",
          storage: "r2"
        };
      } catch (error) {
        try {
          const buffer = await fs.readFile(path.join(config.uploadDir, fileName));
          return { buffer, contentType: contentTypeFromName(fileName), etag: "", storage: "local" };
        } catch {
          throw notFound(error) ? fail("Archivo no encontrado.", 404) : error;
        }
      }
    }

    try {
      const buffer = await fs.readFile(path.join(config.uploadDir, fileName));
      return { buffer, contentType: contentTypeFromName(fileName), etag: "", storage: "local" };
    } catch (error) {
      if (error?.code === "ENOENT") throw fail("Archivo no encontrado.", 404);
      throw error;
    }
  };

  const deleteStoredFile = async (filePath = "") => {
    if (!filePath) return;
    const cloudinaryPublicId = getCloudinaryPublicIdFromUrl(filePath, config);
    if (cloudinaryPublicId) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: "image" }).catch(() => {});
      return;
    }
    if (/^https?:\/\//i.test(filePath)) return;
    const fileName = fileNameFromPath(filePath);
    if (!fileName) return;
    if (config.useR2) {
      await getR2().send(new DeleteObjectCommand({
        Bucket: config.r2Bucket,
        Key: `${R2_UPLOAD_PREFIX}${fileName}`
      })).catch(() => {});
    }
    await fs.unlink(path.join(config.uploadDir, fileName)).catch(() => {});
  };

  const localFiles = async () => {
    await fs.mkdir(config.uploadDir, { recursive: true });
    const entries = await fs.readdir(config.uploadDir, { withFileTypes: true });
    return Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => ({
      name: entry.name,
      size: (await fs.stat(path.join(config.uploadDir, entry.name))).size
    })));
  };

  const getStatus = async () => {
    const local = await localFiles();
    const remote = [];
    if (config.useR2) {
      let continuationToken;
      do {
        const result = await getR2().send(new ListObjectsV2Command({
          Bucket: config.r2Bucket,
          Prefix: R2_UPLOAD_PREFIX,
          ContinuationToken: continuationToken
        }));
        remote.push(...(result.Contents || []));
        continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (continuationToken);
    }
    return {
      configured: Boolean(config.useR2),
      local_files: local.length,
      local_bytes: local.reduce((total, file) => total + file.size, 0),
      r2_files: remote.length,
      r2_bytes: remote.reduce((total, file) => total + Number(file.Size || 0), 0)
    };
  };

  const migrateLocalFiles = async ({ deleteLocal = false } = {}) => {
    if (!config.useR2) throw fail("Cloudflare R2 no esta configurado.");
    const files = await localFiles();
    let migratedBytes = 0;
    for (const file of files) {
      const absolutePath = path.join(config.uploadDir, file.name);
      const buffer = await fs.readFile(absolutePath);
      await putR2(file.name, buffer, contentTypeFromName(file.name), true);
      if (deleteLocal) await fs.unlink(absolutePath);
      migratedBytes += buffer.length;
    }
    return { migrated_files: files.length, migrated_bytes: migratedBytes, local_deleted: deleteLocal };
  };

  return {
    deleteStoredFile,
    getStatus,
    migrateLocalFiles,
    readStoredFile,
    savePhoto: (file) => {
      const type = assertUploadedImage(file);
      return saveFile(file, type.extension, type.mimeType);
    },
    savePdf: (file) => {
      assertUploadedPdf(file);
      return saveFile(file, ".pdf", "application/pdf");
    }
  };
};

const storage = createFileStorageService();

export const saveUploadedPhoto = (file) => storage.savePhoto(file);
export const saveUploadedPdf = (file) => storage.savePdf(file);
export const readStoredFile = (filePath) => storage.readStoredFile(filePath);
export const deleteStoredPhoto = (filePath) => storage.deleteStoredFile(filePath);
export const getUploadStorageStatus = () => storage.getStatus();
export const migrateLocalUploadsToR2 = (options) => storage.migrateLocalFiles(options);
export const getStorageModeLabel = () => env.useR2 ? "r2" : env.useCloudinary ? "cloudinary" : "local";
