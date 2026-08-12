import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { searchClaveCatastral } from "./claveLookupService.js";
import { emitProfileMessage } from "./profileRealtimeService.js";

export const INSPECCION_STATES = ["ASIGNADA", "EN_PROCESO", "SEGUIMIENTO", "FINALIZADA"];
export const INSPECCION_TRANSITIONS = {
  ASIGNADA: ["EN_PROCESO"],
  EN_PROCESO: ["SEGUIMIENTO", "FINALIZADA"],
  SEGUIMIENTO: ["EN_PROCESO", "FINALIZADA"],
  FINALIZADA: []
};
export const TECNICO_ELIGIBLE_ROLES = ["operator", "validadora_campo"];
export const MOTIVOS_SUGERIDOS = [
  "Verificación de conexión",
  "Posible irregularidad",
  "Revisión solicitada",
  "Seguimiento de caso"
];

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value) => String(value ?? "").trim();
const isAdmin = (user) => user?.role === "admin";
const nowIso = () => new Date().toISOString();

// Estado en memoria (solo para USE_MEMORY_DB=true / pruebas). Cada modulo mantiene su propio
// almacen privado, replicando el patron ya usado en clandestinosService.js.
let memoryAutoId = 1;
const memoryInspecciones = [];
const memoryParticipantes = [];
const memoryGps = [];
const memoryHistory = [];
const memoryUsers = [];

// Hook exclusivo para pruebas: permite registrar usuarios (id/role/full_name/is_active)
// ya que en modo memoria no existe una tabla app_users real contra la cual validar roles.
export const __seedMemoryUsersForTests = (users = []) => {
  memoryUsers.length = 0;
  memoryUsers.push(...users);
};

const addHistory = async ({ entidadId, previous = "", next, reason = "", user }) => {
  if (env.useMemoryDb) {
    memoryHistory.unshift({
      id: memoryHistory.length + 1,
      entidad_tipo: "inspeccion",
      entidad_id: Number(entidadId),
      estado_anterior: previous,
      estado_nuevo: next,
      motivo: reason,
      actor_name: user?.full_name || user?.username || "",
      usuario_id: user?.id || null,
      created_at: nowIso()
    });
    return;
  }
  await getPool().query(
    "INSERT INTO historial_estados (entidad_tipo, entidad_id, estado_anterior, estado_nuevo, motivo, usuario_id) VALUES ('inspeccion', ?, ?, ?, ?, ?)",
    [entidadId, previous, next, reason, user?.id || null]
  );
};

const audit = async ({ actorUserId, action, entityId, summary, details }) => {
  if (env.useMemoryDb) return;
  try {
    await createAuditLog({ actorUserId, action, entityType: "inspeccion", entityId, summary, details });
  } catch {
    // La operacion principal no debe fallar si la auditoria no esta disponible.
  }
};

const notify = async ({ recipientUserId, senderUserId, body }) => {
  if (!recipientUserId || Number(recipientUserId) === Number(senderUserId)) return;
  if (env.useMemoryDb) return;
  try {
    const pool = getPool();
    const [result] = await pool.query(
      "INSERT INTO user_profile_messages (sender_user_id, recipient_user_id, body) VALUES (?, ?, ?)",
      [senderUserId || null, recipientUserId, body.slice(0, 2000)]
    );
    const [[message]] = await pool.query(
      `SELECT messages.*, sender.full_name AS sender_name, sender.role AS sender_role, recipient.full_name AS recipient_name
       FROM user_profile_messages AS messages
       LEFT JOIN app_users AS sender ON sender.id = messages.sender_user_id
       LEFT JOIN app_users AS recipient ON recipient.id = messages.recipient_user_id
       WHERE messages.id = ? LIMIT 1`,
      [result.insertId]
    );
    emitProfileMessage(message);
  } catch {
    // Una notificacion fallida no debe interrumpir el flujo operativo de la inspeccion.
  }
};

const getEligibleUser = async (id) => {
  const userId = Number(id) || 0;
  if (!userId) return null;
  if (env.useMemoryDb) {
    const found = memoryUsers.find((item) => Number(item.id) === userId);
    return found && found.is_active !== false && TECNICO_ELIGIBLE_ROLES.includes(found.role) ? found : null;
  }
  const [rows] = await getPool().query(
    "SELECT id, role, full_name, is_active FROM app_users WHERE id = ? LIMIT 1",
    [userId]
  );
  const found = rows[0];
  return found && found.is_active && TECNICO_ELIGIBLE_ROLES.includes(found.role) ? found : null;
};

