import assert from "node:assert/strict";
import { buildFieldZoneGroups, getFieldPointClave, getFieldPointDate, summarizeFieldPoints } from "./fieldControlUtils.js";

const barrios = [{ codigo: "24", barrio: "La Libertad", activo: true }];
const points = [
  { id: 1, diary_date: "2026-08-13", reference_note: "Clave 24-04-20", created_by_name: "Ana" },
  { id: 2, created_at: "2026-08-12T10:00:00Z", description: "24-05-10", created_by_name: "Ana" }
];
assert.equal(getFieldPointDate(points[1]), "2026-08-12");
assert.equal(getFieldPointClave(points[0]), "24-04-20");
assert.equal(buildFieldZoneGroups(points, barrios)[0].zone, "24 - La Libertad");
assert.deepEqual(summarizeFieldPoints(points, barrios), { points: 2, zones: 1, keys: 2, technicians: 1 });
