// Informe semanal de Control de Entregas.
// La vista previa se calcula con datos vivos; el informe oficial guarda un
// snapshot inmutable (resumen_json) que es lo unico que se usa despues para
// pantalla, impresion y PDF.

import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { listMotivos } from "./entregasService.js";
import {
  ESTADOS_REPORTE,
  TIPOS_DOCUMENTO,
  construirCorreccion,
  construirSnapshotSemanal,
  describirSemana,
  diffInDays,
  etiquetarVersion,
  fail,
  semanaPorDefecto,
  toEntero,
  toIsoDate
} from "./entregasRules.js";

const clean = (value) => String(value ?? "").trim();
const isGestor = (user) => ["admin", "operator"].includes(user?.role);
const isAdmin = (user) => user?.role === "admin";

const audit = async ({ user, action, entityId, summary, details }) => {
  try {
    await createAuditLog({
      actorUserId: user?.id ?? null,
      actorName: user?.full_name || user?.username || "",
      action,
      entityType: "reporte_entregas",
      entityId,
      summary,
      details
    });
  } catch {
    // La auditoria no debe interrumpir la emision del informe.
  }
};

export const resolverRango = (query = {}) => {
  const porDefecto = semanaPorDefecto();
  const inicio = toIsoDate(query.fecha_inicio) || porDefecto.fecha_inicio;
  const fin = toIsoDate(query.fecha_fin) || porDefecto.fecha_fin;
  const dias = diffInDays(inicio, fin);
  if (dias < 0) throw fail("La fecha inicial no puede ser posterior a la final.");
  if (dias > 31) throw fail("El rango del informe no puede superar 31 días.");
  return { fecha_inicio: inicio, fecha_fin: fin };
};

// Dos consultas acotadas a la semana; el resto se agrega en memoria con reglas puras.
const cargarDatosDelPeriodo = async ({ fecha_inicio, fecha_fin, tipo_documento = "" }) => {
  const pool = getPool();
  const filtroTipo = TIPOS_DOCUMENTO.includes(tipo_documento) ? "AND entrega_lotes.tipo_documento = ?" : "";
  const paramsTipo = filtroTipo ? [tipo_documento] : [];

  const [lotes] = await pool.query(
    `SELECT
       entrega_lotes.id,
       entrega_lotes.fecha,
       entrega_lotes.tipo_documento,
       entrega_lotes.total_asignadas,
       entrega_lotes.total_sobrantes,
       entrega_lotes.estado,
       entrega_lotes.observacion_responsable,
       entrega_lotes.barrio_codigo,
       entrega_lotes.barrio_nombre,
       entrega_lotes.responsable_id,
       personal_campo.nombre_completo AS responsable_nombre,
       personal_campo.tipo_personal
     FROM entrega_lotes
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     WHERE entrega_lotes.fecha BETWEEN ? AND ? ${filtroTipo}
     ORDER BY entrega_lotes.fecha ASC, entrega_lotes.id ASC`,
    [fecha_inicio, fecha_fin, ...paramsTipo]
  );

  const [noEntregadas] = await pool.query(
    `SELECT
       documento.id,
       documento.lote_id,
       documento.numero_abonado,
       documento.clave_catastral,
       documento.motivo,
       documento.estado,
       documento.observacion,
       entrega_lotes.fecha AS fecha_lote,
       entrega_lotes.tipo_documento,
       entrega_lotes.barrio_codigo,
       entrega_lotes.barrio_nombre,
       entrega_lotes.responsable_id,
       personal_campo.nombre_completo AS responsable_nombre,
       COALESCE(intentos.total, 0) AS intentos
     FROM entrega_no_entregadas AS documento
     INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
     LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
     LEFT JOIN (
       SELECT no_entregada_id, COUNT(*) AS total FROM entrega_intentos GROUP BY no_entregada_id
     ) AS intentos ON intentos.no_entregada_id = documento.id
     WHERE entrega_lotes.fecha BETWEEN ? AND ? ${filtroTipo}
     ORDER BY documento.id ASC`,
    [fecha_inicio, fecha_fin, ...paramsTipo]
  );

  return {
    lotes: lotes.map((row) => ({ ...row, fecha: toIsoDate(row.fecha) })),
    noEntregadas: noEntregadas.map((row) => ({ ...row, fecha_lote: toIsoDate(row.fecha_lote) }))
  };
};

const construirDesdeDatos = async (opciones, user) => {
  const { lotes, noEntregadas } = await cargarDatosDelPeriodo(opciones);
  const catalogoMotivos = await listMotivos({ soloActivos: false });

  return construirSnapshotSemanal({
    ...opciones,
    lotes,
    noEntregadas,
    catalogoMotivos,
    generado_por: user?.id ?? null,
    generado_por_nombre: user?.full_name || user?.username || "",
    generado_en: new Date().toISOString()
  });
};

/* -------------------------------------------------------------------------- */
/* Vista previa (datos vivos, sin persistir)                                   */
/* -------------------------------------------------------------------------- */

