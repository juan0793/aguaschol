// Servicio operativo del modulo Control de Entregas.
// Responsabilidades: personal de campo, lotes diarios, cierre, documentos no
// entregados y seguimiento. Toda la aritmetica vive en entregasRules.js.

import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { jornadaEntregas } from "./entregasReminderService.js";
import { createAuditLog } from "./auditService.js";
import { emitProfileMessage } from "./profileRealtimeService.js";
import { listBarrioCodes } from "./barrioCodeService.js";
import {
  ESTADOS_LOTE,
  ESTADOS_NO_ENTREGADA,
  ESTADOS_EN_SEGUIMIENTO,
  ESTADOS_NO_ENTREGADA_ACTIVOS,
  MOTIVOS_BASE,
  RESULTADOS_INTENTO,
  TIPOS_DOCUMENTO,
  TIPOS_PERSONAL,
  addDays,
  assertPuedeAgregarNoEntregadas,
  calcularEfectividad,
  calcularEntregadas,
  contarNoEntregadasActivas,
  detectarDuplicadosEnLote,
  diffInDays,
  fail,
  listarDiasDelRango,
  semanaPorDefecto,
  toEntero,
  toIsoDate,
  validarConsistenciaDetalle,
  validarMotivo,
  validarSobrantes,
  validarTotalAsignado
} from "./entregasRules.js";

const clean = (value) => String(value ?? "").trim();
const isAdmin = (user) => user?.role === "admin";
// "Gestor" = quien administra la operacion diaria (admin u operador autorizado).
const isGestor = (user) => ["admin", "operator"].includes(user?.role);
const PAGE_SIZE = 12;

const audit = async ({ user, action, entityId, summary, details, executor }) => {
  try {
    await createAuditLog({
      actorUserId: user?.id ?? null,
      actorName: user?.full_name || user?.username || "",
      action,
      entityType: "entrega",
      entityId,
      summary,
      details,
      executor
    });
  } catch (error) {
    // La auditoria nunca debe tumbar la operacion principal, ni siquiera cuando
    // se escribe dentro de la transaccion del llamador: se deja rastro y se sigue.
    console.error(`Auditoria de entregas (${action}) fallida:`, error.message);
  }
};

