import assert from "node:assert/strict";
import test from "node:test";
import { addDaysIso, toLocalIsoDate } from "./entregasDate.js";

test("formatea fecha local en iso", () => {
  assert.equal(toLocalIsoDate(new Date(2026, 7, 25, 15, 30)), "2026-08-25");
});

test("suma dias sin depender de UTC", () => {
  assert.equal(addDaysIso("2026-08-25", -1), "2026-08-24");
});
