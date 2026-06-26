import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { resolveBarrioNameFromClave } from "./barrioCodeService.js";

const memoryPoints = [];
const DEFAULT_MARKER_COLOR = "#1576d1";
const HONDURAS_TIME_ZONE = "America/Tegucigalpa";
const REPORT_BLUE = "FF1576D1";
const REPORT_DARK = "FF10375B";
const REPORT_LIGHT = "FFEAF4FC";
const REPORT_BORDER = "FFBFD4E8";
const BACKEND_LOGO_PATH = path.resolve(env.dbRoot, "backend", "src", "assets", "logo-aguas-choluteca.png");
const FRONTEND_LOGO_PATH = path.resolve(env.dbRoot, "frontend", "src", "assets", "logo-aguas-choluteca.png");
const LOGO_PATH = fs.existsSync(BACKEND_LOGO_PATH) ? BACKEND_LOGO_PATH : FRONTEND_LOGO_PATH;
const POINT_TYPE_LABELS = {
  caja_registro: "Caja de registro",
  descarga: "Descarga",
  pozo: "Pozo de visita",
  negocio_local_comercial: "Negocio / local comercial",
  alerta: "Alerta",
  punto_observado: "Punto observado"
};
const normalizeMarkerColor = (value) => {
  const candidate = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : DEFAULT_MARKER_COLOR;
};
const buildMapsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
const formatExactPoint = (latitude, longitude) =>
  `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
const getLocalDiaryDateKey = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: HONDURAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
};
const formatReportDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};
const uniqueText = (values = []) => Array.from(new Set(values.filter(Boolean)));
const normalizeDiaryDate = (value) => {
  const candidate = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
};
const formatDiaryDateLabel = (value) => {
  const candidate = normalizeDiaryDate(value);
  return candidate ? `${candidate.slice(8, 10)}/${candidate.slice(5, 7)}/${candidate.slice(0, 4)}` : "Todas";
};
const getMapPointTypeLabel = (value = "") =>
  POINT_TYPE_LABELS[value] || String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const toArgb = (value, fallback = DEFAULT_MARKER_COLOR) => `FF${normalizeMarkerColor(value || fallback).slice(1).toUpperCase()}`;
const MAP_POINT_SELECT_FIELDS = `
  map_points.*,
  DATE_FORMAT(map_points.diary_date, '%Y-%m-%d') AS diary_date
`;
const normalizeHousingUnits = (value) => {
  const numeric = Math.round(Number(value || 1));
  return Number.isFinite(numeric) ? Math.max(1, Math.min(999, numeric)) : 1;
};

const extractClaveFromText = (value = "") =>
  String(value ?? "").match(/\b\d{2,3}-\d{2}-\d{2}(?:-\d{2})?\b/)?.[0] || "";

const applyBarrioToReference = ({ referenceNote = "", description = "" } = {}) => {
  const barrio = resolveBarrioNameFromClave(extractClaveFromText(`${referenceNote} ${description}`), "");
  if (!barrio) return referenceNote;
  if (!referenceNote) return barrio;
  if (referenceNote.toLowerCase().includes(barrio.toLowerCase())) return referenceNote;
  return `${barrio} - ${referenceNote}`;
};

const normalizePayload = (payload = {}) => {
  const description = String(payload.description ?? "").trim();
  const referenceNote = String(payload.reference ?? payload.reference_note ?? "").trim();

  return {
    point_type: String(payload.point_type ?? "caja_registro").trim() || "caja_registro",
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    accuracy_meters:
      payload.accuracy_meters == null || payload.accuracy_meters === ""
        ? null
        : Number(payload.accuracy_meters),
    description,
    reference_note: applyBarrioToReference({ referenceNote, description }),
    marker_color: normalizeMarkerColor(payload.marker_color),
    is_terminal_point: Boolean(payload.is_terminal_point),
    housing_units: normalizeHousingUnits(payload.housing_units)
  };
};

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

export const listMapPoints = async ({ date = "" } = {}) => {
  const diaryDate = normalizeDiaryDate(date);
  if (env.useMemoryDb) {
    return [...memoryPoints]
      .filter((point) => !diaryDate || point.diary_date === diaryDate || getLocalDiaryDateKey(point.created_at) === diaryDate)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const pool = getPool();
  const params = [];
  const whereClause = diaryDate
    ? "WHERE COALESCE(map_points.diary_date, DATE(map_points.created_at)) = ?"
    : "";

  if (diaryDate) {
    params.push(diaryDate);
  }

  const [rows] = await pool.query(
    `
      SELECT
        ${MAP_POINT_SELECT_FIELDS},
        app_users.full_name AS created_by_name
      FROM map_points
      LEFT JOIN app_users ON app_users.id = map_points.created_by
      ${whereClause}
      ORDER BY map_points.created_at DESC
    `,
    params
  );
  return rows;
};

export const listMapPointDiaryGroups = async () => {
  if (env.useMemoryDb) {
    return Array.from(
      memoryPoints.reduce((groups, point) => {
        const key = point.diary_date || getLocalDiaryDateKey(point.created_at);
        if (!key) return groups;
        groups.set(key, (groups.get(key) || 0) + 1);
        return groups;
      }, new Map()).entries()
    )
      .map(([key, total]) => ({ key, total }))
      .sort((left, right) => right.key.localeCompare(left.key));
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        DATE_FORMAT(COALESCE(map_points.diary_date, DATE(map_points.created_at)), '%Y-%m-%d') AS \`key\`,
        COUNT(*) AS total
      FROM map_points
      GROUP BY DATE_FORMAT(COALESCE(map_points.diary_date, DATE(map_points.created_at)), '%Y-%m-%d')
      ORDER BY \`key\` DESC
    `
  );
  return rows.map((row) => ({
    key: row.key instanceof Date ? getLocalDiaryDateKey(row.key) : String(row.key || ""),
    total: Number(row.total || 0)
  }));
};