const buildSnapshotFromClave = async (claveCatastral, abonadoNumero, inspeccionGeneral) => {
  const lookup = await searchClaveCatastral(claveCatastral, { field: "clave" });
  if (!lookup.exists) throw fail("La clave catastral no existe en el padrón.", 404);
  const abonadosAsociados = lookup.matches.map((match) => ({
    clave_catastral: match.clave_catastral,
    abonado: match.abonado,
    nombre: match.inquilino || match.nombre || ""
  }));
  let selected = null;
  if (!inspeccionGeneral) {
    if (!abonadoNumero) throw fail("Selecciona el abonado asociado a la clave o marca inspección general.");
    selected = lookup.matches.find((match) => String(match.abonado) === String(abonadoNumero));
    if (!selected) throw fail("El abonado indicado no corresponde a la clave catastral.", 404);
  }
  return {
    clave_catastral: lookup.normalized_query,
    abonado_numero: selected?.abonado || "",
    abonado_nombre_snapshot: selected ? (selected.inquilino || selected.nombre || "") : "Inspección general de la clave",
    barrio_snapshot: selected?.barrio_colonia || abonadosAsociados[0]?.barrio_colonia || "",
    direccion_snapshot: selected?.barrio_colonia || "",
    abonados_asociados: abonadosAsociados
  };
};

const generateNumero = async () => {
  const year = new Date().getFullYear();
  const prefix = `INS-${year}-`;
  if (env.useMemoryDb) {
    const total = memoryInspecciones.filter((item) => item.numero_inspeccion.startsWith(prefix)).length;
    return `${prefix}${String(total + 1).padStart(5, "0")}`;
  }
  const [[row]] = await getPool().query(
    "SELECT COUNT(*) AS total FROM inspecciones WHERE numero_inspeccion LIKE ?",
    [`${prefix}%`]
  );
  return `${prefix}${String(Number(row.total) + 1).padStart(5, "0")}`;
};

const loadParticipantes = async (inspeccionId) => {
  if (env.useMemoryDb) {
    return memoryParticipantes
      .filter((item) => item.inspeccion_id === Number(inspeccionId) && !item.removed_at)
      .map((item) => {
        const person = memoryUsers.find((user) => Number(user.id) === Number(item.tecnico_id));
        return { ...item, tecnico_nombre: person?.full_name || "", tecnico_role: person?.role || "" };
      });
  }
  const [rows] = await getPool().query(
    `SELECT inspeccion_tecnicos.*, app_users.full_name AS tecnico_nombre, app_users.role AS tecnico_role
     FROM inspeccion_tecnicos
     LEFT JOIN app_users ON app_users.id = inspeccion_tecnicos.tecnico_id
     WHERE inspeccion_tecnicos.inspeccion_id = ? AND inspeccion_tecnicos.removed_at IS NULL
     ORDER BY FIELD(inspeccion_tecnicos.rol, 'RESPONSABLE', 'APOYO'), inspeccion_tecnicos.created_at ASC`,
    [inspeccionId]
  );
  return rows;
};

const isActiveParticipant = (participantes, userId) =>
  participantes.some((item) => Number(item.tecnico_id) === Number(userId));

const isResponsable = (participantes, userId) =>
  participantes.some((item) => Number(item.tecnico_id) === Number(userId) && item.rol === "RESPONSABLE");

const insertParticipante = async (inspeccionId, tecnicoId, rol, actorUser) => {
  const participantes = await loadParticipantes(inspeccionId);
  if (isActiveParticipant(participantes, tecnicoId)) throw fail("El técnico ya participa en esta inspección.", 409);
  if (env.useMemoryDb) {
    memoryParticipantes.push({
      id: memoryAutoId++,
      inspeccion_id: Number(inspeccionId),
      tecnico_id: Number(tecnicoId),
      rol,
      agregado_por_usuario_id: actorUser?.id || null,
      created_at: nowIso(),
      removed_at: null
    });
    return;
  }
  await getPool().query(
    "INSERT INTO inspeccion_tecnicos (inspeccion_id, tecnico_id, rol, agregado_por_usuario_id) VALUES (?, ?, ?, ?)",
    [inspeccionId, tecnicoId, rol, actorUser?.id || null]
  );
};

const mapInspeccionRow = (row) => ({
  ...row,
  inspeccion_general: Boolean(row.inspeccion_general),
  requiere_seguimiento: Boolean(row.requiere_seguimiento)
});

