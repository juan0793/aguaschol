import assert from "node:assert/strict";
import test from "node:test";
import { syncMapDiaryGroups } from "./datesAndBusiness.js";

test("syncMapDiaryGroups keeps create, move, and delete totals consistent", () => {
  const initial = [{ key: "2026-09-20", total: 2 }];
  const created = syncMapDiaryGroups(initial, { diary_date: "2026-09-21" });
  assert.deepEqual(created, [
    { key: "2026-09-21", total: 1 },
    { key: "2026-09-20", total: 2 }
  ]);

  const moved = syncMapDiaryGroups(created, { diary_date: "2026-09-22" }, { diary_date: "2026-09-21" });
  assert.deepEqual(moved, [
    { key: "2026-09-22", total: 1 },
    { key: "2026-09-20", total: 2 }
  ]);

  assert.deepEqual(syncMapDiaryGroups(moved, null, { diary_date: "2026-09-22" }), [
    { key: "2026-09-20", total: 2 }
  ]);
});
