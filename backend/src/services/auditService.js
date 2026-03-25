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

const mapAuditRows = (rows) =>
  rows.map((row) => ({
    ...row,
    details_json: row.details_json ? JSON.parse(row.details_json) : null
  }));

export const listAuditLogs = async ({
  limit = 100,
  action = "",
  entityType = "",
  actor = "",
  search = "",
  dateFrom = "",
  dateTo = ""
} = {}) => {
  const pool = getPool();
  const filters = [];
  const params = [];

  if (action.trim()) {
    filters.push("audit_logs.action = ?");
    params.push(action.trim());
  }

  if (entityType.trim()) {
    filters.push("audit_logs.entity_type = ?");
    params.push(entityType.trim());
  }

  if (actor.trim()) {
    filters.push("(app_users.full_name LIKE ? OR app_users.email LIKE ?)");
    params.push(`%${actor.trim()}%`, `%${actor.trim()}%`);
  }

  if (search.trim()) {
    filters.push("(audit_logs.summary LIKE ? OR audit_logs.entity_id LIKE ? OR audit_logs.details_json LIKE ?)");
    params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
  }

  if (dateFrom.trim()) {
    filters.push("DATE(audit_logs.created_at) >= ?");
    params.push(dateFrom.trim());
  }

  if (dateTo.trim()) {
    filters.push("DATE(audit_logs.created_at) <= ?");
    params.push(dateTo.trim());
  }

  const [rows] = await pool.query(
    `
      SELECT
        audit_logs.*,
        app_users.full_name AS actor_name,
        app_users.email AS actor_email
      FROM audit_logs
      LEFT JOIN app_users ON app_users.id = audit_logs.actor_user_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY audit_logs.created_at DESC
      LIMIT ?
    `,
    [...params, Math.min(Number(limit) || 100, 500)]
  );

  return mapAuditRows(rows);
};

export const listEntityAuditLogs = async ({ entityType, entityId, limit = 50 } = {}) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        audit_logs.*,
        app_users.full_name AS actor_name,
        app_users.email AS actor_email
      FROM audit_logs
      LEFT JOIN app_users ON app_users.id = audit_logs.actor_user_id
      WHERE audit_logs.entity_type = ?
        AND audit_logs.entity_id = ?
      ORDER BY audit_logs.created_at DESC
      LIMIT ?
    `,
    [String(entityType ?? ""), String(entityId ?? ""), Math.min(Number(limit) || 50, 200)]
  );

  return mapAuditRows(rows);
};

const escapeCsvValue = (value) => {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

export const exportAuditLogsCsv = async (filters = {}) => {
  const logs = await listAuditLogs({ ...filters, limit: 500 });
  const headers = [
    "fecha",
    "accion",
    "entidad",
    "id_entidad",
    "actor",
    "correo_actor",
    "resumen"
  ];

  const lines = logs.map((log) =>
    [
      log.created_at,
      log.action,
      log.entity_type,
      log.entity_id,
      log.actor_name || "",
      log.actor_email || "",
      log.summary || ""
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
};