const findInspeccionRaw = async (id) => {
  if (env.useMemoryDb) {
    const found = memoryInspecciones.find((item) => item.id === Number(id));
    return found ? mapInspeccionRow(found) : null;
  }
  const [rows] = await getPool().query(
    `SELECT inspecciones.*,
        responsable.full_name AS tecnico_responsable_nombre,
        creador.full_name AS creada_por_nombre,
        finalizador.full_name AS finalizada_por_nombre
     FROM inspecciones
     LEFT JOIN app_users responsable ON responsable.id = inspecciones.tecnico_responsable_id
     LEFT JOIN app_users creador ON creador.id = inspecciones.creada_por_usuario_id
     LEFT JOIN app_users finalizador ON finalizador.id = inspecciones.finalizada_por_usuario_id
     WHERE inspecciones.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? mapInspeccionRow(rows[0]) : null;
};

const loadWithParticipantes = async (id) => {
  const inspeccion = await findInspeccionRaw(id);
  if (!inspeccion) return { inspeccion: null, participantes: [] };
  const participantes = await loadParticipantes(id);
  return { inspeccion, participantes };
};

const assertViewAccess = (inspeccion, participantes, user) => {
  if (isAdmin(user)) return;
  if (!isActiveParticipant(participantes, user?.id)) throw fail("No participas en esta inspección.", 403);
};

export const getInspeccionesConfig = (user) => ({
  estados: INSPECCION_STATES,
  transiciones: INSPECCION_TRANSITIONS,
  motivos_sugeridos: MOTIVOS_SUGERIDOS,
  roles_elegibles: TECNICO_ELIGIBLE_ROLES,
  permissions: {
    can_create: isAdmin(user),
    can_reassign: isAdmin(user),
    can_view_stats: isAdmin(user),
    can_manage: isAdmin(user)
  }
});

export const listTecnicosElegibles = async () => {
  if (env.useMemoryDb) {
    return memoryUsers
      .filter((item) => item.is_active !== false && TECNICO_ELIGIBLE_ROLES.includes(item.role))
      .map((item) => ({
        id: item.id,
        full_name: item.full_name,
        role: item.role,
        inspecciones_activas: memoryParticipantes.filter((participante) => {
          if (participante.tecnico_id !== item.id || participante.removed_at) return false;
          const inspeccion = memoryInspecciones.find((row) => row.id === participante.inspeccion_id);
          return inspeccion && inspeccion.estado !== "FINALIZADA";
        }).length
      }));
  }
  const [rows] = await getPool().query(
    `SELECT app_users.id, app_users.full_name, app_users.role,
        COUNT(DISTINCT CASE WHEN inspecciones.estado != 'FINALIZADA' THEN inspecciones.id END) AS inspecciones_activas
     FROM app_users
     LEFT JOIN inspeccion_tecnicos ON inspeccion_tecnicos.tecnico_id = app_users.id AND inspeccion_tecnicos.removed_at IS NULL
     LEFT JOIN inspecciones ON inspecciones.id = inspeccion_tecnicos.inspeccion_id
     WHERE app_users.is_active = 1 AND app_users.role IN ('operator', 'validadora_campo')
     GROUP BY app_users.id, app_users.full_name, app_users.role
     ORDER BY app_users.full_name ASC`
  );
  return rows.map((row) => ({ ...row, inspecciones_activas: Number(row.inspecciones_activas) }));
};

// Devuelve el listado completo (sin paginar) segun filtros, para reutilizar tanto en
// listInspecciones (paginado) como en el servicio de estadisticas (agregaciones).
export const queryInspecciones = async (filters = {}, user) => {
  const term = clean(filters.q);
  const numero = clean(filters.numero);
  const clave = clean(filters.clave);
  const abonado = clean(filters.abonado);
  const estado = INSPECCION_STATES.includes(filters.estado) ? filters.estado : "";
  const barrio = clean(filters.barrio);
  const tecnicoId = Number(filters.tecnico_id) || 0;
  const fechaDesde = clean(filters.fecha_desde);
  const fechaHasta = clean(filters.fecha_hasta);
  const scopedUserId = isAdmin(user) ? 0 : Number(user?.id) || 0;

  if (env.useMemoryDb) {
    return memoryInspecciones
      .filter((item) => {
        if (estado && item.estado !== estado) return false;
        if (numero && !item.numero_inspeccion.toLowerCase().includes(numero.toLowerCase())) return false;
        if (clave && !item.clave_catastral.toLowerCase().includes(clave.toLowerCase())) return false;
        if (abonado && !item.abonado_nombre_snapshot.toLowerCase().includes(abonado.toLowerCase()) && !item.abonado_numero.includes(abonado)) return false;
        if (barrio && item.barrio_snapshot.toLowerCase() !== barrio.toLowerCase()) return false;
        if (fechaDesde && item.fecha_asignacion < fechaDesde) return false;
        if (fechaHasta && item.fecha_asignacion > `${fechaHasta}T23:59:59.999Z`) return false;
        if (term) {
          const haystack = `${item.numero_inspeccion} ${item.clave_catastral} ${item.abonado_nombre_snapshot} ${item.motivo}`.toLowerCase();
          if (!haystack.includes(term.toLowerCase())) return false;
        }
        const activeParticipantIds = memoryParticipantes
          .filter((participante) => participante.inspeccion_id === item.id && !participante.removed_at)
          .map((participante) => participante.tecnico_id);
        if (tecnicoId && !activeParticipantIds.includes(tecnicoId)) return false;
        if (scopedUserId && !activeParticipantIds.includes(scopedUserId)) return false;
        return true;
      })
      .map((item) => ({
        ...mapInspeccionRow(item),
        tecnico_responsable_nombre: memoryUsers.find((u) => u.id === item.tecnico_responsable_id)?.full_name || ""
      }))
      .sort((a, b) => (a.fecha_asignacion < b.fecha_asignacion ? 1 : -1));
  }

  const clauses = [];
  const params = [];
  if (estado) { clauses.push("inspecciones.estado = ?"); params.push(estado); }
  if (numero) { clauses.push("inspecciones.numero_inspeccion LIKE ?"); params.push(`%${numero}%`); }
  if (clave) { clauses.push("inspecciones.clave_catastral LIKE ?"); params.push(`%${clave}%`); }
  if (abonado) { clauses.push("(inspecciones.abonado_nombre_snapshot LIKE ? OR inspecciones.abonado_numero LIKE ?)"); params.push(`%${abonado}%`, `%${abonado}%`); }
  if (barrio) { clauses.push("inspecciones.barrio_snapshot = ?"); params.push(barrio); }
  if (fechaDesde) { clauses.push("DATE(inspecciones.fecha_asignacion) >= ?"); params.push(fechaDesde); }
  if (fechaHasta) { clauses.push("DATE(inspecciones.fecha_asignacion) <= ?"); params.push(fechaHasta); }
  if (term) {
    clauses.push("(inspecciones.numero_inspeccion LIKE ? OR inspecciones.clave_catastral LIKE ? OR inspecciones.abonado_nombre_snapshot LIKE ? OR inspecciones.motivo LIKE ?)");
    params.push(`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`);
  }
  if (tecnicoId) {
    clauses.push("EXISTS (SELECT 1 FROM inspeccion_tecnicos it WHERE it.inspeccion_id = inspecciones.id AND it.tecnico_id = ? AND it.removed_at IS NULL)");
    params.push(tecnicoId);
  }
  if (scopedUserId) {
    clauses.push("EXISTS (SELECT 1 FROM inspeccion_tecnicos it WHERE it.inspeccion_id = inspecciones.id AND it.tecnico_id = ? AND it.removed_at IS NULL)");
    params.push(scopedUserId);
  }

  const [rows] = await getPool().query(
    `SELECT inspecciones.*, responsable.full_name AS tecnico_responsable_nombre
     FROM inspecciones
     LEFT JOIN app_users responsable ON responsable.id = inspecciones.tecnico_responsable_id
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY inspecciones.fecha_asignacion DESC`,
    params
  );
  return rows.map(mapInspeccionRow);
};

export const listInspecciones = async (filters = {}, user) => {
  const all = await queryInspecciones(filters, user);
  const safeLimit = Math.min(Math.max(Number(filters.limit) || 10, 1), 50);
  const totalPages = Math.max(1, Math.ceil(all.length / safeLimit));
  const page = Math.min(Math.max(Number(filters.page) || 1, 1), totalPages);
  const start = (page - 1) * safeLimit;
  return { items: all.slice(start, start + safeLimit), total: all.length, page, limit: safeLimit, total_pages: totalPages };
};

export const getResumenInspecciones = async (user) => {
  const all = await queryInspecciones({}, user);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const finalizadasEsteMes = all.filter(
    (item) => item.estado === "FINALIZADA" && item.fecha_finalizacion && new Date(item.fecha_finalizacion) >= startOfMonth
  ).length;
  return {
    asignadas: all.filter((item) => item.estado === "ASIGNADA").length,
    en_proceso: all.filter((item) => item.estado === "EN_PROCESO").length,
    seguimiento: all.filter((item) => item.estado === "SEGUIMIENTO").length,
    finalizadas_mes: finalizadasEsteMes,
    total: all.length
  };
};

export const getInspeccionDetail = async (id, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  assertViewAccess(inspeccion, participantes, user);
  let abonadosAsociados = [];
  try {
    const lookup = await searchClaveCatastral(inspeccion.clave_catastral, { field: "clave" });
    abonadosAsociados = lookup.matches.map((match) => ({ clave_catastral: match.clave_catastral, abonado: match.abonado, nombre: match.inquilino || match.nombre || "" }));
  } catch {
    abonadosAsociados = [];
  }
  return { ...inspeccion, participantes, abonados_asociados: abonadosAsociados };
};

export const createInspeccion = async (payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo administración puede crear inspecciones.", 403);
  const claveCatastral = clean(payload.clave_catastral);
  if (!claveCatastral) throw fail("La clave catastral es obligatoria.");
  const motivo = clean(payload.motivo);
  if (!motivo) throw fail("Indica el motivo de la inspección.");
  const trabajoSolicitado = clean(payload.trabajo_solicitado);
  if (!trabajoSolicitado) throw fail("Describe el trabajo solicitado al técnico.");
  const responsableId = Number(payload.tecnico_responsable_id) || 0;
  if (!responsableId) throw fail("Selecciona un técnico responsable.");
  const responsable = await getEligibleUser(responsableId);
  if (!responsable) throw fail("El técnico responsable no es válido, está inactivo o su rol no es elegible.", 404);

  const apoyoIds = [...new Set((Array.isArray(payload.apoyos) ? payload.apoyos : []).map(Number).filter(Number.isInteger))].filter(
    (apoyoId) => apoyoId !== responsableId
  );
  const apoyos = [];
  for (const apoyoId of apoyoIds) {
    const apoyo = await getEligibleUser(apoyoId);
    if (!apoyo) throw fail("Uno de los técnicos de apoyo no es válido, está inactivo o su rol no es elegible.", 404);
    apoyos.push(apoyo);
  }

  const inspeccionGeneral = Boolean(payload.inspeccion_general);
  const snapshot = await buildSnapshotFromClave(claveCatastral, clean(payload.abonado_numero), inspeccionGeneral);
  const numero = await generateNumero();
  const now = nowIso();

  let record;
  if (env.useMemoryDb) {
    record = {
      id: memoryAutoId++,
      numero_inspeccion: numero,
      clave_catastral: snapshot.clave_catastral,
      inspeccion_general: inspeccionGeneral ? 1 : 0,
      abonado_numero: snapshot.abonado_numero,
      abonado_nombre_snapshot: snapshot.abonado_nombre_snapshot,
      barrio_snapshot: snapshot.barrio_snapshot,
      direccion_snapshot: snapshot.direccion_snapshot,
      motivo,
      trabajo_solicitado: trabajoSolicitado,
      informacion_encontrada: "",
      observaciones: "",
      estado: "ASIGNADA",
      requiere_seguimiento: 0,
      seguimiento_detalle: "",
      seguimiento_fecha_sugerida: null,
      tecnico_responsable_id: responsableId,
      creada_por_usuario_id: user.id,
      finalizada_por_usuario_id: null,
      fecha_asignacion: now,
      fecha_inicio: null,
      fecha_finalizacion: null,
      created_at: now,
      updated_at: now
    };
    memoryInspecciones.push(record);
  } else {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO inspecciones (
        numero_inspeccion, clave_catastral, inspeccion_general, abonado_numero, abonado_nombre_snapshot,
        barrio_snapshot, direccion_snapshot, motivo, trabajo_solicitado, tecnico_responsable_id, creada_por_usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero, snapshot.clave_catastral, inspeccionGeneral ? 1 : 0, snapshot.abonado_numero, snapshot.abonado_nombre_snapshot,
        snapshot.barrio_snapshot, snapshot.direccion_snapshot, motivo, trabajoSolicitado, responsableId, user.id
      ]
    );
    record = await findInspeccionRaw(result.insertId);
  }

  await insertParticipante(record.id, responsableId, "RESPONSABLE", user);
  for (const apoyo of apoyos) await insertParticipante(record.id, apoyo.id, "APOYO", user);
  await addHistory({ entidadId: record.id, next: "ASIGNADA", reason: "Inspección creada", user });
  await audit({
    actorUserId: user.id,
    action: "inspeccion.created",
    entityId: record.id,
    summary: `Inspección ${numero} creada para la clave ${snapshot.clave_catastral}`,
    details: { clave: snapshot.clave_catastral, responsable: responsableId, apoyos: apoyoIds }
  });

  const notifyBody = (nombreRol) =>
    `Nueva inspección asignada\n${numero}\n${snapshot.barrio_snapshot}\nAbonado: ${snapshot.abonado_nombre_snapshot}\nMotivo: ${motivo}\nTrabajo solicitado: ${trabajoSolicitado}${nombreRol ? `\n(${nombreRol})` : ""}`;
  await notify({ recipientUserId: responsableId, senderUserId: user.id, body: notifyBody("Técnico responsable") });
  for (const apoyo of apoyos) {
    await notify({ recipientUserId: apoyo.id, senderUserId: user.id, body: notifyBody("Técnico de apoyo") });
  }

  return getInspeccionDetail(record.id, user);
};

const applyPatch = async (id, patch) => {
  if (!Object.keys(patch).length) return;
  if (env.useMemoryDb) {
    const record = memoryInspecciones.find((item) => item.id === Number(id));
    Object.assign(record, patch, { updated_at: nowIso() });
    return;
  }
  const columns = Object.keys(patch);
  await getPool().query(
    `UPDATE inspecciones SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    [...columns.map((column) => patch[column]), id]
  );
};

