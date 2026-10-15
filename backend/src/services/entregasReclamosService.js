// Reclamos de entrega: el abonado dice que su factura o nota de cobro no le llego.
// La oficina lo registra con la clave o el abonado y el sistema anota quien entrego
// ese barrio en el ciclo. Todo el equipo de campo ve todos los reclamos; el tecnico
// escribe que paso y la oficina lo cierra. Las reglas puras viven en
// entregasReclamosRules.js.

import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";
import { getMasterRecords, normalizeLookupKey } from "./claveLookupService.js";
import { jornadaEntregas } from "./entregasReminderService.js";
import { emitProfileMessage } from "./profileRealtimeService.js";
import { leerRepartoBarrios } from "./entregasRepartoService.js";
import { codigoBarrioDeClave } from "./entregasRepartoRules.js";
import { getCicloVigente } from "./entregasService.js";
import { fail, toEntero, toIsoDate } from "./entregasRules.js";
import {
  MAX_COINCIDENCIAS,
  MOTIVOS_RECLAMO,
  armarAvisosReclamo,
  buscarEnPadron,
  elegirResponsable,
  etiquetaMotivo,
  normalizarReclamo,
  normalizarRespuesta,
  resumirAbonado
} from "./entregasReclamosRules.js";
import { assertOperationalWrite } from "../utils/permissions.js";

const clean = (value) => String(value ?? "").trim();
const nombreDe = (user) => clean(user?.full_name || user?.username).slice(0, 180);
const POR_PAGINA = 30;

const puedeVer = (user) => ["admin", "operator", "validadora_campo", "gerente"].includes(user?.role);
const esOficina = (user) => user?.role === "admin" && !user?.preview;
const puedeResponder = (user) => ["admin", "operator", "validadora_campo"].includes(user?.role) && !user?.preview;

const assertVer = (user) => {
  if (!puedeVer(user)) throw fail("Tu perfil no consulta los reclamos de entrega.", 403);
};
const assertOficina = (user) => {
  assertOperationalWrite(user);
  if (!esOficina(user)) throw fail("Solo la oficina registra, cierra o elimina reclamos.", 403);
};

const audit = async ({ user, action, entityId, summary, details }) => {
  try {
    await createAuditLog({
      actorUserId: user?.id ?? null,
      actorName: nombreDe(user),
      action,
      entityType: "entrega",
      entityId,
      summary,
      details
    });
  } catch (error) {
    console.error(`Auditoria de reclamos (${action}) fallida:`, error.message);
  }
};

// Inicio del ciclo de facturacion vigente; sin cortes, el mes calendario.
const inicioDelCiclo = async () => {
  const ciclo = await getCicloVigente();
  return ciclo.fecha_inicio || `${jornadaEntregas().fecha.slice(0, 7)}-01`;
};

const leerPersonal = async () => {
  const [filas] = await getPool().query("SELECT id, nombre_completo, activo, user_id FROM personal_campo ORDER BY nombre_completo");
  return new Map(filas.map((fila) => [Number(fila.id), fila]));
};

const personaResumen = (personal, id) => {
  const fila = id ? personal.get(Number(id)) : null;
  return fila ? { id: Number(fila.id), nombre: fila.nombre_completo, activo: Boolean(fila.activo) } : null;
};

/* -------------------------------------------------------------------------- */
/* Quien entrego esta clave                                                    */
/* -------------------------------------------------------------------------- */

