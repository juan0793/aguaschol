import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { getById, listInmuebles } from "./inmuebleService.js";
import { saveUploadedPhoto } from "./fileStorageService.js";

export const FICHA_STATES = ["draft", "pending", "visit", "confirmed", "regularization", "regularized", "discarded"];
export const REPORT_STATES = ["new", "review", "info_requested", "approved", "linked", "duplicate", "discarded"];
export const FICHA_TRANSITIONS = { draft: ["pending"], pending: ["visit", "discarded"], visit: ["pending", "confirmed", "discarded"], confirmed: ["regularization"], regularization: ["confirmed", "regularized"], regularized: [], discarded: ["pending"] };
export const REPORT_TRANSITIONS = { new: ["review"], review: ["info_requested", "approved", "duplicate", "discarded"], info_requested: ["review", "discarded"], approved: ["linked", "duplicate", "discarded"], linked: [], duplicate: [], discarded: [] };

const memoryReports = [];
const memoryHistory = [];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value) => String(value ?? "").trim();
const servicesJson = (value) => JSON.stringify(value && typeof value === "object" ? value : {});
const parseJson = (value, fallback = {}) => {
  try { return typeof value === "string" ? JSON.parse(value) : value || fallback; } catch { return fallback; }
};
const mapReport = (row) => ({ ...row, services: parseJson(row.servicios_json), evidences: row.evidences || [] });
const canReview = (user) => ["admin", "operator"].includes(user?.role);

export const getClandestinosConfig = (user) => ({
  ficha_states: FICHA_STATES,
  ficha_transitions: FICHA_TRANSITIONS,
  report_states: REPORT_STATES,
  report_transitions: REPORT_TRANSITIONS,
  discard_reasons: ["No corresponde a inmueble clandestino", "Dirección inexistente", "Registro duplicado", "Sin evidencia suficiente"],
  print_templates: ["technical_sheet", "notice", "inspection_order", "evidences", "batch_list"],
  permissions: {
    can_create_report: ["admin", "operator", "validadora_campo"].includes(user?.role),
    can_review_report: canReview(user),
    can_manage_ficha_state: canReview(user),
    can_confirm_or_regularize: user?.role === "admin",
    can_discard: user?.role === "admin",
    can_manage_configuration: user?.role === "admin"
  }
});

export const listClandestinosFichas = async ({ query = "", state = "", barrio = "", page = 1, limit = 15 } = {}) => {
  query = clean(query); state = clean(state); barrio = clean(barrio);
  const all = await listInmuebles({ query, archived: false });
  const filtered = all.filter((item) =>
    (!state || (item.estado_operativo || "pending") === state) &&
    (!barrio || clean(item.barrio_colonia).toLowerCase() === clean(barrio).toLowerCase())
  );
  const safeLimit = Math.min(Math.max(Number(limit) || 15, 5), 100);
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (currentPage - 1) * safeLimit;
  const counts = FICHA_STATES.reduce((result, key) => ({ ...result, [key]: all.filter((item) => (item.estado_operativo || "pending") === key).length }), {});
  return { items: filtered.slice(start, start + safeLimit), total: filtered.length, page: currentPage, total_pages: totalPages, counts };
};

const addHistory = async ({ entityType, entityId, previous = "", next, reason = "", user }) => {
  if (env.useMemoryDb) {
    memoryHistory.unshift({ id: memoryHistory.length + 1, entidad_tipo: entityType, entidad_id: Number(entityId), estado_anterior: previous, estado_nuevo: next, motivo: reason, actor_name: user?.full_name || user?.username || "", created_at: new Date().toISOString() });
    return;
  }
  const pool = getPool();
  await pool.query("INSERT INTO historial_estados (entidad_tipo, entidad_id, estado_anterior, estado_nuevo, motivo, usuario_id) VALUES (?, ?, ?, ?, ?, ?)", [entityType, entityId, previous, next, reason, user?.id || null]);
};

