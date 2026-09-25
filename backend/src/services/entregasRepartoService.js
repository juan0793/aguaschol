// Reparto de barrios de Control de Entregas: que persona de campo entrega cada
// barrio. Las claves por barrio salen del padron en memoria; la asignacion vive en
// entrega_reparto_barrios y cambia cuando la oficina reacomoda las zonas.

import fs from "node:fs";
import path from "node:path";
import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";
import { listBarrioCodes } from "./barrioCodeService.js";
import { getMasterRecords, getMasterVersion } from "./claveLookupService.js";
import { fail } from "./entregasRules.js";
import {
  MAX_ASIGNACIONES_POR_LOTE,
  agruparPadronPorBarrio,
  armarReparto,
  normalizarAsignacion
} from "./entregasRepartoRules.js";

const isGestor = (user) => ["admin", "operator"].includes(user?.role);
const assertGestor = (user) => {
  if (!isGestor(user)) throw fail("Solo administradores y operadores pueden ver o cambiar el reparto de barrios.", 403);
};

const mapaPath = path.resolve(env.dbRoot, "backend", "data", "reparto-mapa.json");
let mapaCache = null;

// Poligonos y puntos del SIG ya proyectados (ver backend/data/reparto-mapa.json).
// Es un archivo estatico: se lee una vez por proceso.
export const getRepartoMapa = () => {
  if (!mapaCache) mapaCache = JSON.parse(fs.readFileSync(mapaPath, "utf8"));
  return mapaCache;
};

// Agrupar 24 mil claves en cada consulta es barato pero innecesario: se recalcula
// solo cuando cambia la version del padron.
let padronCache = { version: null, grupos: [] };
const padronPorBarrio = () => {
  const version = getMasterVersion();
  if (padronCache.version !== version || !padronCache.grupos.length) {
    padronCache = { version, grupos: agruparPadronPorBarrio(getMasterRecords()) };
  }
  return padronCache.grupos;
};

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
    console.error(`Auditoria de reparto (${action}) fallida:`, error.message);
  }
};

export const getReparto = async (user) => {
  assertGestor(user);
  const [[asignaciones], catalogo] = await Promise.all([
    getPool().query(
      `SELECT barrio_codigo, responsable_id, orden_ruta, updated_at
       FROM entrega_reparto_barrios`
    ),
    listBarrioCodes().catch(() => [])
  ]);
  const barrios = armarReparto({ padron: padronPorBarrio(), catalogo, asignaciones });
  const actualizado = asignaciones.reduce((max, fila) => {
    const fecha = fila.updated_at ? new Date(fila.updated_at).toISOString() : "";
    return fecha > max ? fecha : max;
  }, "");
  return {
    barrios,
    total_claves: barrios.reduce((suma, fila) => suma + fila.claves, 0),
    actualizado_en: actualizado || null
  };
};

const assertResponsablesActivos = async (ids, executor) => {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return;
  const [filas] = await executor.query(
    `SELECT id, activo FROM personal_campo WHERE id IN (${unicos.map(() => "?").join(", ")})`,
    unicos
  );
  const activos = new Set(filas.filter((fila) => Number(fila.activo) === 1).map((fila) => Number(fila.id)));
  const faltante = unicos.find((id) => !activos.has(id));
  if (faltante) throw fail("Uno de los responsables no existe o está inactivo en Personal de campo.", 404);
};

const guardarAsignacion = (executor, asignacion, user) =>
  executor.query(
    `INSERT INTO entrega_reparto_barrios (barrio_codigo, responsable_id, orden_ruta, actualizado_por)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE responsable_id = VALUES(responsable_id), orden_ruta = VALUES(orden_ruta),
       actualizado_por = VALUES(actualizado_por)`,
    [asignacion.barrio_codigo, asignacion.responsable_id, asignacion.orden_ruta, user?.id ?? null]
  );

export const updateRepartoBarrio = async (codigo, payload = {}, user) => {
  assertGestor(user);
  const asignacion = normalizarAsignacion(payload, codigo);
  const pool = getPool();
  await assertResponsablesActivos([asignacion.responsable_id], pool);
  await guardarAsignacion(pool, asignacion, user);
  await audit({
    user,
    action: "entrega_reparto_barrio",
    entityId: asignacion.barrio_codigo,
    summary: asignacion.responsable_id
      ? `Barrio ${asignacion.barrio_codigo} asignado a la persona #${asignacion.responsable_id}.`
      : `Barrio ${asignacion.barrio_codigo} quedó sin responsable.`,
    details: asignacion
  });
  return asignacion;
};

// Aplica muchas asignaciones de una vez (cargar una plantilla o reacomodar zonas).
// Todo o nada: si un responsable no es valido no se guarda ninguna.
export const updateRepartoLote = async (payload = {}, user) => {
  assertGestor(user);
  const entrada = Array.isArray(payload.asignaciones) ? payload.asignaciones : [];
  if (!entrada.length) throw fail("No hay asignaciones para guardar.");
  if (entrada.length > MAX_ASIGNACIONES_POR_LOTE) throw fail(`Se pueden guardar hasta ${MAX_ASIGNACIONES_POR_LOTE} barrios por vez.`);
  const asignaciones = [...new Map(entrada.map((item) => {
    const asignacion = normalizarAsignacion(item);
    return [asignacion.barrio_codigo, asignacion];
  })).values()];

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await assertResponsablesActivos(asignaciones.map((item) => item.responsable_id), connection);
    for (const asignacion of asignaciones) await guardarAsignacion(connection, asignacion, user);
    await audit({
      user,
      action: "entrega_reparto_lote",
      entityId: "reparto",
      summary: `${asignaciones.length} barrios reasignados${payload.origen ? ` (${String(payload.origen).slice(0, 80)})` : ""}.`,
      details: { origen: payload.origen || "", total: asignaciones.length },
      executor: connection
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
  return { guardadas: asignaciones.length };
};
