import assert from "node:assert/strict";
import test from "node:test";
import { getRailwaySummary, resetRailwaySummaryCache } from "./railwayUsageService.js";

const usage = { period: { start: "2026-10-09T00:00:00Z", end: "2026-11-09T00:00:00Z", updatedAt: "2026-10-12T18:00:00Z" }, currentUsage: 2.36, estimatedUsage: 18.4, serviceUsage: [{ service: "backend" }], peaks: {} };

test("el resumen de Gerencia solo trae costo y ciclo, y se guarda 5 minutos", async () => {
  resetRailwaySummaryCache();
  let calls = 0;
  const load = async () => { calls += 1; return usage; };
  const first = await getRailwaySummary(load, 0);
  assert.deepEqual(Object.keys(first).sort(), ["currentUsage", "estimatedUsage", "period"]);
  assert.equal(first.currentUsage, 2.36);
  await getRailwaySummary(load, 4 * 60 * 1000);
  assert.equal(calls, 1);
  await getRailwaySummary(load, 5 * 60 * 1000 + 1);
  assert.equal(calls, 2);
});

test("un error de Railway no queda guardado", async () => {
  resetRailwaySummaryCache();
  await assert.rejects(getRailwaySummary(async () => { throw Object.assign(new Error("Railway caído"), { status: 502 }); }, 0), /Railway caído/);
  assert.equal((await getRailwaySummary(async () => usage, 1000)).estimatedUsage, 18.4);
});
