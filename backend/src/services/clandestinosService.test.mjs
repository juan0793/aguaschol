import test from "node:test";
import assert from "node:assert/strict";
import { changeReportState, createTechnicalReport, getClandestinosConfig, listClandestinosFichas, listTechnicalReports, summarizePadronComparison } from "./clandestinosService.js";

const technician = { id: 7, role: "validadora_campo", full_name: "Técnica de campo" };
const reviewer = { id: 8, role: "operator", full_name: "Revisor" };

test("los permisos separan campo, revisión y administración", () => {
  const field = getClandestinosConfig(technician).permissions;
  const review = getClandestinosConfig(reviewer).permissions;
  assert.equal(field.can_create_report, true);
  assert.equal(field.can_review_report, false);
  assert.equal(review.can_review_report, true);
  assert.equal(review.can_confirm_or_regularize, false);
});

test("enviar un reporte no modifica el padrón maestro", async () => {
  const before = await listClandestinosFichas({ limit: 100 });
  const report = await createTechnicalReport({ inmueble_sin_registro: true, hallazgo: "Conexión observada en campo", barrio_colonia: "Barrio prueba" }, technician);
  const after = await listClandestinosFichas({ limit: 100 });
  assert.equal(report.estado, "review");
  assert.equal(after.total, before.total);
  assert.equal((await listTechnicalReports()).some((item) => item.id === report.id), true);
});

test("un técnico no puede aprobar reportes", async () => {
  const [report] = await listTechnicalReports();
  await assert.rejects(() => changeReportState(report.id, { state: "approved" }, technician), (error) => error.status === 403);
});

test("el backend rechaza saltos de estado fuera del flujo", async () => {
  const [report] = await listTechnicalReports();
  await assert.rejects(() => changeReportState(report.id, { state: "linked" }, reviewer), (error) => error.status === 409);
});

test("resume una comparacion masiva de padrones", () => {
  const summary = summarizePadronComparison([
    { appears_in_aguas: true, appears_in_alcaldia: true },
    { appears_in_aguas: false, appears_in_alcaldia: true },
    { appears_in_aguas: false, appears_in_alcaldia: false }
  ]);
  assert.deepEqual(summary, { total: 3, both: 1, alcaldia_only: 1, aguas_only: 0, neither: 1 });
});
