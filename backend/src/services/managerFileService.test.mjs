import assert from "node:assert/strict";
import test from "node:test";
import { assertManagerFileAccess } from "./managerFileService.js";

test("rutas inválidas o traversal se rechazan antes de consultar la base", async () => {
  for (const path of ["/uploads/../privado", "/uploads/..", "/uploads/%2e%2e", "/api/uploads/archivo/subruta", "/chat/imagen.jpg", "/uploads/foto.jpg?token=algo"]) {
    await assert.rejects(() => assertManagerFileAccess(path), (e) => e.status === 403);
  }
});

test("un archivo sin vínculo institucional responde 403", async () => {
  const executor = { query: async () => [[]] };
  await assert.rejects(() => assertManagerFileAccess("/uploads/chat-privado.jpg", executor), (e) => e.status === 403);
  await assert.rejects(() => assertManagerFileAccess("/planos-pdf/borrador.pdf", executor), (e) => e.status === 403);
});

test("las dos URL de medios verifican el mismo archivo institucional mediante parámetros", async () => {
  const queries = [];
  const executor = { query: async (sql, params) => { queries.push({ sql, params }); return [[{ id: 1 }]]; } };
  await assertManagerFileAccess("/uploads/foto-1.jpg", executor);
  await assertManagerFileAccess("/api/uploads/foto-1.jpg", executor);
  assert.deepEqual(queries[0], queries[1]);
  assert.deepEqual(queries[0].params, ["/uploads/foto-1.jpg", "/uploads/foto-1.jpg", "/uploads/foto-1.jpg"]);
  await assertManagerFileAccess("/api/planos-pdf/plano.pdf", executor);
  assert.deepEqual(queries[2].params, ["/planos-pdf/plano.pdf"]);
});