// Arma, para un conjunto de barrios, los lotes del ciclo, el reparto y el nombre.
const contextoDeBarrios = async (codigos) => {
  const unicos = [...new Set(codigos.filter(Boolean))];
  const [desde, { barrios }, personal] = await Promise.all([inicioDelCiclo(), leerRepartoBarrios(), leerPersonal()]);
  let lotes = [];
  if (unicos.length) {
    [lotes] = await getPool().query(
      `SELECT id, fecha, estado, responsable_id, barrio_codigo, tipo_documento
       FROM entrega_lotes
       WHERE fecha >= ? AND barrio_codigo IN (${unicos.map(() => "?").join(", ")})`,
      [desde, ...unicos]
    );
  }
  const reparto = new Map(barrios.map((barrio) => [barrio.codigo, barrio]));
  return {
    desde,
    personal,
    reparto,
    lotesDe: (codigo) => lotes
      .filter((lote) => String(lote.barrio_codigo) === codigo)
      .map((lote) => ({ ...lote, fecha: toIsoDate(lote.fecha) }))
  };
};

const resolverEntrega = (contexto, codigo, tipoDocumento) => {
  const barrio = contexto.reparto.get(codigo);
  const lotes = contexto.lotesDe(codigo);
  const eleccion = elegirResponsable({ lotes, repartoResponsableId: barrio?.responsable_id, tipoDocumento });
  const lote = eleccion.lote_id ? lotes.find((item) => toEntero(item.id) === eleccion.lote_id) : null;
  return {
    barrio_codigo: codigo,
    barrio_nombre: barrio?.nombre || (codigo ? `Barrio ${codigo}` : ""),
    origen: eleccion.origen,
    responsable: personaResumen(contexto.personal, eleccion.responsable_id),
    lote: lote ? { id: toEntero(lote.id), fecha: lote.fecha, estado: lote.estado, tipo_documento: lote.tipo_documento } : null,
    reparto: personaResumen(contexto.personal, barrio?.responsable_id),
    lotes_del_ciclo: lotes.length
  };
};

export const buscarEntrega = async (query = {}, user) => {
  assertVer(user);
  const tipo = ["FACTURA", "NOTA_COBRO"].includes(clean(query.tipo)) ? clean(query.tipo) : "";
  const { campo, consulta, coincidencias } = buscarEnPadron(getMasterRecords(), query.q, normalizeLookupKey);
  const abonados = coincidencias.slice(0, MAX_COINCIDENCIAS).map(resumirAbonado);

  // Una clave valida que no esta en el padron igual dice de que barrio es.
  if (!abonados.length && campo === "clave" && codigoBarrioDeClave(consulta)) {
    abonados.push({ clave_catastral: consulta, numero_abonado: "", abonado_nombre: "", barrio_colonia: "", barrio_codigo: codigoBarrioDeClave(consulta), sin_padron: true });
  }

  const contexto = await contextoDeBarrios(abonados.map((item) => item.barrio_codigo));
  const claves = abonados.map((item) => item.clave_catastral).filter(Boolean);
  const numeros = abonados.map((item) => item.numero_abonado).filter(Boolean);
  let reclamos = [];
  let sobrantes = [];
  if (claves.length || numeros.length) {
    const condiciones = [];
    const params = [];
    if (claves.length) { condiciones.push(`clave_catastral IN (${claves.map(() => "?").join(", ")})`); params.push(...claves); }
    if (numeros.length) { condiciones.push(`numero_abonado IN (${numeros.map(() => "?").join(", ")})`); params.push(...numeros); }
    const donde = condiciones.join(" OR ");
    [[reclamos], [sobrantes]] = await Promise.all([
      getPool().query(`SELECT id, clave_catastral, numero_abonado, estado FROM entrega_reclamos WHERE estado <> 'CERRADO' AND (${donde})`, params),
      getPool().query(
        `SELECT documento.id, documento.clave_catastral, documento.numero_abonado, documento.motivo, documento.estado,
           entrega_motivos.etiqueta AS motivo_etiqueta, entrega_lotes.id AS lote_id, entrega_lotes.fecha
         FROM entrega_no_entregadas AS documento
         INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
         LEFT JOIN entrega_motivos ON entrega_motivos.codigo = documento.motivo
         WHERE entrega_lotes.fecha >= ? AND (${donde.replace(/clave_catastral/g, "documento.clave_catastral").replace(/numero_abonado/g, "documento.numero_abonado")})
         ORDER BY entrega_lotes.fecha DESC, documento.id DESC`,
        [contexto.desde, ...params]
      )
    ]);
  }
  const delAbonado = (lista, item) => lista.filter((fila) =>
    (item.clave_catastral && fila.clave_catastral === item.clave_catastral) ||
    (item.numero_abonado && clean(fila.numero_abonado) === item.numero_abonado));

  return {
    campo,
    consulta,
    ciclo_desde: contexto.desde,
    total: coincidencias.length,
    coincidencias: abonados.map((item) => {
      const sobrante = delAbonado(sobrantes, item)[0];
      return {
        ...item,
        entrega: resolverEntrega(contexto, item.barrio_codigo, tipo),
        reclamos_abiertos: delAbonado(reclamos, item).map((fila) => ({ id: toEntero(fila.id), estado: fila.estado })),
        sobrante: sobrante
          ? { id: toEntero(sobrante.id), lote_id: toEntero(sobrante.lote_id), fecha: toIsoDate(sobrante.fecha), motivo: sobrante.motivo_etiqueta || sobrante.motivo, estado: sobrante.estado }
          : null
      };
    })
  };
};

