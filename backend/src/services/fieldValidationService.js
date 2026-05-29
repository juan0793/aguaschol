import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";

const VALIDATION_STATUSES = new Set(["pending", "approved", "needs_correction", "corrected"]);
const DEFAULT_MARKER_COLOR = "#1576d1";

const normalizeMarkerColor = (value) => {
  const candidate = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : DEFAULT_MARKER_COLOR;
};

const normalizeStatus = (value) => {
  const status = String(value ?? "pending").trim();
  return VALIDATION_STATUSES.has(status) ? status : "pending";
};

const normalizeDiaryDate = (value) => {
  const candidate = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
};

const normalizePointPatch = (payload = {}) => ({
  point_type: String(payload.point_type ?? "caja_registro").trim() || "caja_registro",
  latitude: Number(payload.latitude),
  longitude: Number(payload.longitude),
  accuracy_meters:
    payload.accuracy_meters == null || payload.accuracy_meters === ""
      ? null
      : Number(payload.accuracy_meters),
  description: String(payload.description ?? "").trim(),
  reference_note: String(payload.reference ?? payload.reference_note ?? "").trim(),
  marker_color: normalizeMarkerColor(payload.marker_color),
  is_terminal_point: Boolean(payload.is_terminal_point)
});

const validateCoordinates = ({ latitude, longitude }) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error("Debes proporcionar latitud y longitud validas.");
    error.status = 400;
    throw error;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    const error = new Error("Las coordenadas estan fuera del rango permitido.");
    error.status = 400;
    throw error;
  }
};

const SELECT_VALIDATION_POINT = `
  SELECT
    map_points.*,
    DATE_FORMAT(map_points.diary_date, '%Y-%m-%d') AS diary_date,
    creator.full_name AS created_by_name,
    validator.full_name AS validated_by_name
  FROM map_points
  LEFT JOIN app_users creator ON creator.id = map_points.created_by
  LEFT JOIN app_users validator ON validator.id = map_points.validated_by
`;

export const listFieldValidationPoints = async ({ date = "", status = "" } = {}) => {
  if (env.useMemoryDb) {
    return [];
  }

  const diaryDate = normalizeDiaryDate(date);
  const statusFilter = VALIDATION_STATUSES.has(status) ? status : "";
  const filters = [];
  const params = [];

  if (diaryDate) {
    filters.push("COALESCE(map_points.diary_date, DATE(map_points.created_at)) = ?");
    params.push(diaryDate);
  }

  if (statusFilter) {
    filters.push("map_points.validation_status = ?");
    params.push(statusFilter);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const pool = getPool();
  const [rows] = await pool.query(
    `
      ${SELECT_VALIDATION_POINT}
      ${whereClause}
      ORDER BY
        FIELD(map_points.validation_status, 'needs_correction', 'pending', 'corrected', 'approved'),
        map_points.updated_at DESC,
        map_points.created_at DESC
    `,
    params
  );

  return rows;
};

export const validateFieldPoint = async (id, payload = {}, authUser) => {
  if (env.useMemoryDb) {
    const error = new Error("La validacion de campo requiere base de datos persistente.");
    error.status = 503;
    throw error;
  }

  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    const error = new Error("Punto invalido.");
    error.status = 400;
    throw error;
  }

  const pointPatch = normalizePointPatch(payload);
  validateCoordinates(pointPatch);

  const status = normalizeStatus(payload.validation_status);
  const validationNotes = String(payload.validation_notes ?? "").trim();
  const correctionNotes = String(payload.correction_notes ?? "").trim();

  if (status === "needs_correction" && !correctionNotes) {
    const error = new Error("Agrega una nota para indicar que debe corregirse.");
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(`${SELECT_VALIDATION_POINT} WHERE map_points.id = ? LIMIT 1`, [targetId]);
  const current = rows[0];

  if (!current) {
    const error = new Error("Punto no encontrado.");
    error.status = 404;
    throw error;
  }

  await pool.query(
    `
      UPDATE map_points
      SET
        point_type = ?,
        latitude = ?,
        longitude = ?,
        accuracy_meters = ?,
        description = ?,
        reference_note = ?,
        marker_color = ?,
        is_terminal_point = ?,
        validation_status = ?,
        validated_by = ?,
        validated_at = NOW(),
        validation_notes = ?,
        correction_notes = ?
      WHERE id = ?
    `,
    [
      pointPatch.point_type,
      pointPatch.latitude,
      pointPatch.longitude,
      pointPatch.accuracy_meters,
      pointPatch.description,
      pointPatch.reference_note,
      pointPatch.marker_color,
      pointPatch.is_terminal_point ? 1 : 0,
      status,
      authUser?.id ?? null,
      validationNotes,
      correctionNotes,
      targetId
    ]
  );

  const [updatedRows] = await pool.query(`${SELECT_VALIDATION_POINT} WHERE map_points.id = ? LIMIT 1`, [targetId]);
  const point = updatedRows[0];
  const previousPayload = {
    point_type: current.point_type,
    latitude: current.latitude,
    longitude: current.longitude,
    accuracy_meters: current.accuracy_meters,
    description: current.description,
    reference_note: current.reference_note,
    marker_color: current.marker_color,
    is_terminal_point: Boolean(current.is_terminal_point),
    validation_notes: current.validation_notes,
    correction_notes: current.correction_notes
  };
  const nextPayload = {
    point_type: point.point_type,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy_meters: point.accuracy_meters,
    description: point.description,
    reference_note: point.reference_note,
    marker_color: point.marker_color,
    is_terminal_point: Boolean(point.is_terminal_point),
    validation_notes: point.validation_notes,
    correction_notes: point.correction_notes
  };

  await pool.query(
    `
      INSERT INTO map_point_validation_logs (
        map_point_id, validator_user_id, previous_status, next_status, previous_payload_json, next_payload_json, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      targetId,
      authUser?.id ?? null,
      current.validation_status || "pending",
      point.validation_status || status,
      JSON.stringify(previousPayload),
      JSON.stringify(nextPayload),
      validationNotes || correctionNotes
    ]
  );

  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "map_point.validated",
    entityType: "map_point",
    entityId: point.id,
    summary: `Punto ${point.point_type} validado como ${point.validation_status}`,
    details: {
      previous_status: current.validation_status || "pending",
      next_status: point.validation_status,
      latitude: point.latitude,
      longitude: point.longitude
    }
  });

  return point;
};
