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

test("tiempo relativo: minutos, horas del mismo día, ayer y fecha corta", async () => {
  const { formatNoteRelative } = await import("./notesOrder.js");
  const now = new Date("2026-10-13T18:00:00Z"); // 12:00 en Tegucigalpa
  assert.equal(formatNoteRelative("2026-10-13T17:59:40Z", now), "Ahora");
  assert.equal(formatNoteRelative("2026-10-13T17:35:00Z", now), "Hace 25 min");
  assert.equal(formatNoteRelative("2026-10-13T08:00:00Z", now), "Hace 10 h");
  assert.equal(formatNoteRelative("2026-10-13T05:00:00Z", now), "Ayer", "las 23:00 del 12 en Honduras");
  assert.equal(formatNoteRelative("2026-10-01T18:00:00Z", now), "1 oct");
});

test("grupos por fecha siguen la zona horaria de Honduras y omiten los vacíos", async () => {
  const { groupNotesByTime } = await import("./notesOrder.js");
  const now = new Date("2026-10-13T18:00:00Z");
  const notes = [
    { id: 1, updated_at: "2026-10-13T15:00:00Z" },
    { id: 2, updated_at: "2026-10-13T05:00:00Z" },
    { id: 3, updated_at: "2026-10-09T18:00:00Z" },
    { id: 4, updated_at: "2026-10-02T18:00:00Z" },
    { id: 5, updated_at: "2026-08-02T18:00:00Z" }
  ];
  assert.deepEqual(groupNotesByTime(notes, "updated", now).map((group) => [group.title, group.notes.map((note) => note.id)]), [
    ["Hoy", [1]], ["Ayer", [2]], ["Esta semana", [3]], ["Este mes", [4]], ["Anteriores", [5]]
  ]);
  assert.deepEqual(groupNotesByTime([{ id: 9, created_at: "2026-10-13T15:00:00Z", updated_at: "2026-01-01T00:00:00Z" }], "created", now).map((group) => group.title), ["Hoy"]);
});

test("resaltado sin tildes conserva el texto original y encuentra todas las coincidencias", async () => {
  const { highlightParts } = await import("./notesOrder.js");
  assert.deepEqual(highlightParts("Portón del Portal", "porto"), [
    { text: "Portó", match: true }, { text: "n del Portal", match: false }
  ]);
  assert.deepEqual(highlightParts("ana y Ana", "ANA").filter((part) => part.match).map((part) => part.text), ["ana", "Ana"]);
  assert.deepEqual(highlightParts("texto", ""), [{ text: "texto", match: false }]);
  assert.equal(highlightParts("Café descafeinado", "cafe").map((part) => part.text).join(""), "Café descafeinado");
});

test("filtros por color y categoría ignoran mayúsculas y tildes", async () => {
  const { matchesFilters } = await import("./notesOrder.js");
  const note = { color: "azul", category: "Fontanería" };
  assert.equal(matchesFilters(note, { color: "azul", category: "fontaneria" }), true);
  assert.equal(matchesFilters(note, { color: "verde" }), false);
  assert.equal(matchesFilters({ color: null }, { color: "default" }), true);
  assert.equal(matchesFilters(note, {}), true);
});
