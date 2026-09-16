import assert from "node:assert/strict";
import { buildSidebarSections, getPathForWorkspaceView, getWorkspaceViewFromPath } from "./sidebarConfig.js";

const items = [
  { key: "records", label: "Registros" },
  { key: "requests", label: "Informes" },
  { key: "mapReports", label: "Reportes" },
  { key: "map", label: "Mapa" },
  { key: "users", label: "Usuarios" },
  { key: "notes", label: "Notas" }
];
const sections = buildSidebarSections(items, { key: "dashboard", label: "Tablero" });
const flattened = sections.flatMap((section) => section.items);

assert.deepEqual(sections.map((section) => section.key), ["dashboard", "operacion", "gestion", "territorio"]);
assert.deepEqual(flattened.map((item) => item.key), ["dashboard", "records", "requests", "users", "notes", "map", "mapReports"]);
assert.equal(flattened.find((item) => item.key === "records").label, "Fichas clandestinas");
assert.equal(flattened.find((item) => item.key === "notes").label, "Apuntes");
assert.equal(new Set(flattened.map((item) => item.key)).size, flattened.length);
assert.equal(getWorkspaceViewFromPath("/usuarios"), "users");
assert.equal(getWorkspaceViewFromPath("/USUARIOS/"), "users");
assert.equal(getWorkspaceViewFromPath("/desconocido"), null);
assert.equal(getPathForWorkspaceView("dashboard"), "/dashboard");
assert.equal(getPathForWorkspaceView("records"), "/clandestinos");
assert.equal(getPathForWorkspaceView("executiveReport"), "/");
for (const view of ["dashboard", "profile", "inspecciones", "users", "notes", "records"]) {
  assert.equal(getWorkspaceViewFromPath(getPathForWorkspaceView(view)), view);
}
