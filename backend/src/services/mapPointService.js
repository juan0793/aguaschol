import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";

const memoryPoints = [];

const normalizePayload = (payload = {}) => ({
  point_type: String(payload.point_type ?? "caja_registro").trim() || "caja_registro",
  latitude: Number(payload.latitude),
  longitude: Number(payload.longitude),
  accuracy_meters:
    payload.accuracy_meters == null || payload.accuracy_meters === ""
      ? null
      : Number(payload.accuracy_meters),
  description: String(payload.description ?? "").trim(),
  reference_note: String(payload.reference ?? payload.reference_note ?? "").trim()
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

export const listMapPoints = async () => {
  if (env.useMemoryDb) {
    return [...memoryPoints].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        map_points.*,
        app_users.full_name AS created_by_name
      FROM map_points
      LEFT JOIN app_users ON app_users.id = map_points.created_by
      ORDER BY map_points.created_at DESC
      LIMIT 500
    `
  );
  return rows;
};

export const createMapPoint = async (payload, authUser) => {
  const data = normalizePayload(payload);
  validateCoordinates(data);

  if (env.useMemoryDb) {
    const point = {
      id: memoryPoints.length + 1,
      ...data,
      created_by: authUser?.id ?? null,
      created_by_name: authUser?.full_name ?? authUser?.username ?? "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryPoints.unshift(point);
    return point;
  }

  const pool = getPool();
  const [result] = await pool.query(
    `
      INSERT INTO map_points (
        point_type, latitude, longitude, accuracy_meters, description, reference_note, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.point_type,
      data.latitude,
      data.longitude,
      data.accuracy_meters,
      data.description,
      data.reference_note,
      authUser?.id ?? null
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        map_points.*,
        app_users.full_name AS created_by_name
      FROM map_points
      LEFT JOIN app_users ON app_users.id = map_points.created_by
      WHERE map_points.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  const point = rows[0];
  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "map_point.created",
    entityType: "map_point",
    entityId: point.id,
    summary: `Punto ${point.point_type} registrado en mapa`,
    details: {
      latitude: point.latitude,
      longitude: point.longitude,
      reference_note: point.reference_note
    }
  });

  return point;
};

export const deleteMapPoint = async (id, authUser) => {
  if (env.useMemoryDb) {
    const index = memoryPoints.findIndex((point) => point.id === Number(id));
    if (index === -1) {
      const error = new Error("Punto no encontrado.");
      error.status = 404;
      throw error;
    }

    const [point] = memoryPoints.splice(index, 1);
    return point;
  }

  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM map_points WHERE id = ? LIMIT 1", [id]);
  const point = rows[0];

  if (!point) {
    const error = new Error("Punto no encontrado.");
    error.status = 404;
    throw error;
  }

  await pool.query("DELETE FROM map_points WHERE id = ?", [id]);
  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "map_point.deleted",
    entityType: "map_point",
    entityId: point.id,
    summary: `Punto ${point.point_type} eliminado del mapa`,
    details: {
      latitude: point.latitude,
      longitude: point.longitude,
      reference_note: point.reference_note
    }
  });

  return point;
};