export const changeFichaState = async (id, { state, reason = "" }, user) => {
  if (!canReview(user)) throw fail("Tu rol no puede modificar el estado de una ficha.", 403);
  if (!FICHA_STATES.includes(state)) throw fail("Estado de ficha no válido.");
  if (["confirmed", "regularization", "regularized", "discarded"].includes(state) && user?.role !== "admin") throw fail("Solo administración puede confirmar, regularizar o descartar fichas.", 403);
  if (state === "discarded" && !clean(reason)) throw fail("El motivo es obligatorio para descartar una ficha.");
  const current = await getById(id, { includeArchived: false });
  if (!current) throw fail("Ficha no encontrada.", 404);
  const previous = current.estado_operativo || "pending";
  if (previous === state) return current;
  if (!FICHA_TRANSITIONS[previous]?.includes(state)) throw fail(`La transición ${previous} → ${state} no está permitida.`, 409);
  if (env.useMemoryDb) {
    current.estado_operativo = state;
    current.updated_at = new Date().toISOString();
  } else {
    await getPool().query("UPDATE inmuebles_clandestinos SET estado_operativo = ? WHERE id = ? AND archived_at IS NULL", [state, id]);
  }
  await addHistory({ entityType: "ficha", entityId: id, previous, next: state, reason: clean(reason), user });
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "inmueble.state_changed", entityType: "inmueble", entityId: id, summary: `Ficha ${current.clave_catastral}: ${previous} → ${state}`, details: { previous, next: state, reason: clean(reason) } });
  return { ...(await getById(id, { includeArchived: false })), estado_operativo: state };
};

export const updateFichaInternalNotes = async (id, notes, user) => {
  if (!canReview(user)) throw fail("Tu rol no puede editar observaciones internas.", 403);
  const current = await getById(id, { includeArchived: false });
  if (!current) throw fail("Ficha no encontrada.", 404);
  const value = clean(notes);
  if (env.useMemoryDb) current.observaciones_internas = value;
  else await getPool().query("UPDATE inmuebles_clandestinos SET observaciones_internas = ? WHERE id = ? AND archived_at IS NULL", [value, id]);
  if (!env.useMemoryDb) await createAuditLog({ actorUserId: user?.id, action: "inmueble.internal_notes_updated", entityType: "inmueble", entityId: id, summary: `Observaciones internas actualizadas en ${current.clave_catastral}` });
  return { ...(await getById(id, { includeArchived: false })), observaciones_internas: value };
};

export const listStateHistory = async (entityType, entityId) => {
  if (env.useMemoryDb) return memoryHistory.filter((item) => item.entidad_tipo === entityType && item.entidad_id === Number(entityId));
  const [rows] = await getPool().query(`SELECT historial_estados.*, COALESCE(app_users.full_name, app_users.username, '') AS actor_name FROM historial_estados LEFT JOIN app_users ON app_users.id = historial_estados.usuario_id WHERE entidad_tipo = ? AND entidad_id = ? ORDER BY historial_estados.created_at DESC`, [entityType, entityId]);
  return rows;
};

const reportPayload = (payload = {}) => ({
  clave_consultada: clean(payload.clave_consultada), abonado_consultado: clean(payload.abonado_consultado),
  inmueble_sin_registro: payload.inmueble_sin_registro ? 1 : 0, nombre_reportado: clean(payload.nombre_reportado),
  barrio_colonia: clean(payload.barrio_colonia), direccion: clean(payload.direccion), hallazgo: clean(payload.hallazgo),
  servicios_json: servicesJson(payload.services), latitude: payload.latitude === "" || payload.latitude == null ? null : Number(payload.latitude),
  longitude: payload.longitude === "" || payload.longitude == null ? null : Number(payload.longitude),
  accuracy_meters: payload.accuracy_meters === "" || payload.accuracy_meters == null ? null : Number(payload.accuracy_meters),
  observaciones_internas: clean(payload.observaciones_internas)
});