/* -------------------------------------------------------------------------- */
/* Listado                                                                     */
/* -------------------------------------------------------------------------- */

const SELECT_RECLAMO = `
  SELECT reclamo.*, personal_campo.nombre_completo AS responsable_nombre,
    entrega_lotes.fecha AS lote_fecha, entrega_lotes.estado AS lote_estado
  FROM entrega_reclamos AS reclamo
  LEFT JOIN personal_campo ON personal_campo.id = reclamo.responsable_id
  LEFT JOIN entrega_lotes ON entrega_lotes.id = reclamo.lote_id`;

const iso = (fecha) => (fecha ? new Date(fecha).toISOString() : null);

const mapReclamo = (fila) => ({
  id: toEntero(fila.id),
  numero_abonado: fila.numero_abonado,
  clave_catastral: fila.clave_catastral,
  abonado_nombre: fila.abonado_nombre,
  barrio_codigo: fila.barrio_codigo,
  barrio_nombre: fila.barrio_nombre,
  tipo_documento: fila.tipo_documento,
  cantidad: toEntero(fila.cantidad) || 1,
  motivo: fila.motivo,
  motivo_etiqueta: etiquetaMotivo(fila.motivo),
  detalle: fila.detalle || "",
  responsable: fila.responsable_id ? { id: toEntero(fila.responsable_id), nombre: fila.responsable_nombre || "" } : null,
  responsable_origen: fila.responsable_origen,
  lote: fila.lote_id ? { id: toEntero(fila.lote_id), fecha: toIsoDate(fila.lote_fecha), estado: fila.lote_estado } : null,
  estado: fila.estado,
  respuesta: fila.respuesta || "",
  respondido_por_nombre: fila.respondido_por_nombre,
  respondido_en: iso(fila.respondido_en),
  cerrado_por_nombre: fila.cerrado_por_nombre,
  cerrado_en: iso(fila.cerrado_en),
  created_by_nombre: fila.created_by_nombre,
  created_at: iso(fila.created_at)
});

