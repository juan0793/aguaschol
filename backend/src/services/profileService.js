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

export const CHAT_CHANNELS = [
  { key: "general", label: "General" },
  { key: "campo", label: "Campo" },
  { key: "avisos", label: "Avisos" },
  { key: "soporte", label: "Soporte" },
  { key: "administracion", label: "Administración" }
];

const validChatChannelKeys = new Set(CHAT_CHANNELS.map((channel) => channel.key));
const chatChannelLabelsByKey = new Map(CHAT_CHANNELS.map((channel) => [channel.key, channel.label]));

const normalizeChatChannel = (value = "general") => {
  const normalized = String(value || "general")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return validChatChannelKeys.has(normalized) ? normalized : "general";
};

const buildChannelNotificationBody = ({ channel, senderName, body, attachmentType }) => {
  const label = chatChannelLabelsByKey.get(channel) || "General";
  const cleanSender = String(senderName || "Un usuario").trim();
  const cleanBody = String(body || "").trim();
  const preview = cleanBody || (attachmentType === "image" ? "Envio una fotografia." : "Envio un adjunto.");
  return `Nuevo mensaje en #${label} de ${cleanSender}: ${preview}`.slice(0, 2000);
};

const AUTO_ACHIEVEMENTS = [
  {
    code: "first_point",
    title: "Primer punto GPS",
    description: "Registró su primer punto GPS en campo.",
    icon: "map-pin",
    badge_color: "#1576d1",
    condition: ({ stats }) => stats.points_total >= 1
  },
  {
    code: "ten_points",
    title: "10 puntos censados",
    description: "Registró 10 puntos GPS en el sistema.",
    icon: "target",
    badge_color: "#0f766e",
    condition: ({ stats }) => stats.points_total >= 10
  },
  {
    code: "fifty_points",
    title: "50 puntos censados",
    description: "Registró 50 puntos GPS en el sistema.",
    icon: "target",
    badge_color: "#0e7490",
    condition: ({ stats }) => stats.points_total >= 50
  },
  {
    code: "hundred_points",
    title: "100 puntos censados",
    description: "Registró 100 puntos GPS en el sistema.",
    icon: "target",
    badge_color: "#1d4ed8",
    condition: ({ stats }) => stats.points_total >= 100
  },
  {
    code: "two_hundred_fifty_points",
    title: "250 puntos censados",
    description: "Registró 250 puntos GPS en el sistema.",
    icon: "target",
    badge_color: "#7c3aed",
    condition: ({ stats }) => stats.points_total >= 250
  },
  {
    code: "five_hundred_points",
    title: "500 puntos censados",
    description: "Registró 500 puntos GPS en el sistema.",
    icon: "target",
    badge_color: "#be123c",
    condition: ({ stats }) => stats.points_total >= 500
  },
  {
    code: "first_approved_point",
    title: "Primer punto validado",
    description: "Obtuvo su primer punto GPS validado.",
    icon: "check",
    badge_color: "#16a34a",
    condition: ({ stats }) => stats.approved_points >= 1
  },
  {
    code: "twenty_five_approved",
    title: "25 puntos validados",
    description: "Acumuló 25 puntos GPS validados.",
    icon: "check",
    badge_color: "#15803d",
    condition: ({ stats }) => stats.approved_points >= 25
  },
  {
    code: "hundred_approved",
    title: "100 puntos validados",
    description: "Acumuló 100 puntos GPS validados.",
    icon: "check",
    badge_color: "#166534",
    condition: ({ stats }) => stats.approved_points >= 100
  },
  {
    code: "first_work_day",
    title: "Primera jornada",
    description: "Completó su primera jornada con actividad de campo.",
    icon: "calendar",
    badge_color: "#0f766e",
    condition: ({ stats }) => stats.worked_days >= 1
  },
  {
    code: "five_work_days",
    title: "5 jornadas trabajadas",
    description: "Registró actividad en 5 jornadas de trabajo.",
    icon: "calendar",
    badge_color: "#0e7490",
    condition: ({ stats }) => stats.worked_days >= 5
  },
  {
    code: "fifteen_work_days",
    title: "15 jornadas trabajadas",
    description: "Registró actividad en 15 jornadas de trabajo.",
    icon: "calendar",
    badge_color: "#1d4ed8",
    condition: ({ stats }) => stats.worked_days >= 15
  },
  {
    code: "zone_explorer",
    title: "Explorador de zonas",
    description: "Trabajó en 3 zonas diferentes.",
    icon: "map",
    badge_color: "#0369a1",
    condition: ({ stats }) => stats.zones_total >= 3
  },
  {
    code: "zone_master",
    title: "Dominador de zonas",
    description: "Trabajó en 10 zonas diferentes.",
    icon: "map",
    badge_color: "#4338ca",
    condition: ({ stats }) => stats.zones_total >= 10
  },
  {
    code: "good_performance",
    title: "Buen rendimiento",
    description: "Alcanzó un rendimiento general de 50%.",
    icon: "zap",
    badge_color: "#ca8a04",
    condition: ({ stats }) => stats.performance_score >= 50
  },
  {
    code: "high_performance",
    title: "Alto rendimiento",
    description: "Alcanzó un rendimiento general de 80%.",
    icon: "zap",
    badge_color: "#ea580c",
    condition: ({ stats }) => stats.performance_score >= 80
  },
  {
    code: "perfect_performance",
    title: "Rendimiento perfecto",
    description: "Alcanzó un rendimiento general de 100%.",
    icon: "zap",
    badge_color: "#dc2626",
    condition: ({ stats }) => stats.performance_score >= 100
  },
  {
    code: "productive_day",
    title: "Día productivo",
    description: "Registró 10 puntos GPS en una misma jornada.",
    icon: "sun",
    badge_color: "#f59e0b",
    condition: ({ stats }) => stats.points_today >= 10
  },
  {
    code: "great_day",
    title: "Gran jornada",
    description: "Registró 25 puntos GPS en una misma jornada.",
    icon: "sun",
    badge_color: "#d97706",
    condition: ({ stats }) => stats.points_today >= 25
  },
  {
    code: "active_user",
    title: "Usuario activo",
    description: "Mantuvo una sesión activa de al menos 30 minutos.",
    icon: "clock",
    badge_color: "#2563eb",
    condition: ({ stats }) => stats.screen_minutes_estimated >= 30
  }
];

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
    throw makeError("Solo administración puede consultar perfiles de otros usuarios.", 403);
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

