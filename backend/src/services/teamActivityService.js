import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { emitToRoles } from "./profileRealtimeService.js";

// Actividad del equipo: lo que hacen en el sistema los usuarios que no son
// administradores, leído de la bitácora (audit_logs). Los administradores lo
// reciben en la campana en tiempo real y lo consultan en "Actividad del equipo".

// Sesiones y chat no son trabajo: no se notifican ni se listan.
export const ACCIONES_EXCLUIDAS = ["auth.login", "auth.logout", "auth.logout_all", "auth.password_changed", "profile.message_sent", "profile.general_message_sent", "profile.achievement_awarded"];

// Lo que cierra un trabajo: suena y sale un aviso emergente. Lo demás solo llega a la campana.
const FINALES = new Set([
  "banco_clandestinos.sent_to_ficha",
  "banco_clandestinos.discarded",
  "inspeccion.finalized",
  "technical_report.created",
  "transport.route_completed",
  "LOTE_CERRADO",
  "DOCUMENTO_REENTREGADO"
]);
export const esFinal = (action, details) =>
  FINALES.has(action) || (action === "inmueble.state_changed" && ["regularized", "discarded"].includes(details?.next));

// Áreas del sistema, para filtrar. Cada una se reconoce por el prefijo de la acción o el tipo de entidad.
export const CATEGORIAS = {
  fichas: { label: "Fichas y banco", acciones: ["inmueble.", "banco_clandestinos.", "technical_report.", "field_findings."] },
  inspecciones: { label: "Inspecciones", acciones: ["inspeccion."] },
  entregas: { label: "Entregas", entidades: ["entrega"], acciones: ["entrega_reparto"] },
  campo: { label: "GPS y planos", acciones: ["map_point.", "transport.", "plano."] },
  padron: { label: "Padrón y barrios", acciones: ["padron", "barrio_code."] }
};
export const categoriaDe = (action = "", entityType = "") => {
  for (const [key, { acciones = [], entidades = [] }] of Object.entries(CATEGORIAS)) {
    if (entidades.includes(entityType) || acciones.some((prefijo) => action.startsWith(prefijo))) return key;
  }
  return "otros";
};

const parseDetails = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
};

// A dónde lleva cada evento en la app (lo resuelve el frontend).
const enlaceDe = (row, details) => {
  if (row.entity_type === "inmueble" && Number(row.entity_id) > 0) return { view: "records", fichaId: Number(row.entity_id) };
  if (row.entity_type === "inspeccion") return { view: "inspecciones" };
  if (row.entity_type === "entrega" && String(row.action).startsWith("LOTE_") && Number(row.entity_id) > 0) return { view: "entregas", loteId: Number(row.entity_id) };
  if (row.entity_type === "banco_clandestinos") return { view: "banco" };
  if (details?.lote_id) return { view: "entregas", loteId: Number(details.lote_id) };
  return null;
};

export const mapActividad = (row) => {
  const details = parseDetails(row.details_json);
  return {
    id: Number(row.id),
    actor_id: row.actor_user_id == null ? null : Number(row.actor_user_id),
    actor_name: row.actor_name || row.actor_name_snapshot || "Usuario",
    actor_role: row.actor_role || "",
    action: row.action,
    categoria: categoriaDe(row.action, row.entity_type),
    summary: row.summary || row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    final: esFinal(row.action, details),
    enlace: enlaceDe(row, details),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  };
};

// Se llama desde createAuditLog: si quien actuó no es admin y la acción cuenta,
// se avisa en vivo a los administradores conectados. Nunca rompe la bitácora.
export const notificarActividad = ({ id, actor, action, entityType, entityId, summary, details }) => {
  try {
    if (!actor || actor.role === "admin" || ACCIONES_EXCLUIDAS.includes(action)) return;
    const actividad = mapActividad({
      id, actor_user_id: actor.id, actor_name: actor.full_name, actor_role: actor.role, action,
      entity_type: entityType, entity_id: String(entityId ?? ""), summary, details_json: details, created_at: new Date()
    });
    emitToRoles({ type: "team.activity", activity: actividad }, ["admin"]);
  } catch (error) {
    console.error("No se pudo notificar la actividad del equipo:", error.message);
  }
};

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value) => String(value ?? "").trim();
const fecha = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(clean(value)) ? clean(value) : "");

const filtroCategoria = (categoria) => {
  if (categoria === "otros") {
    const todas = Object.values(CATEGORIAS);
    const prefijos = todas.flatMap(({ acciones = [] }) => acciones);
    const entidades = todas.flatMap(({ entidades = [] }) => entidades);
    return { sql: `NOT (${[...prefijos.map(() => "audit_logs.action LIKE ?"), ...entidades.map(() => "audit_logs.entity_type = ?")].join(" OR ")})`, params: [...prefijos.map((p) => `${p}%`), ...entidades] };
  }
  const def = CATEGORIAS[categoria];
  if (!def) return null;
  const partes = [...(def.acciones || []).map(() => "audit_logs.action LIKE ?"), ...(def.entidades || []).map(() => "audit_logs.entity_type = ?")];
  return { sql: `(${partes.join(" OR ")})`, params: [...(def.acciones || []).map((p) => `${p}%`), ...(def.entidades || [])] };
};

