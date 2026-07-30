import assert from "node:assert/strict";
import { buildSidebarSections } from "./sidebarConfig.js";

const items = [
  { key: "records", label: "Registros" },
  { key: "mapReports", label: "Reportes" },
  { key: "map", label: "Mapa" },
  { key: "users", label: "Usuarios" }
];
const sections = buildSidebarSections(items, { key: "dashboard", label: "Tablero" });
const flattened = sections.flatMap((section) => section.items);

assert.deepEqual(flattened.map((item) => item.key), ["dashboard", "records", "mapReports", "map", "users"]);
assert.equal(flattened.find((item) => item.key === "records").label, "Fichas clandestinas");
assert.equal(new Set(flattened.map((item) => item.key)).size, flattened.length);
