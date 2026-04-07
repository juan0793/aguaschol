import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import XLSX from "xlsx";

const memoryPoints = [];
const DEFAULT_MARKER_COLOR = "#1576d1";
const normalizeMarkerColor = (value) => {
  const candidate = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : DEFAULT_MARKER_COLOR;
};
const buildMapsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
const formatExactPoint = (latitude, longitude) =>
  `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
const formatReportDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};
const uniqueText = (values = []) => Array.from(new Set(values.filter(Boolean)));
const setSheetHyperlink = (worksheet, address, url, label = "Abrir punto") => {
  worksheet[address] = {
    t: "s",
    v: label,
    l: { Target: url, Tooltip: url }
  };
};

const normalizePayload = (payload = {}) => ({
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
  const generatedLabel = formatReportDate(generatedAt);
  const groupedPoints = Array.from(
    points.reduce((groups, point) => {
      const key = formatExactPoint(point.latitude, point.longitude);
      const current = groups.get(key) ?? {
        key,
        latitud: Number(point.latitude),
        longitud: Number(point.longitude),
        total_puntos: 0,
        precision_values: [],
        tipos: new Set(),
        referencias: [],
        maps_url: buildMapsUrl(point.latitude, point.longitude),
        items: []
      };

      current.total_puntos += 1;
      current.tipos.add(point.point_type);
      if (point.reference_note) {
        current.referencias.push(point.reference_note);
      }
      if (Number.isFinite(Number(point.accuracy_meters))) {
        current.precision_values.push(Number(point.accuracy_meters));
      }
      current.items.push(point);
      groups.set(key, current);
      return groups;
    }, new Map()).values()
  );

  const groupedRows = groupedPoints.map((group) => ({
    punto_exacto: group.key,
    latitud: group.latitud,
    longitud: group.longitud,
    total_puntos: group.total_puntos,
    precision_promedio_m: group.precision_values.length
      ? Number((group.precision_values.reduce((total, value) => total + value, 0) / group.precision_values.length).toFixed(2))
      : "",
    tipos_registrados: Array.from(group.tipos).join(", "),
    referencias: uniqueText(group.referencias).join(" | "),
    maps_url: "Abrir punto"
  }));

  const detailRows = points.map((point, index) => ({
    no: index + 1,
    punto_exacto: formatExactPoint(point.latitude, point.longitude),
    fecha: formatReportDate(point.created_at),
    tipo_punto: point.point_type,
    color: point.marker_color || DEFAULT_MARKER_COLOR,
    pin_final: point.is_terminal_point ? "Si" : "No",
    latitud: Number(point.latitude),
    longitud: Number(point.longitude),
    precision_metros: point.accuracy_meters ?? "",
    referencia: point.reference_note ?? "",
    descripcion: point.description ?? "",
    creado_por: point.created_by_name ?? "",
    maps_url: "Abrir punto"
  }));

  const visualRows = [
    ["REPORTE DETALLADO DE PUNTOS DE CAMPO"],
    ["Generado", generatedLabel],
    ["Total de puntos", points.length, "Ubicaciones exactas", groupedPoints.length],
    ["Orden del reporte", "Agrupado por coordenada exacta y luego por fecha de registro"],
    []
  ];
  const visualMerges = [
    XLSX.utils.decode_range("A1:H1"),
    XLSX.utils.decode_range("B2:H2"),
    XLSX.utils.decode_range("B4:H4")
  ];

  groupedPoints.forEach((group, groupIndex) => {
    const averageAccuracy = group.precision_values.length
      ? Number((group.precision_values.reduce((total, value) => total + value, 0) / group.precision_values.length).toFixed(2))
      : "";

    const startRow = visualRows.length + 1;
    visualRows.push([`UBICACION ${groupIndex + 1}`, group.key]);
    visualRows.push(["Google Maps", "Abrir punto en el mapa"]);
    visualRows.push(["Total de puntos", group.total_puntos, "Precision promedio (m)", averageAccuracy || "--"]);
    visualRows.push(["Tipos registrados", Array.from(group.tipos).join(", ") || "--"]);
    visualRows.push(["Referencias", uniqueText(group.referencias).join(" | ") || "--"]);
    visualRows.push(["#", "Fecha", "Tipo de punto", "Referencia", "Descripcion", "Precision (m)", "Creado por", "Maps"]);

    visualMerges.push(XLSX.utils.decode_range(`B${startRow}:H${startRow}`));
    visualMerges.push(XLSX.utils.decode_range(`B${startRow + 1}:H${startRow + 1}`));
    visualMerges.push(XLSX.utils.decode_range(`B${startRow + 3}:H${startRow + 3}`));
    visualMerges.push(XLSX.utils.decode_range(`B${startRow + 4}:H${startRow + 4}`));

    group.items.forEach((point, pointIndex) => {
      visualRows.push([
        pointIndex + 1,
        formatReportDate(point.created_at),
        point.point_type,
        point.reference_note || "--",
        point.description || "--",
        point.accuracy_meters ?? "--",
        point.created_by_name || "--",
        "Abrir punto"
      ]);
    });

    visualRows.push([]);
    visualRows.push([]);
  });

  const summarySheet = XLSX.utils.json_to_sheet(groupedRows);
  summarySheet["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 28 },
    { wch: 56 },
    { wch: 22 }
  ];
  summarySheet["!autofilter"] = { ref: `A1:H${Math.max(groupedRows.length + 1, 2)}` };
  summarySheet["!rows"] = [{ hpt: 24 }, ...groupedRows.map(() => ({ hpt: 22 }))];
  groupedPoints.forEach((group, index) => {
    setSheetHyperlink(summarySheet, `H${index + 2}`, group.maps_url);
  });

  const detailSheet = XLSX.utils.json_to_sheet(detailRows);
  detailSheet["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 13 },
    { wch: 13 },
    { wch: 17 },
    { wch: 34 },
    { wch: 50 },
    { wch: 24 },
    { wch: 22 }
  ];
  detailSheet["!autofilter"] = { ref: `A1:M${Math.max(detailRows.length + 1, 2)}` };
  detailSheet["!rows"] = [{ hpt: 24 }, ...detailRows.map(() => ({ hpt: 22 }))];
  points.forEach((point, index) => {
    setSheetHyperlink(detailSheet, `M${index + 2}`, buildMapsUrl(point.latitude, point.longitude));
  });

  const metaSheet = XLSX.utils.aoa_to_sheet([
    ["Reporte detallado de puntos de campo"],
    ["Generado", generatedLabel],
    ["Total de puntos", points.length],
    ["Ubicaciones exactas", groupedRows.length],
    ["Orden", "Latitud ascendente, longitud ascendente y luego fecha"],
    [],
    ["Este archivo contiene una hoja visual por ubicacion exacta, una hoja resumen por punto exacto y una hoja con el detalle completo de cada registro."]
  ]);
  metaSheet["!cols"] = [{ wch: 24 }, { wch: 90 }];
  metaSheet["!rows"] = [{ hpt: 26 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 12 }, { hpt: 38 }];

  const visualSheet = XLSX.utils.aoa_to_sheet(visualRows);
  visualSheet["!cols"] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 50 },
    { wch: 18 },
    { wch: 24 },
    { wch: 22 }
  ];
  visualSheet["!merges"] = visualMerges;
  visualSheet["!rows"] = visualRows.map((row, index) => {
    if (index === 0) return { hpt: 28 };
    if (index >= 1 && index <= 3) return { hpt: 22 };
    if (!row.some(Boolean)) return { hpt: 12 };
    if (String(row[0] ?? "").startsWith("UBICACION")) return { hpt: 24 };
    if (row[0] === "#") return { hpt: 22 };
    return { hpt: 20 };
  });
  let visualCursor = 6;
  groupedPoints.forEach((group) => {
    setSheetHyperlink(visualSheet, `B${visualCursor + 1}`, group.maps_url, "Abrir punto en el mapa");
    group.items.forEach((point, index) => {
      setSheetHyperlink(visualSheet, `H${visualCursor + 5 + index + 1}`, buildMapsUrl(point.latitude, point.longitude));
    });
    visualCursor += 6 + group.items.length + 2;
  });

  XLSX.utils.book_append_sheet(workbook, metaSheet, "resumen");
  XLSX.utils.book_append_sheet(workbook, visualSheet, "reporte_visual");
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
        point_type, latitude, longitude, accuracy_meters, description, reference_note, marker_color, is_terminal_point, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.point_type,
      data.latitude,
      data.longitude,
      data.accuracy_meters,
      data.description,
      data.reference_note,
      data.marker_color,
      data.is_terminal_point ? 1 : 0,
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
      reference_note: point.reference_note,
      marker_color: point.marker_color,
      is_terminal_point: Boolean(point.is_terminal_point)
    }
  });

  return point;
};

export const updateMapPoint = async (id, payload, authUser) => {
  const data = normalizePayload(payload);
  validateCoordinates(data);

  if (env.useMemoryDb) {
    const index = memoryPoints.findIndex((point) => point.id === Number(id));
    if (index === -1) {
      const error = new Error("Punto no encontrado.");
      error.status = 404;
      throw error;
    }

    memoryPoints[index] = {
      ...memoryPoints[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    return memoryPoints[index];
  }

  const pool = getPool();
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
    [id]
  );
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
        is_terminal_point = ?
      WHERE id = ?
    `,
    [
      data.point_type,
      data.latitude,
      data.longitude,
      data.accuracy_meters,
      data.description,
      data.reference_note,
      data.marker_color,
      data.is_terminal_point ? 1 : 0,
      id
    ]
  );

  const [updatedRows] = await pool.query(
    `
      SELECT
        map_points.*,
        app_users.full_name AS created_by_name
      FROM map_points
      LEFT JOIN app_users ON app_users.id = map_points.created_by
      WHERE map_points.id = ?
      LIMIT 1
    `,
    [id]
  );
  const point = updatedRows[0];

  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "map_point.updated",
    entityType: "map_point",
    entityId: point.id,
    summary: `Punto ${point.point_type} actualizado en reportes de campo`,
    details: {
      previous: {
        latitude: current.latitude,
        longitude: current.longitude,
        reference_note: current.reference_note,
        marker_color: current.marker_color,
        is_terminal_point: Boolean(current.is_terminal_point)
      },
      next: {
        latitude: point.latitude,
        longitude: point.longitude,
        reference_note: point.reference_note,
        marker_color: point.marker_color,
        is_terminal_point: Boolean(point.is_terminal_point)
      }
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
