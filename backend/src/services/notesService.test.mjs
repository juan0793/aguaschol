import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  __notesMemoryWrites,
  __resetNotesMemoryForTests,
  __setNoteDeletedAtForTests,
  addNoteLink,
  createNote,
  deleteNote,
  duplicateNote,
  getNote,
  listCategories,
  listNotes,
  moveNote,
  purgeDeletedNotes,
  restoreNote,
  updateNote
} from "./notesService.js";
import notesRoutes from "../routes/notesRoutes.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const admin = { id: 1, role: "admin", full_name: "Administradora" };
const otroAdmin = { id: 2, role: "admin", full_name: "Otro admin" };

const keys = (result) => result.items.map((note) => note.content);

test.beforeEach(() => __resetNotesMemoryForTests());

test("crear con solo contenido; la nota nueva va al inicio y el resto de campos es opcional", async () => {
  const a = await createNote(admin, { content: "Teléfono del fontanero 9988-4455" });
  const b = await createNote(admin, { content: "Idea suelta" });
  assert.equal(a.title, "");
  assert.equal(a.color, "default");
  assert.equal(a.is_pinned, false);
  assert.deepEqual(keys(await listNotes(admin)), ["Idea suelta", "Teléfono del fontanero 9988-4455"]);
  assert.ok(b.sort_order < a.sort_order);
  await assert.rejects(() => createNote(admin, { content: "   " }), { status: 400 });
  await assert.rejects(() => createNote(admin, { content: "x", color: "#ff0000" }), { status: 400 });
});

test("una nota ajena responde 404 en lectura, edición, borrado y vínculos", async () => {
  const note = await createNote(admin, { content: "Privada" });
  await assert.rejects(() => getNote(otroAdmin, note.id), { status: 404 });
  await assert.rejects(() => updateNote(otroAdmin, note.id, { content: "pisada" }), { status: 404 });
  await assert.rejects(() => deleteNote(otroAdmin, note.id), { status: 404 });
  await assert.rejects(() => addNoteLink(otroAdmin, note.id, { target_type: "inspeccion", target_id: "5" }), { status: 404 });
  assert.equal((await listNotes(otroAdmin)).items.length, 0);
});

test("fijar mueve a Fijados sin tocar sort_order; archivar desfija y restaurar no recupera el pin", async () => {
  const a = await createNote(admin, { content: "A" });
  await createNote(admin, { content: "B" });
  const pinned = await updateNote(admin, a.id, { is_pinned: true });
  assert.equal(pinned.sort_order, a.sort_order);
  assert.deepEqual(keys(await listNotes(admin)), ["A", "B"], "los fijados encabezan el listado");
  assert.deepEqual(keys(await listNotes(admin, { pinned: "1" })), ["A"]);

  const archived = await updateNote(admin, a.id, { is_archived: true });
  assert.equal(archived.is_pinned, false);
  assert.deepEqual(keys(await listNotes(admin)), ["B"]);
  assert.deepEqual(keys(await listNotes(admin, { archived: "1" })), ["A"]);
  const restored = await updateNote(admin, a.id, { is_archived: false });
  assert.equal(restored.is_pinned, false);
});

test("mover usa el punto medio entre vecinos, persiste y escribe una sola fila", async () => {
  const c = await createNote(admin, { content: "C" });
  const b = await createNote(admin, { content: "B" });
  const a = await createNote(admin, { content: "A" });
  assert.deepEqual(keys(await listNotes(admin)), ["A", "B", "C"]);

  const writes = __notesMemoryWrites();
  const moved = await moveNote(admin, c.id, { before_id: a.id, after_id: b.id });
  assert.equal(__notesMemoryWrites() - writes, 1);
  assert.equal(moved.sort_order, (a.sort_order + b.sort_order) / 2);
  assert.deepEqual(keys(await listNotes(admin)), ["A", "C", "B"]);

  await moveNote(admin, b.id, { after_id: a.id });
  assert.deepEqual(keys(await listNotes(admin)), ["B", "A", "C"], "a la posición 1");
  await moveNote(admin, b.id, { before_id: c.id });
  assert.deepEqual(keys(await listNotes(admin)), ["A", "C", "B"], "al final");
});