const getSortedMapPoints = async (options = {}) =>
  (await listMapPoints(options)).sort((left, right) => {
    const dateDiff = new Date(left.created_at) - new Date(right.created_at);
    if (dateDiff !== 0) return dateDiff;
    return Number(left.id || 0) - Number(right.id || 0);
  });

const styleHeaderRow = (row) => {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_BLUE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: REPORT_BORDER } },
      left: { style: "thin", color: { argb: REPORT_BORDER } },
      bottom: { style: "thin", color: { argb: REPORT_BORDER } },
      right: { style: "thin", color: { argb: REPORT_BORDER } }
    };
  });
};

const styleDataRow = (row, index) => {
  row.height = 24;
  row.eachCell((cell) => {
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } }
    };
    if (index % 2 === 1) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FBFF" } };
    }
  });
};

const setHyperlink = (cell, url, label = "Abrir en Maps") => {
  cell.value = { text: label, hyperlink: url };
  cell.font = { color: { argb: "FF0563C1" }, underline: true };
};

const addReportLogo = (workbook, worksheet) => {
  if (!fs.existsSync(LOGO_PATH)) return;
  const logoId = workbook.addImage({ filename: LOGO_PATH, extension: "png" });
  worksheet.addImage(logoId, {
    tl: { col: 0.2, row: 0.2 },
    ext: { width: 58, height: 58 }
  });
};

const decorateWorksheet = (worksheet, lastColumn) => {
  worksheet.properties.defaultRowHeight = 20;
  worksheet.pageSetup = {
    paperSize: 1,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 }
  };
  worksheet.views = [{ state: "frozen", ySplit: 7 }];
  worksheet.getColumn(lastColumn).alignment = { wrapText: true, vertical: "top" };
};

