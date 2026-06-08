import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const makeError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const asPositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

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

const getTargetUser = async (pool, authUser, requestedUserId) => {
  const targetId = asPositiveId(requestedUserId) ?? authUser.id;

  if (targetId !== authUser.id && authUser.role !== "admin") {
    throw makeError("Solo administracion puede consultar perfiles de otros usuarios.", 403);
  }

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
      WHERE app_users.id = ?
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
      LIMIT 1
    `,
    [targetId]
  );

  if (!rows.length) {
    throw makeError("Usuario no encontrado.", 404);
  }

  return sanitizeUser(rows[0]);
};

const normalizeMessage = (message) => ({
  id: message.id,
  sender_user_id: message.sender_user_id,
  recipient_user_id: message.recipient_user_id,
  parent_message_id: message.parent_message_id,
  body: message.body,
  read_at: message.read_at,
  created_at: message.created_at,
  sender_name: message.sender_name ?? "Sistema",
  sender_role: message.sender_role ?? "",
  recipient_name: message.recipient_name ?? ""
});

const emptyProfile = (authUser) => ({
  user: sanitizeUser({ ...authUser, active_sessions: 1 }),
  stats: {
    points_total: 0,
    points_today: 0,
    approved_points: 0,
    pending_points: 0,
    housing_units_total: 0,
    worked_days: 0,
    worked_minutes_estimated: 0,
    screen_minutes_estimated: 0,
    performance_score: 0,
    zones_total: 0
  },
  zones: [],
  points: [],
  messages: [],
  achievements: [],
  unread_count: 0,
  generated_at: new Date().toISOString()
});

export const getProfile = async ({ authUser, userId }) => {
  if (env.useMemoryDb) {
    return emptyProfile(authUser);
  }

  const pool = getPool();
  const user = await getTargetUser(pool, authUser, userId);
  const targetId = user.id;

  const [[statsRow]] = await pool.query(
    `
      SELECT
        COUNT(*) AS points_total,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS points_today,
        SUM(CASE WHEN validation_status IN ('approved', 'corrected') THEN 1 ELSE 0 END) AS approved_points,
        SUM(CASE WHEN validation_status = 'pending' THEN 1 ELSE 0 END) AS pending_points,
        COALESCE(SUM(housing_units), 0) AS housing_units_total,
        COUNT(DISTINCT COALESCE(diary_date, DATE(created_at))) AS worked_days
      FROM map_points
      WHERE created_by = ?
    `,
    [targetId]
  );
  const [[minutesRow]] = await pool.query(
    `
      SELECT COALESCE(SUM(GREATEST(15, TIMESTAMPDIFF(MINUTE, first_at, last_at))), 0) AS worked_minutes_estimated
      FROM (
        SELECT DATE(created_at) AS work_day, MIN(created_at) AS first_at, MAX(created_at) AS last_at
        FROM map_points
        WHERE created_by = ?
        GROUP BY DATE(created_at)
      ) AS worked_days
    `,
    [targetId]
  );
  const [zones] = await pool.query(
    `
      SELECT
        COALESCE(NULLIF(reference_note, ''), NULLIF(SUBSTRING_INDEX(description, '\n', 1), ''), 'Zona sin referencia') AS zone,
        COUNT(*) AS total,
        AVG(latitude) AS latitude,
        AVG(longitude) AS longitude,
        MIN(created_at) AS first_at,
        MAX(created_at) AS last_at
      FROM map_points
      WHERE created_by = ?
      GROUP BY zone
      ORDER BY total DESC, last_at DESC
      LIMIT 30
    `,
    [targetId]
  );
  const [points] = await pool.query(
    `
      SELECT
        id,
        point_type,
        latitude,
        longitude,
        reference_note,
        description,
        marker_color,
        housing_units,
        validation_status,
        created_at,
        updated_at
      FROM map_points
      WHERE created_by = ?
      ORDER BY created_at DESC
      LIMIT 160
    `,
    [targetId]
  );
  const [messages] = await pool.query(
    `
      SELECT
        messages.*,
        sender.full_name AS sender_name,
        sender.role AS sender_role,
        recipient.full_name AS recipient_name
      FROM user_profile_messages AS messages
      LEFT JOIN app_users AS sender ON sender.id = messages.sender_user_id
      LEFT JOIN app_users AS recipient ON recipient.id = messages.recipient_user_id
      WHERE messages.sender_user_id = ? OR messages.recipient_user_id = ?
      ORDER BY messages.created_at DESC
      LIMIT 50
    `,
    [targetId, targetId]
  );
  const [achievements] = await pool.query(
    `
      SELECT
        achievements.*,
        awarded_by_user.full_name AS awarded_by_name
      FROM user_achievements AS achievements
      LEFT JOIN app_users AS awarded_by_user ON awarded_by_user.id = achievements.awarded_by
      WHERE achievements.user_id = ?
      ORDER BY achievements.awarded_at DESC
      LIMIT 40
    `,
    [targetId]
  );
  const [[unreadRow]] = await pool.query(
    `
      SELECT COUNT(*) AS unread_count
      FROM user_profile_messages
      WHERE recipient_user_id = ? AND read_at IS NULL
    `,
    [targetId]
  );

  const workedMinutes = Number(minutesRow?.worked_minutes_estimated ?? 0);
  const sessionMinutes =
    Number(user.active_sessions) > 0 && user.last_login_at
      ? clamp(Math.round((Date.now() - new Date(user.last_login_at).getTime()) / 60000), 0, 720)
      : 0;
  const pointsTotal = Number(statsRow?.points_total ?? 0);
  const approvedPoints = Number(statsRow?.approved_points ?? 0);
  const zonesTotal = zones.length;
  const performanceScore = clamp(
    Math.round(pointsTotal * 1.8 + approvedPoints * 1.2 + zonesTotal * 4 + Number(statsRow?.worked_days ?? 0) * 3),
    0,
    100
  );

  return {
    user,
    stats: {
      points_total: pointsTotal,
      points_today: Number(statsRow?.points_today ?? 0),
      approved_points: approvedPoints,
      pending_points: Number(statsRow?.pending_points ?? 0),
      housing_units_total: Number(statsRow?.housing_units_total ?? 0),
      worked_days: Number(statsRow?.worked_days ?? 0),
      worked_minutes_estimated: workedMinutes,
      screen_minutes_estimated: sessionMinutes,
      performance_score: performanceScore,
      zones_total: zonesTotal
    },
    zones: zones.map((zone) => ({
      ...zone,
      total: Number(zone.total ?? 0),
      latitude: Number(zone.latitude),
      longitude: Number(zone.longitude)
    })),
    points: points.map((point) => ({
      ...point,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      housing_units: Number(point.housing_units ?? 0),
      zone_label: point.reference_note || String(point.description ?? "").split("\n")[0] || "Zona sin referencia"
    })),
    messages: messages.map(normalizeMessage),
    achievements: achievements.map((achievement) => ({
      ...achievement,
      awarded_by_name: achievement.awarded_by_name ?? "Administracion"
    })),
    unread_count: Number(unreadRow?.unread_count ?? 0),
    generated_at: new Date().toISOString()
  };
};

export const sendProfileMessage = async ({ authUser, recipientUserId, body, parentMessageId = null }) => {
  if (env.useMemoryDb) {
    throw makeError("Los mensajes requieren base de datos persistente.", 503);
  }

  const cleanBody = String(body ?? "").trim();
  const recipientId = asPositiveId(recipientUserId);
  const parentId = asPositiveId(parentMessageId);

  if (!recipientId || cleanBody.length < 2) {
    throw makeError("Selecciona un destinatario y escribe un mensaje.");
  }

  const pool = getPool();
  const [recipientRows] = await pool.query("SELECT id, role, full_name FROM app_users WHERE id = ? AND is_active = 1 LIMIT 1", [recipientId]);

  if (!recipientRows.length) {
    throw makeError("Destinatario no encontrado.", 404);
  }

  if (authUser.role !== "admin" && recipientRows[0].role !== "admin") {
    throw makeError("Las respuestas de usuarios deben enviarse a administracion.", 403);
  }

  const [result] = await pool.query(
    `
      INSERT INTO user_profile_messages (sender_user_id, recipient_user_id, parent_message_id, body)
      VALUES (?, ?, ?, ?)
    `,
    [authUser.id, recipientId, parentId, cleanBody.slice(0, 2000)]
  );

  await createAuditLog({
    actorUserId: authUser.id,
    action: "profile.message_sent",
    entityType: "user_profile_message",
    entityId: result.insertId,
    summary: `Mensaje enviado a ${recipientRows[0].full_name}.`
  });

  const [[message]] = await pool.query(
    `
      SELECT
        messages.*,
        sender.full_name AS sender_name,
        sender.role AS sender_role,
        recipient.full_name AS recipient_name
      FROM user_profile_messages AS messages
      LEFT JOIN app_users AS sender ON sender.id = messages.sender_user_id
      LEFT JOIN app_users AS recipient ON recipient.id = messages.recipient_user_id
      WHERE messages.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return normalizeMessage(message);
};

