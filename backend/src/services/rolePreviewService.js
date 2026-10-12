import { getPool } from "../config/db.js";
import { hashToken } from "../utils/password.js";
import { createAuditLog } from "./auditService.js";
import { closeSessionSockets } from "../utils/sessionSockets.js";

export const PREVIEW_ROLES = ["gerente", "operator", "validadora_campo", "transport"];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function applyRolePreview(user, now = Date.now()) {
  if (!user.preview_role) return user;
  if (user.role !== "admin" || !PREVIEW_ROLES.includes(user.preview_role)) return null;
  // MySQL escribe el vencimiento con su NOW(); UNIX_TIMESTAMP lo entrega como instante absoluto, sin
  // depender de que Node y la base compartan zona horaria. Debe ser estable entre consultas: el
  // frontend recarga la página cuando cambia expires_at.
  const fromDb = "preview_expires_epoch" in user;
  const epoch = user.preview_expires_epoch === null ? NaN : Number(user.preview_expires_epoch);
  const expiresAt = fromDb ? epoch * 1000 : new Date(user.preview_expires_at).getTime();
  return { ...user, role: user.preview_role, preview: {
    original_role: "admin", read_only: true,
    expires_at: fromDb && Number.isFinite(expiresAt) ? new Date(expiresAt).toISOString() : user.preview_expires_at,
    expired: !user.preview_expires_at || !Number.isFinite(expiresAt) || expiresAt <= now
  } };
}

export async function changeRolePreview(token, role, executor = getPool()) {
  if (role !== null && !PREVIEW_ROLES.includes(role)) fail(400, "Perfil de prueba inválido.");
  const connection = await executor.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT s.id, s.user_id, s.preview_role, u.role, u.force_password_change
      FROM auth_sessions s INNER JOIN app_users u ON u.id=s.user_id
      WHERE s.token=? AND s.expires_at>NOW() AND u.is_active=1 FOR UPDATE`, [hashToken(token)]);
    const session = rows[0];
    if (!session || session.role !== "admin") fail(403, "Solo administradores pueden probar perfiles.");
    if (role && session.force_password_change) fail(403, "Completa el cambio de contraseña antes de probar perfiles.");
    if (role && session.preview_role) fail(403, "Vuelve a administrador antes de elegir otro perfil.");
    await connection.query(`UPDATE auth_sessions SET preview_role=?,
      preview_expires_at=${role ? "DATE_ADD(NOW(), INTERVAL 15 MINUTE)" : "NULL"} WHERE id=?`, [role, session.id]);
    await createAuditLog({ actorUserId: session.user_id, action: role ? "auth.preview_started" : "auth.preview_ended",
      entityType: "session", entityId: session.id, summary: role ? `Prueba de perfil ${role}` : "Retorno a administrador",
      details: { original_role: "admin", previous_role: session.preview_role, effective_role: role || "admin", read_only: Boolean(role) }, executor: connection });
    await connection.commit();
    closeSessionSockets(token);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