export const previewReporteSemanal = async (query = {}, user) => {
  if (!isGestor(user)) throw fail("No tienes permiso para generar informes semanales.", 403);
  const rango = resolverRango(query);
  const tipo = TIPOS_DOCUMENTO.includes(clean(query.tipo_documento)) ? clean(query.tipo_documento) : "";

  const snapshot = await construirDesdeDatos(
    {
      ...rango,
      tipo_documento: tipo,
      incluir_anexo_pendientes: clean(query.incluir_anexo) === "1"
    },
    user
  );

  const existentes = await listReportesSemanales({ ...rango, limit: 20 });
  return {
    ...snapshot,
    es_preview: true,
    reportes_existentes: existentes.items.filter(
      (item) => item.fecha_inicio === rango.fecha_inicio && item.fecha_fin === rango.fecha_fin
    )
  };
};

/* -------------------------------------------------------------------------- */
/* Generacion oficial                                                          */
/* -------------------------------------------------------------------------- */

const insertarReporte = async ({ rango, tipo, snapshot, user, version = 1, origenId = null, estado = "GENERADO", motivoCorreccion = "" }) => {
  const totales = snapshot.totales;
  const [result] = await getPool().query(
    `INSERT INTO reportes_semanales_entregas
       (fecha_inicio, fecha_fin, generado_por, generado_por_nombre, tipo_documento,
        total_asignadas, total_entregadas, total_no_entregadas, total_reentregadas, total_pendientes,
        efectividad, resumen_json, estado, version, reporte_origen_id, motivo_correccion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rango.fecha_inicio,
      rango.fecha_fin,
      user?.id ?? null,
      user?.full_name || user?.username || "",
      tipo,
      totales.asignadas,
      totales.entregadas,
      totales.no_entregadas,
      totales.reentregadas,
      totales.pendientes,
      totales.efectividad,
      JSON.stringify(snapshot),
      estado,
      version,
      origenId,
      motivoCorreccion
    ]
  );
  return result.insertId;
};

export const generarReporteSemanal = async (payload = {}, user) => {
  if (!isGestor(user)) throw fail("No tienes permiso para generar informes semanales.", 403);
  const rango = resolverRango(payload);
  const tipo = TIPOS_DOCUMENTO.includes(clean(payload.tipo_documento)) ? clean(payload.tipo_documento) : "";

  // Proteccion contra rango duplicado accidental.
  const [existentes] = await getPool().query(
    `SELECT id, version FROM reportes_semanales_entregas
     WHERE fecha_inicio = ? AND fecha_fin = ? AND tipo_documento = ? AND estado <> 'ANULADO'
     ORDER BY version DESC LIMIT 1`,
    [rango.fecha_inicio, rango.fecha_fin, tipo]
  );
  if (existentes.length && !payload.confirmar_duplicado) {
    throw fail(
      `Ya existe un informe emitido para ${describirSemana(rango.fecha_inicio, rango.fecha_fin).toLowerCase()}. Genera una versión corregida en lugar de duplicarlo.`,
      409
    );
  }

  // Se recalcula dentro de la operacion de generacion, no se reutiliza el preview.
  const snapshot = await construirDesdeDatos(
    { ...rango, tipo_documento: tipo, incluir_anexo_pendientes: Boolean(payload.incluir_anexo_pendientes) },
    user
  );

  const id = await insertarReporte({ rango, tipo, snapshot, user });
  await audit({
    user,
    action: "REPORTE_GENERADO",
    entityId: id,
    summary: `Informe semanal generado (${rango.fecha_inicio} a ${rango.fecha_fin})`,
    details: { reporte_id: id, ...rango, tipo_documento: tipo, totales: snapshot.totales }
  });

  return getReporteSemanal(id, user);
};

export const generarCorreccion = async (id, payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo un administrador puede emitir versiones corregidas.", 403);
  const original = await cargarReporte(id);
  const correccion = construirCorreccion(original);
  const rango = { fecha_inicio: toIsoDate(original.fecha_inicio), fecha_fin: toIsoDate(original.fecha_fin) };

  const snapshot = await construirDesdeDatos(
    {
      ...rango,
      tipo_documento: original.tipo_documento,
      incluir_anexo_pendientes: Boolean(payload.incluir_anexo_pendientes)
    },
    user
  );

  const nuevoId = await insertarReporte({
    rango,
    tipo: original.tipo_documento,
    snapshot,
    user,
    version: correccion.version,
    origenId: correccion.reporte_origen_id,
    estado: "CORREGIDO",
    motivoCorreccion: clean(payload.motivo).slice(0, 255)
  });

  await audit({
    user,
    action: "REPORTE_CORREGIDO",
    entityId: nuevoId,
    summary: `Versión ${correccion.version} del informe ${original.id} emitida`,
    details: { reporte_id: nuevoId, reporte_origen_id: correccion.reporte_origen_id, motivo: clean(payload.motivo) }
  });

  return getReporteSemanal(nuevoId, user);
};

export const anularReporte = async (id, payload = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo un administrador puede anular un informe.", 403);
  const reporte = await cargarReporte(id);
  await getPool().query("UPDATE reportes_semanales_entregas SET estado = 'ANULADO', motivo_correccion = ? WHERE id = ?", [
    clean(payload.motivo).slice(0, 255),
    reporte.id
  ]);
  await audit({
    user,
    action: "REPORTE_ANULADO",
    entityId: reporte.id,
    summary: `Informe semanal ${reporte.id} anulado`,
    details: { reporte_id: reporte.id, motivo: clean(payload.motivo) }
  });
  return getReporteSemanal(reporte.id, user);
};

/* -------------------------------------------------------------------------- */
/* Consulta del historico                                                      */
/* -------------------------------------------------------------------------- */

const cargarReporte = async (id) => {
  const [rows] = await getPool().query("SELECT * FROM reportes_semanales_entregas WHERE id = ? LIMIT 1", [toEntero(id)]);
  if (!rows.length) throw fail("El informe indicado no existe.", 404);
  return rows[0];
};

const mapReporteRow = (row, { conSnapshot = false } = {}) => ({
  id: row.id,
  fecha_inicio: toIsoDate(row.fecha_inicio),
  fecha_fin: toIsoDate(row.fecha_fin),
  periodo_etiqueta: describirSemana(row.fecha_inicio, row.fecha_fin),
  fecha_generacion: row.fecha_generacion,
  generado_por: row.generado_por,
  generado_por_nombre: row.generado_por_nombre || "",
  tipo_documento: row.tipo_documento || "",
  total_asignadas: toEntero(row.total_asignadas),
  total_entregadas: toEntero(row.total_entregadas),
  total_no_entregadas: toEntero(row.total_no_entregadas),
  total_reentregadas: toEntero(row.total_reentregadas),
  total_pendientes: toEntero(row.total_pendientes),
  efectividad: Number(row.efectividad) || 0,
  estado: row.estado,
  version: toEntero(row.version),
  version_etiqueta: etiquetarVersion(row),
  reporte_origen_id: row.reporte_origen_id,
  motivo_correccion: row.motivo_correccion || "",
  ...(conSnapshot ? { snapshot: parseSnapshot(row.resumen_json) } : {})
});

const parseSnapshot = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const listReportesSemanales = async (query = {}) => {
  const filtros = [];
  const params = [];

  if (toIsoDate(query.fecha_inicio)) {
    filtros.push("fecha_fin >= ?");
    params.push(toIsoDate(query.fecha_inicio));
  }
  if (toIsoDate(query.fecha_fin)) {
    filtros.push("fecha_inicio <= ?");
    params.push(toIsoDate(query.fecha_fin));
  }
  if (ESTADOS_REPORTE.includes(clean(query.estado))) {
    filtros.push("estado = ?");
    params.push(clean(query.estado));
  }
  if (TIPOS_DOCUMENTO.includes(clean(query.tipo_documento))) {
    filtros.push("tipo_documento = ?");
    params.push(clean(query.tipo_documento));
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const page = Math.max(toEntero(query.page) || 1, 1);
  const limit = Math.min(Math.max(toEntero(query.limit) || 12, 1), 100);
  const offset = (page - 1) * limit;
  const pool = getPool();

  const [[conteo]] = await pool.query(
    `SELECT COUNT(*) AS total FROM reportes_semanales_entregas ${where}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT id, fecha_inicio, fecha_fin, fecha_generacion, generado_por, generado_por_nombre, tipo_documento,
            total_asignadas, total_entregadas, total_no_entregadas, total_reentregadas, total_pendientes,
            efectividad, estado, version, reporte_origen_id, motivo_correccion
     FROM reportes_semanales_entregas
     ${where}
     ORDER BY fecha_inicio DESC, version DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = toEntero(conteo.total);
  return {
    items: rows.map((row) => mapReporteRow(row)),
    total,
    page,
    limit,
    total_pages: Math.max(Math.ceil(total / limit), 1)
  };
};

// Siempre devuelve el snapshot guardado: un informe historico no se recalcula.
export const getReporteSemanal = async (id, user) => {
  if (!isGestor(user)) throw fail("No tienes permiso para consultar informes semanales.", 403);
  const row = await cargarReporte(id);
  const [versiones] = await getPool().query(
    `SELECT id, version, estado, fecha_generacion, motivo_correccion
     FROM reportes_semanales_entregas
     WHERE id = ? OR reporte_origen_id = ? OR id = ?
     ORDER BY version ASC`,
    [row.reporte_origen_id || row.id, row.reporte_origen_id || row.id, row.id]
  );

  return {
    ...mapReporteRow(row, { conSnapshot: true }),
    versiones: versiones.map((item) => ({
      ...item,
      version_etiqueta: etiquetarVersion(item)
    }))
  };
};