export const listTechnicalReports = async ({ query = "", state = "" } = {}) => {
  query = clean(query); state = clean(state);
  if (env.useMemoryDb) return memoryReports.filter((item) => (!state || item.estado === state) && (!query || JSON.stringify(item).toLowerCase().includes(clean(query).toLowerCase()))).map(mapReport);
  const term = clean(query);
  const [rows] = await getPool().query(`SELECT reportes_tecnicos.*, COALESCE(app_users.full_name, app_users.username, '') AS creator_name FROM reportes_tecnicos LEFT JOIN app_users ON app_users.id = reportes_tecnicos.creado_por WHERE (? = '' OR reportes_tecnicos.estado = ?) AND (? = '' OR reportes_tecnicos.codigo LIKE ? OR reportes_tecnicos.clave_consultada LIKE ? OR reportes_tecnicos.abonado_consultado LIKE ? OR reportes_tecnicos.barrio_colonia LIKE ?) ORDER BY reportes_tecnicos.updated_at DESC`, [state, state, term, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]);
  if (!rows.length) return [];
  const [evidences] = await getPool().query("SELECT * FROM reporte_evidencias WHERE reporte_id IN (?) ORDER BY created_at DESC", [rows.map((row) => row.id)]);
  return rows.map((row) => mapReport({ ...row, evidences: evidences.filter((item) => Number(item.reporte_id) === Number(row.id)) }));
};