test("mover con un vecino inexistente u orden invertido responde 409 con la posición real", async () => {
  const b = await createNote(admin, { content: "B" });
  const a = await createNote(admin, { content: "A" });
  const c = await createNote(admin, { content: "C" });
  await assert.rejects(() => moveNote(admin, c.id, { before_id: 9999 }), (error) => error.status === 409 && error.body.note.id === c.id);
  await assert.rejects(() => moveNote(admin, c.id, { before_id: b.id, after_id: a.id }), { status: 409 });
});

test("vecinos demasiado juntos disparan la renumeración y el orden se conserva", async () => {
  const notes = [];
  for (const content of ["D", "C", "B", "A"]) notes.push(await createNote(admin, { content }));
  const [d, c, , a] = notes;
  // Encajar repetidamente entre A y la nota que tiene justo detrás agota la precisión.
  let neighbor = c;
  for (let round = 0; round < 60; round += 1) {
    const moving = round % 2 ? c : d;
    const target = round % 2 ? d : c;
    await moveNote(admin, moving.id, { before_id: a.id, after_id: neighbor.id === moving.id ? target.id : neighbor.id });
    neighbor = moving;
  }
  const orders = (await listNotes(admin)).items.map((note) => note.sort_order);
  assert.equal(new Set(orders).size, orders.length, "sin empates tras renumerar");
  assert.equal((await listNotes(admin)).items[0].content, "A");
});

test("duplicar crea copia sin pin y activa justo después del original", async () => {
  const b = await createNote(admin, { content: "B" });
  const a = await createNote(admin, { title: "Proveedor", content: "A", color: "verde", category: "Compras" });
  await updateNote(admin, a.id, { is_pinned: true });
  const copy = await duplicateNote(admin, a.id);
  assert.equal(copy.is_pinned, false);
  assert.equal(copy.title, "Proveedor");
  assert.equal(copy.color, "verde");
  assert.ok(copy.sort_order > a.sort_order && copy.sort_order < b.sort_order);

  await updateNote(admin, b.id, { is_archived: true });
  const fromArchive = await duplicateNote(admin, b.id);
  assert.equal(fromArchive.is_archived, false);
});

test("eliminar es lógico y restaurar devuelve la nota a su posición; la purga borra a los 30 días", async () => {
  const b = await createNote(admin, { content: "B" });
  const a = await createNote(admin, { content: "A" });
  await deleteNote(admin, a.id);
  assert.deepEqual(keys(await listNotes(admin)), ["B"]);
  await assert.rejects(() => getNote(admin, a.id), { status: 404 });
  const restored = await restoreNote(admin, a.id);
  assert.equal(restored.sort_order, a.sort_order);
  assert.deepEqual(keys(await listNotes(admin)), ["A", "B"]);

  await deleteNote(admin, b.id);
  __setNoteDeletedAtForTests(b.id, new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString());
  assert.equal(await purgeDeletedNotes(), 1);
  await assert.rejects(() => restoreNote(admin, b.id), { status: 404 });
});