const autoStartIfNeeded = async (inspeccion, user, reason) => {
  if (inspeccion.estado !== "ASIGNADA") return;
  await applyPatch(inspeccion.id, { estado: "EN_PROCESO", fecha_inicio: nowIso() });
  await addHistory({ entidadId: inspeccion.id, previous: "ASIGNADA", next: "EN_PROCESO", reason, user });
};

export const updateInspeccion = async (id, payload = {}, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  if (inspeccion.estado === "FINALIZADA" && !isAdmin(user)) throw fail("La inspección ya fue finalizada.", 409);
  assertViewAccess(inspeccion, participantes, user);

  if (payload.expected_updated_at && new Date(payload.expected_updated_at).getTime() !== new Date(inspeccion.updated_at).getTime()) {
    throw fail("La inspección fue modificada por otro usuario. Recarga los datos antes de continuar.", 409);
  }

  const patch = {};
  if ("informacion_encontrada" in payload) patch.informacion_encontrada = clean(payload.informacion_encontrada);
  if ("observaciones" in payload) patch.observaciones = clean(payload.observaciones);
  if ("requiere_seguimiento" in payload) patch.requiere_seguimiento = payload.requiere_seguimiento ? 1 : 0;
  if ("seguimiento_detalle" in payload) patch.seguimiento_detalle = clean(payload.seguimiento_detalle);
  if ("seguimiento_fecha_sugerida" in payload) patch.seguimiento_fecha_sugerida = clean(payload.seguimiento_fecha_sugerida) || null;
  if ("motivo" in payload || "trabajo_solicitado" in payload) {
    if (!isAdmin(user)) throw fail("Solo administración puede editar el motivo o el trabajo solicitado.", 403);
    if ("motivo" in payload) patch.motivo = clean(payload.motivo);
    if ("trabajo_solicitado" in payload) patch.trabajo_solicitado = clean(payload.trabajo_solicitado);
  }

  if (!Object.keys(patch).length) return getInspeccionDetail(id, user);
  await applyPatch(id, patch);
  if ("informacion_encontrada" in patch && patch.informacion_encontrada) {
    await autoStartIfNeeded(inspeccion, user, "Información de campo registrada");
  }
  await audit({ actorUserId: user.id, action: "inspeccion.details_updated", entityId: id, summary: `Datos de inspección ${inspeccion.numero_inspeccion} actualizados` });
  return getInspeccionDetail(id, user);
};