const notificarCambioDeLote = async ({ lote, user, tipo }) => {
  if (env.useMemoryDb || user?.role !== "operator") return;

  try {
    const pool = getPool();
    const [administradores] = await pool.query(
      "SELECT id FROM app_users WHERE role = 'admin' AND is_active = 1 AND id <> ?",
      [user.id]
    );
    const fase = tipo === "APERTURA" ? "APERTURA" : "CIERRE";
    const body = `${tipo === "APERTURA" ? "Lote aperturado" : "Lote cerrado"} por ${user.full_name || user.username || "un técnico"}. Lote #${lote.id} · ${toIsoDate(lote.fecha)} · ${lote.responsable_nombre || "Sin responsable"} · ${lote.barrio_nombre}.`;

    for (const administrador of administradores) {
      const [result] = await pool.query(
        "INSERT INTO user_profile_messages (sender_user_id, recipient_user_id, body) VALUES (?, ?, ?)",
        [user.id, administrador.id, body]
      );
      await pool.query(
        "INSERT INTO entrega_recordatorios (lote_id, recipient_user_id, jornada, fase, message_id) VALUES (?, ?, ?, ?, ?)",
        [lote.id, administrador.id, toIsoDate(lote.fecha), fase, result.insertId]
      );
      emitProfileMessage({
        id: result.insertId,
        sender_user_id: user.id,
        sender_name: user.full_name || user.username || "Técnico",
        recipient_user_id: administrador.id,
        body,
        entrega_lote_id: lote.id,
        read_at: null,
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    // El aviso no debe bloquear la apertura o el cierre ya confirmado.
    console.error(`Notificación de lote (${tipo}) fallida:`, error.message);
  }
};

/* -------------------------------------------------------------------------- */
/* Catalogos                                                                   */
/* -------------------------------------------------------------------------- */

export const listMotivos = async ({ soloActivos = true } = {}) => {
  try {
    const [rows] = await getPool().query(
      `SELECT codigo, etiqueta, requiere_observacion, orden, activo
       FROM entrega_motivos
       ${soloActivos ? "WHERE activo = 1" : ""}
       ORDER BY orden ASC, etiqueta ASC`
    );
    if (rows.length) {
      return rows.map((row) => ({ ...row, requiere_observacion: Boolean(row.requiere_observacion) }));
    }
  } catch {
    // Si la tabla aun no existe se usa el catalogo base en codigo.
  }
  return MOTIVOS_BASE.map((item) => ({ ...item, activo: 1 }));
};

// El vinculo entre el usuario logueado y su ficha de personal permite que un
// tecnico con acceso vea unicamente sus lotes.
const getPersonalDelUsuario = async (user) => {
  if (!user?.id) return null;
  const [rows] = await getPool().query(
    "SELECT id, nombre_completo, tipo_personal FROM personal_campo WHERE user_id = ? AND activo = 1 LIMIT 1",
    [user.id]
  );
  return rows[0] || null;
};

export const getEntregasConfig = async (user) => {
  const [motivos, personalPropio, barrios, ciclo] = await Promise.all([
    listMotivos(),
    getPersonalDelUsuario(user),
    listBarrioCodes().catch(() => []),
    getCicloVigente()
  ]);

  return {
    tipos_documento: TIPOS_DOCUMENTO,
    jornada: { ...jornadaEntregas(), zona_horaria: env.entregasTimezone, fin: env.entregasFin, recordatorios: env.entregasRecordatoriosEnabled },
    estados_lote: ESTADOS_LOTE,
    estados_no_entregada: ESTADOS_NO_ENTREGADA,
    estados_en_seguimiento: ESTADOS_EN_SEGUIMIENTO,
    resultados_intento: RESULTADOS_INTENTO,
    tipos_personal: TIPOS_PERSONAL,
    motivos,
    barrios: barrios.map((item) => ({ codigo: item.codigo, barrio: item.barrio })),
    semana_actual: semanaPorDefecto(jornadaEntregas().fecha),
    ciclo,
    personal_vinculado: personalPropio,
    permissions: {
      can_manage_personal: isAdmin(user),
      can_create_lote: isGestor(user),
      can_edit_lote: Boolean(personalPropio) || isGestor(user),
      can_close_own_lote: Boolean(personalPropio) || isGestor(user),
      can_force_close: isAdmin(user),
      can_reopen_lote: isAdmin(user),
      can_delete_lote: isAdmin(user),
      can_close_ciclo: isAdmin(user),
      can_manage_seguimiento: isGestor(user) || Boolean(personalPropio),
      can_generate_report: isGestor(user),
      can_correct_report: isAdmin(user),
      can_view_all: isGestor(user)
    }
  };
};

/* -------------------------------------------------------------------------- */
/* Personal de campo                                                           */
/* -------------------------------------------------------------------------- */

// Un gestor ve el directorio completo (telefonos, usuario vinculado, metricas por
// persona). Un tecnico con usuario solo ve nombre/tipo/estado, lo suficiente para
// elegir responsable en filtros y formularios. Sin vinculo, lista vacia.
export const listPersonal = async (query = {}, user) => {
  const filtros = [];
  const params = [];

  if (clean(query.q)) {
    filtros.push("personal_campo.nombre_completo LIKE ?");
    params.push(`%${clean(query.q)}%`);
  }
  if (TIPOS_PERSONAL.includes(clean(query.tipo_personal))) {
    filtros.push("personal_campo.tipo_personal = ?");
    params.push(clean(query.tipo_personal));
  }
  if (clean(query.activo) === "1" || clean(query.activo) === "0") {
    filtros.push("personal_campo.activo = ?");
    params.push(Number(clean(query.activo)));
  }
  if (clean(query.acceso) === "con") filtros.push("personal_campo.user_id IS NOT NULL");
  if (clean(query.acceso) === "sin") filtros.push("personal_campo.user_id IS NULL");

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  // Una sola consulta agregada: nada de N+1 por persona.
  const [rows] = await getPool().query(
    `SELECT
       personal_campo.*,
       app_users.username AS usuario_username,
       app_users.full_name AS usuario_nombre,
       app_users.role AS usuario_role,
       COALESCE(resumen.lotes, 0) AS lotes,
       COALESCE(resumen.asignadas, 0) AS asignadas,
       COALESCE(resumen.sobrantes, 0) AS sobrantes,
       resumen.ultima_actividad
     FROM personal_campo
     LEFT JOIN app_users ON app_users.id = personal_campo.user_id
     LEFT JOIN (
       SELECT responsable_id,
              COUNT(*) AS lotes,
              SUM(total_asignadas) AS asignadas,
              SUM(total_sobrantes) AS sobrantes,
              MAX(fecha) AS ultima_actividad
       FROM entrega_lotes
       GROUP BY responsable_id
     ) AS resumen ON resumen.responsable_id = personal_campo.id
     ${where}
     ORDER BY personal_campo.activo DESC, personal_campo.nombre_completo ASC`,
    params
  );

  const mapped = rows.map((row) => {
    const asignadas = toEntero(row.asignadas);
    const entregadas = Math.max(asignadas - toEntero(row.sobrantes), 0);
    return {
      ...row,
      activo: Boolean(row.activo),
      tiene_acceso: Boolean(row.user_id),
      asignadas,
      entregadas,
      efectividad: calcularEfectividad(entregadas, asignadas),
      ultima_actividad: toIsoDate(row.ultima_actividad)
    };
  });

  if (isGestor(user)) return mapped;
  const personalPropio = await getPersonalDelUsuario(user);
  if (!personalPropio) return [];
  return mapped.map((persona) => ({
    id: persona.id,
    nombre_completo: persona.nombre_completo,
    tipo_personal: persona.tipo_personal,
    activo: persona.activo
  }));
};

const validarPersonalPayload = (payload = {}) => {
  const nombre = clean(payload.nombre_completo);
  if (nombre.length < 3) throw fail("El nombre completo es obligatorio.");
  const tipo = clean(payload.tipo_personal).toUpperCase() || "OTRO";
  if (!TIPOS_PERSONAL.includes(tipo)) throw fail("El tipo de personal no es válido.");
  return {
    nombre_completo: nombre.slice(0, 180),
    tipo_personal: tipo,
    telefono: clean(payload.telefono).slice(0, 40),
    user_id: payload.user_id ? toEntero(payload.user_id) : null,
    activo: payload.activo === false || payload.activo === 0 ? 0 : 1
  };
};

const assertUsuarioDisponible = async (userId, personalId = null) => {
  if (!userId) return;
  const pool = getPool();
  const [[usuario]] = await pool.query("SELECT id FROM app_users WHERE id = ? LIMIT 1", [userId]);
  if (!usuario) throw fail("El usuario indicado no existe.", 404);
  const [rows] = await pool.query(
    "SELECT id FROM personal_campo WHERE user_id = ? AND id <> ? LIMIT 1",
    [userId, personalId || 0]
  );
  if (rows.length) throw fail("Ese usuario ya está vinculado a otra persona de campo.");
};

export const createPersonal = async (payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo administradores pueden registrar personal de campo.", 403);
  const data = validarPersonalPayload(payload);
  await assertUsuarioDisponible(data.user_id);

  const [result] = await getPool().query(
    `INSERT INTO personal_campo (nombre_completo, tipo_personal, user_id, telefono, activo)
     VALUES (?, ?, ?, ?, ?)`,
    [data.nombre_completo, data.tipo_personal, data.user_id, data.telefono, data.activo]
  );

  await audit({
    user,
    action: "PERSONAL_CAMPO_CREADO",
    entityId: result.insertId,
    summary: `Personal de campo registrado: ${data.nombre_completo}`,
    details: data
  });

  return { id: result.insertId, ...data };
};

export const updatePersonal = async (id, payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo administradores pueden editar personal de campo.", 403);
  const personalId = toEntero(id);
  const [[actual]] = await getPool().query("SELECT * FROM personal_campo WHERE id = ? LIMIT 1", [personalId]);
  if (!actual) throw fail("La persona indicada no existe.", 404);

  const data = validarPersonalPayload({ ...actual, ...payload });
  await assertUsuarioDisponible(data.user_id, personalId);

  await getPool().query(
    `UPDATE personal_campo
     SET nombre_completo = ?, tipo_personal = ?, user_id = ?, telefono = ?, activo = ?
     WHERE id = ?`,
    [data.nombre_completo, data.tipo_personal, data.user_id, data.telefono, data.activo, personalId]
  );

  await audit({
    user,
    action: "PERSONAL_CAMPO_EDITADO",
    entityId: personalId,
    summary: `Personal de campo actualizado: ${data.nombre_completo}`,
    details: data
  });

  return { id: personalId, ...data };
};

/* -------------------------------------------------------------------------- */
/* Lotes                                                                       */
/* -------------------------------------------------------------------------- */

const resolverBarrio = async (payload = {}) => {
  const codigo = clean(payload.barrio_codigo);
  const nombreManual = clean(payload.barrio_nombre);
  if (!codigo && !nombreManual) throw fail("El barrio es obligatorio.");

  const catalogo = await listBarrioCodes().catch(() => []);
  const encontrado = catalogo.find((item) => String(item.codigo) === codigo);
  if (codigo && !encontrado && !nombreManual) throw fail("El barrio indicado no existe en el catálogo.", 404);

  return {
    barrio_codigo: codigo.slice(0, 10),
    barrio_nombre: (encontrado?.barrio || nombreManual).slice(0, 180)
  };
};

// Un gestor ve todo; un tecnico con usuario ve solo sus lotes. Si el usuario no
// esta vinculado a personal_campo no vemos nada (lista vacia, no un error duro).
const alcanceLotes = async (user) => {
  if (isGestor(user)) return { filtro: "", params: [] };
  const personal = await getPersonalDelUsuario(user);
  if (!personal) return { filtro: "1 = 0", params: [] };
  return { filtro: "entrega_lotes.responsable_id = ?", params: [personal.id], personal };
};

export const listLotes = async (query = {}, user) => {
  const alcance = await alcanceLotes(user);
  const filtros = alcance.filtro ? [alcance.filtro] : [];
  const params = [...alcance.params];

  if (toIsoDate(query.fecha_desde)) {
    filtros.push("entrega_lotes.fecha >= ?");
    params.push(toIsoDate(query.fecha_desde));
  }
  if (toIsoDate(query.fecha_hasta)) {
    filtros.push("entrega_lotes.fecha <= ?");
    params.push(toIsoDate(query.fecha_hasta));
  }
  if (TIPOS_DOCUMENTO.includes(clean(query.tipo_documento))) {
    filtros.push("entrega_lotes.tipo_documento = ?");
    params.push(clean(query.tipo_documento));
  }
  if (ESTADOS_LOTE.includes(clean(query.estado))) {
    filtros.push("entrega_lotes.estado = ?");
    params.push(clean(query.estado));
  }
  if (clean(query.barrio_codigo)) {
    filtros.push("entrega_lotes.barrio_codigo = ?");
    params.push(clean(query.barrio_codigo));
  }
  if (toEntero(query.responsable_id)) {
    filtros.push("entrega_lotes.responsable_id = ?");
    params.push(toEntero(query.responsable_id));
  }
  if (clean(query.q)) {
    filtros.push("(personal_campo.nombre_completo LIKE ? OR entrega_lotes.barrio_nombre LIKE ?)");
    params.push(`%${clean(query.q)}%`, `%${clean(query.q)}%`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const page = Math.max(toEntero(query.page) || 1, 1);
  const limit = Math.min(Math.max(toEntero(query.limit) || PAGE_SIZE, 1), 100);
  const offset = (page - 1) * limit;
  const pool = getPool();

  const [[conteo]] = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT entrega_lotes.responsable_id) AS responsables,
       COALESCE(SUM(entrega_lotes.total_asignadas), 0) AS asignadas,
       COALESCE(SUM(entrega_lotes.estado = 'ABIERTO'), 0) AS abiertos,
       COALESCE(SUM(CASE WHEN entrega_lotes.estado <> 'ABIERTO' THEN entrega_lotes.total_asignadas - entrega_lotes.total_sobrantes ELSE 0 END), 0) AS entregadas,
       COALESCE(SUM(CASE WHEN entrega_lotes.estado <> 'ABIERTO' THEN entrega_lotes.total_sobrantes ELSE 0 END), 0) AS sobrantes
     FROM entrega_lotes
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       entrega_lotes.*,
       personal_campo.nombre_completo AS responsable_nombre,
       personal_campo.tipo_personal,
       COALESCE(detalle.total_detalle, 0) AS total_detalle,
       COALESCE(detalle.pendientes, 0) AS pendientes
     FROM entrega_lotes
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     LEFT JOIN (
       SELECT lote_id,
              SUM(estado <> 'CANCELADA') AS total_detalle,
              SUM(estado = 'PENDIENTE') AS pendientes
       FROM entrega_no_entregadas
       GROUP BY lote_id
     ) AS detalle ON detalle.lote_id = entrega_lotes.id
     ${where}
     ORDER BY entrega_lotes.fecha DESC, entrega_lotes.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = toEntero(conteo.total);
  return {
    items: rows.map(mapLoteRow),
    resumen: { ...Object.fromEntries(Object.entries(conteo).map(([key, value]) => [key, Number(value)])), efectividad: calcularEfectividad(conteo.entregadas, conteo.asignadas) },
    total,
    page,
    limit,
    total_pages: Math.max(Math.ceil(total / limit), 1)
  };
};

const mapLoteRow = (row) => ({
  ...row,
  fecha: toIsoDate(row.fecha),
  total_asignadas: toEntero(row.total_asignadas),
  total_sobrantes: toEntero(row.total_sobrantes),
  total_entregadas: calcularEntregadas(row),
  efectividad: calcularEfectividad(calcularEntregadas(row), row.total_asignadas),
  total_detalle: toEntero(row.total_detalle),
  pendientes: toEntero(row.pendientes)
});

const cargarLote = async (id, executor = getPool(), forUpdate = false) => {
  const [rows] = await executor.query(
    `SELECT entrega_lotes.*, personal_campo.nombre_completo AS responsable_nombre, personal_campo.tipo_personal,
            personal_campo.user_id AS responsable_user_id,
            cierre.full_name AS closed_by_nombre
     FROM entrega_lotes
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     LEFT JOIN app_users AS cierre ON cierre.id = entrega_lotes.closed_by
     WHERE entrega_lotes.id = ? LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [toEntero(id)]
  );
  if (!rows.length) throw fail("El lote indicado no existe.", 404);
  return rows[0];
};

const assertPuedeVerLote = (lote, user) => {
  if (isGestor(user)) return;
  if (!user?.id || !lote.responsable_user_id || Number(lote.responsable_user_id) !== Number(user.id)) {
    throw fail("No tienes acceso a este lote.", 403);
  }
};

export const getLoteDetail = async (id, user) => {
  const lote = await cargarLote(id);
  assertPuedeVerLote(lote, user);
  const noEntregadas = await listNoEntregadasDeLote(lote.id);
  return { ...mapLoteRow(lote), no_entregadas: noEntregadas };
};

export const createLote = async (payload = {}, user) => {
  if (!isGestor(user)) throw fail("No tienes permiso para crear lotes.", 403);

  const responsableId = toEntero(payload.responsable_id);
  if (!responsableId) throw fail("Selecciona el responsable del lote.");
  const [[responsable]] = await getPool().query(
    "SELECT id, nombre_completo, activo FROM personal_campo WHERE id = ? LIMIT 1",
    [responsableId]
  );
  if (!responsable) throw fail("El responsable indicado no existe.", 404);
  if (!responsable.activo) throw fail("El responsable seleccionado está inactivo.");

  const tipo = clean(payload.tipo_documento).toUpperCase();
  if (!TIPOS_DOCUMENTO.includes(tipo)) throw fail("Selecciona el tipo de documento.");

  const fecha = toIsoDate(payload.fecha) || jornadaEntregas().fecha;
  const totalAsignadas = validarTotalAsignado(payload.total_asignadas);
  const barrio = await resolverBarrio(payload);

  const [result] = await getPool().query(
    `INSERT INTO entrega_lotes
       (fecha, responsable_id, barrio_codigo, barrio_nombre, tipo_documento, total_asignadas, estado, observacion_inicial, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'ABIERTO', ?, ?)`,
    [
      fecha,
      responsableId,
      barrio.barrio_codigo,
      barrio.barrio_nombre,
      tipo,
      totalAsignadas,
      clean(payload.observacion_inicial) || null,
      user?.id ?? null
    ]
  );

  await audit({
    user,
    action: "LOTE_CREADO",
    entityId: result.insertId,
    summary: `Lote de ${tipo} para ${responsable.nombre_completo} (${barrio.barrio_nombre}): ${totalAsignadas} documentos`,
    details: { lote_id: result.insertId, fecha, responsable_id: responsableId, tipo_documento: tipo, total_asignadas: totalAsignadas }
  });

  const creado = await getLoteDetail(result.insertId, user);
  await notificarCambioDeLote({ lote: creado, user, tipo: "APERTURA" });
  return creado;
};

export const updateLote = async (id, payload = {}, user) => {
  const lote = await cargarLote(id);
  assertPuedeVerLote(lote, user);
  if (lote.estado !== "ABIERTO" && !isAdmin(user)) {
    throw fail("Solo un administrador puede editar un lote ya cerrado.", 403);
  }

  const cambios = {};
  if (payload.fecha !== undefined) cambios.fecha = toIsoDate(payload.fecha) || lote.fecha;
  if (payload.total_asignadas !== undefined) cambios.total_asignadas = validarTotalAsignado(payload.total_asignadas);
  if (payload.tipo_documento !== undefined) {
    const tipo = clean(payload.tipo_documento).toUpperCase();
    if (!TIPOS_DOCUMENTO.includes(tipo)) throw fail("El tipo de documento no es válido.");
    cambios.tipo_documento = tipo;
  }
  if (payload.responsable_id !== undefined) {
    const responsableId = toEntero(payload.responsable_id);
    if (!responsableId) throw fail("Selecciona el responsable del lote.");
    if (!isGestor(user) && responsableId !== toEntero(lote.responsable_id)) {
      throw fail("No tienes permiso para cambiar el responsable del lote.", 403);
    }
    const [[responsable]] = await getPool().query(
      "SELECT id, activo FROM personal_campo WHERE id = ? LIMIT 1",
      [responsableId]
    );
    if (!responsable) throw fail("El responsable indicado no existe.", 404);
    if (!responsable.activo) throw fail("El responsable seleccionado está inactivo.");
    cambios.responsable_id = responsableId;
  }
  if (payload.barrio_codigo !== undefined || payload.barrio_nombre !== undefined) {
    Object.assign(cambios, await resolverBarrio(payload));
  }
  if (payload.observacion_inicial !== undefined) cambios.observacion_inicial = clean(payload.observacion_inicial) || null;
  if (payload.observacion_responsable !== undefined) {
    cambios.observacion_responsable = clean(payload.observacion_responsable) || null;
  }
  if (payload.estado !== undefined && clean(payload.estado).toUpperCase() !== lote.estado) {
    throw fail("Usa el cierre de lote, la reapertura administrativa o la emisión del informe para cambiar el estado.");
  }

  const columnas = Object.keys(cambios);
  if (!columnas.length) return getLoteDetail(lote.id, user);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const actual = await cargarLote(id, connection, true);
    assertPuedeVerLote(actual, user);
    if (actual.estado !== "ABIERTO" && !isAdmin(user)) {
      throw fail("El lote ya está cerrado. Pide a un administrador que lo reabra para corregirlo.", 409);
    }
    const detalle = await listNoEntregadasDeLote(id, connection);
    const asignadas = cambios.total_asignadas ?? actual.total_asignadas;
    validarSobrantes(contarNoEntregadasActivas(detalle), asignadas);
    validarSobrantes(actual.total_sobrantes, asignadas);
    await connection.query(
      `UPDATE entrega_lotes SET ${columnas.map((columna) => `${columna} = ?`).join(", ")} WHERE id = ?`,
      [...columnas.map((columna) => cambios[columna]), lote.id]
    );
    await audit({ user, action: "LOTE_EDITADO", entityId: lote.id, summary: `Lote #${lote.id} actualizado`, details: { lote_id: lote.id, cambios }, executor: connection });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }

  return getLoteDetail(lote.id, user);
};

// Cierre diario: guarda sobrantes + observacion y valida que el detalle cuadre.
// Todo el chequeo de consistencia y la escritura ocurren dentro de una misma
// transaccion con bloqueo de filas, para que un alta/baja de no-entregadas
// concurrente no deje el lote cerrado con un total_sobrantes desactualizado.
export const cerrarLote = async (id, payload = {}, user) => {
  let lote, sobrantes;
  const observacion = clean(payload.observacion_responsable);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    lote = await cargarLote(id, connection, true);
    assertPuedeVerLote(lote, user);
    if (lote.estado !== "ABIERTO") {
      throw fail("El lote ya está cerrado o revisado. Un administrador debe reabrirlo para corregir el cierre.", 409);
    }
    sobrantes = validarSobrantes(payload.total_sobrantes, lote.total_asignadas);

    const detalle = await listNoEntregadasDeLote(lote.id, connection, { forUpdate: true });
    validarConsistenciaDetalle({
      total_sobrantes: sobrantes,
      detalle
    });

    await connection.query(
      `UPDATE entrega_lotes
       SET total_sobrantes = ?, observacion_responsable = ?, estado = 'CERRADO', closed_by = ?, closed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sobrantes, observacion || null, user?.id ?? null, lote.id]
    );
    await connection.query(
      `UPDATE user_profile_messages messages INNER JOIN entrega_recordatorios aviso ON aviso.message_id = messages.id
       SET messages.read_at = COALESCE(messages.read_at, CURRENT_TIMESTAMP) WHERE aviso.lote_id = ?`, [lote.id]);
    await audit({ user, action: "LOTE_CERRADO", entityId: lote.id, summary: `Lote #${lote.id} cerrado`, details: { lote_id: lote.id, total_asignadas: lote.total_asignadas, total_sobrantes: sobrantes, closed_by: user.id }, executor: connection });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const cerrado = await getLoteDetail(lote.id, user);
  await notificarCambioDeLote({ lote: cerrado, user, tipo: "CIERRE" });
  return cerrado;
};

// Toda marcha atras administrativa exige un motivo: es lo unico que queda en la
// auditoria para explicar por que se revirtio un cierre o se borro un lote.
const exigirMotivo = (payload, mensaje) => {
  const motivo = clean(payload.motivo);
  if (motivo.length < 5) throw fail(mensaje);
  if (motivo.length > 255) throw fail("El motivo no puede superar los 255 caracteres.");
  return motivo;
};

// Reapertura administrativa: la unica via de vuelta cuando un lote se cerro por
// error. El detalle y total_sobrantes se conservan, asi que la invariante
// COUNT(activas) == total_sobrantes sigue firme y el lote vuelve a admitir
// edicion, altas de no entregadas y un cierre corregido.
export const reabrirLote = async (id, payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo un administrador puede reabrir un lote.", 403);
  const motivo = exigirMotivo(payload, "Explica por qué se reabre el lote (mínimo 5 caracteres).");

  let loteId;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const lote = await cargarLote(id, connection, true);
    if (lote.estado === "ABIERTO") throw fail("El lote ya está abierto.", 409);
    loteId = lote.id;
    await connection.query(
      "UPDATE entrega_lotes SET estado = 'ABIERTO', closed_by = NULL, closed_at = NULL WHERE id = ?",
      [lote.id]
    );
    await audit({
      user,
      action: "LOTE_REABIERTO",
      entityId: lote.id,
      summary: `Lote #${lote.id} reabierto desde ${lote.estado}: ${motivo}`.slice(0, 250),
      details: {
        lote_id: lote.id,
        estado_anterior: lote.estado,
        closed_by: lote.closed_by,
        closed_at: lote.closed_at,
        total_sobrantes: toEntero(lote.total_sobrantes),
        motivo
      },
      executor: connection
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getLoteDetail(loteId, user);
};

// Borrado definitivo, para lotes cargados por error. Un lote cerrado o revisado
// hay que reabrirlo primero: son dos pasos deliberados y cada uno deja su motivo
// en la auditoria. El FK en cascada arrastra detalle, intentos y recordatorios;
// los avisos ya enviados se limpian antes para no dejar mensajes huerfanos en el
// centro de notificaciones. La auditoria guarda el lote completo por si hay que
// reconstruirlo.
export const deleteLote = async (id, payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo un administrador puede eliminar un lote.", 403);
  const motivo = exigirMotivo(payload, "Explica por qué se elimina el lote (mínimo 5 caracteres).");

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const lote = await cargarLote(id, connection, true);
    if (lote.estado !== "ABIERTO") {
      throw fail("Reabre el lote antes de eliminarlo, para dejar constancia de por qué se revierte el cierre.", 409);
    }
    const detalle = await listNoEntregadasDeLote(lote.id, connection, { forUpdate: true });
    await connection.query(
      `DELETE messages FROM user_profile_messages messages
       INNER JOIN entrega_recordatorios aviso ON aviso.message_id = messages.id
       WHERE aviso.lote_id = ?`,
      [lote.id]
    );
    await connection.query("DELETE FROM entrega_lotes WHERE id = ?", [lote.id]);
    await audit({
      user,
      action: "LOTE_ELIMINADO",
      entityId: lote.id,
      summary: `Lote #${lote.id} (${lote.barrio_nombre}, ${toIsoDate(lote.fecha)}) eliminado: ${motivo}`.slice(0, 250),
      details: { motivo, lote: mapLoteRow(lote), no_entregadas: detalle },
      executor: connection
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { deleted: true, id: toEntero(id) };
};

/* -------------------------------------------------------------------------- */
/* Ciclo de facturacion                                                        */
/* -------------------------------------------------------------------------- */

// El ciclo vigente arranca el dia siguiente al ultimo corte declarado. Mientras
// no haya cortes, corre desde siempre: es el estado inicial de una instalacion.
export const getCicloVigente = async (executor = getPool()) => {
  const [filas] = await executor.query(
    `SELECT fecha_corte, motivo, documentos_vencidos, declarado_por_nombre, created_at
     FROM entrega_ciclos ORDER BY fecha_corte DESC, id DESC LIMIT 1`
  );
  const ultimo = filas[0];
  const inicio = ultimo ? addDays(toIsoDate(ultimo.fecha_corte), 1) : "";
  return {
    fecha_inicio: inicio,
    dias_abierto: inicio ? Math.max(diffInDays(inicio, jornadaEntregas().fecha) + 1, 0) : 0,
    ultimo_corte: ultimo
      ? {
        fecha_corte: toIsoDate(ultimo.fecha_corte),
        motivo: ultimo.motivo,
        documentos_vencidos: toEntero(ultimo.documentos_vencidos),
        declarado_por_nombre: ultimo.declarado_por_nombre,
        created_at: ultimo.created_at
      }
      : null
  };
};

// Cuando facturacion emite los documentos del mes nuevo, los pendientes del ciclo
// anterior quedan sin efecto: la factura nueva reemplaza a la vieja y ya no tiene
// sentido seguir persiguiendo la entrega de la anterior. Pasan a VENCIDA, que
// sigue contando como no entregada del lote -asi las cifras de lotes ya cerrados
// no se mueven- pero sale de la cola de seguimiento.
export const cerrarCicloEntregas = async (payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo un administrador puede cerrar el ciclo de facturación.", 403);
  const motivo = exigirMotivo(payload, "Indica de qué emisión se trata (mínimo 5 caracteres).");
  const hoy = jornadaEntregas().fecha;
  const corte = toIsoDate(payload.fecha_corte) || hoy;
  if (corte > hoy) throw fail("El corte no puede ser una fecha futura.");

  let vencidos = 0;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [previos] = await connection.query(
      "SELECT fecha_corte FROM entrega_ciclos ORDER BY fecha_corte DESC, id DESC LIMIT 1 FOR UPDATE"
    );
    const anterior = previos[0] && toIsoDate(previos[0].fecha_corte);
    if (anterior && anterior >= corte) {
      throw fail(`El último corte ya cubre hasta el ${anterior}. Elige una fecha posterior.`, 409);
    }
    const [result] = await connection.query(
      `UPDATE entrega_no_entregadas AS documento
       INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
       SET documento.estado = 'VENCIDA'
       WHERE documento.estado = 'PENDIENTE' AND entrega_lotes.fecha <= ?`,
      [corte]
    );
    vencidos = toEntero(result.affectedRows);
    await connection.query(
      `INSERT INTO entrega_ciclos (fecha_corte, motivo, documentos_vencidos, declarado_por, declarado_por_nombre)
       VALUES (?, ?, ?, ?, ?)`,
      [corte, motivo, vencidos, user?.id ?? null, user?.full_name || user?.username || ""]
    );
    await audit({
      user,
      action: "CICLO_CERRADO",
      entityId: corte,
      summary: `Ciclo cerrado al ${corte}: ${vencidos} documento(s) sin efecto. ${motivo}`.slice(0, 250),
      details: { fecha_corte: corte, corte_anterior: anterior || null, documentos_vencidos: vencidos, motivo },
      executor: connection
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { ...(await getCicloVigente()), documentos_vencidos: vencidos };
};

/* -------------------------------------------------------------------------- */
/* Documentos no entregados                                                    */
/* -------------------------------------------------------------------------- */

const listNoEntregadasDeLote = async (loteId, executor = getPool(), { forUpdate = false } = {}) => {
  const [rows] = await executor.query(
    `SELECT documento.*, COALESCE(intentos.total, 0) AS intentos
     FROM entrega_no_entregadas AS documento
     LEFT JOIN (
       SELECT no_entregada_id, COUNT(*) AS total FROM entrega_intentos GROUP BY no_entregada_id
     ) AS intentos ON intentos.no_entregada_id = documento.id
     WHERE documento.lote_id = ?
     ORDER BY documento.id ASC
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [toEntero(loteId)]
  );
  return rows.map(mapNoEntregadaRow);
};

// Recalcula total_sobrantes a partir del detalle activo real. Se usa cada vez que
// el conteo de "no entregadas activas" de un lote ya cerrado/revisado cambia
// (correccion admin, borrado, cancelacion), para que la regla
// COUNT(activas) == total_sobrantes nunca quede desactualizada.
const recalcularTotalSobrantes = async (executor, loteId) => {
  const lote = await cargarLote(loteId, executor, true);
  const detalle = await listNoEntregadasDeLote(loteId, executor);
  const total = contarNoEntregadasActivas(detalle);
  validarSobrantes(total, lote.total_asignadas);
  await executor.query("UPDATE entrega_lotes SET total_sobrantes = ? WHERE id = ?", [total, loteId]);
  return total;
};

const mapNoEntregadaRow = (row) => ({
  ...row,
  intentos: toEntero(row.intentos),
  fecha_lote: toIsoDate(row.fecha_lote || row.fecha),
  fecha_ultimo_intento: toIsoDate(row.fecha_ultimo_intento),
  fecha_entrega_final: toIsoDate(row.fecha_entrega_final)
});

export const createNoEntregadas = async (loteId, payload = {}, user) => {
  const lote = await cargarLote(loteId);
  assertPuedeVerLote(lote, user);

  const filas = Array.isArray(payload.items) ? payload.items : [payload];
  if (!filas.length) throw fail("No hay documentos para registrar.");

  const catalogo = await listMotivos();
  const preparadas = filas.map((item) => {
    const numero = clean(item.numero_abonado);
    const clave = clean(item.clave_catastral);
    if (!numero && !clave) throw fail("Cada documento necesita número de abonado o clave catastral.");
    return {
      numero_abonado: numero.slice(0, 80),
      clave_catastral: clave.slice(0, 30),
      abonado_nombre: clean(item.abonado_nombre).slice(0, 180),
      motivo: validarMotivo({ motivo: item.motivo, observacion: item.observacion, catalogo }),
      observacion: clean(item.observacion) || null
    };
  });

  // La correccion administrativa es la unica via para agregar documentos a un
  // lote que ya no esta ABIERTO; re-cuadra total_sobrantes al terminar.
  const esCorreccionAdmin = Boolean(payload.correccion_admin) && isAdmin(user);

  const connection = await getPool().getConnection();
  let estadoActual;
  let nuevosSobrantes = null;
  try {
    await connection.beginTransaction();
    const actual = await cargarLote(lote.id, connection, true);
    assertPuedeVerLote(actual, user);
    estadoActual = actual.estado;
    assertPuedeAgregarNoEntregadas({ estadoLote: estadoActual, esCorreccionAdmin });

    const existentes = await listNoEntregadasDeLote(lote.id, connection, { forUpdate: true });
    validarSobrantes(contarNoEntregadasActivas(existentes) + preparadas.length, actual.total_asignadas);
    const duplicados = detectarDuplicadosEnLote([...existentes, ...preparadas]);
    if (duplicados.length && !payload.permitir_duplicados) {
      throw fail(
        `Hay ${duplicados.length} abonado(s)/clave(s) repetidos en este lote. Revísalos o confirma el registro duplicado.`
      );
    }

    await connection.query(
      `INSERT INTO entrega_no_entregadas
         (lote_id, numero_abonado, clave_catastral, abonado_nombre, motivo, observacion, estado, created_by)
       VALUES ?`,
      [
        preparadas.map((item) => [
          lote.id,
          item.numero_abonado,
          item.clave_catastral,
          item.abonado_nombre,
          item.motivo,
          item.observacion,
          "PENDIENTE",
          user?.id ?? null
        ])
      ]
    );

    if (estadoActual !== "ABIERTO") {
      nuevosSobrantes = await recalcularTotalSobrantes(connection, lote.id);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await audit({
    user,
    action: estadoActual === "ABIERTO" ? "DOCUMENTO_PENDIENTE_CREADO" : "DOCUMENTO_PENDIENTE_CORREGIDO_ADMIN",
    entityId: lote.id,
    summary:
      estadoActual === "ABIERTO"
        ? `${preparadas.length} documento(s) no entregado(s) registrados en el lote #${lote.id}`
        : `Admin agregó ${preparadas.length} documento(s) a un lote ${estadoActual} (#${lote.id}) y ajustó sobrantes a ${nuevosSobrantes}`,
    details: {
      lote_id: lote.id,
      total: preparadas.length,
      estado_lote: estadoActual,
      ...(nuevosSobrantes !== null ? { nuevos_sobrantes: nuevosSobrantes } : {})
    }
  });

  return getLoteDetail(lote.id, user);
};

export const listNoEntregadas = async (query = {}, user) => {
  const hoy = jornadaEntregas().fecha;
  const alcance = await alcanceLotes(user);
  const filtros = alcance.filtro ? [alcance.filtro] : [];
  const params = [...alcance.params];
  if (clean(query.q)) {
    filtros.push("(documento.numero_abonado LIKE ? OR documento.clave_catastral LIKE ? OR documento.abonado_nombre LIKE ?)");
    params.push(...Array(3).fill(`%${clean(query.q)}%`));
  }
  if (clean(query.sin_intentos) === "1") filtros.push("NOT EXISTS (SELECT 1 FROM entrega_intentos WHERE no_entregada_id = documento.id)");

  if (clean(query.numero_abonado)) {
    filtros.push("documento.numero_abonado LIKE ?");
    params.push(`%${clean(query.numero_abonado)}%`);
  }
  if (clean(query.clave_catastral)) {
    filtros.push("documento.clave_catastral LIKE ?");
    params.push(`%${clean(query.clave_catastral)}%`);
  }
  if (clean(query.barrio_codigo)) {
    filtros.push("entrega_lotes.barrio_codigo = ?");
    params.push(clean(query.barrio_codigo));
  }
  if (toEntero(query.responsable_id)) {
    filtros.push("entrega_lotes.responsable_id = ?");
    params.push(toEntero(query.responsable_id));
  }
  if (TIPOS_DOCUMENTO.includes(clean(query.tipo_documento))) {
    filtros.push("entrega_lotes.tipo_documento = ?");
    params.push(clean(query.tipo_documento));
  }
  if (clean(query.motivo)) {
    filtros.push("documento.motivo = ?");
    params.push(clean(query.motivo).toUpperCase());
  }
  if (ESTADOS_NO_ENTREGADA.includes(clean(query.estado))) {
    filtros.push("documento.estado = ?");
    params.push(clean(query.estado));
  }
  if (toIsoDate(query.fecha_desde)) {
    filtros.push("entrega_lotes.fecha >= ?");
    params.push(toIsoDate(query.fecha_desde));
  }
  if (toIsoDate(query.fecha_hasta)) {
    filtros.push("entrega_lotes.fecha <= ?");
    params.push(toIsoDate(query.fecha_hasta));
  }
  if (toEntero(query.dias_minimos) > 0) {
    filtros.push("DATEDIFF(?, entrega_lotes.fecha) > ?");
    params.push(hoy, toEntero(query.dias_minimos));
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const page = Math.max(toEntero(query.page) || 1, 1);
  const limit = Math.min(Math.max(toEntero(query.limit) || PAGE_SIZE, 1), 100);
  const offset = (page - 1) * limit;
  const pool = getPool();

  const [[conteo]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM entrega_no_entregadas AS documento
     INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
     ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       documento.*,
       entrega_lotes.fecha AS fecha_lote,
       entrega_lotes.tipo_documento,
       entrega_lotes.barrio_codigo,
       entrega_lotes.barrio_nombre,
       entrega_lotes.responsable_id,
       personal_campo.nombre_completo AS responsable_nombre,
       DATEDIFF(?, entrega_lotes.fecha) AS dias_pendiente,
       COALESCE(intentos.total, 0) AS intentos
     FROM entrega_no_entregadas AS documento
     INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     LEFT JOIN (
       SELECT no_entregada_id, COUNT(*) AS total FROM entrega_intentos GROUP BY no_entregada_id
     ) AS intentos ON intentos.no_entregada_id = documento.id
     ${where}
     ORDER BY entrega_lotes.fecha ASC, documento.id ASC
     LIMIT ? OFFSET ?`,
    [hoy, ...params, limit, offset]
  );

  const total = toEntero(conteo.total);
  return {
    items: rows.map((row) => ({ ...mapNoEntregadaRow(row), dias_pendiente: Math.max(toEntero(row.dias_pendiente), 0) })),
    total,
    page,
    limit,
    total_pages: Math.max(Math.ceil(total / limit), 1)
  };
};

const cargarNoEntregada = async (id) => {
  const [rows] = await getPool().query(
    `SELECT documento.*, entrega_lotes.fecha AS fecha_lote, entrega_lotes.tipo_documento,
            entrega_lotes.barrio_codigo, entrega_lotes.barrio_nombre, entrega_lotes.responsable_id,
            entrega_lotes.estado AS lote_estado,
            personal_campo.nombre_completo AS responsable_nombre, personal_campo.user_id AS responsable_user_id
     FROM entrega_no_entregadas AS documento
     INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     WHERE documento.id = ? LIMIT 1`,
    [toEntero(id)]
  );
  if (!rows.length) throw fail("El documento indicado no existe.", 404);
  return rows[0];
};

// Igual que createNoEntregadas: un lote REVISADO ya quedo archivado en un informe
// semanal y no admite mas cambios salvo que un administrador lo fuerce.
const assertLoteEditable = (documento, user) => {
  if (documento.lote_estado === "REVISADO" && !isAdmin(user)) {
    throw fail("El lote ya fue revisado y no admite cambios.");
  }
};

export const getNoEntregadaDetail = async (id, user) => {
  const documento = await cargarNoEntregada(id);
  assertPuedeVerLote(documento, user);
  const [intentos] = await getPool().query(
    `SELECT entrega_intentos.*, personal_campo.nombre_completo AS responsable_nombre
     FROM entrega_intentos
     LEFT JOIN personal_campo ON personal_campo.id = entrega_intentos.responsable_id
     WHERE entrega_intentos.no_entregada_id = ?
     ORDER BY entrega_intentos.fecha ASC, entrega_intentos.id ASC`,
    [documento.id]
  );

  return {
    ...mapNoEntregadaRow({ ...documento, intentos: intentos.length }),
    intentos_detalle: intentos.map((item) => ({ ...item, fecha: toIsoDate(item.fecha) }))
  };
};

export const updateNoEntregada = async (id, payload = {}, user) => {
  const documento = await cargarNoEntregada(id);
  assertPuedeVerLote(documento, user);
  assertLoteEditable(documento, user);
  const catalogo = await listMotivos();
  const cambios = {};

  if (payload.motivo !== undefined) {
    cambios.motivo = validarMotivo({
      motivo: payload.motivo,
      observacion: payload.observacion ?? documento.observacion,
      catalogo
    });
  }
  if (payload.observacion !== undefined) cambios.observacion = clean(payload.observacion) || null;
  if (payload.numero_abonado !== undefined) cambios.numero_abonado = clean(payload.numero_abonado).slice(0, 80);
  if (payload.clave_catastral !== undefined) cambios.clave_catastral = clean(payload.clave_catastral).slice(0, 30);
  if (payload.abonado_nombre !== undefined) cambios.abonado_nombre = clean(payload.abonado_nombre).slice(0, 180);
  if (payload.estado !== undefined) {
    const estado = clean(payload.estado).toUpperCase();
    if (!ESTADOS_NO_ENTREGADA.includes(estado)) throw fail("El estado del documento no es válido.");
    cambios.estado = estado;
    cambios.fecha_entrega_final = estado === "REENTREGADA"
      ? toIsoDate(payload.fecha_entrega_final) || jornadaEntregas().fecha
      : null;
  }

  const columnas = Object.keys(cambios);
  if (!columnas.length) return getNoEntregadaDetail(documento.id, user);
  if (!clean(cambios.numero_abonado ?? documento.numero_abonado) && !clean(cambios.clave_catastral ?? documento.clave_catastral)) {
    throw fail("El documento necesita número de abonado o clave catastral.");
  }
  validarMotivo({ motivo: cambios.motivo ?? documento.motivo, observacion: cambios.observacion ?? documento.observacion, catalogo });

  // Un cambio de estado puede sacar (o meter) el documento del conteo de
  // "activas" (p. ej. CANCELADA). Si el lote ya no esta ABIERTO, total_sobrantes
  // ya quedo fijo al cerrar, asi que se recalcula en la misma transaccion.
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const actual = await cargarLote(documento.lote_id, connection, true);
    assertPuedeVerLote(actual, user);
    assertLoteEditable({ lote_estado: actual.estado }, user);
    await connection.query(
      `UPDATE entrega_no_entregadas SET ${columnas.map((columna) => `${columna} = ?`).join(", ")} WHERE id = ?`,
      [...columnas.map((columna) => cambios[columna]), documento.id]
    );
    if (columnas.includes("estado")) {
      const detalle = await listNoEntregadasDeLote(documento.lote_id, connection);
      validarSobrantes(contarNoEntregadasActivas(detalle), actual.total_asignadas);
      if (actual.estado !== "ABIERTO") await recalcularTotalSobrantes(connection, documento.lote_id);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (cambios.estado === "REENTREGADA") {
    await audit({
      user,
      action: "DOCUMENTO_REENTREGADO",
      entityId: documento.id,
      summary: `Documento ${documento.numero_abonado || documento.clave_catastral} marcado como reentregado`,
      details: { no_entregada_id: documento.id, lote_id: documento.lote_id }
    });
  }

  return getNoEntregadaDetail(documento.id, user);
};

export const deleteNoEntregada = async (id, user) => {
  const documento = await cargarNoEntregada(id);
  assertPuedeVerLote(documento, user);
  if (documento.lote_estado !== "ABIERTO" && !isAdmin(user)) {
    throw fail("Solo un administrador puede eliminar filas de un lote cerrado.", 403);
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const actual = await cargarLote(documento.lote_id, connection, true);
    assertPuedeVerLote(actual, user);
    if (actual.estado !== "ABIERTO" && !isAdmin(user)) {
      throw fail("El lote ya está cerrado. Pide a un administrador que lo reabra para corregirlo.", 409);
    }
    await connection.query("DELETE FROM entrega_no_entregadas WHERE id = ?", [documento.id]);
    if (actual.estado !== "ABIERTO") {
      await recalcularTotalSobrantes(connection, documento.lote_id);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await audit({
    user,
    action: "DOCUMENTO_PENDIENTE_ELIMINADO",
    entityId: documento.id,
    summary: `Documento no entregado eliminado del lote #${documento.lote_id}`,
    details: { no_entregada_id: documento.id, lote_id: documento.lote_id }
  });

  return { ok: true };
};

/* -------------------------------------------------------------------------- */
/* Seguimiento / intentos                                                      */
/* -------------------------------------------------------------------------- */

export const registrarIntento = async (id, payload = {}, user) => {
  const documento = await cargarNoEntregada(id);
  assertPuedeVerLote(documento, user);
  assertLoteEditable(documento, user);

  const resultado = clean(payload.resultado).toUpperCase();
  if (!RESULTADOS_INTENTO.includes(resultado)) throw fail("El resultado del intento no es válido.");
  const fecha = toIsoDate(payload.fecha) || jornadaEntregas().fecha;
  const responsableId = toEntero(payload.responsable_id) || documento.responsable_id || null;
  const observacion = clean(payload.observacion) || null;
  if (resultado === "OTRO" && !observacion) throw fail('El resultado "Otro" exige una observación.');

  const connection = await getPool().getConnection();
  let result;
  try {
  await connection.beginTransaction();
  const actual = await cargarLote(documento.lote_id, connection, true);
  assertPuedeVerLote(actual, user);
  assertLoteEditable({ lote_estado: actual.estado }, user);
  const [[vigente]] = await connection.query("SELECT * FROM entrega_no_entregadas WHERE id = ? FOR UPDATE", [documento.id]);
  if (!vigente) throw fail("El documento ya no existe.", 404);
  if (vigente.estado === "CANCELADA") throw fail("El seguimiento está cancelado.");
  if (vigente.estado === "VENCIDA") {
    throw fail("El documento venció con el cierre de ciclo: la factura nueva lo reemplaza.");
  }
  const [[responsable]] = await connection.query("SELECT id FROM personal_campo WHERE id = ? AND activo = 1", [responsableId]);
  if (!responsable) throw fail("El responsable del intento no está activo.");
  [result] = await connection.query(
    `INSERT INTO entrega_intentos (no_entregada_id, fecha, responsable_id, resultado, observacion, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [documento.id, fecha, responsableId, resultado, observacion, user?.id ?? null]
  );

  // El intento nunca sobrescribe al anterior: solo actualiza el estado vigente.
  const nuevoEstado = resultado === "ENTREGADO"
    ? "REENTREGADA"
    : resultado === "NO_LOCALIZADO"
      ? "NO_LOCALIZADA"
      : vigente.estado;

  await connection.query(
    `UPDATE entrega_no_entregadas
     SET estado = ?, fecha_ultimo_intento = ?, fecha_entrega_final = ?
     WHERE id = ?`,
    [nuevoEstado, fecha, nuevoEstado === "REENTREGADA" ? (vigente.fecha_entrega_final || fecha) : null, documento.id]
  );
  await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }

  await audit({
    user,
    action: resultado === "ENTREGADO" ? "DOCUMENTO_REENTREGADO" : "INTENTO_REGISTRADO",
    entityId: documento.id,
    summary: `Intento ${resultado} registrado para ${documento.numero_abonado || documento.clave_catastral}`,
    details: { intento_id: result.insertId, no_entregada_id: documento.id, lote_id: documento.lote_id, resultado, fecha }
  });

  return getNoEntregadaDetail(documento.id, user);
};

/* -------------------------------------------------------------------------- */
/* Resumen / dashboard                                                         */
/* -------------------------------------------------------------------------- */

export const getResumen = async (query = {}, user) => {
  const hoy = jornadaEntregas().fecha;
  const alcance = await alcanceLotes(user);
  const semana = semanaPorDefecto(hoy);
  const desde = toIsoDate(query.fecha_desde) || semana.fecha_inicio;
  const hasta = toIsoDate(query.fecha_hasta) || semana.fecha_fin;
  const filtros = ["entrega_lotes.fecha BETWEEN ? AND ?"];
  const params = [desde, hasta];

  if (alcance.filtro) {
    filtros.push(alcance.filtro);
    params.push(...alcance.params);
  }
  if (TIPOS_DOCUMENTO.includes(clean(query.tipo_documento))) {
    filtros.push("entrega_lotes.tipo_documento = ?");
    params.push(clean(query.tipo_documento));
  }

  const where = `WHERE ${filtros.join(" AND ")}`;
  const pool = getPool();

  const totalesSql = `SELECT
       COUNT(*) AS lotes,
       COALESCE(SUM(total_asignadas), 0) AS asignadas,
       COALESCE(SUM(total_sobrantes), 0) AS sobrantes,
       COALESCE(SUM(CASE WHEN estado <> 'ABIERTO' THEN total_asignadas - total_sobrantes ELSE 0 END), 0) AS entregadas,
       COALESCE(SUM(estado = 'ABIERTO'), 0) AS lotes_abiertos
     FROM entrega_lotes ${where}`;

  const detalleSql = `SELECT
       COALESCE(SUM(documento.estado = 'PENDIENTE'), 0) AS pendientes,
       COALESCE(SUM(documento.estado = 'REENTREGADA'), 0) AS reentregadas,
       COALESCE(SUM(documento.estado = 'NO_LOCALIZADA'), 0) AS no_localizadas,
       COALESCE(SUM(documento.estado = 'VENCIDA'), 0) AS vencidas,
       COALESCE(SUM(documento.estado = 'PENDIENTE' AND DATEDIFF(?, entrega_lotes.fecha) > 3), 0) AS pendientes_3,
       COALESCE(SUM(documento.estado = 'PENDIENTE' AND DATEDIFF(?, entrega_lotes.fecha) > 7), 0) AS pendientes_7
     FROM entrega_no_entregadas AS documento
     INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
     ${where}`;

  const [[totales]] = await pool.query(totalesSql, params);
  const [[detalle]] = await pool.query(detalleSql, [hoy, hoy, ...params]);

  // Barrios ordenados por sobrante: se cruzan dos consultas porque las asignadas
  // viven en el lote y los sobrantes en el detalle. Contar documentos activos (en
  // vez de leer total_sobrantes) tambien cubre los lotes todavia abiertos, donde
  // esa columna aun no se escribio.
  const [porBarrioLotes] = await pool.query(
    `SELECT entrega_lotes.barrio_codigo, entrega_lotes.barrio_nombre,
            COUNT(*) AS lotes,
            COALESCE(SUM(estado = 'ABIERTO'), 0) AS lotes_abiertos,
            COALESCE(SUM(total_asignadas), 0) AS asignadas,
            COALESCE(SUM(CASE WHEN estado <> 'ABIERTO' THEN total_asignadas - total_sobrantes ELSE 0 END), 0) AS entregadas
     FROM entrega_lotes ${where}
     GROUP BY entrega_lotes.barrio_codigo, entrega_lotes.barrio_nombre`,
    params
  );

  const [porBarrioDocs] = await pool.query(
    `SELECT entrega_lotes.barrio_codigo, entrega_lotes.barrio_nombre,
            COUNT(*) AS sobrantes,
            COALESCE(SUM(documento.estado = 'PENDIENTE'), 0) AS pendientes,
            COALESCE(SUM(documento.estado = 'REENTREGADA'), 0) AS reentregadas
     FROM entrega_no_entregadas AS documento
     INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
     ${where} AND documento.estado IN (?)
     GROUP BY entrega_lotes.barrio_codigo, entrega_lotes.barrio_nombre`,
    [...params, ESTADOS_NO_ENTREGADA_ACTIVOS]
  );

  const [porDia] = await pool.query(
    `SELECT entrega_lotes.fecha,
            COALESCE(SUM(total_asignadas), 0) AS asignadas,
            COALESCE(SUM(CASE WHEN estado <> 'ABIERTO' THEN total_asignadas - total_sobrantes ELSE 0 END), 0) AS entregadas,
            COALESCE(SUM(total_sobrantes), 0) AS no_entregadas
     FROM entrega_lotes ${where}
     GROUP BY entrega_lotes.fecha
     ORDER BY entrega_lotes.fecha ASC`,
    params
  );

  // Periodo previo de igual longitud, inmediatamente anterior al seleccionado,
  // para poder mostrar una tendencia (▲/▼) junto a cada indicador.
  const duracionDias = diffInDays(desde, hasta) + 1;
  const desdeAnterior = addDays(desde, -duracionDias);
  const hastaAnterior = addDays(desde, -1);
  const paramsAnterior = [desdeAnterior, hastaAnterior, ...params.slice(2)];
  const [[totalesAnterior]] = await pool.query(totalesSql, paramsAnterior);
  const [[detalleAnterior]] = await pool.query(detalleSql, [hoy, hoy, ...paramsAnterior]);

  const asignadas = toEntero(totales.asignadas);
  const entregadas = toEntero(totales.entregadas);
  const asignadasAnterior = toEntero(totalesAnterior.asignadas);
  const entregadasAnterior = toEntero(totalesAnterior.entregadas);

  const porDiaMapa = new Map(porDia.map((row) => [toIsoDate(row.fecha), row]));

  const barrios = new Map();
  const claveBarrio = (row) => String(row.barrio_codigo || row.barrio_nombre || "");
  porBarrioLotes.forEach((row) => barrios.set(claveBarrio(row), {
    barrio_codigo: row.barrio_codigo || "",
    barrio_nombre: row.barrio_nombre || "Sin barrio",
    lotes: toEntero(row.lotes),
    lotes_abiertos: toEntero(row.lotes_abiertos),
    asignadas: toEntero(row.asignadas),
    entregadas: toEntero(row.entregadas),
    sobrantes: 0,
    pendientes: 0,
    reentregadas: 0
  }));
  porBarrioDocs.forEach((row) => {
    const fila = barrios.get(claveBarrio(row));
    if (!fila) return;
    fila.sobrantes = toEntero(row.sobrantes);
    fila.pendientes = toEntero(row.pendientes);
    fila.reentregadas = toEntero(row.reentregadas);
  });

  return {
    periodo: { fecha_inicio: desde, fecha_fin: hasta },
    periodo_anterior: { fecha_inicio: desdeAnterior, fecha_fin: hastaAnterior },
    lotes: toEntero(totales.lotes),
    lotes_abiertos: toEntero(totales.lotes_abiertos),
    asignadas,
    entregadas,
    sobrantes: toEntero(totales.sobrantes),
    pendientes: toEntero(detalle.pendientes),
    reentregadas: toEntero(detalle.reentregadas),
    no_localizadas: toEntero(detalle.no_localizadas),
    vencidas: toEntero(detalle.vencidas),
    pendientes_mas_3_dias: toEntero(detalle.pendientes_3),
    pendientes_mas_7_dias: toEntero(detalle.pendientes_7),
    efectividad: calcularEfectividad(entregadas, asignadas),
    comparativo: {
      asignadas: asignadasAnterior,
      entregadas: entregadasAnterior,
      pendientes: toEntero(detalleAnterior.pendientes),
      reentregadas: toEntero(detalleAnterior.reentregadas),
      no_localizadas: toEntero(detalleAnterior.no_localizadas),
      vencidas: toEntero(detalleAnterior.vencidas),
      efectividad: calcularEfectividad(entregadasAnterior, asignadasAnterior)
    },
    // El conteo absoluto responde "donde hubo mas sobrante"; la tasa dice donde
    // esta el problema real, porque un barrio grande siempre suma mas.
    por_barrio: [...barrios.values()]
      .map((fila) => ({
        ...fila,
        efectividad: calcularEfectividad(fila.entregadas, fila.asignadas),
        tasa_sobrante: calcularEfectividad(fila.sobrantes, fila.asignadas)
      }))
      .sort((izquierda, derecha) => derecha.sobrantes - izquierda.sobrantes || derecha.asignadas - izquierda.asignadas)
      .slice(0, 8),
    por_dia: listarDiasDelRango(desde, hasta).map((fecha) => {
      const row = porDiaMapa.get(fecha);
      return {
        fecha,
        asignadas: row ? toEntero(row.asignadas) : 0,
        entregadas: row ? toEntero(row.entregadas) : 0,
        no_entregadas: row ? toEntero(row.no_entregadas) : 0
      };
    })
  };
};

export { ESTADOS_NO_ENTREGADA_ACTIVOS };
