// Fase 7: "Probar como otro rol" contra MySQL/MariaDB real, por HTTP y WebSocket.
// Base exclusiva de pruebas; nunca conecta a la base configurada en .env.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import WebSocket from "ws";

const database = `aguaschol_preview_test_${process.pid}`;
const password = process.env.ENTREGAS_TEST_PASSWORD || "entregas-local-qa";
Object.assign(process.env, {
  DB_HOST: "127.0.0.1", DB_PORT: process.env.ENTREGAS_TEST_PORT || "3317", DB_USER: "root",
  DB_PASSWORD: password, DB_NAME: database, USE_MEMORY_DB: "false", DB_AUTO_START: "false",
  AUTH_USERNAME: "admin", AUTH_PASSWORD: "preview-local-qa", TELEGRAM_BOT_TOKEN: ""
});
const server = { host: "127.0.0.1", port: Number(process.env.DB_PORT), user: "root", password };

// MySQL en otra zona horaria que Node (como Railway en UTC y la API en America/Tegucigalpa).
const nodeOffset = -new Date().getTimezoneOffset();
const mysqlZone = nodeOffset === 0 ? "-06:00" : "+00:00";
const root = await mysql.createConnection(server);
const [[{ zone: originalZone }]] = await root.query("SELECT @@global.time_zone AS zone");
await root.query("SET GLOBAL time_zone = ?", [mysqlZone]);

const db = await import("../config/db.js");
const { default: app } = await import("../app.js");
const { hashPassword, hashToken } = await import("../utils/password.js");
const { PREVIEW_ROLES } = await import("./rolePreviewService.js");
const { initializeProfileRealtime } = await import("./profileRealtimeService.js");
const { initializeTransportRealtime } = await import("./transportRealtimeService.js");

const READS = ["/api/entregas/config", "/api/entregas/lotes", "/api/inspecciones/config", "/api/clandestinos/config",
  "/api/transport", "/api/admin/team-activity", "/api/gis/config"];