export const changeEstado = async (id, { estado, motivo = "" } = {}, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  if (!isAdmin(user) && !isResponsable(participantes, user.id)) throw fail("Solo el técnico responsable o administración pueden cambiar el estado.", 403);
  if (!INSPECCION_STATES.includes(estado) || estado === "FINALIZADA") throw fail("Estado no válido. Usa la acción de finalizar para cerrar la inspección.");
  const previous = inspeccion.estado;
  if (previous === estado) return getInspeccionDetail(id, user);
  if (!INSPECCION_TRANSITIONS[previous]?.includes(estado)) throw fail(`La transición ${previous} → ${estado} no está permitida.`, 409);

  const patch = { estado };
  if (estado === "EN_PROCESO" && !inspeccion.fecha_inicio) patch.fecha_inicio = nowIso();
  await applyPatch(id, patch);
  await addHistory({ entidadId: id, previous, next: estado, reason: clean(motivo), user });
  await audit({ actorUserId: user.id, action: "inspeccion.state_changed", entityId: id, summary: `Inspección ${inspeccion.numero_inspeccion}: ${previous} → ${estado}`, details: { previous, next: estado, reason: clean(motivo) } });
  return getInspeccionDetail(id, user);
};

export const finalizarInspeccion = async (id, payload = {}, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  if (!isAdmin(user) && !isResponsable(participantes, user.id)) throw fail("Solo el técnico responsable o administración pueden finalizar la inspección.", 403);
  if (inspeccion.estado === "FINALIZADA") return getInspeccionDetail(id, user);
  if (!INSPECCION_TRANSITIONS[inspeccion.estado]?.includes("FINALIZADA")) {
    throw fail(`La transición ${inspeccion.estado} → FINALIZADA no está permitida.`, 409);
  }

  const requiereSeguimiento = Boolean(payload.requiere_seguimiento);
  const patch = {
    estado: "FINALIZADA",
    finalizada_por_usuario_id: user.id,
    fecha_finalizacion: nowIso(),
    requiere_seguimiento: requiereSeguimiento ? 1 : 0
  };
  if ("informacion_encontrada" in payload) patch.informacion_encontrada = clean(payload.informacion_encontrada);
  if ("observaciones" in payload) patch.observaciones = clean(payload.observaciones);
  if (requiereSeguimiento) {
    patch.seguimiento_detalle = clean(payload.seguimiento_detalle);
    patch.seguimiento_fecha_sugerida = clean(payload.seguimiento_fecha_sugerida) || null;
  }

  const previous = inspeccion.estado;
  await applyPatch(id, patch);
  await addHistory({ entidadId: id, previous, next: "FINALIZADA", reason: "Inspección finalizada", user });
  await audit({
    actorUserId: user.id,
    action: "inspeccion.finalized",
    entityId: id,
    summary: `Inspección ${inspeccion.numero_inspeccion} finalizada por ${user.full_name || user.username}`,
    details: { requiere_seguimiento: requiereSeguimiento }
  });
  return getInspeccionDetail(id, user);
};

