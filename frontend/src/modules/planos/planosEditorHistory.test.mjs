import test from "node:test";
import assert from "node:assert/strict";
import { nextLineDraft, pushEditorHistory, redoEditorHistory, undoEditorHistory } from "./planosEditorHistory.js";

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
  const first = nextLineDraft(null, { x: 10, y: 20 }, "correcciones");
  assert.equal(first.line, null);
  assert.deepEqual(first.draft, { start: { x: 10, y: 20 }, layer: "correcciones" });

  const second = nextLineDraft(first.draft, { x: 11, y: 21 }, "codigos");
  assert.equal(second.draft, null);
  assert.deepEqual(second.line.data_json.puntos, [{ x: 10, y: 20 }, { x: 11, y: 21 }]);
  assert.equal(second.line.data_json.capa, "correcciones");
});