test("MySQL real: perfiles de prueba, permisos, vencimiento, concurrencia, auditoría y sockets", async () => {
  let pool, httpServer, realtime;
  const sockets = [];
  try {
    await db.ensureDatabaseReady();
    pool = db.getPool();
    const [[{ zone }]] = await pool.query("SELECT @@session.time_zone AS zone");
    assert.equal(zone, mysqlZone);

    // La migración manual de la Fase 6 se aplica sobre una tabla sin las columnas nuevas.
    await pool.query("ALTER TABLE auth_sessions DROP COLUMN preview_role, DROP COLUMN preview_expires_at");
    const migration = await fs.readFile(new URL("../../sql/migrations/20261012_role_preview_sessions.sql", import.meta.url), "utf8");
    await pool.query(migration.replace(/^--.*$/gm, ""));
    const [columns] = await pool.query("SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'auth_sessions' AND COLUMN_NAME LIKE 'preview%' ORDER BY COLUMN_NAME", [database]);
    assert.deepEqual(columns.map((c) => `${c.name}:${c.type}`), ["preview_expires_at:timestamp", "preview_role:varchar"]);

    const hash = await hashPassword("perfil-local-qa");
    const accounts = { admin2: "admin", admin3: "admin", gerente_qa: "gerente", operator_qa: "operator", validadora_qa: "validadora_campo", transport_qa: "transport" };
    for (const [username, role] of Object.entries(accounts)) {
      await pool.query("INSERT INTO app_users (username, full_name, email, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 1)",
        [username, `QA ${username}`, `${username}@example.test`, role, hash]);
    }
    await pool.query("UPDATE app_users SET force_password_change = 0");

    httpServer = http.createServer(app);
    realtime = { "/ws/profile": initializeProfileRealtime({ server: httpServer }), "/ws/transport": initializeTransportRealtime({ server: httpServer }) };
    httpServer.on("upgrade", (request, socket, head) => {
      const wss = realtime[new URL(request.url, "http://localhost").pathname];
      if (!wss) return socket.destroy();
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    });
    await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${httpServer.address().port}`;

    const api = async (method, path, token, body) => {
      const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json().catch(() => null), headers: response.headers };
    };
    const login = async (username, pass = "perfil-local-qa") => {
      const { status, data } = await api("POST", "/api/auth/login", null, { username, password: pass });
      assert.equal(status, 200, `login ${username}`);
      return data.token;
    };
    const connect = (path, token) => new Promise((resolve) => {
      const state = { messages: [], closed: null };
      state.socket = new WebSocket(`${base.replace("http", "ws")}${path}?token=${encodeURIComponent(token)}`);
      sockets.push(state.socket);
      state.done = new Promise((done) => state.socket.on("close", (code, reason) => { state.closed = { code, reason: String(reason) }; done(state.closed); resolve(state); }));
      state.socket.on("message", (raw) => { state.messages.push(JSON.parse(raw)); resolve(state); });
      state.socket.on("error", () => {});
    });
    const audits = async (token, action) => {
      const [[{ id }]] = await pool.query("SELECT id FROM auth_sessions WHERE token = ?", [hashToken(token)]);
      const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM audit_logs WHERE action = ? AND entity_type = 'session' AND entity_id = ?", [action, String(id)]);
      return total;
    };

    // Cuentas reales de cada perfil: ninguna puede iniciar el modo de prueba.
    const real = {};
    for (const [username, role] of Object.entries(accounts).filter(([, role]) => role !== "admin")) {
      real[role] = await login(username);
      assert.equal((await api("GET", "/api/auth/me", real[role])).data.user.role, role);
      assert.equal((await api("POST", "/api/auth/preview", real[role], { role: "operator" })).status, 403, `${role} no inicia prueba`);
    }

    // Administrador con dos sesiones independientes; solo la sesión A cambia de perfil.
    const adminA = await login("admin", "preview-local-qa");
    const adminB = await login("admin", "preview-local-qa");
    for (const role of PREVIEW_ROLES) {
      const before = Date.now();
      const started = await api("POST", "/api/auth/preview", adminA, { role });
      assert.equal(started.status, 200, `inicia ${role}`);
      assert.equal(started.headers.get("clear-site-data"), '"cache"');
      const me = (await api("GET", "/api/auth/me", adminA)).data.user;
      assert.equal(me.role, role);
      assert.equal(me.preview.expired, false, `${role} no vence al iniciar aunque MySQL use ${mysqlZone}`);
      const minutes = (Date.parse(me.preview.expires_at) - before) / 60000;
      assert.ok(minutes > 14.5 && minutes < 15.5, `${role} vence en 15 minutos (fueron ${minutes.toFixed(2)})`);
      // El frontend recarga cuando cambia expires_at: debe ser idéntico entre consultas.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      assert.equal((await api("GET", "/api/auth/me", adminA)).data.user.preview.expires_at, me.preview.expires_at, `${role} expires_at estable`);
      assert.equal((await api("GET", "/api/auth/me", adminB)).data.user.role, "admin");

      // Lecturas: la prueba nunca permite lo que la cuenta real del perfil no puede leer.
      let allowed = 0;
      for (const path of READS) {
        const [preview, account] = [await api("GET", path, adminA), await api("GET", path, real[role])];
        assert.equal(preview.headers.get("cache-control"), "private, no-store", `${role} ${path} sin caché`);
        if (preview.status === 200) { allowed += 1; assert.equal(account.status, 200, `${role} ${path}: prueba ${preview.status}, cuenta ${account.status}`); }
      }
      assert.ok(allowed > 0, `${role} conserva al menos una lectura`);

      // Escrituras bloqueadas aunque la cuenta real sí pueda escribir.
      const write = await api("POST", "/api/entregas/lotes", adminA, { barrio_nombre: "BO. EL CENTRO", total_asignadas: 1 });
      assert.equal(write.status, 403);
      assert.match(write.data.message, /Modo de prueba/);
      assert.equal((await api("POST", "/api/auth/preview", adminA, { role: "operator" })).status, 403, "sin cambios anidados");
      assert.equal((await api("POST", "/api/auth/change-password", adminA, { currentPassword: "preview-local-qa", newPassword: "otra-clave-qa-123" })).status, 403);

      const ended = await api("DELETE", "/api/auth/preview", adminA);
      assert.equal(ended.status, 200);
      assert.equal(ended.data.user.role, "admin");
      assert.equal(ended.data.user.preview, undefined);
    }
    assert.equal(await audits(adminA, "auth.preview_started"), PREVIEW_ROLES.length);
    assert.equal(await audits(adminA, "auth.preview_ended"), PREVIEW_ROLES.length);
    const [[{ role: storedRole }]] = await pool.query("SELECT role FROM app_users WHERE username = 'admin'");
    assert.equal(storedRole, "admin");

    // Dos inicios simultáneos en la misma sesión: el bloqueo FOR UPDATE deja pasar solo uno.
    const adminC = await login("admin2");
    const race = await Promise.all([api("POST", "/api/auth/preview", adminC, { role: "gerente" }), api("POST", "/api/auth/preview", adminC, { role: "operator" })]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 403]);
    assert.equal(await audits(adminC, "auth.preview_started"), 1);
    const winner = race.find((r) => r.status === 200).data.user.role;
    assert.equal((await api("GET", "/api/auth/me", adminC)).data.user.role, winner);
    assert.equal((await api("DELETE", "/api/auth/preview", adminC)).status, 200);

    // Vencimiento real con el reloj de MySQL; el cálculo anterior con el reloj de Node no lo detectaba.
    // El primer ingreso de una cuenta se marca para la bienvenida; el siguiente ya no.
    const firstLogin = await api("POST", "/api/auth/login", null, { username: "admin3", password: "perfil-local-qa" });
    assert.equal(firstLogin.data.user.first_login, true);
    const secondLogin = await api("POST", "/api/auth/login", null, { username: "admin3", password: "perfil-local-qa" });
    assert.equal(secondLogin.data.user.first_login, false);
    const adminD = secondLogin.data.token;
    await pool.query("UPDATE app_users SET force_password_change = 1 WHERE username = 'admin3'");
    assert.equal((await api("POST", "/api/auth/preview", adminD, { role: "gerente" })).status, 403, "cambio de contraseña pendiente");
    await pool.query("UPDATE app_users SET force_password_change = 0 WHERE username = 'admin3'");
    const profileSocket = await connect("/ws/profile", adminD);
    const transportSocket = await connect("/ws/transport", adminD);
    const otherSession = await connect("/ws/profile", adminB);
    assert.equal(profileSocket.messages[0]?.type, "profile.connected");
    assert.equal(transportSocket.messages[0]?.type, "transport.connected");
    assert.equal((await api("POST", "/api/auth/preview", adminD, { role: "transport" })).status, 200);
    assert.equal((await profileSocket.done).code, 1008, "socket de perfil cerrado al cambiar de modo");
    assert.equal((await transportSocket.done).code, 1008, "socket de transporte cerrado al cambiar de modo");
    assert.equal(otherSession.closed, null, "otra sesión del mismo administrador sigue conectada");
    assert.equal((await connect("/ws/transport", adminD)).closed?.code, 1008, "sin sockets nuevos durante la prueba");
    assert.equal((await connect("/ws/profile", adminD)).closed?.code, 1008);

    await pool.query("UPDATE auth_sessions SET preview_expires_at = NOW() - INTERVAL 1 SECOND WHERE token = ?", [hashToken(adminD)]);
    const [[raw]] = await pool.query("SELECT preview_expires_at FROM auth_sessions WHERE token = ?", [hashToken(adminD)]);
    if (nodeOffset < 0) {
      assert.equal(new Date(raw.preview_expires_at).getTime() <= Date.now(), false,
        "el entorno reproduce el desfase: con el reloj de Node la prueba vencida seguiría activa horas");
    }
    const expired = await api("GET", "/api/transport", adminD);
    assert.equal(expired.status, 403);
    assert.match(expired.data.message, /venció/);
    const meExpired = (await api("GET", "/api/auth/me", adminD)).data.user;
    assert.equal(meExpired.role, "transport");
    assert.equal(meExpired.preview.expired, true);
    assert.equal((await api("POST", "/api/auth/preview", adminD, { role: "gerente" })).status, 403, "vencida no se cambia a otro perfil");
    const back = await api("DELETE", "/api/auth/preview", adminD);
    assert.equal(back.status, 200);
    assert.equal(back.data.user.role, "admin");
    assert.equal((await api("GET", "/api/transport", adminD)).status, 200);
    const reconnected = await connect("/ws/transport", adminD);
    assert.equal(reconnected.messages[0]?.type, "transport.connected", "al volver, los sockets se aceptan otra vez");
    const [[endedAudit]] = await pool.query("SELECT details_json FROM audit_logs WHERE action = 'auth.preview_ended' ORDER BY id DESC LIMIT 1");
    const details = JSON.parse(endedAudit.details_json);
    assert.equal(details.previous_role, "transport");
    assert.equal(details.effective_role, "admin");

    // Cerrar sesión desde una prueba vencida también funciona.
    assert.equal((await api("POST", "/api/auth/preview", adminD, { role: "operator" })).status, 200);
    await pool.query("UPDATE auth_sessions SET preview_expires_at = NOW() - INTERVAL 1 SECOND WHERE token = ?", [hashToken(adminD)]);
    assert.equal((await api("POST", "/api/auth/logout", adminD)).status, 200);
    assert.equal((await api("GET", "/api/auth/me", adminD)).status, 401);

    console.log(`QA MySQL verificado: ${database} (MySQL ${mysqlZone}, Node UTC${nodeOffset >= 0 ? "+" : ""}${nodeOffset / 60})`);
  } finally {
    for (const socket of sockets) socket.terminate();
    for (const wss of Object.values(realtime || {})) for (const client of wss.clients) client.terminate();
    if (httpServer) await new Promise((resolve) => { httpServer.closeAllConnections?.(); httpServer.close(resolve); });
    if (pool) await pool.end();
    await root.query("SET GLOBAL time_zone = ?", [originalZone]);
    if (process.env.ENTREGAS_QA_KEEP !== "1") {
      assert.match(database, /^aguaschol_preview_test_\d+$/);
      await root.query(`DROP DATABASE IF EXISTS \`${database}\``);
    }
    await root.end();
  }
});
