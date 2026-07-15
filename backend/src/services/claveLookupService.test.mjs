import assert from "node:assert/strict";
import test from "node:test";
import { getAguasServiceReport, searchClaveCatastral } from "./claveLookupService.js";

test("calcula deuda general y por servicio para cada barrio", async () => {
  const report = await getAguasServiceReport();
  assert.ok(report.summary.deuda.total > 0);
  assert.ok(report.summary.services.every((service) => Number.isFinite(service.deuda.total)));
  assert.ok(report.barrios.every((barrio) => Number.isFinite(barrio.deuda.total)));
  assert.equal(report.summary.deuda.criticos, report.barrios.reduce((total, barrio) => total + barrio.deuda.criticos, 0));
  assert.ok(report.barrios.every((barrio) => barrio.servicios.every((service) => Number.isFinite(service.deuda.total))));
});

test("busca el numero de abonado de forma exacta", async () => {
  const result = await searchClaveCatastral("1223", { field: "abonado" });
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.every((record) => String(record.abonado) === "1223"));
});