/**
 * Lista la actividad del equipo (más reciente primero) con un resumen por persona
 * del periodo y cuántos eventos no ha visto este administrador.
 * filtros: { actor, categoria, desde, hasta (YYYY-MM-DD), antes (id para paginar), limit }
 */
export const listTeamActivity = async (filtros = {}, user) => {
  if (user?.role !== "admin") throw fail("Solo administración ve la actividad del equipo.", 403);
  const limit = Math.min(Math.max(Number(filtros.limit) || 50, 1), 200);
  if (env.useMemoryDb) return { items: [], tecnicos: [], unread: 0, seen_at: null, categorias: Object.fromEntries(Object.entries(CATEGORIAS).map(([key, { label }]) => [key, label])), has_more: false };

  const where = ["audit_logs.actor_user_id IS NOT NULL", "app_users.role <> 'admin'", "audit_logs.action NOT IN (?)"];
  const params = [ACCIONES_EXCLUIDAS];
  const desde = fecha(filtros.desde);
  const hasta = fecha(filtros.hasta);
  if (desde) { where.push("audit_logs.created_at >= ?"); params.push(`${desde} 00:00:00`); }
  if (hasta) { where.push("audit_logs.created_at <= ?"); params.push(`${hasta} 23:59:59`); }
  const periodoWhere = [...where];
  const periodoParams = [...params];
  if (Number(filtros.actor) > 0) { where.push("audit_logs.actor_user_id = ?"); params.push(Number(filtros.actor)); }
  const categoria = filtroCategoria(clean(filtros.categoria));
  if (categoria) { where.push(categoria.sql); params.push(...categoria.params); }
  const listaWhere = [...where];
  const listaParams = [...params];
  if (Number(filtros.antes) > 0) { listaWhere.push("audit_logs.id < ?"); listaParams.push(Number(filtros.antes)); }

  const pool = getPool();
  const base = "FROM audit_logs JOIN app_users ON app_users.id = audit_logs.actor_user_id";
  // La campana solo pide lo último (resumen=0): se omite el resumen por persona.
  const conResumen = clean(filtros.resumen) !== "0";
  const [[rows], [personas], [[seen]]] = await Promise.all([
    pool.query(
      `SELECT audit_logs.*, COALESCE(app_users.full_name, app_users.username) AS actor_name, app_users.role AS actor_role
       ${base} WHERE ${listaWhere.join(" AND ")} ORDER BY audit_logs.id DESC LIMIT ?`,
      [...listaParams, limit + 1]
    ),
    conResumen ? pool.query(
      `SELECT audit_logs.actor_user_id, COALESCE(app_users.full_name, app_users.username) AS nombre, audit_logs.action, audit_logs.details_json,
         audit_logs.created_at >= CURRENT_DATE AS es_hoy, audit_logs.created_at
       ${base} WHERE ${periodoWhere.join(" AND ")} ORDER BY audit_logs.id DESC LIMIT 5000`,
      periodoParams
    ) : [[]],
    pool.query("SELECT team_activity_seen_at FROM app_users WHERE id = ? LIMIT 1", [user.id])
  ]);
  const seenAt = seen?.team_activity_seen_at || null;
  // Sin vistas previas se cuentan solo los últimos 7 días, no toda la historia.
  const desdeNoLeidos = seenAt || new Date(Date.now() - 7 * 86400000);
  const [[{ unread }]] = await pool.query(
    `SELECT COUNT(*) AS unread ${base} WHERE app_users.role <> 'admin' AND audit_logs.action NOT IN (?) AND audit_logs.created_at > ?`,
    [ACCIONES_EXCLUIDAS, desdeNoLeidos]
  );

  // Resumen por persona del periodo (sin el filtro de persona ni de área).
  const porPersona = new Map();
  for (const row of personas) {
    const id = Number(row.actor_user_id);
    const entry = porPersona.get(id) || { id, nombre: row.nombre, total: 0, hoy: 0, finalizados: 0, ultima: null };
    entry.total += 1;
    if (Number(row.es_hoy)) entry.hoy += 1;
    if (esFinal(row.action, parseDetails(row.details_json))) entry.finalizados += 1;
    if (!entry.ultima) entry.ultima = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
    porPersona.set(id, entry);
  }

  return {
    items: rows.slice(0, limit).map(mapActividad),
    has_more: rows.length > limit,
    tecnicos: [...porPersona.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es")),
    unread: Number(unread || 0),
    seen_at: seenAt instanceof Date ? seenAt.toISOString() : seenAt,
    categorias: Object.fromEntries(Object.entries(CATEGORIAS).map(([key, { label }]) => [key, label]))
  };
};

// El administrador ya vio la actividad hasta ahora: la campana vuelve a cero.
export const markTeamActivitySeen = async (user) => {
  if (user?.role !== "admin") throw fail("Solo administración ve la actividad del equipo.", 403);
  if (env.useMemoryDb) return { seen_at: new Date().toISOString() };
  await getPool().query("UPDATE app_users SET team_activity_seen_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  return { seen_at: new Date().toISOString() };
};
