import assert from "node:assert/strict";
import test from "node:test";
import { prepareManagerReport, persistPreparedReport, registerManagerReportEvent, validateManagerReportParams, getOwnManagerReportArchive } from "./managerReportService.js";
import { hashToken } from "../utils/password.js";

const gerente = { id: 9, role: "gerente", full_name: "Gerencia de prueba" };
const now = new Date("2026-10-12T18:00:00Z");
const payload = { event: "pdf_generated", bytes: 1000, sha256: "a".repeat(64) };
const sample = { sections: [{ title: "Resumen", columns: ["Indicador", "Valor"], rows: [["Cuentas", 12]] }], notes: [], cutoff: null, period: { from: "2026-10-01", to: "2026-10-12" } };

test("los filtros respetan Honduras, calendario, tipos y alcance explícito", () => {
  assert.equal(validateManagerReportParams({ month: "2026-10" }, now).to, "2026-10-12");
  assert.equal(validateManagerReportParams({ month: "2024-02" }, now).to, "2024-02-29");
  for (const input of [{ type: "users" }, { type: ["executive"] }, { type: {} }, { month: "2026-11" }, { month: "2026-13" }, { type: "deliveries", barrio: "Otro" }, { type: "gps", barrio: "Otro" }, { actor_user_id: 1 }, { rows: [] }, { type: "__proto__" }]) assert.throws(() => validateManagerReportParams(input, now), (e) => e.status === 400);
});

test("solo administración y Gerencia preparan informes y no se aceptan filas del cliente", async () => {
  let calls = 0;
  const dependencies = { now, load: async () => { calls++; return sample; }, persist: async () => { calls++; } };
  for (const role of ["operator", "transport", "validadora_campo"]) {
    await assert.rejects(() => prepareManagerReport({}, { id: 1, role }, "token", dependencies), (e) => e.status === 403);
  }
  await assert.rejects(() => prepareManagerReport({ rows: [[999]] }, gerente, "token", dependencies), (e) => e.status === 400);
  assert.equal(calls, 0);
  const report = await prepareManagerReport({ type: "executive", month: "2026-10" }, gerente, "token", dependencies);
  assert.match(report.report_id, /^RPT-20261012-120000-[A-F0-9]{8}$/);
  assert.equal(report.sections[0].rows[0][1], 12);
});

test("no se entrega un informe si falla el registro de preparación", async () => {
  await assert.rejects(() => prepareManagerReport({}, gerente, "token", { now, load: async () => sample, persist: async () => { throw new Error("Auditoría no disponible"); } }), /Auditoría no disponible/);
});

test("archivo y preparación se escriben en una transacción y el HTML del padrón se escapa", async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push("begin"), commit: async () => calls.push("commit"), rollback: async () => calls.push("rollback"), release: () => calls.push("release"),
    query: async (sql, params) => { calls.push({ sql, params }); return sql.includes("FROM app_users") ? [[gerente]] : [{ insertId: 1 }]; }
  };
  const report = { ...sample, type: "portfolio", title: "Cartera", report_id: "RPT-20261012-120000-ABCDEF12", created_at: now.toISOString(), filters: { barrio: "<script>alert(1)</script>" } };
  await persistPreparedReport(report, gerente, "token", connection);
  assert.ok(calls.includes("commit"));
  const archive = calls.find((call) => call.sql?.includes("INSERT INTO report_archives"));
  assert.ok(archive.params[6].includes("&lt;script&gt;"));
  assert.ok(!archive.params[6].includes("<script>"));
  const mutations = calls.filter((call) => /^\s*(INSERT|UPDATE|DELETE)/.test(call.sql || ""));
  assert.equal(mutations.length, 2);
  assert.ok(mutations.every((call) => /INSERT INTO (report_archives|audit_logs)/.test(call.sql)));
  const audit = mutations.find((call) => call.sql.includes("INSERT INTO audit_logs"));
  const details = JSON.parse(audit.params[7]);
  assert.notEqual(details.session_binding, hashToken("token"), "la auditoría no expone el hash autenticador de la sesión");
  connection.query = async (sql) => { if (sql.includes("INSERT INTO audit_logs")) throw new Error("Error audit"); return sql.includes("FROM app_users") ? [[gerente]] : [{ insertId: 1 }]; };
  calls.length = 0;
  await assert.rejects(() => persistPreparedReport(report, gerente, "token", connection), /Error audit/);
  assert.ok(calls.includes("rollback"));
  assert.ok(!calls.includes("commit"));
});

test("la exportación exige preparación propia, sesión coincidente y autorización vigente", async () => {
  const id = "RPT-20261012-120000-ABCDEF12";
  const audits = [];
  const dependencies = { now, find: async () => ({ session_binding: hashToken("manager-report:token"), prepared_at: now.toISOString() }), audit: async (record) => audits.push(record) };
  assert.deepEqual(await registerManagerReportEvent(id, payload, gerente, "token", dependencies), { ok: true });
  assert.equal(audits[0].actorUserId, gerente.id);
  assert.equal(audits[0].details.client_declared, true);
  await assert.rejects(() => registerManagerReportEvent(id, payload, gerente, "otra-sesion", dependencies), (e) => e.status === 403);
  await assert.rejects(() => registerManagerReportEvent(id, payload, gerente, "token", { ...dependencies, find: async () => null }), (e) => e.status === 403);
  await assert.rejects(() => registerManagerReportEvent(id, payload, gerente, "token", { ...dependencies, now: new Date(now.getTime() + 31 * 60000) }), (e) => e.status === 403);
  await assert.rejects(() => registerManagerReportEvent(id, { ...payload, event: "cerrar_lote" }, gerente, "token", dependencies), (e) => e.status === 400);
  assert.equal(audits.length, 1);
});

test("otros perfiles no leen archivos de informes gerenciales", async () => {
  await assert.rejects(() => getOwnManagerReportArchive("RPT-20261012-120000-ABCDEF12", { role: "operator", id: 1 }), (e) => e.status === 403);
});

test("los archivos requieren propiedad y preparación del servidor, no basta el prefijo manager", async () => {
  const id = "RPT-20261012-120000-ABCDEF12";
  const archive = { actor_user_id: gerente.id, report_type: "manager.executive" };
  const dependencies = { get: async () => archive, find: async () => ({ filters: { type: "executive" } }) };
  assert.equal(await getOwnManagerReportArchive(id, gerente, dependencies), archive);
  await assert.rejects(() => getOwnManagerReportArchive(id, gerente, { ...dependencies, get: async () => ({ ...archive, actor_user_id: 100 }) }), (e) => e.status === 403);
  await assert.rejects(() => getOwnManagerReportArchive(id, gerente, { ...dependencies, find: async () => null }), (e) => e.status === 403);
});
