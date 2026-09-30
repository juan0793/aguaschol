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

test("resume agua potable y aguas residuales dentro del filtro actual", async () => {
  const result = await listClandestinosFichas({ limit: 100 });
  const services = result.service_stats;
  assert.equal(services.total, result.total);
  assert.equal(services.ambos + services.solo_agua + services.solo_aguas_residuales + services.ninguno, services.total);
  assert.equal(services.agua_potable >= services.ambos, true);
  assert.equal(services.aguas_residuales >= services.ambos, true);
});

test("ritmo: el día se cuenta en hora de Honduras, no en UTC", async () => {
  const { fechaHonduras, lunesDe } = await import("./clandestinosService.js");
  assert.equal(fechaHonduras("2026-10-01T03:00:00Z"), "2026-09-30"); // 9:00 p. m. del 30 en Choluteca
  assert.equal(fechaHonduras("2026-10-01T06:00:00Z"), "2026-10-01");
  assert.equal(lunesDe("2026-09-30"), "2026-09-28");
  assert.equal(lunesDe("2026-09-28"), "2026-09-28");
  assert.equal(lunesDe("2026-10-04"), "2026-09-28");
});

test("ritmo: serie con ceros, totales de hoy/semana/mes/año y barrios", async () => {
  const { resumirRitmo } = await import("./clandestinosService.js");
  const ahora = new Date("2026-09-30T20:00:00Z"); // 2:00 p. m. del 30 en Honduras
  const filas = [
    { created_at: "2026-09-30T15:00:00Z", estado: "pending", barrio: "Barrio El Estruendo" },
    { created_at: "2026-10-01T02:00:00Z", estado: "pending", barrio: "Barrio El Estruendo" }, // 8 p. m. del 30
    { created_at: "2026-09-28T15:00:00Z", estado: "regularized", barrio: "Barrio El Centro" },
    { created_at: "2026-09-02T15:00:00Z", estado: "pending", barrio: "" },
    { created_at: "2025-12-10T15:00:00Z", estado: "discarded", barrio: "Barrio El Centro" }
  ];
  const dia = resumirRitmo(filas, "dia", ahora);
  assert.equal(dia.serie.length, 30);
  assert.equal(dia.serie.at(-1).periodo, "2026-09-30");
  assert.equal(dia.serie.at(-1).total, 2);
  assert.deepEqual(dia.serie.at(-1).etapas, { pending: 2 });
  assert.deepEqual(dia.totales, { hoy: 2, semana: 3, mes: 4, anio: 4, total: 5 });
  // Empate a 2: van por nombre.
  assert.deepEqual(dia.barrios.slice(0, 2), [{ barrio: "Barrio El Centro", total: 2 }, { barrio: "Barrio El Estruendo", total: 2 }]);
  assert.ok(dia.barrios.some((item) => item.barrio === "Sin barrio"));
  const semana = resumirRitmo(filas, "semana", ahora);
  assert.equal(semana.serie.length, 16);
  assert.deepEqual([semana.serie.at(-1).periodo, semana.serie.at(-1).total], ["2026-09-28", 3]);
  const mes = resumirRitmo(filas, "mes", ahora);
  assert.deepEqual([mes.serie.length, mes.serie.at(-1).periodo, mes.serie.at(-1).total], [12, "2026-09", 4]);
  const anio = resumirRitmo(filas, "anio", ahora);
  assert.deepEqual(anio.serie.map((punto) => [punto.periodo, punto.total]), [["2025", 1], ["2026", 4]]);
  assert.equal(resumirRitmo([], "otra", ahora).granularidad, "dia");
});
