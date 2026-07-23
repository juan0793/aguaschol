import assert from "node:assert/strict";
import test from "node:test";
import {
  activateMasterRecordsInMemory,
  getAguasServiceReport,
  getMasterRecordsForImport,
  normalizeLookupKey,
  searchClaveCatastral
} from "./claveLookupService.js";

test("acepta claves catastrales historicas con bloques de tres digitos", () => {
  assert.equal(normalizeLookupKey("22-37-116-03"), "22-37-116-03");
  assert.throws(() => normalizeLookupKey("110"));
});

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

test("una importacion actualiza inmediatamente las consultas en memoria", async () => {
  const previous = getMasterRecordsForImport();
  try {
    activateMasterRecordsInMemory([{ clave_catastral: "99-99-99-99", abonado: "990001", nombre: "PRUEBA R2" }], { codigoLote: "TEST" });
    const result = await searchClaveCatastral("990001", { field: "abonado" });
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].clave_catastral, "99-99-99-99");
  } finally {
    activateMasterRecordsInMemory(previous, { codigoLote: "RESTORE-TEST" });
  }
});
