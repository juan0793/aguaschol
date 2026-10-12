import assert from "node:assert/strict";
import test from "node:test";
import { managerMonthRange, buildManagerDashboardModel } from "./managerDashboardSelectors.js";
import { canOpenWorkspace, MANAGER_NAVIGATION } from "../../utils/roleAccess.js";

test("el mes actual termina hoy y los meses anteriores respetan calendario y años bisiestos", () => {
  assert.deepEqual(managerMonthRange("2026-10", "2026-10-12"), { from: "2026-10-01", to: "2026-10-12" });
  assert.equal(managerMonthRange("2024-02", "2026-10-12").to, "2024-02-29");
  assert.equal(managerMonthRange("2025-02", "2026-10-12").to, "2025-02-28");
  for (const month of ["2026-11", "2026-13", "", "2026-1", "0000-01"]) assert.throws(() => managerMonthRange(month, "2026-10-12"));
});

const fixture = () => ({
  padron: { summary: { deuda: { total: 500 }, total_records: 20, total_barrios: 2 }, barrios: [] }, meta: { updated_at: "2026-10-10" },
  inspections: { creadas_mes: 3, finalizadas_mes: 1, seguimiento: 2, carga_tecnicos: [] },
  deliveries: { entregadas: 12, pendientes: 3, vencidas: 1, lotes_abiertos: 2, por_dia: [] },
  fichas: { total: 73, items: [{ id: 1 }] }, gps: { groups: [{ total: 9 }, { total: 4 }] },
  activity: { items: [{ id: 1, summary: "Inspección finalizada", actor_name: "Técnico" }] }
});

test("los indicadores usan totales del servidor y jornadas, sin contar la página visible", () => {
  const model = buildManagerDashboardModel(fixture(), () => {});
  assert.equal(model.metrics.find((item) => item.key === "records").value, 73);
  assert.equal(model.metrics.find((item) => item.key === "gps").value, 13);
  assert.equal(model.debtSummary.total, 500);
  assert.equal(model.attention.find((item) => item.key === "delivery-expired").count, 1);
  assert.equal(model.canExport, false);
  assert.ok(model.quickActions.every(([view]) => canOpenWorkspace("gerente", view)));
});

test("un indicador ausente se informa como error, nunca como un cero inventado", () => {
  const data = fixture();
  delete data.deliveries.pendientes;
  assert.throws(() => buildManagerDashboardModel(data, () => {}), /indicador válido/);
});

test("Gerencia no puede navegar a administración, importación, edición GPS ni perfil de mensajes", () => {
  assert.ok(canOpenWorkspace("gerente", "dashboard"));
  for (const item of MANAGER_NAVIGATION) assert.ok(canOpenWorkspace("gerente", item.key));
  for (const view of ["users", "railwayUsage", "notes", "importacion", "padron", "map", "profile", "logs", "unknown"]) assert.equal(canOpenWorkspace("gerente", view), false);
  assert.equal(canOpenWorkspace("admin", "users"), true);
  assert.equal(canOpenWorkspace("operator", "map"), true);
});