export const markProfileMessageRead = async ({ authUser, messageId }) => {
  if (env.useMemoryDb) {
    return { ok: true };
  }

  const id = asPositiveId(messageId);
  if (!id) {
    throw makeError("Mensaje invalido.");
  }

  const pool = getPool();
  const [result] = await pool.query(
    `
      UPDATE user_profile_messages
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE id = ? AND recipient_user_id = ?
    `,
    [id, authUser.id]
  );

  return { ok: result.affectedRows > 0 };
};

export const awardProfileAchievement = async ({ authUser, userId, title, description = "", icon = "success", badgeColor = "#1576d1" }) => {
  if (env.useMemoryDb) {
    throw makeError("Los logros requieren base de datos persistente.", 503);
  }

  if (authUser.role !== "admin") {
    throw makeError("Solo administracion puede asignar logros.", 403);
  }

  const targetId = asPositiveId(userId);
  const cleanTitle = String(title ?? "").trim();
  const cleanDescription = String(description ?? "").trim();

  if (!targetId || cleanTitle.length < 3) {
    throw makeError("Selecciona un usuario y escribe el nombre del logro.");
  }

  const pool = getPool();
  await getTargetUser(pool, authUser, targetId);
  const [result] = await pool.query(
    `
      INSERT INTO user_achievements (user_id, awarded_by, title, description, icon, badge_color)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [targetId, authUser.id, cleanTitle.slice(0, 120), cleanDescription.slice(0, 255), String(icon ?? "success").slice(0, 40), String(badgeColor ?? "#1576d1").slice(0, 20)]
  );

  await createAuditLog({
    actorUserId: authUser.id,
    action: "profile.achievement_awarded",
    entityType: "user_achievement",
    entityId: result.insertId,
    summary: `Logro asignado: ${cleanTitle}.`
  });

  const [[achievement]] = await pool.query(
    `
      SELECT achievements.*, awarded_by_user.full_name AS awarded_by_name
      FROM user_achievements AS achievements
      LEFT JOIN app_users AS awarded_by_user ON awarded_by_user.id = achievements.awarded_by
      WHERE achievements.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return {
    ...achievement,
    awarded_by_name: achievement.awarded_by_name ?? "Administracion"
  };
};