export const createTechnicalReport = async (payload, user) => {
  if (!["admin", "operator", "validadora_campo"].includes(user?.role)) throw fail("Tu rol no puede crear reportes técnicos.", 403);
  const data = reportPayload(payload);
  if (!data.inmueble_sin_registro && !data.clave_consultada && !data.abonado_consultado) throw fail("Confirma una clave o abonado, o marca inmueble sin registro.");
  if (!data.hallazgo) throw fail("Describe el hallazgo técnico.");
  const code = `RT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;
  if (env.useMemoryDb) {
    const report = mapReport({ id: memoryReports.length + 1, codigo: code, estado: "review", ...data, creado_por: user?.id, creator_name: user?.full_name || "", evidences: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    memoryReports.unshift(report); await addHistory({ entityType: "reporte", entityId: report.id, next: "review", reason: "Enviado desde campo", user }); return report;
  }
  const pool = getPool();
  const duplicateKey = data.clave_consultada || data.abonado_consultado;
  if (duplicateKey) {
    const [duplicates] = await pool.query("SELECT id, codigo FROM reportes_tecnicos WHERE estado NOT IN ('duplicate','discarded','linked') AND (clave_consultada = ? OR abonado_consultado = ?) LIMIT 1", [data.clave_consultada, data.abonado_consultado]);
    if (duplicates.length) throw fail(`Ya existe el reporte abierto ${duplicates[0].codigo} para esa referencia.`, 409);
  }
  const [result] = await pool.query(`INSERT INTO reportes_tecnicos (codigo, estado, clave_consultada, abonado_consultado, inmueble_sin_registro, nombre_reportado, barrio_colonia, direccion, hallazgo, servicios_json, latitude, longitude, accuracy_meters, observaciones_internas, creado_por) VALUES (?, 'review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [code, data.clave_consultada, data.abonado_consultado, data.inmueble_sin_registro, data.nombre_reportado, data.barrio_colonia, data.direccion, data.hallazgo, data.servicios_json, data.latitude, data.longitude, data.accuracy_meters, data.observaciones_internas, user?.id || null]);
  await addHistory({ entityType: "reporte", entityId: result.insertId, next: "review", reason: "Enviado desde campo", user });
  await createAuditLog({ actorUserId: user?.id, action: "technical_report.created", entityType: "technical_report", entityId: result.insertId, summary: `Reporte ${code} enviado a revisión` });
  return (await listTechnicalReports({ query: code }))[0];
};

export const changeReportState = async (id, { state, reason = "" }, user) => {
  if (!canReview(user)) throw fail("Tu rol no puede revisar reportes.", 403);
  if (!REPORT_STATES.includes(state)) throw fail("Estado de reporte no válido.");
  if (["info_requested", "duplicate", "discarded"].includes(state) && !clean(reason)) throw fail("Indica el motivo del cambio.");
  if (env.useMemoryDb) {
    const report = memoryReports.find((item) => Number(item.id) === Number(id)); if (!report) throw fail("Reporte no encontrado.", 404);
    const previous = report.estado; if (!REPORT_TRANSITIONS[previous]?.includes(state)) throw fail(`La transición ${previous} → ${state} no está permitida.`, 409); report.estado = state; report.motivo_estado = clean(reason); report.updated_at = new Date().toISOString(); await addHistory({ entityType: "reporte", entityId: id, previous, next: state, reason, user }); return report;
  }
  const [rows] = await getPool().query("SELECT * FROM reportes_tecnicos WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail("Reporte no encontrado.", 404);
  if (!REPORT_TRANSITIONS[rows[0].estado]?.includes(state)) throw fail(`La transición ${rows[0].estado} → ${state} no está permitida.`, 409);
  await getPool().query("UPDATE reportes_tecnicos SET estado = ?, motivo_estado = ?, revisado_por = ? WHERE id = ?", [state, clean(reason), user?.id || null, id]);
  await addHistory({ entityType: "reporte", entityId: id, previous: rows[0].estado, next: state, reason: clean(reason), user });
  await createAuditLog({ actorUserId: user?.id, action: "technical_report.state_changed", entityType: "technical_report", entityId: id, summary: `Reporte ${rows[0].codigo}: ${rows[0].estado} → ${state}`, details: { reason: clean(reason) } });
  return (await listTechnicalReports({ query: rows[0].codigo }))[0];
};

export const linkTechnicalReport = async (reportId, inmuebleId, user) => {
  if (!canReview(user)) throw fail("Tu rol no puede vincular reportes.", 403);
  const inmueble = await getById(inmuebleId, { includeArchived: false }); if (!inmueble) throw fail("Ficha no encontrada.", 404);
  if (env.useMemoryDb) return changeReportState(reportId, { state: "linked", reason: `Vinculado a ${inmueble.clave_catastral}` }, user);
  const pool = getPool();
  await pool.query("INSERT INTO vinculos_reportes (reporte_id, inmueble_id, creado_por) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tipo = VALUES(tipo)", [reportId, inmuebleId, user?.id || null]);
  await pool.query("UPDATE reportes_tecnicos SET inmueble_id = ? WHERE id = ?", [inmuebleId, reportId]);
  return changeReportState(reportId, { state: "linked", reason: `Vinculado a ${inmueble.clave_catastral}` }, user);
};

export const attachReportEvidence = async (reportId, file, description, user) => {
  if (!file) throw fail("Selecciona una fotografía.");
  const stored = await saveUploadedPhoto(file);
  if (env.useMemoryDb) {
    const report = memoryReports.find((item) => Number(item.id) === Number(reportId)); if (!report) throw fail("Reporte no encontrado.", 404);
    const evidence = { id: Date.now(), reporte_id: Number(reportId), tipo: "photo", archivo_path: stored.photoPath, nombre_original: file.originalname, descripcion: clean(description), created_at: new Date().toISOString() }; report.evidences.push(evidence); return evidence;
  }
  const [result] = await getPool().query("INSERT INTO reporte_evidencias (reporte_id, tipo, archivo_path, nombre_original, descripcion, creado_por) VALUES (?, 'photo', ?, ?, ?, ?)", [reportId, stored.photoPath, file.originalname || "", clean(description), user?.id || null]);
  await createAuditLog({ actorUserId: user?.id, action: "technical_report.evidence_added", entityType: "technical_report", entityId: reportId, summary: "Evidencia fotográfica agregada" });
  return { id: result.insertId, reporte_id: Number(reportId), archivo_path: stored.photoPath, nombre_original: file.originalname || "", descripcion: clean(description) };
};
