import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { sendUserCreatedEmail } from "./emailService.js";
import { generatePassword, hashPassword } from "../utils/password.js";

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  username: user.username,
  role: user.role,
  is_active: Boolean(user.is_active),
  last_login_at: user.last_login_at,
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
      SELECT id, full_name, email, username, role, is_active, last_login_at, created_at, updated_at
      FROM app_users
      ORDER BY created_at DESC
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
      INSERT INTO app_users (full_name, email, username, role, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `,
    [cleanName, cleanEmail, username, cleanRole, passwordHash]
  );

  const [rows] = await pool.query(
    `
      SELECT id, full_name, email, username, role, is_active, last_login_at, created_at, updated_at
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
