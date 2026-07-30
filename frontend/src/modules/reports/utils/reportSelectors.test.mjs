import assert from "node:assert/strict";
import { buildPadronNameIndex, filterReportDays, filterReportPoints, paginate } from "./reportSelectors.js";

assert.deepEqual(filterReportDays([{ key: "2026-06-08", total: 2 }, { key: "2025-06-08", total: 0 }], { year: "2026", withPoints: true }).map(({ key }) => key), ["2026-06-08"]);
assert.equal(filterReportPoints([{ report_zone: "Centro", report_key: "10-20", latitude: 1, longitude: 2 }], { query: "10-20", status: "ready" }).length, 1);
assert.deepEqual(paginate([1, 2, 3], 2, 2), { items: [3], page: 2, totalPages: 2, total: 3 });
const names = buildPadronNameIndex([{ key: "clave:14-28-01", matches: [{ clave_catastral: "14-28-01", abonado: "4592", nombre: "HONDU PRENDAS" }] }]);
assert.equal(names.get("clave:14-28-01"), "HONDU PRENDAS");
assert.equal(names.get("abonado:4592"), "HONDU PRENDAS");