export const exportMapPointsWorkbook = async ({ date = "" } = {}) => {
  const diaryDate = normalizeDiaryDate(date);
  const points = await getSortedMapPoints({ date: diaryDate });
  const workbook = new ExcelJS.Workbook();
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

  workbook.creator = "Aguas de Choluteca";
  workbook.created = new Date(generatedAt);

  const reportSheet = workbook.addWorksheet("reporte_detallado");
  reportSheet.columns = [
    { header: "No.", key: "no", width: 7 },
    { header: "Tipo", key: "tipo", width: 24 },
    { header: "Marca", key: "marca", width: 13 },
    { header: "Latitud", key: "latitud", width: 14 },
    { header: "Longitud", key: "longitud", width: 14 },
    { header: "Coordenadas", key: "coordenadas", width: 27 },
    { header: "Precision (m)", key: "precision", width: 14 },
    { header: "Viviendas", key: "viviendas", width: 11 },
    { header: "Referencia", key: "referencia", width: 38 },
    { header: "Descripcion", key: "descripcion", width: 46 },
    { header: "Registrado", key: "registrado", width: 23 },
    { header: "Google Maps", key: "maps", width: 20 }
  ];
  reportSheet.mergeCells("C1:J1");
  reportSheet.mergeCells("C2:J2");
  reportSheet.mergeCells("C3:J3");
  reportSheet.mergeCells("K1:L2");
  reportSheet.mergeCells("K3:L4");
  reportSheet.mergeCells("A5:L5");
  addReportLogo(workbook, reportSheet);
  reportSheet.getCell("A1").value = "";
  reportSheet.getCell("C1").value = "REPORTE DETALLADO DE PUNTOS DE CAMPO";
  reportSheet.getCell("C1").font = { bold: true, size: 16, color: { argb: REPORT_DARK } };
  reportSheet.getCell("C2").value = "Aguas de Choluteca, S.A. de C.V.";
  reportSheet.getCell("C2").font = { bold: true, size: 11, color: { argb: REPORT_BLUE } };
  reportSheet.getCell("C3").value = `Jornada: ${formatDiaryDateLabel(diaryDate)} | Generado: ${generatedLabel}`;
  reportSheet.getCell("C3").font = { size: 10, color: { argb: "FF405B75" } };
  reportSheet.getCell("K1").value = `${points.length}\npuntos`;
  reportSheet.getCell("K1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  reportSheet.getCell("K1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_BLUE } };
  reportSheet.getCell("K1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  reportSheet.getCell("K3").value = `${groupedPoints.length}\nubicaciones`;
  reportSheet.getCell("K3").font = { bold: true, size: 14, color: { argb: REPORT_DARK } };
  reportSheet.getCell("K3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_LIGHT } };
  reportSheet.getCell("K3").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  reportSheet.getCell("A5").value = "Ordenado por hora de registro. Cada fila queda enumerada e incluye coordenadas copiables y enlace directo a Google Maps.";
  reportSheet.getCell("A5").font = { bold: true, color: { argb: REPORT_DARK } };
  reportSheet.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_LIGHT } };
  reportSheet.getCell("A5").alignment = { vertical: "middle", wrapText: true };
  reportSheet.getRow(1).height = 24;
  reportSheet.getRow(2).height = 20;
  reportSheet.getRow(3).height = 20;
  reportSheet.getRow(4).height = 18;
  reportSheet.getRow(5).height = 24;
  reportSheet.getRow(7).values = reportSheet.columns.map((column) => column.header);
  styleHeaderRow(reportSheet.getRow(7));

  points.forEach((point, index) => {
    const row = reportSheet.addRow({
      no: index + 1,
      tipo: getMapPointTypeLabel(point.point_type),
      marca: point.is_terminal_point ? "Pin final" : point.marker_color || DEFAULT_MARKER_COLOR,
      latitud: Number(point.latitude),
      longitud: Number(point.longitude),
      coordenadas: formatExactPoint(point.latitude, point.longitude),
      precision: point.accuracy_meters == null ? "" : Number(point.accuracy_meters),
      viviendas: point.housing_units ?? 1,
      referencia: point.reference_note || "",
      descripcion: point.description || "",
      registrado: `${formatReportDate(point.created_at)}${point.created_by_name ? ` - ${point.created_by_name}` : ""}`,
      maps: "Abrir en Maps"
    });
    styleDataRow(row, index);
    row.getCell("C").fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(point.marker_color) } };
    row.getCell("C").font = { color: { argb: "FFFFFFFF" }, bold: true };
    setHyperlink(row.getCell("L"), buildMapsUrl(point.latitude, point.longitude));
  });

  const lastReportRow = Math.max(8, reportSheet.lastRow?.number || 8);
  reportSheet.autoFilter = { from: "A7", to: `L${lastReportRow}` };
  reportSheet.getColumn("D").numFmt = "0.000000";
  reportSheet.getColumn("E").numFmt = "0.000000";
  reportSheet.getColumn("G").numFmt = "0.00";
  decorateWorksheet(reportSheet, "J");

  const locationSheet = workbook.addWorksheet("por_ubicacion");
  locationSheet.columns = [
    { header: "No.", key: "no", width: 7 },
    { header: "Coordenadas", key: "coordenadas", width: 28 },
    { header: "Latitud", key: "latitud", width: 14 },
    { header: "Longitud", key: "longitud", width: 14 },
    { header: "Puntos", key: "total", width: 10 },
    { header: "Precision prom. (m)", key: "precision", width: 18 },
    { header: "Tipos registrados", key: "tipos", width: 34 },
    { header: "Referencias", key: "referencias", width: 64 },
    { header: "Google Maps", key: "maps", width: 20 }
  ];
  locationSheet.mergeCells("A1:I1");
  locationSheet.getCell("A1").value = "RESUMEN POR UBICACION EXACTA";
  locationSheet.getCell("A1").font = { bold: true, size: 14, color: { argb: REPORT_DARK } };
  locationSheet.getRow(3).values = locationSheet.columns.map((column) => column.header);
  styleHeaderRow(locationSheet.getRow(3));
  groupedPoints.forEach((group, index) => {
    const row = locationSheet.addRow({
      no: index + 1,
      coordenadas: group.key,
      latitud: group.latitud,
      longitud: group.longitud,
      total: group.total_puntos,
      precision: group.precision_values.length
        ? Number((group.precision_values.reduce((total, value) => total + value, 0) / group.precision_values.length).toFixed(2))
        : "",
      tipos: Array.from(group.tipos).map(getMapPointTypeLabel).join(", "),
      referencias: uniqueText(group.referencias).join(" | "),
      maps: "Abrir en Maps"
    });
    styleDataRow(row, index);
    setHyperlink(row.getCell("I"), group.maps_url);
  });
  locationSheet.autoFilter = { from: "A3", to: `I${Math.max(4, locationSheet.lastRow?.number || 4)}` };
  locationSheet.getColumn("C").numFmt = "0.000000";
  locationSheet.getColumn("D").numFmt = "0.000000";
  locationSheet.getColumn("F").numFmt = "0.00";
  locationSheet.views = [{ state: "frozen", ySplit: 3 }];

  const dataSheet = workbook.addWorksheet("datos");
  dataSheet.columns = [
    { header: "id", key: "id", width: 10 },
    { header: "no", key: "no", width: 7 },
    { header: "fecha", key: "fecha", width: 23 },
    { header: "tipo_punto", key: "tipo", width: 28 },
    { header: "color", key: "color", width: 12 },
    { header: "pin_final", key: "pin", width: 10 },
    { header: "latitud", key: "latitud", width: 14 },
    { header: "longitud", key: "longitud", width: 14 },
    { header: "coordenadas", key: "coordenadas", width: 28 },
    { header: "precision_metros", key: "precision", width: 18 },
    { header: "viviendas", key: "viviendas", width: 12 },
    { header: "referencia", key: "referencia", width: 42 },
    { header: "descripcion", key: "descripcion", width: 56 },
    { header: "creado_por", key: "creado_por", width: 24 },
    { header: "maps_url", key: "maps", width: 70 }
  ];
  styleHeaderRow(dataSheet.getRow(1));
  points.forEach((point, index) => {
    const row = dataSheet.addRow({
      id: point.id ?? "",
      no: index + 1,
      fecha: formatReportDate(point.created_at),
      tipo: getMapPointTypeLabel(point.point_type),
      color: point.marker_color || DEFAULT_MARKER_COLOR,
      pin: point.is_terminal_point ? "Si" : "No",
      latitud: Number(point.latitude),
      longitud: Number(point.longitude),
      coordenadas: formatExactPoint(point.latitude, point.longitude),
      precision: point.accuracy_meters == null ? "" : Number(point.accuracy_meters),
      viviendas: point.housing_units ?? 1,
      referencia: point.reference_note || "",
      descripcion: point.description || "",
      creado_por: point.created_by_name || "",
      maps: buildMapsUrl(point.latitude, point.longitude)
    });
    styleDataRow(row, index);
  });
  dataSheet.autoFilter = { from: "A1", to: `O${Math.max(2, dataSheet.lastRow?.number || 2)}` };
  dataSheet.views = [{ state: "frozen", ySplit: 1 }];

  return {
    fileName: `reporte-detallado-puntos-campo-${diaryDate || new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: Buffer.from(await workbook.xlsx.writeBuffer())
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
      diary_date: getLocalDiaryDateKey(new Date()),
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
        point_type, latitude, longitude, accuracy_meters, description, reference_note, marker_color, is_terminal_point, housing_units, created_by, diary_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.housing_units,
      authUser?.id ?? null,
      getLocalDiaryDateKey(new Date())
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        ${MAP_POINT_SELECT_FIELDS},
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
        ${MAP_POINT_SELECT_FIELDS},
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

  const nextValidationStatus =
    current.validation_status === "needs_correction" ? "corrected" : current.validation_status || "pending";

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
        housing_units = ?,
        validation_status = ?
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
      data.housing_units,
      nextValidationStatus,
      id
    ]
  );

  const [updatedRows] = await pool.query(
    `
      SELECT
        ${MAP_POINT_SELECT_FIELDS},
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
  const [rows] = await pool.query(`SELECT ${MAP_POINT_SELECT_FIELDS} FROM map_points WHERE id = ? LIMIT 1`, [id]);
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