export const reasignarInspeccion = async (id, { tecnico_responsable_id } = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo administración puede reasignar una inspección.", 403);
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  if (inspeccion.estado === "FINALIZADA") throw fail("No se puede reasignar una inspección finalizada.", 409);
  const nuevoResponsable = await getEligibleUser(tecnico_responsable_id);
  if (!nuevoResponsable) throw fail("El técnico responsable no es válido, está inactivo o su rol no es elegible.", 404);
  if (Number(nuevoResponsable.id) === Number(inspeccion.tecnico_responsable_id)) return getInspeccionDetail(id, user);

  const previousResponsableId = inspeccion.tecnico_responsable_id;
  const existingAsApoyo = participantes.find((item) => Number(item.tecnico_id) === Number(nuevoResponsable.id));

  if (env.useMemoryDb) {
    if (existingAsApoyo) existingAsApoyo.rol = "RESPONSABLE";
    else memoryParticipantes.push({ id: memoryAutoId++, inspeccion_id: Number(id), tecnico_id: nuevoResponsable.id, rol: "RESPONSABLE", agregado_por_usuario_id: user.id, created_at: nowIso(), removed_at: null });
    const previousRow = memoryParticipantes.find((item) => item.inspeccion_id === Number(id) && Number(item.tecnico_id) === Number(previousResponsableId) && !item.removed_at);
    if (previousRow) previousRow.rol = "APOYO";
  } else {
    const pool = getPool();
    if (existingAsApoyo) await pool.query("UPDATE inspeccion_tecnicos SET rol = 'RESPONSABLE' WHERE id = ?", [existingAsApoyo.id]);
    else await insertParticipante(id, nuevoResponsable.id, "RESPONSABLE", user);
    if (previousResponsableId) {
      await pool.query(
        "UPDATE inspeccion_tecnicos SET rol = 'APOYO' WHERE inspeccion_id = ? AND tecnico_id = ? AND removed_at IS NULL",
        [id, previousResponsableId]
      );
    }
  }

  await applyPatch(id, { tecnico_responsable_id: nuevoResponsable.id });
  await audit({
    actorUserId: user.id,
    action: "inspeccion.reassigned",
    entityId: id,
    summary: `Inspección ${inspeccion.numero_inspeccion} reasignada a ${nuevoResponsable.full_name}`,
    details: { previous_responsable: previousResponsableId, new_responsable: nuevoResponsable.id }
  });
  await notify({
    recipientUserId: nuevoResponsable.id,
    senderUserId: user.id,
    body: `Inspección reasignada\n${inspeccion.numero_inspeccion}\n${inspeccion.barrio_snapshot}\nAhora eres el técnico responsable.`
  });
  return getInspeccionDetail(id, user);
};

