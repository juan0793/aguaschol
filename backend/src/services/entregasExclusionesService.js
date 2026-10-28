// Exclusiones de entrega (2026-10-28): claves catastrales y números de abonado cuya
// factura la entrega otro departamento. Administración arma la lista; todos la reciben
// en /entregas/config para que el cierre avise al técnico si anota uno como sobrante.

import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { normalizarEnvioExclusiones } from "./entregasExclusionesRules.js";
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
    exclusiones: await listExclusiones()
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
  return { exclusiones: await listExclusiones() };
};