const normalizeGeneralMessage = (message) => ({
  id: message.id,
  sender_user_id: message.sender_user_id,
  reply_to_message_id: message.reply_to_message_id,
  channel: normalizeChatChannel(message.channel),
  body: message.body,
  attachment_url: message.attachment_url ?? "",
  attachment_type: message.attachment_type ?? "",
  pinned_at: message.pinned_at,
  pinned_by: message.pinned_by,
  deleted_at: message.deleted_at,
  created_at: message.created_at,
  sender_name: message.sender_name ?? "Sistema",
  sender_role: message.sender_role ?? "",
  reply_to: message.reply_to_message_id
    ? {
        id: message.reply_to_message_id,
        body: message.reply_body ?? "",
        sender_name: message.reply_sender_name ?? "Usuario",
        attachment_type: message.reply_attachment_type ?? "",
        attachment_url: message.reply_attachment_url ?? ""
      }
    : null,
  is_general: true
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
    general_messages: [],
    chat_channels: CHAT_CHANNELS,
    achievements: [],
  unread_count: 0,
  generated_at: new Date().toISOString()
});

const evaluateAutomaticAchievements = async ({ pool, targetId, stats }) => {
  const unlockedAchievements = AUTO_ACHIEVEMENTS.filter((achievement) => achievement.condition({ stats }));

  if (!unlockedAchievements.length) {
    return [];
  }

  const codes = unlockedAchievements.map((achievement) => achievement.code);
  const [existingRows] = await pool.query(
    `
      SELECT achievement_code
      FROM user_achievements
      WHERE user_id = ?
        AND achievement_code IN (?)
    `,
    [targetId, codes]
  );
  const existingCodes = new Set(existingRows.map((row) => row.achievement_code).filter(Boolean));
  const newAchievements = unlockedAchievements.filter((achievement) => !existingCodes.has(achievement.code));

  for (const achievement of newAchievements) {
    await pool.query(
      `
        INSERT INTO user_achievements
          (user_id, awarded_by, achievement_code, title, description, icon, badge_color)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        targetId,
        null,
        achievement.code,
        achievement.title,
        achievement.description,
        achievement.icon,
        achievement.badge_color
      ]
    );
  }

  return newAchievements;
};

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
  const [generalMessages] = await pool.query(
    `
      SELECT
        messages.*,
        sender.full_name AS sender_name,
        sender.role AS sender_role,
        reply.body AS reply_body,
        reply.attachment_type AS reply_attachment_type,
        reply.attachment_url AS reply_attachment_url,
        reply_sender.full_name AS reply_sender_name
      FROM profile_general_messages AS messages
      LEFT JOIN app_users AS sender ON sender.id = messages.sender_user_id
      LEFT JOIN profile_general_messages AS reply ON reply.id = messages.reply_to_message_id
      LEFT JOIN app_users AS reply_sender ON reply_sender.id = reply.sender_user_id
      WHERE messages.deleted_at IS NULL
      ORDER BY messages.created_at DESC
      LIMIT 80
    `
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
  const stats = {
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
  };

  await evaluateAutomaticAchievements({
    pool,
    targetId,
    stats
  });

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

  return {
    user,
    stats,
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
    general_messages: generalMessages.map(normalizeGeneralMessage),
    chat_channels: CHAT_CHANNELS,
    achievements: achievements.map((achievement) => ({
      ...achievement,
      awarded_by_name: achievement.awarded_by_name ?? "Administración"
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

  if (recipientId === authUser.id) {
    throw makeError("No puedes enviarte mensajes a ti mismo.", 400);
  }

  const pool = getPool();
  const [recipientRows] = await pool.query("SELECT id, role, full_name FROM app_users WHERE id = ? AND is_active = 1 LIMIT 1", [recipientId]);

  if (!recipientRows.length) {
    throw makeError("Destinatario no encontrado.", 404);
  }

  if (authUser.role !== "admin" && recipientRows[0].role !== "admin") {
    throw makeError("Las respuestas de usuarios deben enviarse a administración.", 403);
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

export const sendGeneralProfileMessage = async ({ authUser, body, channel = "general", attachmentUrl = "", attachmentType = "", replyToMessageId = null }) => {
  if (env.useMemoryDb) {
    throw makeError("Los mensajes requieren base de datos persistente.", 503);
  }

  const cleanBody = String(body ?? "").trim();
  const cleanAttachmentUrl = String(attachmentUrl ?? "").trim();
  const cleanAttachmentType = String(attachmentType ?? "").trim();
  const cleanChannel = normalizeChatChannel(channel);
  const replyToId = asPositiveId(replyToMessageId);

  if (cleanBody.length < 2 && !cleanAttachmentUrl) {
    throw makeError("Escribe un mensaje o adjunta una imagen.");
  }

  const pool = getPool();
  if (replyToId) {
    const [[replyMessage]] = await pool.query(
      `
        SELECT id
        FROM profile_general_messages
        WHERE id = ?
          AND channel = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [replyToId, cleanChannel]
    );

    if (!replyMessage) {
      throw makeError("El mensaje al que respondes ya no esta disponible.", 404);
    }
  }

  const [result] = await pool.query(
    `
      INSERT INTO profile_general_messages (sender_user_id, reply_to_message_id, channel, body, attachment_url, attachment_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [authUser.id, replyToId, cleanChannel, cleanBody.slice(0, 2000), cleanAttachmentUrl.slice(0, 500), cleanAttachmentType.slice(0, 40)]
  );

  await createAuditLog({
    actorUserId: authUser.id,
    action: "profile.general_message_sent",
    entityType: "profile_general_message",
    entityId: result.insertId,
    summary: `Mensaje enviado al canal ${cleanChannel}.`
  });

  const [[message]] = await pool.query(
    `
      SELECT
        messages.*,
        sender.full_name AS sender_name,
        sender.role AS sender_role,
        reply.body AS reply_body,
        reply.attachment_type AS reply_attachment_type,
        reply.attachment_url AS reply_attachment_url,
        reply_sender.full_name AS reply_sender_name
      FROM profile_general_messages AS messages
      LEFT JOIN app_users AS sender ON sender.id = messages.sender_user_id
      LEFT JOIN profile_general_messages AS reply ON reply.id = messages.reply_to_message_id
      LEFT JOIN app_users AS reply_sender ON reply_sender.id = reply.sender_user_id
      WHERE messages.id = ?
        AND messages.deleted_at IS NULL
      LIMIT 1
    `,
    [result.insertId]
  );

  const normalizedMessage = normalizeGeneralMessage(message);
  const [recipients] = await pool.query(
    `
      SELECT id
      FROM app_users
      WHERE is_active = 1
        AND id <> ?
      ORDER BY role = 'admin' ASC, full_name ASC
    `,
    [authUser.id]
  );

  let notificationMessages = [];
  if (recipients.length) {
    const notificationBody = buildChannelNotificationBody({
      channel: cleanChannel,
      senderName: message?.sender_name || authUser.full_name,
      body: cleanBody,
      attachmentType: cleanAttachmentType
    });
    const values = recipients.map((recipient) => [authUser.id, recipient.id, null, notificationBody]);
    const [notificationResult] = await pool.query(
      `
        INSERT INTO user_profile_messages (sender_user_id, recipient_user_id, parent_message_id, body)
        VALUES ?
      `,
      [values]
    );
    const firstId = Number(notificationResult.insertId ?? 0);
    if (firstId) {
      const ids = values.map((_, index) => firstId + index);
      const [notificationRows] = await pool.query(
        `
          SELECT
            messages.*,
            sender.full_name AS sender_name,
            sender.role AS sender_role,
            recipient.full_name AS recipient_name
          FROM user_profile_messages AS messages
          LEFT JOIN app_users AS sender ON sender.id = messages.sender_user_id
          LEFT JOIN app_users AS recipient ON recipient.id = messages.recipient_user_id
          WHERE messages.id IN (?)
          ORDER BY messages.id ASC
        `,
        [ids]
      );
      notificationMessages = notificationRows.map(normalizeMessage);
    }
  }

  return {
    message: normalizedMessage,
    notifications: notificationMessages,
    notifications_delivered: notificationMessages.length
  };
};

export const updateGeneralProfileMessagePin = async ({ authUser, messageId, pinned = true }) => {
  if (env.useMemoryDb) {
    throw makeError("Los mensajes requieren base de datos persistente.", 503);
  }

  if (authUser.role !== "admin") {
    throw makeError("Solo administración puede anclar mensajes.", 403);
  }

  const id = asPositiveId(messageId);
  if (!id) {
    throw makeError("Mensaje invalido.");
  }

  const pool = getPool();
  await pool.query(
    `
      UPDATE profile_general_messages
      SET pinned_at = ?, pinned_by = ?
      WHERE id = ? AND deleted_at IS NULL
    `,
    [pinned ? new Date() : null, pinned ? authUser.id : null, id]
  );

  const [[message]] = await pool.query(
    `
      SELECT
        messages.*,
        sender.full_name AS sender_name,
        sender.role AS sender_role,
        reply.body AS reply_body,
        reply.attachment_type AS reply_attachment_type,
        reply.attachment_url AS reply_attachment_url,
        reply_sender.full_name AS reply_sender_name
      FROM profile_general_messages AS messages
      LEFT JOIN app_users AS sender ON sender.id = messages.sender_user_id
      LEFT JOIN profile_general_messages AS reply ON reply.id = messages.reply_to_message_id
      LEFT JOIN app_users AS reply_sender ON reply_sender.id = reply.sender_user_id
      WHERE messages.id = ?
        AND messages.deleted_at IS NULL
      LIMIT 1
    `,
    [id]
  );

  if (!message) {
    throw makeError("Mensaje no encontrado.", 404);
  }

  return normalizeGeneralMessage(message);
};

export const deleteGeneralProfileMessage = async ({ authUser, messageId }) => {
  if (env.useMemoryDb) {
    throw makeError("Los mensajes requieren base de datos persistente.", 503);
  }

  const id = asPositiveId(messageId);
  if (!id) {
    throw makeError("Mensaje invalido.");
  }

  const pool = getPool();
  const [[message]] = await pool.query(
    `
      SELECT id, sender_user_id
      FROM profile_general_messages
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
    `,
    [id]
  );

  if (!message) {
    throw makeError("Mensaje no encontrado.", 404);
  }

  if (authUser.role !== "admin" && Number(message.sender_user_id) !== Number(authUser.id)) {
    throw makeError("Solo administracion o el dueno del mensaje puede borrarlo.", 403);
  }

  const [result] = await pool.query(
    `
      UPDATE profile_general_messages
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `,
    [id]
  );

  if (!result.affectedRows) {
    throw makeError("Mensaje no encontrado.", 404);
  }

  return { ok: true, id };
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
    throw makeError("Solo administración puede asignar logros.", 403);
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
    awarded_by_name: achievement.awarded_by_name ?? "Administración"
  };
};
