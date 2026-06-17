import test from "node:test";
import assert from "node:assert/strict";
import { pushEditorHistory, redoEditorHistory, undoEditorHistory } from "./planosEditorHistory.js";

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
