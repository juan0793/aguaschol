// Exclusiones de entrega (2026-10-28): claves catastrales y números de abonado cuya
// factura la entrega otro departamento. Administración arma la lista; todos la reciben
// en /entregas/config para que el cierre avise al técnico si anota uno como sobrante.

import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { getMasterRecords, getMasterVersion } from "./claveLookupService.js";
import { jornadaEntregas } from "./entregasReminderService.js";
import { addDays, toIsoDate } from "./entregasRules.js";
import { detallarExclusiones, indexarCuentas, llaveExclusion, normalizarEnvioExclusiones, resumenExclusiones } from "./entregasExclusionesRules.js";
import { assertOperationalWrite } from "../utils/permissions.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const toEntero = (valor) => Number.parseInt(valor, 10) || 0;

const auditar = async ({ user, action, entityId, summary, details }) => {
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
  } catch (error) {
    console.error(`Auditoria de exclusiones (${action}) fallida:`, error.message);
  }
};

const mapear = (fila) => ({
  id: toEntero(fila.id),
  tipo: fila.tipo,
  valor: fila.valor,
  llave: fila.llave,
  nota: fila.nota || "",
  created_by_nombre: fila.created_by_nombre || "",
  created_at: fila.created_at
});

export const listExclusiones = async () => {
  const [filas] = await getPool().query(
    `SELECT id, tipo, valor, llave, nota, created_by_nombre, created_at
     FROM entrega_exclusiones ORDER BY tipo ASC, valor ASC`
  );
  return filas.map(mapear);
};

// Para el cierre del técnico basta con saber qué excluir y la nota.
export const exclusionesParaConfig = async () => (await listExclusiones())
  .map(({ id, tipo, valor, llave, nota }) => ({ id, tipo, valor, llave, nota }));

// El índice del padrón se rehace solo cuando cambia su versión.
let padronCuentas = { version: null, indice: null };
const indiceCuentas = () => {
  const version = getMasterVersion();
  if (padronCuentas.version !== version) padronCuentas = { version, indice: indexarCuentas(getMasterRecords()) };
  return padronCuentas.indice;
};

// IN () vacío no es SQL válido: se usa un valor que ninguna fila tiene.
const oNada = (valores) => (valores.length ? valores : ["\u0000"]);

// La pantalla de Exclusiones (administración y Gerencia): cada exclusión con su cuenta
// del padrón, el saldo y qué pasó con su entrega en el ciclo vigente (ver
// entregaDelCiclo). Sin cortes declarados, el ciclo es el mes en curso, como el avance.
export const listExclusionesConDetalle = async (user) => {
  const pool = getPool();
  const hoy = jornadaEntregas().fecha;
  const [exclusiones, [cortes]] = await Promise.all([
    listExclusiones(),
    pool.query("SELECT fecha_corte FROM entrega_ciclos ORDER BY fecha_corte DESC, id DESC LIMIT 1")
  ]);
  const desde = cortes[0] ? addDays(toIsoDate(cortes[0].fecha_corte), 1) : `${hoy.slice(0, 7)}-01`;
  const indice = indiceCuentas();

  // Llaves para buscar lo anotado como no entregado: las de la exclusión y las de sus cuentas.
  const abonados = new Set();
  const claves = new Set();
  const barrios = new Set();
  for (const exclusion of exclusiones) {
    (exclusion.tipo === "ABONADO" ? abonados : claves).add(exclusion.llave);
    for (const cuenta of (exclusion.tipo === "ABONADO" ? indice.porAbonado : indice.porClave).get(exclusion.llave) || []) {
      abonados.add(llaveExclusion("ABONADO", cuenta.abonado));
      claves.add(llaveExclusion("CLAVE", cuenta.clave_catastral));
      const barrio = String(cuenta.clave_catastral || "").split("-")[0];
      if (barrio) barrios.add(barrio);
    }
    if (exclusion.tipo === "CLAVE" && String(exclusion.valor).includes("-")) barrios.add(String(exclusion.valor).split("-")[0]);
  }

  const [[documentos], [lotes]] = exclusiones.length ? await Promise.all([
    pool.query(
      `SELECT documento.id, documento.lote_id, documento.numero_abonado, documento.clave_catastral, documento.estado,
         documento.fecha_entrega_final, entrega_lotes.fecha, entrega_lotes.tipo_documento, personal_campo.nombre_completo AS tecnico
       FROM entrega_no_entregadas AS documento
       INNER JOIN entrega_lotes ON entrega_lotes.id = documento.lote_id
       LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
       WHERE documento.estado <> 'CANCELADA' AND entrega_lotes.fecha <= ?
         AND (TRIM(LEADING '0' FROM REPLACE(documento.numero_abonado, ' ', '')) IN (?)
           OR REPLACE(REPLACE(documento.clave_catastral, '-', ''), ' ', '') IN (?))`,
      [hoy, oNada([...abonados].filter(Boolean)), oNada([...claves].filter(Boolean))]
    ),
    pool.query(
      `SELECT entrega_lotes.id, entrega_lotes.fecha, entrega_lotes.estado, entrega_lotes.barrio_codigo, entrega_lotes.tipo_documento,
         personal_campo.nombre_completo AS tecnico
       FROM entrega_lotes
       LEFT JOIN personal_campo ON personal_campo.id = entrega_lotes.responsable_id
       WHERE entrega_lotes.fecha >= ? AND entrega_lotes.fecha <= ? AND entrega_lotes.barrio_codigo IN (?)`,
      [desde, hoy, oNada([...barrios])]
    )
  ]) : [[[]], [[]]];

  const fechas = (fila) => ({ ...fila, fecha: toIsoDate(fila.fecha), fecha_entrega_final: toIsoDate(fila.fecha_entrega_final) });
  const detalle = detallarExclusiones({
    exclusiones,
    indice,
    documentos: documentos.map(fechas),
    lotes: lotes.map(fechas),
    desde,
    conSaldo: ["admin", "gerente"].includes(user?.role)
  });
  return { exclusiones: detalle, resumen: resumenExclusiones(detalle), ciclo: { desde, hasta: hoy, declarado: Boolean(cortes[0]) } };
};

