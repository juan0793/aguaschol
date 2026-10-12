import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { applyRolePreview, changeRolePreview, PREVIEW_ROLES } from "./rolePreviewService.js";
import { getSessionUser } from "./authService.js";
import { hashToken } from "../utils/password.js";
import { registerSessionSocket, closeSessionSockets } from "../utils/sessionSockets.js";
import { requireRolePreviewAccess } from "../middleware/rolePreviewAccess.js";
import { requireManagerAccess } from "../middleware/managerAccess.js";
import { assertOperationalWrite } from "../utils/permissions.js";

const source = { id: 7, user_id: 1, full_name: "QA", role: "admin", is_active: 1, preview_role: null };
function database(row = source, auditFailure = false) {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push(["begin"]), commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]), release: () => calls.push(["release"]),
    query: async (sql, params) => {
      calls.push([sql, params]);
      if (sql.includes("FOR UPDATE")) return [[row].filter(Boolean)];
      if (sql.includes("SELECT id, full_name")) return [[row].filter(Boolean)];
      if (sql.includes("INSERT INTO audit_logs") && auditFailure) throw new Error("audit failed");
      return [{ insertId: 1 }];
    }
  };
  return { calls, getConnection: async () => connection };
}
function request(role, method, baseUrl, path, expired = false) {
  let code = 200, allowed = false;
  const req = { method, baseUrl, path, authUser: { role, preview: { expired } } };
  const res = { setHeader() {}, status(value) { code = value; return this; }, json() {} };
  requireRolePreviewAccess(req, res, () => requireManagerAccess(req, res, () => { allowed = true; }));
  return { code, allowed };
}
test("perfiles efectivos preservan la identidad administrativa y vencen sin recuperar permisos", () => {
  for (const role of PREVIEW_ROLES) {
    const user = applyRolePreview({ ...source, preview_role: role, preview_expires_at: "2026-10-12T18:00:00Z" }, Date.parse("2026-10-12T17:50:00Z"));
    assert.equal(user.id, source.id); assert.equal(user.role, role); assert.equal(user.preview.original_role, "admin");
    assert.equal(user.preview.expired, false);
    assert.throws(() => assertOperationalWrite(user), (e) => e.status === 403);
    assert.equal(applyRolePreview({ ...source, preview_role: role, preview_expires_at: "2026-10-12T18:00:00Z" }, Date.parse("2026-10-12T18:00:00Z")).preview.expired, true);
  }
  assert.equal(applyRolePreview({ ...source, role: "operator", preview_role: "gerente" }), null);
  assert.equal(applyRolePreview({ ...source, preview_role: "admin" }), null);
  assert.equal(applyRolePreview({ ...source, preview_role: "gerente", preview_expires_at: "invalid" }).preview.expired, true);
  assert.equal(source.role, "admin");
});
test("el vencimiento usa el instante absoluto de MySQL aunque Node tenga otra zona horaria", async () => {
  const now = Date.parse("2026-10-12T18:00:00Z");
  const epoch = Date.parse("2026-10-12T18:10:00Z") / 1000;
  // Node leyó el TIMESTAMP 6 h atrás (MySQL en UTC, Node en America/Tegucigalpa): por reloj local ya venció.
  const behind = applyRolePreview({ ...source, preview_role: "gerente", preview_expires_at: "2026-10-12T12:10:00Z", preview_expires_epoch: epoch }, now);
  assert.equal(behind.preview.expired, false);
  assert.equal(behind.preview.expires_at, "2026-10-12T18:10:00.000Z");
  // Al revés: por reloj local faltan 6 h, pero el instante real ya pasó.
  const ahead = applyRolePreview({ ...source, preview_role: "gerente", preview_expires_at: "2026-10-13T00:00:00Z", preview_expires_epoch: now / 1000 - 1 }, now);
  assert.equal(ahead.preview.expired, true);
  assert.equal(applyRolePreview({ ...source, preview_role: "gerente", preview_expires_at: "2026-10-12T18:10:00Z", preview_expires_epoch: now / 1000 }, now).preview.expired, true);
  assert.equal(applyRolePreview({ ...source, preview_role: "gerente", preview_expires_at: null, preview_expires_epoch: null }, now).preview.expired, true);
  // El frontend recarga si expires_at cambia: consultas en momentos distintos deben dar el mismo valor.
  const later = applyRolePreview({ ...source, preview_role: "gerente", preview_expires_at: "2026-10-12T12:10:00Z", preview_expires_epoch: String(epoch) }, now + 61_234);
  assert.equal(later.preview.expires_at, behind.preview.expires_at);
  const calls = [];
  const executor = { query: async (sql) => { calls.push(sql); return [[{ ...source, preview_role: "operator", preview_expires_at: "2026-10-12T12:10:00Z", preview_expires_epoch: String(Date.now() / 1000 + 600) }]]; } };
  const user = await getSessionUser("QA-token", executor);
  assert.match(calls[0], /UNIX_TIMESTAMP\(auth_sessions\.preview_expires_at\) AS preview_expires_epoch/);
  assert.equal(user.role, "operator");
  assert.equal(user.preview.expired, false);
  assert.equal("preview_expires_epoch" in user, false);
});
test("solo hash del bearer autoriza: ni hash robado ni token heredado se buscan directamente", async () => {
  const token = "QA-token"; const calls = [];
  const executor = { query: async (sql, args) => { calls.push([sql, args]); return [args[0] === hashToken(token) ? [source] : []]; } };
  assert.equal((await getSessionUser(token, executor)).role, "admin");
  assert.equal(await getSessionUser(hashToken(token), executor), null);
  assert.deepEqual(calls[0][1], [hashToken(token)]);
  assert.doesNotMatch(calls[0][0], /token IN/);
  assert.equal(await getSessionUser("", executor), null);
});
test("entrada y salida solo actualizan la sesión y auditan en la misma transacción", async () => {
  for (const role of [...PREVIEW_ROLES, null]) {
    const db = database(); await changeRolePreview("QA", role, db);
    const updates = db.calls.filter(([sql]) => sql.startsWith("UPDATE"));
    assert.equal(updates.length, 1); assert.match(updates[0][0], /^UPDATE auth_sessions/);
    assert.deepEqual(updates[0][1], [role, 7]);
    assert.ok(db.calls.some(([sql]) => sql.includes("INSERT INTO audit_logs")));
    assert.ok(db.calls.some(([sql]) => sql === "commit"));
    assert.equal(db.calls.at(-1)[0], "release");
  }
});
test("rechaza roles, escalamiento, cambio anidado, cambio obligatorio y falla de auditoría", async () => {
  for (const role of ["admin", "root", {}, ["gerente"], undefined]) await assert.rejects(() => changeRolePreview("QA", role, database()), (e) => e.status === 400);
  for (const row of [null, { ...source, role: "operator" }, { ...source, preview_role: "operator" }, { ...source, force_password_change: 1 }]) {
    const db = database(row); await assert.rejects(() => changeRolePreview("QA", "gerente", db), (e) => e.status === 403);
    assert.ok(db.calls.some(([sql]) => sql === "rollback"));
    assert.ok(!db.calls.some(([sql]) => sql.startsWith("UPDATE")));
  }
  const db = database(source, true);
  await assert.rejects(() => changeRolePreview("QA", "gerente", db), /audit failed/);
  assert.ok(!db.calls.some(([sql]) => sql === "commit"));
  assert.ok(db.calls.some(([sql]) => sql === "rollback"));
});
test("todos los perfiles bloquean escritura, rutas nuevas, perfil y administración; salida vencida funciona", () => {
  for (const role of PREVIEW_ROLES) {
    for (const [method, base, path] of [["POST", "/api/inmuebles", "/"], ["PATCH", "/api/inspecciones", "/1/estado"], ["DELETE", "/api/map-points", "/1"], ["GET", "/api/admin", "/users"], ["GET", "/api/profile", "/"], ["GET", "/api/new", "/"], ["POST", "/api/auth", "/change-password"], ["POST", "/api/auth", "/preview"]]) assert.equal(request(role, method, base, path).code, 403);
    assert.equal(request(role, "GET", "/api/auth", "/me", true).allowed, true);
    assert.equal(request(role, "DELETE", "/api/auth", "/preview", true).allowed, true);
    assert.equal(request(role, "GET", "/api/inspecciones", "/config", true).code, 403);
    assert.equal(request(role, "GET", "/api/inspecciones", "/config").allowed, true);
  }
  assert.equal(request("gerente", "POST", "/api/reports", "/manager").allowed, true);
  assert.equal(request("operator", "POST", "/api/reports", "/manager").code, 403);
});
test("cambio de modo cierra sockets de esa sesión sin afectar otra", () => {
  const socket = new EventEmitter(); socket.close = () => { socket.emit("close"); };
  const other = new EventEmitter(); other.close = () => { throw new Error("other closed"); };
  registerSessionSocket("QA", socket); registerSessionSocket("other", other);
  closeSessionSockets("QA"); assert.equal(socket.authRevoked, true); assert.equal(other.authRevoked, undefined);
  other.emit("close");
});
