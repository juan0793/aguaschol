import test from "node:test";
import assert from "node:assert/strict";
import { cloneEditorElement, finishLineDraft, legacyTwoClickLineDraft, moveElementInStack, nextLineDraft, pushEditorHistory, redoEditorHistory, undoEditorHistory } from "./planosEditorHistory.js";

test("croquis history undoes and redoes element edits", () => {
  let history = { past: [], future: [] };
  let elements = [];
  ({ history, next: elements } = pushEditorHistory(history, elements, [{ localId: "1" }]));
  ({ history, next: elements } = pushEditorHistory(history, elements, [{ localId: "1" }, { localId: "2" }]));

  ({ history, next: elements } = undoEditorHistory(history, elements));
  assert.deepEqual(elements, [{ localId: "1" }]);

  ({ history, next: elements } = redoEditorHistory(history, elements));
  assert.deepEqual(elements, [{ localId: "1" }, { localId: "2" }]);
});

test("croquis history keeps the last snapshots only", () => {
  let history = { past: [], future: [] };
  let elements = [];
  for (let index = 0; index < 35; index += 1) {
    ({ history, next: elements } = pushEditorHistory(history, elements, [{ localId: String(index) }]));
  }

  assert.equal(history.past.length, 30);
  ({ history, next: elements } = undoEditorHistory(history, elements));
  assert.deepEqual(elements, [{ localId: "33" }]);
});

test("line tool creates a line with two clicks", () => {
  const first = legacyTwoClickLineDraft(null, { x: 10, y: 20 }, "correcciones");
  assert.equal(first.line, null);
  assert.deepEqual(first.draft, { points: [{ x: 10, y: 20 }], layer: "correcciones" });

  const second = legacyTwoClickLineDraft(first.draft, { x: 11, y: 21 }, "codigos");
  assert.equal(second.draft, null);
  assert.deepEqual(second.line.data_json.puntos, [{ x: 10, y: 20 }, { x: 11, y: 21 }]);
  assert.equal(second.line.data_json.capa, "correcciones");
});

test("line tool creates editable polylines", () => {
  let result = nextLineDraft(null, { x: 10, y: 20 }, "correcciones");
  result = nextLineDraft(result.draft, { x: 30, y: 40 }, "correcciones");
  result = nextLineDraft(result.draft, { x: 50, y: 60 }, "correcciones");

  const line = finishLineDraft(result.draft, "codigos");
  assert.deepEqual(line.data_json.puntos, [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }]);
  assert.equal(line.data_json.capa, "correcciones");
});

test("editor duplicates and reorders elements", () => {
  const original = { localId: "a", tipo_elemento: "linea", data_json: { puntos: [{ x: 1, y: 2 }, { x: 3, y: 4 }] } };
  const copy = cloneEditorElement(original, 10);
  assert.equal(copy.tipo_elemento, "linea");
  assert.deepEqual(copy.data_json.puntos, [{ x: 11, y: 12 }, { x: 13, y: 14 }]);

  assert.deepEqual(moveElementInStack([{ localId: "a" }, { localId: "b" }, { localId: "c" }], "b", "front").map((item) => item.localId), ["a", "c", "b"]);
  assert.deepEqual(moveElementInStack([{ localId: "a" }, { localId: "b" }, { localId: "c" }], "b", "back").map((item) => item.localId), ["b", "a", "c"]);
});
