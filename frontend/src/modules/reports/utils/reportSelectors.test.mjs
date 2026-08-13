import assert from "node:assert/strict";
import { buildPadronNameIndex, buildReportDebtRows, buildSharedCadastralKeys, filterReportDays, filterReportPoints, paginate, selectReportZones, stripServicesFromDescription } from "./reportSelectors.js";

assert.deepEqual(filterReportDays([{ key: "2026-06-08", total: 2 }, { key: "2025-06-08", total: 0 }], { year: "2026", withPoints: true }).map(({ key }) => key), ["2026-06-08"]);
assert.equal(filterReportPoints([{ report_zone: "Centro", report_key: "10-20", latitude: 1, longitude: 2 }], { query: "10-20", status: "ready" }).length, 1);
assert.deepEqual(paginate([1, 2, 3], 2, 2), { items: [3], page: 2, totalPages: 2, total: 3 });
assert.deepEqual(selectReportZones({ zones: [
  { overrideKey: "centro", items: [{ point_type: "caja" }] },
  { overrideKey: "sur", items: [{ point_type: "negocio" }, { point_type: "negocio" }] }
] }, ["sur"], (value) => value.toUpperCase()), {
  zones: [{ overrideKey: "sur", items: [{ point_type: "negocio" }, { point_type: "negocio" }] }],
  totalZones: 1,
  totalPoints: 2,
  totalsByType: { NEGOCIO: 2 }
});
const names = buildPadronNameIndex([{ key: "clave:14-28-01", matches: [{ clave_catastral: "14-28-01", abonado: "4592", nombre: "HONDU PRENDAS" }] }]);
assert.equal(names.get("clave:14-28-01"), "HONDU PRENDAS");
assert.equal(names.get("abonado:4592"), "HONDU PRENDAS");
assert.deepEqual(buildSharedCadastralKeys([{ matches: [
  { clave_catastral: "14-28-01-01", clave_base: "14-28-01", abonado: "4592", nombre: "LOCAL A" },
  { clave_catastral: "14-28-01-02", clave_base: "14-28-01", abonado: "4468", nombre: "LOCAL B" },
  { clave_catastral: "14-28-02", abonado: "5000", nombre: "LOCAL C" }
] }]), [{ clave: "14-28-01", abonados: ["4592", "4468"], nombres: ["LOCAL A", "LOCAL B"], total: 2 }]);
assert.deepEqual(buildReportDebtRows([{ matches: [
  { clave_base: "14-28-01", abonado: "4592", nombre: "LOCAL A", total: 120.5 },
  { clave_base: "14-28-01", abonado: "4468", nombre: "LOCAL B", total: 80 },
  { clave_base: "14-28-01", abonado: "4592", nombre: "LOCAL A", total: 120.5 }
] }]), [
  { clave: "14-28-01", abonado: "4592", nombre: "LOCAL A", total: 120.5 },
  { clave: "14-28-01", abonado: "4468", nombre: "LOCAL B", total: 80 }
]);
assert.equal(stripServicesFromDescription("Local abierto. Servicios: Agua: Sí | Alcant.: No | Barrido: Sí | Desechos: Sí | Peligrosos: No Buena atención."), "Local abierto. Buena atención.");
