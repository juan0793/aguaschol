import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { env } from "../config/env.js";
import { generateToken, verifyPassword } from "../utils/password.js";

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  username: user.username,
  role: user.role,
  is_active: Boolean(user.is_active),
  last_login_at: user.last_login_at
});

export const loginUser = async ({ username, password }) => {
  const identifier = username?.trim();
  if (!identifier || !password) {
    const error = new Error("Usuario/correo y contrasena son obligatorios.");
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT *
      FROM app_users
      WHERE username = ? OR email = ?
      LIMIT 1
    `,
    [identifier, identifier.toLowerCase()]
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    const error = new Error("Usuario o contrasena incorrectos.");
    error.status = 401;
    throw error;
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    const error = new Error("Usuario o contrasena incorrectos.");
    error.status = 401;
    throw error;
  }

  const token = generateToken();
  const sessionDays = Math.max(env.authSessionDays, 1);

  await pool.query(
    `
      INSERT INTO auth_sessions (user_id, token, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))
    `,
    [user.id, token, sessionDays]
  );
  await pool.query("UPDATE app_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

  await createAuditLog({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "session",
    entityId: token.slice(0, 12),
    summary: `Inicio de sesion de ${user.username}`
  });

  return {
    token,
    user: sanitizeUser({ ...user, last_login_at: new Date().toISOString() })
  };
};

export const logoutUser = async (token, actorUser) => {
  if (!token) return;

  const pool = getPool();
  await pool.query("DELETE FROM auth_sessions WHERE token = ?", [token]);

  await createAuditLog({
    actorUserId: actorUser?.id ?? null,
    action: "auth.logout",
    entityType: "session",
    entityId: token.slice(0, 12),
    summary: `Cierre de sesion de ${actorUser?.username ?? "usuario"}`
  });
};

export const getSessionUser = async (token) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        auth_sessions.token,
        auth_sessions.expires_at,
        app_users.id,
        app_users.full_name,
        app_users.email,
        app_users.username,
        app_users.role,
        app_users.is_active,
        app_users.last_login_at
      FROM auth_sessions
      INNER JOIN app_users ON app_users.id = auth_sessions.user_id
      WHERE auth_sessions.token = ?
        AND auth_sessions.expires_at > NOW()
        AND app_users.is_active = 1
      LIMIT 1
    `,
    [token]
  );

  return rows[0] ? sanitizeUser(rows[0]) : null;
};
