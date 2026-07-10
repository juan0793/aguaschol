import assert from "node:assert/strict";
import test from "node:test";
import { validateRuntimeEnv } from "../config/env.js";
import { clearMediaSessionCookie, setMediaSessionCookie } from "../middleware/authMiddleware.js";
import { assertUploadedImage, assertUploadedPdf, detectImageType } from "./fileValidation.js";
import { hashPassword, hashToken, verifyPassword } from "./password.js";

test("runtime configuration requires an admin password in production", () => {
  assert.throws(() => validateRuntimeEnv({ isProduction: true, authPassword: "" }), /AUTH_PASSWORD/);
  assert.doesNotThrow(() => validateRuntimeEnv({ isProduction: true, authPassword: "segura-123" }));
});

test("session tokens are stored as deterministic hashes", () => {
  const token = "token-de-prueba";
  assert.equal(hashToken(token), hashToken(token));
  assert.equal(hashToken(token).length, 64);
  assert.notEqual(hashToken(token), token);
});

test("media session cookie is HttpOnly and can be cleared", () => {
  const calls = [];
  const response = {
    cookie: (...args) => calls.push(["set", ...args]),
    clearCookie: (...args) => calls.push(["clear", ...args])
  };

  setMediaSessionCookie(response, "token-seguro");
  clearMediaSessionCookie(response);

  assert.equal(calls[0][0], "set");
  assert.equal(calls[0][2], "token-seguro");
  assert.equal(calls[0][3].httpOnly, true);
  assert.equal(calls[0][3].sameSite, "lax");
  assert.equal(calls[1][0], "clear");
  assert.equal(calls[1][1], calls[0][1]);
});

test("password hashing verifies the original password only", async () => {
  const hash = await hashPassword("Clave-segura-123");
  assert.equal(await verifyPassword("Clave-segura-123", hash), true);
  assert.equal(await verifyPassword("otra-clave", hash), false);
});

test("image validation checks the real file signature", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]);
  const file = { buffer: jpeg, mimetype: "image/jpeg", originalname: "evidencia.jpg" };
  assert.deepEqual(detectImageType(jpeg), { extension: ".jpg", mimeType: "image/jpeg" });
  assert.deepEqual(assertUploadedImage(file), { extension: ".jpg", mimeType: "image/jpeg" });
  assert.throws(
    () => assertUploadedImage({ ...file, buffer: Buffer.from("no-es-imagen") }),
    /imagenes JPEG/
  );
});

test("PDF validation rejects renamed non-PDF files", () => {
  assert.doesNotThrow(() =>
    assertUploadedPdf({ buffer: Buffer.from("%PDF-1.7\n"), mimetype: "application/pdf", originalname: "plano.pdf" })
  );
  assert.throws(
    () => assertUploadedPdf({ buffer: Buffer.from("contenido falso"), mimetype: "application/pdf", originalname: "plano.pdf" }),
    /PDF validos/
  );
});
