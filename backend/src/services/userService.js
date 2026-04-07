import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { sendPasswordResetEmail, sendUserCreatedEmail } from "./emailService.js";
import { generatePassword, hashPassword } from "../utils/password.js";

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  username: user.username,
  role: user.role,
  force_password_change: Boolean(user.force_password_change),
  is_active: Boolean(user.is_active),
  last_login_at: user.last_login_at,
  active_sessions: Number(user.active_sessions ?? 0),
  is_online: Number(user.active_sessions ?? 0) > 0,
  latest_session_expires_at: user.latest_session_expires_at ?? null,
  created_at: user.created_at,
  updated_at: user.updated_at
});

const makeUsername = async (email) => {
  const pool = getPool();
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "") || "usuario";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const [rows] = await pool.query("SELECT id FROM app_users WHERE username = ? LIMIT 1", [candidate]);
    if (!rows.length) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}${suffix}`;
  }
};

export const listUsers = async () => {
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        app_users.id,
        app_users.full_name,
        app_users.email,
        app_users.username,
        app_users.role,
        app_users.force_password_change,
        app_users.is_active,
        app_users.last_login_at,
        app_users.created_at,
        app_users.updated_at,
        COUNT(auth_sessions.id) AS active_sessions,
        MAX(auth_sessions.expires_at) AS latest_session_expires_at
      FROM app_users
      LEFT JOIN auth_sessions
        ON auth_sessions.user_id = app_users.id
       AND auth_sessions.expires_at > NOW()
      GROUP BY
        app_users.id,
        app_users.full_name,
        app_users.email,
        app_users.username,
        app_users.role,
        app_users.force_password_change,
        app_users.is_active,
        app_users.last_login_at,
        app_users.created_at,
        app_users.updated_at
      ORDER BY active_sessions DESC, app_users.full_name ASC, app_users.created_at DESC
    `
  );

  return rows.map(sanitizeUser);
};

export const createUser = async ({ full_name, email, role = "operator" }, actorUser) => {
  const pool = getPool();
  const cleanName = full_name?.trim();
  const cleanEmail = email?.trim().toLowerCase();
  const cleanRole = role === "admin" ? "admin" : "operator";

  if (!cleanName || !cleanEmail) {
    const error = new Error("Nombre completo y correo son obligatorios.");
    error.status = 400;
    throw error;
  }

  const [existing] = await pool.query("SELECT id FROM app_users WHERE email = ? LIMIT 1", [cleanEmail]);
  if (existing.length) {
    const error = new Error("Ya existe un usuario con ese correo.");
    error.status = 409;
    throw error;
  }

  const username = await makeUsername(cleanEmail);
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const [result] = await pool.query(
    `
      INSERT INTO app_users (full_name, email, username, role, password_hash, force_password_change, is_active)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `,
    [cleanName, cleanEmail, username, cleanRole, passwordHash]
  );

  const [rows] = await pool.query(
    `
      SELECT id, full_name, email, username, role, force_password_change, is_active, last_login_at, created_at, updated_at
      FROM app_users
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  const user = sanitizeUser(rows[0]);
  const emailResult = await sendUserCreatedEmail({
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    password
  });

  await createAuditLog({
    actorUserId: actorUser?.id ?? null,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    summary: `Usuario ${user.username} creado`,
    details: {
      email_sent: emailResult.sent,
      email_skipped: emailResult.skipped ?? false,
      sandbox: emailResult.sandbox ?? false,
      role: user.role
    }
  });

  return {
    user,
    delivery: emailResult,
    temp_password: emailResult.sent ? null : password
  };
};

export const deleteUser = async (userId, actorUser) => {
  const pool = getPool();
  const targetId = Number(userId);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    const error = new Error("Usuario invalido.");
    error.status = 400;
    throw error;
  }

  if (actorUser?.id === targetId) {
    const error = new Error("No puedes eliminar tu propio usuario.");
    error.status = 400;
    throw error;
  }

  const [rows] = await pool.query(
    `
      SELECT id, full_name, email, username, role, force_password_change, is_active, last_login_at, created_at, updated_at
      FROM app_users
      WHERE id = ?
      LIMIT 1
    `,
    [targetId]
  );

  const user = rows[0];
  if (!user) {
    const error = new Error("Usuario no encontrado.");
    error.status = 404;
    throw error;
  }

  await createAuditLog({
    actorUserId: actorUser?.id ?? null,
    action: "user.deleted",
    entityType: "user",
    entityId: targetId,
    summary: `Usuario ${user.username} eliminado`,
    details: {
      email: user.email,
      role: user.role
    }
  });

  await pool.query("DELETE FROM auth_sessions WHERE user_id = ?", [targetId]);
  await pool.query("DELETE FROM app_users WHERE id = ?", [targetId]);

  return sanitizeUser(user);
};

export const resetUserPassword = async (userId, actorUser) => {
  const pool = getPool();
  const targetId = Number(userId);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    const error = new Error("Usuario invalido.");
    error.status = 400;
    throw error;
  }

  const [rows] = await pool.query(
    `
      SELECT id, full_name, email, username, role, force_password_change, is_active, last_login_at, created_at, updated_at
      FROM app_users
      WHERE id = ?
      LIMIT 1
    `,
    [targetId]
  );

  const user = rows[0];
  if (!user) {
    const error = new Error("Usuario no encontrado.");
    error.status = 404;
    throw error;
  }

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await pool.query(
    `
      UPDATE app_users
      SET password_hash = ?, force_password_change = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [passwordHash, targetId]
  );
  await pool.query("DELETE FROM auth_sessions WHERE user_id = ?", [targetId]);

  const delivery = await sendPasswordResetEmail({
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    password
  });

  await createAuditLog({
    actorUserId: actorUser?.id ?? null,
    action: "user.password_reset",
    entityType: "user",
    entityId: targetId,
    summary: `Contrasena temporal regenerada para ${user.username}`,
    details: {
      email_sent: delivery.sent,
      email_skipped: delivery.skipped ?? false,
      sandbox: delivery.sandbox ?? false
    }
  });

  return {
    user: {
      ...sanitizeUser(user),
      force_password_change: true
    },
    delivery,
    temp_password: delivery.sent ? null : password
  };
};
