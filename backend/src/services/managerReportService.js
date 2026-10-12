import { randomBytes } from "node:crypto";
import { getPool } from "../config/db.js";
import { createAuditLog, createReportArchive, getReportArchive } from "./auditService.js";
import { getAguasServiceReport, getClaveLookupMeta } from "./claveLookupService.js";
import { getResumenInspecciones, queryInspecciones } from "./inspeccionesService.js";
import { getResumen as getEntregasResumen } from "./entregasService.js";
import { listClandestinosFichas, ritmoClandestinosFichas } from "./clandestinosService.js";
import { listBancoClandestinos } from "./bancoClandestinosService.js";
import { getMapPointTypeLabel, listMapPoints, listMapPointDiaryGroups } from "./mapPointService.js";
import { listTeamActivity } from "./teamActivityService.js";
import { canReadInstitutionally } from "../utils/permissions.js";
import { hashToken } from "../utils/password.js";

export const MANAGER_REPORT_TITLES = {
  executive: "Resumen ejecutivo de Gerencia General", portfolio: "Cartera y padrón por barrio",
  inspections: "Seguimiento de inspecciones", deliveries: "Control de entregas",
  clandestinos: "Fichas clandestinas", gps: "Seguimiento territorial GPS", team: "Actividad del equipo"
};
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const day = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const assertReader = (user) => { if (!canReadInstitutionally(user)) throw fail("No tienes permiso para exportar informes gerenciales.", 403); };
// No registrar el hash usado en auth_sessions: la compatibilidad antigua lo acepta como token.
const reportSessionBinding = (token) => hashToken(`manager-report:${token}`);
const money = (value) => {
  if (value == null || !Number.isFinite(Number(value))) throw fail("El padrón no devolvió un importe válido.", 503);
  return `L ${Number(value).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const section = (title, columns, rows) => ({ title, columns, rows });

export const validateManagerReportParams = (input = {}, now = new Date()) => {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["type", "month", "barrio"].includes(key))) throw fail("Filtros de informe no válidos.");
  const type = input.type ?? "executive";
  if (typeof type !== "string" || !Object.hasOwn(MANAGER_REPORT_TITLES, type)) throw fail("Tipo de informe no válido.");
  const today = day(now);
  const month = input.month ?? today.slice(0, 7);
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > today.slice(0, 7) || Number(month.slice(0, 4)) < 1000) throw fail("Mes de informe no válido.");
  if (input.barrio != null && typeof input.barrio !== "string") throw fail("Barrio no válido.");
  const barrio = (input.barrio || "").trim();
  if (barrio.length > 180 || (barrio && !["portfolio", "inspections", "clandestinos"].includes(type))) throw fail("El filtro de barrio no corresponde a este informe.");
  const [year, number] = month.split("-").map(Number);
  return { type, month, barrio, from: `${month}-01`, to: month === today.slice(0, 7) ? today : `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` };
};

// Cifras para leer en pantalla: las tablas llevan texto ya formateado (también van al PDF)
// y `insights` lleva números para gráficos e indicadores.
const count = (value) => Number(value || 0).toLocaleString("es-HN");
const FICHA_LABELS = { draft: "Borrador", pending: "Por visitar", visit: "En visita", confirmed: "Aviso pendiente", regularization: "En seguimiento", regularized: "Cerrada", discarded: "Descartada" };
const INSPECCION_LABELS = { ASIGNADA: "Asignada", EN_PROCESO: "En proceso", SEGUIMIENTO: "En seguimiento", FINALIZADA: "Finalizada" };
const amount = (value) => Number(Number(value || 0).toFixed(2));
const topCounts = (items, keyOf, limit = 10) => {
  const totals = new Map();
  for (const item of items) {
    const key = String(keyOf(item) || "").trim() || "Sin dato";
    totals.set(key, (totals.get(key) || 0) + 1);
  }
  return [...totals.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es")).slice(0, limit);
};
const perDay = (dates, from, to) => {
  const totals = new Map();
  for (const date of dates) if (date >= from && date <= to) totals.set(date, (totals.get(date) || 0) + 1);
  const days = [];
  for (let cursor = new Date(`${from}T12:00:00Z`); day(cursor) <= to; cursor = new Date(cursor.getTime() + 86400000)) days.push({ fecha: day(cursor), total: totals.get(day(cursor)) || 0 });
  return days;
};

export const loadManagerReportData = async (filters, user) => {
  assertReader(user);
  const { type, month, barrio, from, to } = filters;
  const notes = [];
  let sections = [];
  let cutoff = null;
  let insights = {};
  if (type === "portfolio") {
    const [report, meta] = await Promise.all([getAguasServiceReport(), getClaveLookupMeta()]);
    const rows = report.barrios.filter((row) => !barrio || row.barrio_colonia.toLowerCase() === barrio.toLowerCase());
    if (barrio && !rows.length) throw fail("El barrio no aparece en el padrón activo.", 404);
    cutoff = meta.updated_at;
    notes.push("Cartera del padrón activo. No representa una evolución histórica de mora.");
    const ordered = [...rows].sort((a, b) => Number(b.deuda.total) - Number(a.deuda.total));
    sections = [section("Cartera por barrio", ["Barrio", "Cuentas", "Capital", "Intereses", "Mora total"], ordered.map((row) => [row.barrio_colonia, count(row.total_registros), money(row.deuda.capital), money(row.deuda.intereses), money(row.deuda.total)]))];
    const capital = amount(rows.reduce((sum, row) => sum + Number(row.deuda.capital || 0), 0));
    const intereses = amount(rows.reduce((sum, row) => sum + Number(row.deuda.intereses || 0), 0));
    insights = {
      cuentas: rows.reduce((sum, row) => sum + Number(row.total_registros || 0), 0),
      capital, intereses, mora: amount(capital + intereses), total_barrios: rows.length,
      barrios: ordered.slice(0, 12).map((row) => ({ label: row.barrio_colonia, cuentas: Number(row.total_registros || 0), capital: amount(row.deuda.capital), intereses: amount(row.deuda.intereses), total: amount(row.deuda.total) }))
    };
  } else if (type === "inspections") {
    const rows = await queryInspecciones({ barrio }, user);
    const filtered = rows.filter((row) => { const date = day(new Date(row.fecha_asignacion)); return date >= from && date <= to; });
    notes.push(`Inspecciones asignadas en el período: ${count(filtered.length)}. Se muestran hasta 500.`);
    sections = [section("Inspecciones asignadas", ["Número", "Clave", "Barrio", "Responsable", "Estado"], filtered.slice(0, 500).map((row) => [row.numero_inspeccion, row.clave_catastral, row.barrio_snapshot, row.tecnico_responsable_nombre, INSPECCION_LABELS[row.estado] || row.estado]))];
    insights = {
      total: filtered.length,
      estados: Object.fromEntries(["ASIGNADA", "EN_PROCESO", "SEGUIMIENTO", "FINALIZADA"].map((estado) => [estado, filtered.filter((row) => row.estado === estado).length])),
      barrios: topCounts(filtered, (row) => row.barrio_snapshot, 10),
      responsables: topCounts(filtered, (row) => row.tecnico_responsable_nombre || "Sin responsable", 10),
      por_dia: perDay(filtered.map((row) => day(new Date(row.fecha_asignacion))), from, to)
    };
  } else if (type === "deliveries") {
    const data = await getEntregasResumen({ fecha_desde: from, fecha_hasta: to }, user);
    notes.push("Consulta de seguimiento. La preparación del informe no cierra ni revisa lotes.");
    sections = [section("Resumen del período", ["Indicador", "Total"], [["Lotes", count(data.lotes)], ["Lotes abiertos", count(data.lotes_abiertos)], ["Asignadas", count(data.asignadas)], ["Entregadas", count(data.entregadas)], ["Pendientes", count(data.pendientes)], ["Vencidas", count(data.vencidas)]]), section("Seguimiento diario", ["Fecha", "Asignadas", "Entregadas", "No entregadas"], data.por_dia.map((row) => [row.fecha, count(row.asignadas), count(row.entregadas), count(row.no_entregadas)]))];
    insights = {
      lotes: Number(data.lotes || 0), lotes_abiertos: Number(data.lotes_abiertos || 0), asignadas: Number(data.asignadas || 0),
      entregadas: Number(data.entregadas || 0), pendientes: Number(data.pendientes || 0), vencidas: Number(data.vencidas || 0),
      por_dia: (data.por_dia || []).map((row) => ({ fecha: row.fecha, asignadas: Number(row.asignadas || 0), entregadas: Number(row.entregadas || 0), no_entregadas: Number(row.no_entregadas || 0) }))
    };
  } else if (type === "clandestinos") {
    const [data, ritmo, banco] = await Promise.all([
      listClandestinosFichas({ barrio, limit: 500 }),
      ritmoClandestinosFichas({ barrio, granularidad: "mes" }),
      barrio ? Promise.resolve(null) : listBancoClandestinos({ estado: "", limit: 5 })
    ]);
    notes.push(`Fichas activas de la consulta: ${count(data.total)}. Se muestran ${count(data.items.length)}.`);
    sections = [section("Fichas activas", ["Clave", "Abonado", "Nombre", "Barrio", "Estado"], data.items.map((row) => [row.clave_catastral, row.abonado, row.inquilino || row.nombre_catastral, row.barrio_colonia, FICHA_LABELS[row.estado_operativo || "pending"] || row.estado_operativo]))];
    insights = {
      total: Number(data.total || 0),
      etapas: Object.fromEntries(Object.entries(data.counts || {}).map(([key, value]) => [key, Number(value || 0)])),
      barrios: (ritmo.barrios || []).map((row) => ({ label: row.barrio, total: Number(row.total || 0) })),
      por_mes: (ritmo.serie || []).slice(-12).map((row) => ({ periodo: row.periodo, total: Number(row.total || 0) })),
      ritmo: ritmo.totales,
      banco: banco ? {
        estados: banco.estados, dictamenes: banco.counts, sin_asignar: Number(banco.sin_asignar || 0),
        barrios: (banco.barrio_counts || []).slice(0, 8).map((row) => ({ label: row.barrio, total: row.total, clandestino: row.clandestino, sin_determinar: row.sin_determinar, registrado: row.registrado })),
        tecnicos: (banco.asignaciones || []).filter((row) => row.total > 0).map((row) => ({ label: row.nombre, pendientes: row.pendientes, trabajados: row.trabajados, total: row.total, avance: row.avance }))
      } : null
    };
    if (banco) notes.push("El banco reúne puntos de campo que todavía no son ficha; sus cifras son del estado actual.");
  } else if (type === "gps") {
    const rows = await listMapPoints();
    const dated = rows.map((row) => ({ ...row, fecha: row.diary_date ? String(row.diary_date).slice(0, 10) : day(new Date(row.created_at)) }));
    const filtered = dated.filter((row) => row.fecha >= from && row.fecha <= to);
    notes.push(`Puntos del período y filtros: ${count(filtered.length)}. Se muestran hasta 500.`);
    sections = [section("Puntos GPS", ["Fecha", "Tipo", "Latitud", "Longitud", "Técnico"], filtered.slice(0, 500).map((row) => [row.fecha, getMapPointTypeLabel(row.point_type), Number(row.latitude).toFixed(6), Number(row.longitude).toFixed(6), row.created_by_name]))];
    insights = {
      total: filtered.length,
      tipos: topCounts(filtered, (row) => getMapPointTypeLabel(row.point_type), 8),
      tecnicos: topCounts(filtered, (row) => row.created_by_name || "Sin técnico", 10),
      por_dia: perDay(filtered.map((row) => row.fecha), from, to)
    };
  } else if (type === "team") {
    const data = await listTeamActivity({ desde: from, hasta: to, tz: 360, limit: 200 }, user);
    notes.push(`Eventos del período: ${count(data.total)}. Se muestran ${count(data.items.length)}.`);
    sections = [section("Actividad institucional", ["Fecha", "Persona", "Actividad"], data.items.map((row) => [day(new Date(row.created_at)), row.actor_name, row.summary]))];
    insights = {
      total: Number(data.total || 0),
      personas: topCounts(data.items, (row) => row.actor_name || "Sin nombre", 10),
      por_dia: perDay(data.items.map((row) => day(new Date(row.created_at))), from, to)
    };
  } else {
    const [padron, meta, inspections, deliveries, fichas, gps] = await Promise.all([
      getAguasServiceReport(), getClaveLookupMeta(), getResumenInspecciones(user, { mes: month }),
      getEntregasResumen({ fecha_desde: from, fecha_hasta: to }, user), listClandestinosFichas({ limit: 5 }), listMapPointDiaryGroups()
    ]);
    cutoff = meta.updated_at;
    notes.push("Cartera y fichas corresponden al estado actual. El período filtra Inspecciones y Entregas; la carga técnica es actual.");
    const puntos = gps.reduce((sum, row) => sum + row.total, 0);
    sections = [section("Padrón y cartera actual", ["Indicador", "Total"], [["Cuentas", count(padron.summary.total_records)], ["Barrios", count(padron.summary.total_barrios)], ["Capital", money(padron.summary.deuda.capital)], ["Intereses", money(padron.summary.deuda.intereses)], ["Mora", money(padron.summary.deuda.total)], ["Fichas activas", count(fichas.total)], ["Puntos GPS registrados", count(puntos)]]), section("Seguimiento del período", ["Indicador", "Total"], [["Inspecciones creadas", count(inspections.creadas_mes)], ["Inspecciones finalizadas", count(inspections.finalizadas_mes)], ["Documentos entregados", count(deliveries.entregadas)], ["Documentos pendientes", count(deliveries.pendientes)], ["Documentos vencidos", count(deliveries.vencidas)]]), section("Carga técnica actual", ["Técnico", "Inspecciones activas"], inspections.carga_tecnicos.map((row) => [row.nombre, count(row.activas)]))];
    insights = {
      cuentas: Number(padron.summary.total_records || 0), barrios: Number(padron.summary.total_barrios || 0),
      capital: amount(padron.summary.deuda.capital), intereses: amount(padron.summary.deuda.intereses), mora: amount(padron.summary.deuda.total),
      deudores: Number(padron.summary.deuda.deudores || 0), fichas: Number(fichas.total || 0), puntos,
      inspecciones: { creadas: Number(inspections.creadas_mes || 0), finalizadas: Number(inspections.finalizadas_mes || 0), creadas_anterior: inspections.creadas_mes_anterior ?? null, finalizadas_anterior: inspections.finalizadas_mes_anterior ?? null },
      entregas: { entregadas: Number(deliveries.entregadas || 0), asignadas: Number(deliveries.asignadas || 0), pendientes: Number(deliveries.pendientes || 0), vencidas: Number(deliveries.vencidas || 0) },
      carga: inspections.carga_tecnicos.map((row) => ({ label: row.nombre || "Sin nombre", total: Number(row.activas || 0) }))
    };
  }
  return { sections, notes, cutoff, insights, period: ["portfolio", "clandestinos"].includes(type) ? null : { from, to } };
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const archiveMarkup = (report) => `<header class="print-header"><h1>Aguas de Choluteca</h1><h2>${escapeHtml(report.title)}</h2><p>Informe gerencial de consulta - ${escapeHtml(report.report_id)}</p><p>Preparado: ${escapeHtml(report.created_at)}</p>${report.period ? `<p>Período: ${escapeHtml(report.period.from)} al ${escapeHtml(report.period.to)}</p>` : ""}${report.cutoff ? `<p>Corte del padrón: ${escapeHtml(report.cutoff)}</p>` : ""}${report.filters.barrio ? `<p>Barrio: ${escapeHtml(report.filters.barrio)}</p>` : ""}</header>${report.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}${report.sections.map((item) => `<section><h3>${escapeHtml(item.title)}</h3><table class="field-report-table"><thead><tr>${item.columns.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${item.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>${!item.rows.length ? "<p>Sin registros para los filtros seleccionados.</p>" : ""}</section>`).join("")}`;

export const persistPreparedReport = async (report, user, token, executor) => {
  assertReader(user);
  if (!token) throw fail("Sesión requerida.", 401);
  const connection = executor || await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await createReportArchive({ reportId: report.report_id, title: report.title, reportType: `manager.${report.type}`, bodyClassName: "field-report-body", bodyMarkup: archiveMarkup(report), actorUserId: user.id, executor: connection });
    await createAuditLog({ actorUserId: user.id, action: "report.manager.prepared", entityType: "report", entityId: report.report_id, summary: `Informe gerencial preparado: ${report.title}`, details: { session_binding: reportSessionBinding(token), effective_role: user.role, preview_mode: Boolean(user.preview), original_role: user.preview?.original_role || user.role, prepared_at: report.created_at, filters: report.filters, cutoff: report.cutoff, rows: report.sections.reduce((sum, item) => sum + item.rows.length, 0) }, executor: connection });
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
};

export const prepareManagerReport = async (input, user, token, { load = loadManagerReportData, persist = persistPreparedReport, now = new Date() } = {}) => {
  assertReader(user);
  if (!token) throw fail("Sesión requerida.", 401);
  const filters = validateManagerReportParams(input, now);
  const data = await load(filters, user);
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const parts = Object.fromEntries(stamp.map((part) => [part.type, part.value]));
  const report = { ...data, type: filters.type, title: MANAGER_REPORT_TITLES[filters.type], filters, created_at: now.toISOString(), report_id: `RPT-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}-${randomBytes(4).toString("hex").toUpperCase()}` };
  await persist(report, user, token);
  return report;
};

const findPreparedReport = async (reportId, user) => {
  const [rows] = await getPool().query("SELECT details_json FROM audit_logs WHERE action = 'report.manager.prepared' AND entity_id = ? AND actor_user_id = ? ORDER BY id DESC LIMIT 1", [reportId, user.id]);
  return rows[0] ? JSON.parse(rows[0].details_json) : null;
};

export const registerManagerReportEvent = async (reportId, input, user, token, { find = findPreparedReport, audit = createAuditLog, now = new Date() } = {}) => {
  assertReader(user);
  if (!/^RPT-\d{8}-\d{6}-[A-F0-9]{8}$/.test(reportId)) throw fail("Identificador de informe no válido.");
  if (!input || !["pdf_generated", "download_requested"].includes(input.event) || !Number.isInteger(input.bytes) || input.bytes < 1 || input.bytes > 25_000_000 || !/^[a-f0-9]{64}$/.test(input.sha256 || "")) throw fail("Evento de exportación no válido.");
  const prepared = await find(reportId, user);
  const age = prepared ? now.getTime() - Date.parse(prepared.prepared_at) : NaN;
  if (!token || prepared?.session_binding !== reportSessionBinding(token) || !Number.isFinite(age) || age < -60000 || age > 30 * 60000) throw fail("El informe no pertenece a esta sesión o su autorización de exportación venció. Genera una nueva consulta.", 403);
  await audit({ actorUserId: user.id, action: `report.manager.${input.event}`, entityType: "report", entityId: reportId, summary: input.event === "pdf_generated" ? "PDF gerencial generado (declarado por el cliente)" : "Descarga de PDF gerencial solicitada", details: { effective_role: user.role, preview_mode: Boolean(user.preview), original_role: user.preview?.original_role || user.role, bytes: input.bytes, sha256: input.sha256, client_declared: true } });
  return { ok: true };
};

export const getOwnManagerReportArchive = async (reportId, user, { get = getReportArchive, find = findPreparedReport } = {}) => {
  assertReader(user);
  if (!/^RPT-\d{8}-\d{6}-[A-F0-9]{8}$/.test(reportId)) throw fail("Identificador de informe no válido.");
  const [archive, prepared] = await Promise.all([get(reportId), find(reportId, user)]);
  if (!archive || !prepared || Number(archive.actor_user_id) !== Number(user.id) || archive.report_type !== `manager.${prepared.filters?.type}`) throw fail("No tienes acceso a este informe.", 403);
  return archive;
};
