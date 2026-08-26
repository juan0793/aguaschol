// Servicio operativo del modulo Control de Entregas.
// Responsabilidades: personal de campo, lotes diarios, cierre, documentos no
// entregados y seguimiento. Toda la aritmetica vive en entregasRules.js.

import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { listBarrioCodes } from "./barrioCodeService.js";
import {
  ESTADOS_LOTE,
  ESTADOS_NO_ENTREGADA,
  ESTADOS_NO_ENTREGADA_ACTIVOS,
  MOTIVOS_BASE,
  RESULTADOS_INTENTO,
  TIPOS_DOCUMENTO,
  TIPOS_PERSONAL,
  assertPuedeAgregarNoEntregadas,
  calcularEfectividad,
  calcularEntregadas,
  contarNoEntregadasActivas,
  detectarDuplicadosEnLote,
  fail,
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

const audit = async ({ user, action, entityId, summary, details }) => {
  try {
    await createAuditLog({
      actorUserId: user?.id ?? null,
      actorName: user?.full_name || user?.username || "",
      action,
      entityType: "entrega",
      entityId,
      summary,
      details
    });
  } catch {
    // La auditoria nunca debe tumbar la operacion principal.
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
  const [motivos, personalPropio, barrios] = await Promise.all([
    listMotivos(),
    getPersonalDelUsuario(user),
    listBarrioCodes().catch(() => [])
  ]);

  return {
    tipos_documento: TIPOS_DOCUMENTO,
    estados_lote: ESTADOS_LOTE,
    estados_no_entregada: ESTADOS_NO_ENTREGADA,
    resultados_intento: RESULTADOS_INTENTO,
    tipos_personal: TIPOS_PERSONAL,
    motivos,
    barrios: barrios.map((item) => ({ codigo: item.codigo, barrio: item.barrio })),
    semana_actual: semanaPorDefecto(),
    personal_vinculado: personalPropio,
    permissions: {
      can_manage_personal: isAdmin(user),
      can_create_lote: isGestor(user),
      can_edit_lote: Boolean(personalPropio) || isGestor(user),
      can_close_own_lote: Boolean(personalPropio) || isGestor(user),
      can_force_close: isAdmin(user),
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
    `SELECT COUNT(*) AS total
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

const cargarLote = async (id) => {
  const [rows] = await getPool().query(
    `SELECT entrega_lotes.*, personal_campo.nombre_completo AS responsable_nombre, personal_campo.tipo_personal,
            personal_campo.user_id AS responsable_user_id
     FROM entrega_lotes
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     WHERE entrega_lotes.id = ? LIMIT 1`,
    [toEntero(id)]
  );
  if (!rows.length) throw fail("El lote indicado no existe.", 404);
  return rows[0];
};

const assertPuedeVerLote = (lote, user) => {
  if (isGestor(user)) return;
  if (Number(lote.responsable_user_id) !== Number(user?.id)) {
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

  const fecha = toIsoDate(payload.fecha) || new Date().toISOString().slice(0, 10);
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

  return getLoteDetail(result.insertId, user);
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
  if (payload.estado !== undefined && isAdmin(user)) {
    const estado = clean(payload.estado).toUpperCase();
    if (!ESTADOS_LOTE.includes(estado)) throw fail("El estado del lote no es válido.");
    cambios.estado = estado;
  }

  const columnas = Object.keys(cambios);
  if (!columnas.length) return getLoteDetail(lote.id, user);

  await getPool().query(
    `UPDATE entrega_lotes SET ${columnas.map((columna) => `${columna} = ?`).join(", ")} WHERE id = ?`,
    [...columnas.map((columna) => cambios[columna]), lote.id]
  );

  await audit({
    user,
    action: "LOTE_EDITADO",
    entityId: lote.id,
    summary: `Lote #${lote.id} actualizado`,
    details: { lote_id: lote.id, cambios }
  });

  return getLoteDetail(lote.id, user);
};

// Cierre diario: guarda sobrantes + observacion y valida que el detalle cuadre.
// Todo el chequeo de consistencia y la escritura ocurren dentro de una misma
// transaccion con bloqueo de filas, para que un alta/baja de no-entregadas
// concurrente no deje el lote cerrado con un total_sobrantes desactualizado.
export const cerrarLote = async (id, payload = {}, user) => {
  const lote = await cargarLote(id);
  assertPuedeVerLote(lote, user);
  if (lote.estado === "REVISADO") throw fail("El lote ya fue revisado y no admite cambios.");

  const sobrantes = validarSobrantes(payload.total_sobrantes, lote.total_asignadas);
  const observacion = clean(payload.observacion_responsable);
  const forzar = Boolean(payload.forzar_cierre) && isAdmin(user);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [loteRows] = await connection.query("SELECT estado FROM entrega_lotes WHERE id = ? LIMIT 1 FOR UPDATE", [lote.id]);
    if (!loteRows.length) throw fail("El lote indicado no existe.", 404);
    if (loteRows[0].estado === "REVISADO") throw fail("El lote ya fue revisado y no admite cambios.");

    const detalle = await listNoEntregadasDeLote(lote.id, connection, { forUpdate: true });
    validarConsistenciaDetalle({
      total_sobrantes: sobrantes,
      detalle,
      permitirDiferencia: forzar
    });

    await connection.query(
      `UPDATE entrega_lotes
       SET total_sobrantes = ?, observacion_responsable = ?, estado = 'CERRADO', closed_by = ?, closed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sobrantes, observacion || null, user?.id ?? null, lote.id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await audit({
    user,
    action: "LOTE_CERRADO",
    entityId: lote.id,
    summary: `Lote #${lote.id} cerrado con ${sobrantes} sobrantes de ${lote.total_asignadas}`,
    details: {
      lote_id: lote.id,
      total_asignadas: toEntero(lote.total_asignadas),
      total_sobrantes: sobrantes,
      total_entregadas: calcularEntregadas({ total_asignadas: lote.total_asignadas, total_sobrantes: sobrantes }),
      forzado: forzar
    }
  });

  return getLoteDetail(lote.id, user);
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
  const detalle = await listNoEntregadasDeLote(loteId, executor);
  const total = contarNoEntregadasActivas(detalle);
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
    const [loteRows] = await connection.query("SELECT estado FROM entrega_lotes WHERE id = ? LIMIT 1 FOR UPDATE", [lote.id]);
    if (!loteRows.length) throw fail("El lote indicado no existe.", 404);
    estadoActual = loteRows[0].estado;
    assertPuedeAgregarNoEntregadas({ estadoLote: estadoActual, esCorreccionAdmin });

    const existentes = await listNoEntregadasDeLote(lote.id, connection, { forUpdate: true });
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
  const alcance = await alcanceLotes(user);
  const filtros = alcance.filtro ? [alcance.filtro] : [];
  const params = [...alcance.params];

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
    filtros.push("DATEDIFF(CURDATE(), entrega_lotes.fecha) >= ?");
    params.push(toEntero(query.dias_minimos));
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
       DATEDIFF(CURDATE(), entrega_lotes.fecha) AS dias_pendiente,
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
    [...params, limit, offset]
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
      ? toIsoDate(payload.fecha_entrega_final) || new Date().toISOString().slice(0, 10)
      : null;
  }

  const columnas = Object.keys(cambios);
  if (!columnas.length) return getNoEntregadaDetail(documento.id, user);

  // Un cambio de estado puede sacar (o meter) el documento del conteo de
  // "activas" (p. ej. CANCELADA). Si el lote ya no esta ABIERTO, total_sobrantes
  // ya quedo fijo al cerrar, asi que se recalcula en la misma transaccion.
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE entrega_no_entregadas SET ${columnas.map((columna) => `${columna} = ?`).join(", ")} WHERE id = ?`,
      [...columnas.map((columna) => cambios[columna]), documento.id]
    );
    if (columnas.includes("estado") && documento.lote_estado !== "ABIERTO") {
      await recalcularTotalSobrantes(connection, documento.lote_id);
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
    await connection.query("DELETE FROM entrega_no_entregadas WHERE id = ?", [documento.id]);
    if (documento.lote_estado !== "ABIERTO") {
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
  const fecha = toIsoDate(payload.fecha) || new Date().toISOString().slice(0, 10);
  const responsableId = toEntero(payload.responsable_id) || documento.responsable_id || null;
  const observacion = clean(payload.observacion) || null;
  if (resultado === "OTRO" && !observacion) throw fail('El resultado "Otro" exige una observación.');

  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO entrega_intentos (no_entregada_id, fecha, responsable_id, resultado, observacion, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [documento.id, fecha, responsableId, resultado, observacion, user?.id ?? null]
  );

  // El intento nunca sobrescribe al anterior: solo actualiza el estado vigente.
  const nuevoEstado = resultado === "ENTREGADO"
    ? "REENTREGADA"
    : resultado === "NO_LOCALIZADO"
      ? "NO_LOCALIZADA"
      : documento.estado === "PENDIENTE" ? "PENDIENTE" : documento.estado;

  await pool.query(
    `UPDATE entrega_no_entregadas
     SET estado = ?, fecha_ultimo_intento = ?, fecha_entrega_final = ?
     WHERE id = ?`,
    [nuevoEstado, fecha, resultado === "ENTREGADO" ? fecha : documento.fecha_entrega_final, documento.id]
  );

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
  const alcance = await alcanceLotes(user);
  const semana = semanaPorDefecto();
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

  const [[totales]] = await pool.query(
    `SELECT
       COUNT(*) AS lotes,
       COALESCE(SUM(total_asignadas), 0) AS asignadas,
       COALESCE(SUM(total_sobrantes), 0) AS sobrantes,
       COALESCE(SUM(estado = 'ABIERTO'), 0) AS lotes_abiertos
     FROM entrega_lotes ${where}`,
    params
  );

  const [[detalle]] = await pool.query(
    `SELECT
       COALESCE(SUM(documento.estado = 'PENDIENTE'), 0) AS pendientes,
       COALESCE(SUM(documento.estado = 'REENTREGADA'), 0) AS reentregadas,
       COALESCE(SUM(documento.estado = 'NO_LOCALIZADA'), 0) AS no_localizadas,
       COALESCE(SUM(documento.estado = 'PENDIENTE' AND DATEDIFF(CURDATE(), entrega_lotes.fecha) > 3), 0) AS pendientes_3,
       COALESCE(SUM(documento.estado = 'PENDIENTE' AND DATEDIFF(CURDATE(), entrega_lotes.fecha) > 7), 0) AS pendientes_7
     FROM entrega_no_entregadas AS documento
     INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
     ${where}`,
    params
  );

  const [porDia] = await pool.query(
    `SELECT entrega_lotes.fecha,
            COALESCE(SUM(total_asignadas), 0) AS asignadas,
            COALESCE(SUM(total_asignadas - total_sobrantes), 0) AS entregadas,
            COALESCE(SUM(total_sobrantes), 0) AS no_entregadas
     FROM entrega_lotes ${where}
     GROUP BY entrega_lotes.fecha
     ORDER BY entrega_lotes.fecha ASC`,
    params
  );

  const asignadas = toEntero(totales.asignadas);
  const entregadas = Math.max(asignadas - toEntero(totales.sobrantes), 0);

  return {
    periodo: { fecha_inicio: desde, fecha_fin: hasta },
    lotes: toEntero(totales.lotes),
    lotes_abiertos: toEntero(totales.lotes_abiertos),
    asignadas,
    entregadas,
    sobrantes: toEntero(totales.sobrantes),
    pendientes: toEntero(detalle.pendientes),
    reentregadas: toEntero(detalle.reentregadas),
    no_localizadas: toEntero(detalle.no_localizadas),
    pendientes_mas_3_dias: toEntero(detalle.pendientes_3),
    pendientes_mas_7_dias: toEntero(detalle.pendientes_7),
    efectividad: calcularEfectividad(entregadas, asignadas),
    por_dia: porDia.map((row) => ({
      fecha: toIsoDate(row.fecha),
      asignadas: toEntero(row.asignadas),
      entregadas: toEntero(row.entregadas),
      no_entregadas: toEntero(row.no_entregadas)
    }))
  };
};

export { ESTADOS_NO_ENTREGADA_ACTIVOS };
