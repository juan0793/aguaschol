import { getPool } from "../config/db.js";

export const createAuditLog = async ({
  actorUserId = null,
  action,
  entityType,
  entityId = "",
  summary = "",
  details = null
}) => {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, summary, details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [actorUserId, action, entityType, String(entityId ?? ""), summary, details ? JSON.stringify(details) : null]
  );
};

export const listAuditLogs = async ({ limit = 100 } = {}) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        audit_logs.*,
        app_users.full_name AS actor_name,
        app_users.email AS actor_email
      FROM audit_logs
      LEFT JOIN app_users ON app_users.id = audit_logs.actor_user_id
      ORDER BY audit_logs.created_at DESC
      LIMIT ?
    `,
    [Math.min(Number(limit) || 100, 500)]
  );

  return rows.map((row) => ({
    ...row,
    details_json: row.details_json ? JSON.parse(row.details_json) : null
  }));
};
