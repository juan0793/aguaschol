import assert from "node:assert/strict";
import { buildFieldZoneGroups, getFieldPointClave, getFieldPointDate, getFieldPointZone, mergeFieldBarrioCatalog, summarizeFieldPoints } from "./fieldControlUtils.js";

const barrios = [{ codigo: "24", barrio: "La Libertad", activo: true }];
const points = [
  { id: 1, diary_date: "2026-08-13", reference_note: "Clave 24-04-20", created_by_name: "Ana" },
  { id: 2, created_at: "2026-08-12T10:00:00Z", description: "24-05-10", created_by_name: "Ana" }
];
assert.equal(getFieldPointDate(points[1]), "2026-08-12");
assert.equal(getFieldPointClave(points[0]), "24-04-20");
assert.equal(buildFieldZoneGroups(points, barrios)[0].zone, "24 - La Libertad");
assert.deepEqual(summarizeFieldPoints(points, barrios), { points: 2, zones: 1, keys: 2, technicians: 1 });

const officialCatalog = mergeFieldBarrioCatalog(
  [{ codigo: "05", barrio: "Barrio Campo Sol" }],
  [{ codigo_barrio: "05", nombre_barrio: "CAMPO SOL" }]
);
assert.deepEqual(officialCatalog, [{ codigo: "05", barrio: "CAMPO SOL", activo: true }]);
assert.equal(getFieldPointZone({ suggested_zone: "Barrio Campo Sol" }, officialCatalog), "05 - CAMPO SOL");
assert.equal(getFieldPointZone({ report_zone_label: "5 - Campo Sol | Clave 05-01-02" }, officialCatalog), "05 - CAMPO SOL");
