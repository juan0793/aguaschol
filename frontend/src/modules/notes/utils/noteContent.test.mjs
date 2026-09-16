import test from "node:test";
import assert from "node:assert/strict";
import { tokenizeNoteContent } from "./noteContent.js";
import { formatNoteShortDate, matchesQuery, neighborsForDrop } from "./notesOrder.js";

const types = (text) => tokenizeNoteContent(text).map((segment) => [segment.type, segment.value]);

test("detecta teléfonos hondureños con guion o prefijo +504", () => {
  assert.deepEqual(types("Fontanero 9988-4455, oficina +504 2782-1234"), [
    ["text", "Fontanero "], ["phone", "9988-4455"], ["text", ", oficina "], ["phone", "+504 2782-1234"]
  ]);
  assert.equal(tokenizeNoteContent("Tel 9988-4455")[1].href, "tel:+50499884455");
  assert.equal(tokenizeNoteContent("+50499884455")[0].href, "tel:+50499884455");
});

test("ocho dígitos sin formato reconocible no se convierten (medidor, clave, lote)", () => {
  assert.deepEqual(types("Medidor 99884455"), [["text", "Medidor 99884455"]]);
  assert.deepEqual(types("Clave 42-34-01-02"), [["text", "Clave 42-34-01-02"]]);
  assert.deepEqual(types("Lote 1234-5678-9"), [["text", "Lote 1234-5678-9"]]);
});

test("detecta URLs, quita la puntuación final y solo acepta http(s)", () => {
  assert.deepEqual(types("Ver https://aguaschol.hn/pagos."), [["text", "Ver "], ["url", "https://aguaschol.hn/pagos"], ["text", "."]]);
  assert.deepEqual(types("(ver https://ejemplo.hn/a)"), [["text", "(ver "], ["url", "https://ejemplo.hn/a"], ["text", ")"]]);
  assert.equal(tokenizeNoteContent("https://es.wikipedia.org/wiki/Choluteca_(ciudad)")[0].value, "https://es.wikipedia.org/wiki/Choluteca_(ciudad)");
  assert.equal(tokenizeNoteContent("www.google.com")[0].href, "https://www.google.com/");
  assert.deepEqual(types("javascript:alert(1)"), [["text", "javascript:alert(1)"]]);
});

test("el HTML queda como texto plano", () => {
  assert.deepEqual(types("<script>alert(1)</script>"), [["text", "<script>alert(1)</script>"]]);
});

test("vecinos al soltar: en medio, al inicio y al final", () => {
  const list = [{ id: 1, sort_order: 10 }, { id: 2, sort_order: 20 }];
  const dragged = { id: 9, sort_order: 50 };
  assert.deepEqual(neighborsForDrop(list, 1, dragged), { before_id: 1, after_id: 2, sort_order: 15 });
  assert.deepEqual(neighborsForDrop(list, 0, dragged), { before_id: null, after_id: 1, sort_order: -990 });
  assert.deepEqual(neighborsForDrop(list, 2, dragged), { before_id: 2, after_id: null, sort_order: 1020 });
});

test("fecha corta y búsqueda local sin tildes", () => {
  const now = new Date("2026-09-16T18:00:00Z");
  assert.equal(formatNoteShortDate("2026-09-16T18:00:00Z", now), "16 sep");
  assert.equal(formatNoteShortDate("2025-12-31T18:00:00Z", now), "31 dic 2025");
  assert.equal(matchesQuery({ title: "", content: "Portón norte", category: "" }, "porton"), true);
  assert.equal(matchesQuery({ title: "", content: "Portón norte", category: "Accesos" }, "acces"), true);
});