export const listParticipantesHandler = async (id, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  assertViewAccess(inspeccion, participantes, user);
  return participantes;
};

export const addParticipante = async (id, { tecnico_id } = {}, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  if (inspeccion.estado === "FINALIZADA") throw fail("No se pueden agregar técnicos a una inspección finalizada.", 409);
  if (!isAdmin(user) && !isResponsable(participantes, user.id)) throw fail("Solo el técnico responsable o administración pueden agregar apoyo.", 403);
  const apoyo = await getEligibleUser(tecnico_id);
  if (!apoyo) throw fail("El técnico no es válido, está inactivo o su rol no es elegible.", 404);

  await insertParticipante(id, apoyo.id, "APOYO", user);
  await audit({ actorUserId: user.id, action: "inspeccion.collaborator_added", entityId: id, summary: `${apoyo.full_name} agregado como apoyo en ${inspeccion.numero_inspeccion}` });
  await notify({
    recipientUserId: apoyo.id,
    senderUserId: user.id,
    body: `Nueva colaboración en inspección\n${user.full_name || user.username} te agregó como técnico de apoyo.\n${inspeccion.numero_inspeccion}\n${inspeccion.barrio_snapshot}`
  });
  return listParticipantesHandler(id, user);
};

export const removeParticipante = async (id, tecnicoId, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  if (!isAdmin(user) && !isResponsable(participantes, user.id)) throw fail("Solo el técnico responsable o administración pueden quitar un apoyo.", 403);
  const target = participantes.find((item) => Number(item.tecnico_id) === Number(tecnicoId));
  if (!target) throw fail("El técnico no participa en esta inspección.", 404);
  if (target.rol === "RESPONSABLE") throw fail("No puedes quitar al técnico responsable; usa la reasignación.", 400);

  if (env.useMemoryDb) {
    const record = memoryParticipantes.find((item) => item.id === target.id);
    record.removed_at = nowIso();
  } else {
    await getPool().query("UPDATE inspeccion_tecnicos SET removed_at = NOW() WHERE id = ?", [target.id]);
  }
  await audit({ actorUserId: user.id, action: "inspeccion.collaborator_removed", entityId: id, summary: `${target.tecnico_nombre || "Técnico"} removido de ${inspeccion.numero_inspeccion}` });
  return listParticipantesHandler(id, user);
};