test("autoguardado con updated_at viejo responde 409; organizar no cuenta como edición", async () => {
  const note = await createNote(admin, { content: "Versión 1" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const edited = await updateNote(admin, note.id, { content: "Versión 2", expected_updated_at: note.updated_at });
  await assert.rejects(
    () => updateNote(admin, note.id, { content: "Pestaña vieja", expected_updated_at: note.updated_at }),
    (error) => error.status === 409 && error.body.note.content === "Versión 2"
  );
  const pinned = await updateNote(admin, note.id, { is_pinned: true });
  assert.equal(pinned.updated_at, edited.updated_at);
  const other = await createNote(admin, { content: "Otra" });
  await moveNote(admin, note.id, { after_id: other.id });
  assert.equal((await getNote(admin, note.id)).updated_at, edited.updated_at);
});

test("buscar encuentra en título, contenido y categoría, sin distinguir tildes, fuera de la primera página", async () => {
  await createNote(admin, { content: "Clave del portón: 4471", category: "Accesos" });
  for (let index = 0; index < 90; index += 1) await createNote(admin, { content: `Relleno ${index}` });
  const firstPage = await listNotes(admin, { limit: 40 });
  assert.equal(firstPage.items.length, 40);
  assert.ok(firstPage.next_cursor);
  assert.equal(firstPage.items.some((note) => note.content.includes("portón")), false);
  assert.deepEqual(keys(await listNotes(admin, { q: "porton" })), ["Clave del portón: 4471"]);
  assert.equal((await listNotes(admin, { q: "accesos" })).items.length, 1);

  const seen = new Set();
  let cursor = null;
  do {
    const page = await listNotes(admin, { limit: 40, cursor });
    page.items.forEach((note) => seen.add(note.id));
    cursor = page.next_cursor;
  } while (cursor);
  assert.equal(seen.size, 91, "el cursor recorre todo sin repetir");
});

test("orden por fecha no altera sort_order y la categoría reutiliza la escritura existente", async () => {
  const a = await createNote(admin, { content: "A", category: "Proveedores" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const b = await createNote(admin, { content: "B", category: "  proveedores " });
  assert.equal(b.category, "Proveedores");
  await moveNote(admin, b.id, { before_id: a.id });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await updateNote(admin, a.id, { content: "A editada" });
  assert.deepEqual(keys(await listNotes(admin, { sort: "updated" })), ["A editada", "B"]);
  assert.deepEqual(keys(await listNotes(admin, { sort: "manual" })), ["A editada", "B"]);
  assert.deepEqual(keys(await listNotes(admin, { sort: "created" })), ["B", "A editada"]);
  assert.deepEqual(await listCategories(admin), ["Proveedores"]);
});

test("cada envío crea su propio vínculo y la nota sigue en el tablero", async () => {
  const note = await createNote(admin, { content: "Revisar fuga en Bo. El Centro" });
  await addNoteLink(admin, note.id, { target_type: "inspeccion", target_id: "17", target_label: "INS-2026-00017" });
  const linked = await addNoteLink(admin, note.id, { target_type: "inspeccion", target_id: "18", target_label: "INS-2026-00018" });
  assert.deepEqual(linked.links.map((link) => link.target_label), ["INS-2026-00017", "INS-2026-00018"]);
  assert.equal(linked.is_archived, false);
  assert.equal((await listNotes(admin)).items.length, 1);
  await assert.rejects(() => addNoteLink(admin, note.id, { target_type: "ficha", target_id: "3" }), { status: 400 });
});

test("HTTP: sin sesión 401, sin rol admin 403, nota ajena 404, contenido como texto plano", async () => {
  const build = (user) => {
    const app = express();
    app.use(express.json());
    app.use("/api/admin/notes", user === undefined ? requireAuth : (req, _res, next) => { req.authUser = user; next(); }, notesRoutes);
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
    return app;
  };
  const withServer = async (app, run) => {
    const server = app.listen(0);
    try {
      await run(`http://127.0.0.1:${server.address().port}/api/admin/notes`);
    } finally {
      server.close();
    }
  };

  await withServer(build(undefined), async (base) => {
    assert.equal((await fetch(base)).status, 401);
  });
  await withServer(build({ id: 3, role: "operator" }), async (base) => {
    assert.equal((await fetch(base)).status, 403);
    assert.equal((await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "x" }) })).status, 403);
  });
  let noteId;
  await withServer(build(admin), async (base) => {
    const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "<script>alert(1)</script>" }) });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.content, "<script>alert(1)</script>", "se guarda tal cual; el frontend lo escapa");
    noteId = created.id;
    const conflict = await fetch(`${base}/${noteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "y", expected_updated_at: "2000-01-01T00:00:00.000Z" }) });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).note.id, noteId);
  });
  await withServer(build(otroAdmin), async (base) => {
    assert.equal((await fetch(`${base}/${noteId}`)).status, 404);
  });
});

test("con un solo vecino se ubica junto al vecino real, no a un paso fijo", async () => {
  const d = await createNote(admin, { content: "D" });
  const c = await createNote(admin, { content: "C" });
  const b = await createNote(admin, { content: "B" });
  const a = await createNote(admin, { content: "A" });
  // El cliente solo tenía cargadas A y B y soltó D "al final": debe quedar entre B y C.
  await moveNote(admin, d.id, { before_id: b.id });
  assert.deepEqual(keys(await listNotes(admin)), ["A", "B", "D", "C"]);
  // Y soltar A "al inicio" de una lista que empieza en C la deja justo antes de C.
  await moveNote(admin, a.id, { after_id: c.id });
  assert.deepEqual(keys(await listNotes(admin)), ["B", "D", "A", "C"]);
});
