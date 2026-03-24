import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { env } from "../config/env.js";
import { generateToken, hashPassword, verifyPassword } from "../utils/password.js";

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  username: user.username,
  role: user.role,
  force_password_change: Boolean(user.force_password_change),
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

export const changeOwnPassword = async ({ userId, currentPassword, newPassword }) => {
  const current = currentPassword?.trim() ?? "";
  const next = newPassword?.trim() ?? "";

  if (!current || !next) {
    const error = new Error("Debes ingresar la contrasena actual y la nueva contrasena.");
    error.status = 400;
    throw error;
  }

  if (next.length < 8) {
    const error = new Error("La nueva contrasena debe tener al menos 8 caracteres.");
    error.status = 400;
    throw error;
  }

  if (current === next) {
    const error = new Error("La nueva contrasena debe ser diferente a la actual.");
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT id, username, password_hash, force_password_change
      FROM app_users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );

  const user = rows[0];
  if (!user) {
    const error = new Error("Usuario no encontrado.");
    error.status = 404;
    throw error;
  }

  const validPassword = await verifyPassword(current, user.password_hash);
  if (!validPassword) {
    const error = new Error("La contrasena actual no es correcta.");
    error.status = 401;
    throw error;
  }

  const passwordHash = await hashPassword(next);
  await pool.query(
    `
      UPDATE app_users
      SET password_hash = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [passwordHash, userId]
  );

  await createAuditLog({
    actorUserId: userId,
    action: "auth.password_changed",
    entityType: "user",
    entityId: userId,
    summary: `Contrasena actualizada para ${user.username}`,
    details: {
      forced_change_completed: Boolean(user.force_password_change)
    }
  });

  const [updatedRows] = await pool.query(
    `
      SELECT id, full_name, email, username, role, force_password_change, is_active, last_login_at
      FROM app_users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );

  return sanitizeUser(updatedRows[0]);
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
        app_users.force_password_change,
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