export const listGps = async (id, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  assertViewAccess(inspeccion, participantes, user);
  if (env.useMemoryDb) {
    return memoryGps
      .filter((item) => item.inspeccion_id === Number(id))
      .map((item) => ({ ...item, usuario_nombre: memoryUsers.find((u) => u.id === item.usuario_id)?.full_name || "" }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  const [rows] = await getPool().query(
    `SELECT inspeccion_gps.*, app_users.full_name AS usuario_nombre
     FROM inspeccion_gps
     LEFT JOIN app_users ON app_users.id = inspeccion_gps.usuario_id
     WHERE inspeccion_gps.inspeccion_id = ?
     ORDER BY inspeccion_gps.created_at DESC`,
    [id]
  );
  return rows;
};

export const addGps = async (id, payload = {}, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  if (inspeccion.estado === "FINALIZADA") throw fail("No se pueden registrar puntos GPS en una inspección finalizada.", 409);
  assertViewAccess(inspeccion, participantes, user);

  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw fail("La latitud no es válida.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw fail("La longitud no es válida.");
  const accuracy = payload.accuracy_meters === "" || payload.accuracy_meters == null ? null : Number(payload.accuracy_meters);
  const tipoPunto = clean(payload.tipo_punto) || "observado";
  const descripcion = clean(payload.descripcion);

  let record;
  if (env.useMemoryDb) {
    record = {
      id: memoryAutoId++,
      inspeccion_id: Number(id),
      usuario_id: user.id,
      latitude, longitude, accuracy_meters: accuracy, tipo_punto: tipoPunto, descripcion,
      created_at: nowIso()
    };
    memoryGps.push(record);
  } else {
    const [result] = await getPool().query(
      "INSERT INTO inspeccion_gps (inspeccion_id, usuario_id, latitude, longitude, accuracy_meters, tipo_punto, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, user.id, latitude, longitude, accuracy, tipoPunto, descripcion]
    );
    record = { id: result.insertId, inspeccion_id: Number(id), usuario_id: user.id, latitude, longitude, accuracy_meters: accuracy, tipo_punto: tipoPunto, descripcion, created_at: nowIso(), usuario_nombre: user.full_name };
  }

  await autoStartIfNeeded(inspeccion, user, "Punto GPS registrado en campo");
  await audit({ actorUserId: user.id, action: "inspeccion.gps_registered", entityId: id, summary: `Punto GPS registrado en ${inspeccion.numero_inspeccion}`, details: { tipo_punto: tipoPunto } });
  return record;
};

export const getBitacora = async (id, user) => {
  const { inspeccion, participantes } = await loadWithParticipantes(id);
  if (!inspeccion) throw fail("Inspección no encontrada.", 404);
  assertViewAccess(inspeccion, participantes, user);

  if (env.useMemoryDb) {
    return memoryHistory.filter((item) => item.entidad_id === Number(id)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  const pool = getPool();
  const [historyRows] = await pool.query(
    `SELECT historial_estados.*, COALESCE(app_users.full_name, app_users.username, '') AS actor_name
     FROM historial_estados LEFT JOIN app_users ON app_users.id = historial_estados.usuario_id
     WHERE entidad_tipo = 'inspeccion' AND entidad_id = ? ORDER BY historial_estados.created_at DESC`,
    [id]
  );
  const [auditRows] = await pool.query(
    `SELECT audit_logs.*, COALESCE(NULLIF(audit_logs.actor_name_snapshot, ''), app_users.full_name) AS actor_name
     FROM audit_logs LEFT JOIN app_users ON app_users.id = audit_logs.actor_user_id
     WHERE entity_type = 'inspeccion' AND entity_id = ? ORDER BY audit_logs.created_at DESC`,
    [String(id)]
  );
  const combined = [
    ...historyRows.map((row) => ({ tipo: "estado", created_at: row.created_at, actor_name: row.actor_name, resumen: `${row.estado_anterior || "—"} → ${row.estado_nuevo}${row.motivo ? `: ${row.motivo}` : ""}` })),
    ...auditRows.map((row) => ({ tipo: "auditoria", created_at: row.created_at, actor_name: row.actor_name, resumen: row.summary, accion: row.action }))
  ];
  return combined.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
};
