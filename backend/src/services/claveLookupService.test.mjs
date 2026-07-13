import assert from "node:assert/strict";
import test from "node:test";
import { getAguasServiceReport } from "./claveLookupService.js";

test("calcula deuda general y por servicio para cada barrio", async () => {
  const report = await getAguasServiceReport();
  assert.ok(report.summary.deuda.total > 0);
  assert.ok(report.summary.services.every((service) => Number.isFinite(service.deuda.total)));
  assert.ok(report.barrios.every((barrio) => Number.isFinite(barrio.deuda.total)));
  assert.ok(report.barrios.every((barrio) => barrio.servicios.every((service) => Number.isFinite(service.deuda.total))));
});