export const listReclamos = async (query = {}, user) => {
  assertVer(user);
  const pagina = Math.max(toEntero(query.pagina), 1);
  const filtros = [];
  const params = [];
  const estado = clean(query.estado);
  if (estado === "SIN_RESPUESTA" || estado === "RESPONDIDO" || estado === "CERRADO") {
    filtros.push("reclamo.estado = ?");
    params.push(estado);
  } else if (estado !== "TODOS") {
    filtros.push("reclamo.estado <> 'CERRADO'");
  }
  const responsable = clean(query.responsable);
  if (responsable === "sin") filtros.push("reclamo.responsable_id IS NULL");
  else if (toEntero(responsable) > 0) { filtros.push("reclamo.responsable_id = ?"); params.push(toEntero(responsable)); }
  const q = clean(query.q).slice(0, 80);
  if (q) {
    filtros.push("(reclamo.clave_catastral LIKE ? OR reclamo.numero_abonado LIKE ? OR reclamo.abonado_nombre LIKE ? OR reclamo.barrio_nombre LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const donde = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const pool = getPool();
  const desde = await inicioDelCiclo();
  // Lo sin respuesta primero y, dentro, lo mas viejo arriba: es lo que mas espera.
  const [[filas], [[{ total }]], [estados], [porTecnico]] = await Promise.all([
    pool.query(
      `${SELECT_RECLAMO} ${donde}
       ORDER BY FIELD(reclamo.estado, 'SIN_RESPUESTA', 'RESPONDIDO', 'CERRADO'),
         CASE WHEN reclamo.estado = 'CERRADO' THEN 0 ELSE UNIX_TIMESTAMP(reclamo.created_at) END ASC,
         reclamo.cerrado_en DESC, reclamo.id DESC
       LIMIT ? OFFSET ?`,
      [...params, POR_PAGINA, (pagina - 1) * POR_PAGINA]
    ),
    pool.query(`SELECT COUNT(*) AS total FROM entrega_reclamos AS reclamo ${donde}`, params),
    pool.query(
      `SELECT estado, COUNT(*) AS total, MIN(created_at) AS mas_antiguo
       FROM entrega_reclamos WHERE estado <> 'CERRADO' OR DATE(cerrado_en) >= ? GROUP BY estado`,
      [desde]
    ),
    pool.query(
      `SELECT reclamo.responsable_id AS id, MAX(personal_campo.nombre_completo) AS nombre,
         SUM(reclamo.estado = 'SIN_RESPUESTA') AS sin_respuesta, SUM(reclamo.estado = 'RESPONDIDO') AS respondido,
         SUM(reclamo.estado = 'CERRADO' AND DATE(reclamo.cerrado_en) >= ?) AS cerrado
       FROM entrega_reclamos AS reclamo
       LEFT JOIN personal_campo ON personal_campo.id = reclamo.responsable_id
       WHERE reclamo.estado <> 'CERRADO' OR DATE(reclamo.cerrado_en) >= ?
       GROUP BY reclamo.responsable_id`,
      [desde, desde]
    )
  ]);
  const porEstado = Object.fromEntries(estados.map((fila) => [fila.estado, fila]));
  return {
    items: filas.map(mapReclamo),
    total: toEntero(total),
    pagina,
    por_pagina: POR_PAGINA,
    ciclo_desde: desde,
    resumen: {
      sin_respuesta: toEntero(porEstado.SIN_RESPUESTA?.total),
      respondido: toEntero(porEstado.RESPONDIDO?.total),
      cerrado_ciclo: toEntero(porEstado.CERRADO?.total),
      mas_antiguo_sin_respuesta: iso(porEstado.SIN_RESPUESTA?.mas_antiguo)
    },
    por_tecnico: porTecnico
      .map((fila) => ({
        id: fila.id == null ? null : toEntero(fila.id),
        nombre: fila.id == null ? "Sin técnico" : fila.nombre || "Sin nombre",
        sin_respuesta: toEntero(fila.sin_respuesta),
        respondido: toEntero(fila.respondido),
        cerrado: toEntero(fila.cerrado)
      }))
      .sort((a, b) => (a.id == null) - (b.id == null) || b.sin_respuesta - a.sin_respuesta || b.respondido - a.respondido || a.nombre.localeCompare(b.nombre, "es")),
    motivos: MOTIVOS_RECLAMO,
    permisos: { registrar: esOficina(user), responder: puedeResponder(user), cerrar: esOficina(user) }
  };
};

/* -------------------------------------------------------------------------- */
/* Escrituras                                                                  */
/* -------------------------------------------------------------------------- */

// Campana: el responsable y todo el equipo de campo se enteran del reclamo nuevo. Un
// aviso que falla nunca deshace el reclamo ya guardado.
const avisarReclamo = async (reclamo, responsableUserId, user) => {
  if (env.useMemoryDb) return 0;
  try {
    const pool = getPool();
    const [tecnicos] = await pool.query("SELECT id FROM app_users WHERE is_active = 1 AND role IN ('operator', 'validadora_campo')");
    const avisos = armarAvisosReclamo({ reclamo, responsableUserId, tecnicos, autorId: user?.id });
    const remitente = nombreDe(user) || "Oficina";
    for (const aviso of avisos) {
      const [resultado] = await pool.query(
        "INSERT INTO user_profile_messages (sender_user_id, recipient_user_id, body) VALUES (?, ?, ?)",
        [user?.id ?? null, aviso.recipient_user_id, aviso.body]
      );
      await pool.query(
        "INSERT INTO entrega_reclamo_avisos (message_id, reclamo_id, recipient_user_id) VALUES (?, ?, ?)",
        [resultado.insertId, reclamo.id, aviso.recipient_user_id]
      );
      emitProfileMessage({
        id: resultado.insertId,
        sender_user_id: user?.id ?? null,
        sender_name: remitente,
        recipient_user_id: aviso.recipient_user_id,
        body: aviso.body,
        entrega_reclamo_id: reclamo.id,
        read_at: null,
        created_at: new Date().toISOString()
      });
    }
    return avisos.length;
  } catch (error) {
    console.error(`Aviso del reclamo #${reclamo.id} fallido:`, error.message);
    return 0;
  }
};

const leerReclamo = async (id, executor = getPool()) => {
  const [filas] = await executor.query(`${SELECT_RECLAMO} WHERE reclamo.id = ? LIMIT 1`, [toEntero(id)]);
  if (!filas[0]) throw fail("El reclamo no existe o ya fue eliminado.", 404);
  return filas[0];
};

export const crearReclamo = async (payload = {}, user) => {
  assertOficina(user);
  const datos = normalizarReclamo(payload);

  // El padron completa nombre y barrio; si la clave no esta, se guarda lo escrito.
  let abonado = null;
  try {
    const consulta = datos.clave_catastral || datos.numero_abonado;
    const { coincidencias } = buscarEnPadron(getMasterRecords(), consulta, normalizeLookupKey);
    const exacta = coincidencias.find((item) =>
      (datos.clave_catastral && item.clave_catastral === datos.clave_catastral) ||
      (datos.numero_abonado && clean(item.abonado) === datos.numero_abonado)) || (coincidencias.length === 1 ? coincidencias[0] : null);
    abonado = exacta ? resumirAbonado(exacta) : null;
  } catch { abonado = null; }

  let clave = abonado?.clave_catastral || datos.clave_catastral;
  if (clave && !abonado) {
    try { clave = normalizeLookupKey(clave); } catch { throw fail("La clave catastral no tiene un formato válido."); }
  }
  const numero = abonado?.numero_abonado || datos.numero_abonado;
  const codigo = codigoBarrioDeClave(clave);
  const contexto = await contextoDeBarrios([codigo]);
  const entrega = resolverEntrega(contexto, codigo, datos.tipo_documento);

  let responsableId = entrega.responsable?.id ?? null;
  let origen = entrega.origen;
  let loteId = entrega.lote?.id ?? null;
  if (datos.responsable_id && datos.responsable_id !== responsableId) {
    const persona = contexto.personal.get(datos.responsable_id);
    if (!persona || !Number(persona.activo)) throw fail("El técnico elegido no existe o está inactivo.", 404);
    responsableId = datos.responsable_id;
    origen = "OFICINA";
    loteId = null;
  }

  const [resultado] = await getPool().query(
    `INSERT INTO entrega_reclamos (numero_abonado, clave_catastral, abonado_nombre, barrio_codigo, barrio_nombre,
       tipo_documento, cantidad, motivo, detalle, responsable_id, responsable_origen, lote_id, created_by, created_by_nombre)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      numero, clave, (abonado?.abonado_nombre || "").slice(0, 180), codigo, entrega.barrio_nombre.slice(0, 180),
      datos.tipo_documento, datos.cantidad, datos.motivo, datos.detalle || null, responsableId, origen, loteId,
      user?.id ?? null, nombreDe(user)
    ]
  );
  const reclamo = mapReclamo(await leerReclamo(resultado.insertId));
  const responsableUserId = responsableId ? contexto.personal.get(responsableId)?.user_id ?? null : null;
  reclamo.avisados = await avisarReclamo(reclamo, responsableUserId, user);
  await audit({
    user,
    action: "entrega_reclamo_creado",
    entityId: reclamo.id,
    summary: `Reclamo #${reclamo.id}: ${reclamo.clave_catastral || reclamo.numero_abonado} · ${reclamo.motivo_etiqueta}${reclamo.responsable ? ` · ${reclamo.responsable.nombre}` : ""}.`,
    details: { clave: reclamo.clave_catastral, abonado: reclamo.numero_abonado, responsable_id: responsableId, origen, lote_id: loteId }
  });
  return reclamo;
};

export const responderReclamo = async (id, payload = {}, user) => {
  assertOperationalWrite(user);
  if (!puedeResponder(user)) throw fail("Tu perfil no responde reclamos.", 403);
  const respuesta = normalizarRespuesta(payload);
  const actual = await leerReclamo(id);
  if (actual.estado === "CERRADO") throw fail("La oficina ya cerró este reclamo. Pide que lo reabran para cambiar la respuesta.", 409);
  await getPool().query(
    `UPDATE entrega_reclamos SET respuesta = ?, estado = 'RESPONDIDO', respondido_por = ?, respondido_por_nombre = ?, respondido_en = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [respuesta, user?.id ?? null, nombreDe(user), toEntero(id)]
  );
  await audit({ user, action: "entrega_reclamo_respondido", entityId: toEntero(id), summary: `Reclamo #${toEntero(id)} respondido.` });
  return mapReclamo(await leerReclamo(id));
};

export const cerrarReclamo = async (id, user) => {
  assertOficina(user);
  const actual = await leerReclamo(id);
  if (actual.estado === "CERRADO") return mapReclamo(actual);
  await getPool().query(
    "UPDATE entrega_reclamos SET estado = 'CERRADO', cerrado_por_nombre = ?, cerrado_en = CURRENT_TIMESTAMP WHERE id = ?",
    [nombreDe(user), toEntero(id)]
  );
  await audit({ user, action: "entrega_reclamo_cerrado", entityId: toEntero(id), summary: `Reclamo #${toEntero(id)} cerrado.` });
  return mapReclamo(await leerReclamo(id));
};

export const reabrirReclamo = async (id, user) => {
  assertOficina(user);
  const actual = await leerReclamo(id);
  if (actual.estado !== "CERRADO") return mapReclamo(actual);
  await getPool().query(
    `UPDATE entrega_reclamos SET estado = IF(COALESCE(respuesta, '') = '', 'SIN_RESPUESTA', 'RESPONDIDO'),
       cerrado_por_nombre = '', cerrado_en = NULL WHERE id = ?`,
    [toEntero(id)]
  );
  await audit({ user, action: "entrega_reclamo_reabierto", entityId: toEntero(id), summary: `Reclamo #${toEntero(id)} reabierto.` });
  return mapReclamo(await leerReclamo(id));
};

export const eliminarReclamo = async (id, user) => {
  assertOficina(user);
  const actual = mapReclamo(await leerReclamo(id));
  await getPool().query("DELETE FROM entrega_reclamos WHERE id = ?", [actual.id]);
  await audit({
    user,
    action: "entrega_reclamo_eliminado",
    entityId: actual.id,
    summary: `Reclamo #${actual.id} eliminado (${actual.clave_catastral || actual.numero_abonado}).`,
    details: actual
  });
  return { eliminado: actual.id };
};
