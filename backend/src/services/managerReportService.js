import { randomBytes } from "node:crypto";
import { getPool } from "../config/db.js";
import { createAuditLog, createReportArchive, getReportArchive } from "./auditService.js";
import { getAguasServiceReport, getClaveLookupMeta } from "./claveLookupService.js";
import { getResumenInspecciones, queryInspecciones } from "./inspeccionesService.js";
import { getResumen as getEntregasResumen } from "./entregasService.js";
import { listClandestinosFichas } from "./clandestinosService.js";
import { listMapPoints, listMapPointDiaryGroups } from "./mapPointService.js";
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

export const loadManagerReportData = async (filters, user) => {
  assertReader(user);
  const { type, month, barrio, from, to } = filters;
  const notes = [];
  let sections = [];
  let cutoff = null;
  if (type === "portfolio") {
    const [report, meta] = await Promise.all([getAguasServiceReport(), getClaveLookupMeta()]);
    const rows = report.barrios.filter((row) => !barrio || row.barrio_colonia.toLowerCase() === barrio.toLowerCase());
    if (barrio && !rows.length) throw fail("El barrio no aparece en el padrón activo.", 404);
    cutoff = meta.updated_at;
    notes.push("Cartera del padrón activo. No representa una evolución histórica de mora.");
    sections = [section("Cartera por barrio", ["Barrio", "Cuentas", "Capital", "Intereses", "Mora total"], rows.map((row) => [row.barrio_colonia, row.total_registros, money(row.deuda.capital), money(row.deuda.intereses), money(row.deuda.total)]))];
  } else if (type === "inspections") {
    const rows = await queryInspecciones({ barrio }, user);
    const filtered = rows.filter((row) => { const date = day(new Date(row.fecha_asignacion)); return date >= from && date <= to; });
    notes.push(`Inspecciones asignadas en el período: ${filtered.length}. Se muestran hasta 500.`);
    sections = [section("Inspecciones asignadas", ["Número", "Clave", "Barrio", "Responsable", "Estado"], filtered.slice(0, 500).map((row) => [row.numero_inspeccion, row.clave_catastral, row.barrio_snapshot, row.tecnico_responsable_nombre, row.estado]))];
  } else if (type === "deliveries") {
    const data = await getEntregasResumen({ fecha_desde: from, fecha_hasta: to }, user);
    notes.push("Consulta de seguimiento. La preparación del informe no cierra ni revisa lotes.");
    sections = [section("Resumen del período", ["Indicador", "Total"], [["Lotes", data.lotes], ["Lotes abiertos", data.lotes_abiertos], ["Asignadas", data.asignadas], ["Entregadas", data.entregadas], ["Pendientes", data.pendientes], ["Vencidas", data.vencidas]]), section("Seguimiento diario", ["Fecha", "Asignadas", "Entregadas", "No entregadas"], data.por_dia.map((row) => [row.fecha, row.asignadas, row.entregadas, row.no_entregadas]))];
  } else if (type === "clandestinos") {
    const data = await listClandestinosFichas({ barrio, limit: 500 });
    notes.push(`Fichas activas de la consulta: ${data.total}. Se muestran ${data.items.length}.`);
    sections = [section("Fichas activas", ["Clave", "Abonado", "Nombre", "Barrio", "Estado"], data.items.map((row) => [row.clave_catastral, row.abonado, row.inquilino || row.nombre_catastral, row.barrio_colonia, row.estado_operativo || "pending"]))];
  } else if (type === "gps") {
    const rows = await listMapPoints();
    const filtered = rows.filter((row) => {
      const date = row.diary_date ? String(row.diary_date).slice(0, 10) : day(new Date(row.created_at));
      return date >= from && date <= to;
    });
    notes.push(`Puntos del período y filtros: ${filtered.length}. Se muestran hasta 500.`);
    sections = [section("Puntos GPS", ["Fecha", "Tipo", "Latitud", "Longitud", "Técnico"], filtered.slice(0, 500).map((row) => [row.diary_date || day(new Date(row.created_at)), row.point_type, Number(row.latitude).toFixed(6), Number(row.longitude).toFixed(6), row.created_by_name]))];
  } else if (type === "team") {
    const data = await listTeamActivity({ desde: from, hasta: to, tz: 360, limit: 200 }, user);
    notes.push(`Eventos del período: ${data.total}. Se muestran ${data.items.length}.`);
    sections = [section("Actividad institucional", ["Fecha", "Persona", "Actividad"], data.items.map((row) => [day(new Date(row.created_at)), row.actor_name, row.summary]))];
  } else {
    const [padron, meta, inspections, deliveries, fichas, gps] = await Promise.all([
      getAguasServiceReport(), getClaveLookupMeta(), getResumenInspecciones(user, { mes: month }),
      getEntregasResumen({ fecha_desde: from, fecha_hasta: to }, user), listClandestinosFichas({ limit: 5 }), listMapPointDiaryGroups()
    ]);
    cutoff = meta.updated_at;
    notes.push("Cartera y fichas corresponden al estado actual. El período filtra Inspecciones y Entregas; la carga técnica es actual.");
    sections = [section("Padrón y cartera actual", ["Indicador", "Total"], [["Cuentas", padron.summary.total_records], ["Barrios", padron.summary.total_barrios], ["Capital", money(padron.summary.deuda.capital)], ["Intereses", money(padron.summary.deuda.intereses)], ["Mora", money(padron.summary.deuda.total)], ["Fichas activas", fichas.total], ["Puntos GPS registrados", gps.reduce((sum, row) => sum + row.total, 0)]]), section("Seguimiento del período", ["Indicador", "Total"], [["Inspecciones creadas", inspections.creadas_mes], ["Inspecciones finalizadas", inspections.finalizadas_mes], ["Documentos entregados", deliveries.entregadas], ["Documentos pendientes", deliveries.pendientes], ["Documentos vencidos", deliveries.vencidas]]), section("Carga técnica actual", ["Técnico", "Inspecciones activas"], inspections.carga_tecnicos.map((row) => [row.nombre, row.activas]))];
  }
  return { sections, notes, cutoff, period: ["portfolio", "clandestinos"].includes(type) ? null : { from, to } };
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
