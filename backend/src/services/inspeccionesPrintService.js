import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { getInspeccionDetail, listGps } from "./inspeccionesService.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const TIPOS_DOCUMENTO = ["ORDEN", "REPORTE"];
const ACCIONES = ["PDF_GENERADO", "IMPRESO", "REIMPRESO"];

let memoryAutoId = 1;
const memoryEventos = [];

const insertEvento = async (inspeccionId, tipoDocumento, accion, userId) => {
  if (env.useMemoryDb) {
    const record = { id: memoryAutoId++, inspeccion_id: Number(inspeccionId), tipo_documento: tipoDocumento, accion, usuario_id: userId || null, created_at: new Date().toISOString() };
    memoryEventos.push(record);
    return record;
  }
  const [result] = await getPool().query(
    "INSERT INTO inspeccion_impresiones (inspeccion_id, tipo_documento, accion, usuario_id) VALUES (?, ?, ?, ?)",
    [inspeccionId, tipoDocumento, accion, userId || null]
  );
  return { id: result.insertId, inspeccion_id: Number(inspeccionId), tipo_documento: tipoDocumento, accion, usuario_id: userId || null, created_at: new Date().toISOString() };
};

const eventosDe = async (inspeccionId) => {
  if (env.useMemoryDb) {
    return memoryEventos.filter((item) => item.inspeccion_id === Number(inspeccionId));
  }
  const [rows] = await getPool().query(
    `SELECT inspeccion_impresiones.*, COALESCE(app_users.full_name, app_users.username, '') AS usuario_nombre
     FROM inspeccion_impresiones
     LEFT JOIN app_users ON app_users.id = inspeccion_impresiones.usuario_id
     WHERE inspeccion_id = ? ORDER BY created_at DESC`,
    [inspeccionId]
  );
  return rows;
};

const statusFor = (eventos, tipoDocumento) => {
  const rows = eventos.filter((item) => item.tipo_documento === tipoDocumento && ["IMPRESO", "REIMPRESO"].includes(item.accion));
  const sorted = [...rows].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  return {
    impreso: sorted.length > 0,
    primera_impresion: sorted[0]?.created_at || null,
    impreso_por: sorted[0]?.usuario_nombre || null,
    ultima_impresion: sorted[sorted.length - 1]?.created_at || null,
    total_impresiones: sorted.length
  };
};

export const getPrintStatusForOne = async (inspeccionId) => {
  const eventos = await eventosDe(inspeccionId);
  return { ORDEN: statusFor(eventos, "ORDEN"), REPORTE: statusFor(eventos, "REPORTE") };
};

// Enriquecer en lote un listado de inspecciones (para la tabla "Ver inspecciones") sin cargar
// todo el historial de impresiones al frontend.
export const attachPrintStatus = async (items = []) => {
  if (!items.length) return items;
  if (env.useMemoryDb) {
    return Promise.all(items.map(async (item) => ({ ...item, print_status: await getPrintStatusForOne(item.id) })));
  }
  const ids = items.map((item) => item.id);
  const [rows] = await getPool().query(
    `SELECT inspeccion_id, tipo_documento, MIN(created_at) AS primera_impresion, MAX(created_at) AS ultima_impresion, COUNT(*) AS total
     FROM inspeccion_impresiones
     WHERE inspeccion_id IN (?) AND accion IN ('IMPRESO', 'REIMPRESO')
     GROUP BY inspeccion_id, tipo_documento`,
    [ids]
  );
  return items.map((item) => {
    const status = { ORDEN: { impreso: false, primera_impresion: null, total_impresiones: 0 }, REPORTE: { impreso: false, primera_impresion: null, total_impresiones: 0 } };
    rows.filter((row) => Number(row.inspeccion_id) === Number(item.id)).forEach((row) => {
      status[row.tipo_documento] = { impreso: true, primera_impresion: row.primera_impresion, ultima_impresion: row.ultima_impresion, total_impresiones: Number(row.total) };
    });
    return { ...item, print_status: status };
  });
};

export const getPrintData = async (id, tipo, user) => {
  const tipoDocumento = String(tipo ?? "").toUpperCase();
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) throw fail("Tipo de documento no válido. Usa 'orden' o 'reporte'.");
  const inspeccion = await getInspeccionDetail(id, user);
  const gps = tipoDocumento === "REPORTE" ? await listGps(id, user) : [];
  const printStatus = await getPrintStatusForOne(id);
  return { tipo_documento: tipoDocumento, inspeccion, gps, print_status: printStatus };
};

export const registerPrintEvent = async (id, payload = {}, user) => {
  const inspeccion = await getInspeccionDetail(id, user);
  const tipoDocumento = String(payload.tipo_documento ?? "").toUpperCase();
  const accion = String(payload.accion ?? "").toUpperCase();
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) throw fail("Tipo de documento no válido.");
  if (!ACCIONES.includes(accion)) throw fail("Acción de impresión no válida.");

  let effectiveAccion = accion;
  if (accion === "IMPRESO") {
    const status = await getPrintStatusForOne(id);
    if (status[tipoDocumento].impreso) effectiveAccion = "REIMPRESO";
  }

  const record = await insertEvento(id, tipoDocumento, effectiveAccion, user.id);
  if (!env.useMemoryDb) {
    try {
      await createAuditLog({
        actorUserId: user.id,
        action: effectiveAccion === "PDF_GENERADO" ? "inspeccion.pdf_generated" : effectiveAccion === "REIMPRESO" ? "inspeccion.reprinted" : "inspeccion.printed",
        entityType: "inspeccion",
        entityId: id,
        summary: `${tipoDocumento === "ORDEN" ? "Orden" : "Reporte"} de inspección ${inspeccion.numero_inspeccion}: ${effectiveAccion.toLowerCase()}`
      });
    } catch {
      // La operacion de impresion no debe fallar si la auditoria no esta disponible.
    }
  }
  return record;
};

export const listPrintHistory = async (id, user) => {
  await getInspeccionDetail(id, user);
  return eventosDe(id);
};
