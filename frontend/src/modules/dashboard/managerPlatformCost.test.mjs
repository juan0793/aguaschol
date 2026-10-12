import test from "node:test";
import assert from "node:assert/strict";
import { readCycle } from "./platformCost.js";

test("lee el ciclo de Railway: día, promedio diario y gasto contra calendario", () => {
  const cycle = readCycle({ period: { start: "2026-10-09T00:00:00Z", end: "2026-11-09T00:00:00Z", updatedAt: "2026-10-12T04:30:00Z" }, currentUsage: 2.36, estimatedUsage: 18.4 });
  assert.equal(cycle.cycleDays, 31);
  assert.equal(cycle.cycleDay, 4);
  assert.equal(cycle.dailyAverage.toFixed(2), "0.74");
  assert.equal(Math.round(cycle.spentShare * 100), 13);
  assert.equal(Math.round(cycle.elapsedShare * 100), 10);
});

test("sin estimado no inventa proporción", () => {
  const cycle = readCycle({ period: { start: "2026-10-09T00:00:00Z", end: "2026-11-09T00:00:00Z", updatedAt: "2026-10-09T00:00:00Z" }, currentUsage: 0, estimatedUsage: 0 });
  assert.equal(cycle.spentShare, 0);
  assert.equal(cycle.cycleDay, 0);
});
