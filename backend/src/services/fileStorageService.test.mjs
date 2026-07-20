import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFileStorageService } from "./fileStorageService.js";

const fakeClient = () => {
  const objects = new Map();
  return {
    objects,
    send: async (command) => {
      const { Key } = command.input;
      if (command.constructor.name === "PutObjectCommand") {
        objects.set(Key, { body: Buffer.from(command.input.Body), type: command.input.ContentType });
        return {};
      }
      if (command.constructor.name === "HeadObjectCommand") {
        const object = objects.get(Key);
        if (!object) throw Object.assign(new Error("No existe"), { name: "NoSuchKey" });
        return { ContentLength: object.body.length };
      }
      if (command.constructor.name === "GetObjectCommand") {
        const object = objects.get(Key);
        if (!object) throw Object.assign(new Error("No existe"), { name: "NoSuchKey" });
        return { Body: object.body, ContentType: object.type, ETag: '"test"' };
      }
      if (command.constructor.name === "ListObjectsV2Command") {
        return { Contents: [...objects].map(([objectKey, object]) => ({ Key: objectKey, Size: object.body.length })) };
      }
      if (command.constructor.name === "DeleteObjectCommand") {
        objects.delete(Key);
        return {};
      }
      throw new Error(`Comando inesperado: ${command.constructor.name}`);
    }
  };
};

test("migra, verifica y sirve archivos privados desde R2 antes de borrar el volumen", async (context) => {
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "aguaschol-r2-"));
  context.after(() => fs.rm(uploadDir, { recursive: true, force: true }));
  await fs.writeFile(path.join(uploadDir, "foto.png"), Buffer.from("archivo-antiguo"));
  const client = fakeClient();
  const service = createFileStorageService({
    config: {
      useR2: true,
      useCloudinary: false,
      uploadDir,
      r2Bucket: "privado",
      r2Region: "auto",
      r2Endpoint: "https://example.invalid",
      r2AccessKeyId: "test",
      r2SecretAccessKey: "test"
    },
    client
  });

  const migrated = await service.migrateLocalFiles({ deleteLocal: true });
  assert.deepEqual(migrated, { migrated_files: 1, migrated_bytes: 15, local_deleted: true });
  await assert.rejects(fs.stat(path.join(uploadDir, "foto.png")), { code: "ENOENT" });
  assert.equal((await service.readStoredFile("/uploads/foto.png")).buffer.toString(), "archivo-antiguo");
  assert.deepEqual(await service.getStatus(), {
    configured: true,
    local_files: 0,
    local_bytes: 0,
    r2_files: 1,
    r2_bytes: 15
  });
});
