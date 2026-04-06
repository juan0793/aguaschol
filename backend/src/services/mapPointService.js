import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import XLSX from "xlsx";

const memoryPoints = [];
const buildMapsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;

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

const getSortedMapPoints = async () =>
  (await listMapPoints()).sort((left, right) => {
    const latitudeDiff = Number(left.latitude) - Number(right.latitude);
    if (latitudeDiff !== 0) {
      return latitudeDiff;
    }

    const longitudeDiff = Number(left.longitude) - Number(right.longitude);
    if (longitudeDiff !== 0) {
      return longitudeDiff;
    }

    return new Date(left.created_at) - new Date(right.created_at);
  });

export const exportMapPointsWorkbook = async () => {
  const points = await getSortedMapPoints();
  const workbook = XLSX.utils.book_new();
  const generatedAt = new Date().toISOString();

  const groupedRows = Array.from(
    points.reduce((groups, point) => {
      const key = `${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}`;
      const current = groups.get(key) ?? {
        punto_exacto: key,
        latitud: Number(point.latitude),
        longitud: Number(point.longitude),
        precision_promedio_m: [],
        total_puntos: 0,
        tipos: new Set(),
        referencias: [],
        maps_url: buildMapsUrl(point.latitude, point.longitude)
      };

      current.total_puntos += 1;
      current.tipos.add(point.point_type);
      if (point.reference_note) {
        current.referencias.push(point.reference_note);
      }
      if (Number.isFinite(Number(point.accuracy_meters))) {
        current.precision_promedio_m.push(Number(point.accuracy_meters));
      }
      groups.set(key, current);
      return groups;
    }, new Map()).values()
  ).map((group) => ({
    punto_exacto: group.punto_exacto,
    latitud: group.latitud,
    longitud: group.longitud,
    total_puntos: group.total_puntos,
    precision_promedio_m: group.precision_promedio_m.length
      ? Number(
          (
            group.precision_promedio_m.reduce((total, value) => total + value, 0) / group.precision_promedio_m.length
          ).toFixed(2)
        )
      : "",
    tipos_registrados: Array.from(group.tipos).join(", "),
    referencias: group.referencias.join(" | "),
    maps_url: group.maps_url
  }));

  const detailRows = points.map((point, index) => ({
    no: index + 1,
    punto_exacto: `${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}`,
    fecha: point.created_at,
    tipo_punto: point.point_type,
    latitud: Number(point.latitude),
    longitud: Number(point.longitude),
    precision_metros: point.accuracy_meters ?? "",
    referencia: point.reference_note ?? "",
    descripcion: point.description ?? "",
    creado_por: point.created_by_name ?? "",
    maps_url: buildMapsUrl(point.latitude, point.longitude)
  }));

  const summarySheet = XLSX.utils.json_to_sheet(groupedRows);
  summarySheet["!cols"] = [
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 24 },
    { wch: 48 },
    { wch: 48 }
  ];
  summarySheet["!autofilter"] = { ref: `A1:H${Math.max(groupedRows.length + 1, 2)}` };

  const detailSheet = XLSX.utils.json_to_sheet(detailRows);
  detailSheet["!cols"] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 34 },
    { wch: 48 },
    { wch: 24 },
    { wch: 48 }
  ];
  detailSheet["!autofilter"] = { ref: `A1:K${Math.max(detailRows.length + 1, 2)}` };

  const metaSheet = XLSX.utils.aoa_to_sheet([
    ["Reporte detallado de puntos de campo"],
    ["Generado", generatedAt],
    ["Total de puntos", points.length],
    ["Ubicaciones exactas", groupedRows.length],
    ["Orden", "Latitud ascendente, longitud ascendente y luego fecha"],
    [],
    ["Este archivo contiene una hoja resumen por punto exacto y otra hoja con el detalle completo de cada registro."]
  ]);
  metaSheet["!cols"] = [{ wch: 24 }, { wch: 80 }];

  XLSX.utils.book_append_sheet(workbook, metaSheet, "resumen");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "por_ubicacion");
  XLSX.utils.book_append_sheet(workbook, detailSheet, "detalle_puntos");

  return {
    fileName: `reporte-detallado-puntos-campo-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  };
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