export const agregarExclusiones = async (payload = {}, user) => {
  assertOperationalWrite(user);
  if (user?.role !== "admin") throw fail("Solo administración puede editar las exclusiones.", 403);
  const { tipo, items, invalidos } = normalizarEnvioExclusiones(payload);

  const pool = getPool();
  const [existentes] = await pool.query("SELECT llave FROM entrega_exclusiones WHERE tipo = ? AND llave IN (?)", [tipo, items.map((item) => item.llave)]);
  const yaEstaban = new Set(existentes.map((fila) => fila.llave));
  const nuevas = items.filter((item) => !yaEstaban.has(item.llave));
  if (nuevas.length) {
    await pool.query(
      `INSERT IGNORE INTO entrega_exclusiones (tipo, valor, llave, nota, created_by, created_by_nombre) VALUES ?`,
      [nuevas.map((item) => [tipo, item.valor, item.llave, item.nota, user.id ?? null, user.full_name || user.username || null])]
    );
    await auditar({
      user,
      action: "EXCLUSIONES_AGREGADAS",
      entityId: null,
      summary: `${nuevas.length} ${tipo === "CLAVE" ? "claves" : "abonados"} excluidos de la entrega`,
      details: { tipo, valores: nuevas.map((item) => item.valor), nota: nuevas[0].nota }
    });
  }
  return {
    agregadas: nuevas.length,
    repetidas: items.length - nuevas.length,
    invalidos,
    ...(await listExclusionesConDetalle(user))
  };
};

export const eliminarExclusion = async (id, user) => {
  assertOperationalWrite(user);
  if (user?.role !== "admin") throw fail("Solo administración puede editar las exclusiones.", 403);
  const pool = getPool();
  const [filas] = await pool.query("SELECT * FROM entrega_exclusiones WHERE id = ?", [toEntero(id)]);
  if (!filas.length) throw fail("Esa exclusión ya no existe.", 404);
  await pool.query("DELETE FROM entrega_exclusiones WHERE id = ?", [toEntero(id)]);
  await auditar({
    user,
    action: "EXCLUSION_QUITADA",
    entityId: toEntero(id),
    summary: `${filas[0].tipo === "CLAVE" ? "Clave" : "Abonado"} ${filas[0].valor} vuelve a la entrega normal`,
    details: mapear(filas[0])
  });
  return listExclusionesConDetalle(user);
};
