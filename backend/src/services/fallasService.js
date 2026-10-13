import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { accionDeRuta, normalizarRuta, tipoDeCodigo, validarFallasDispositivo } from "./fallasRules.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const puedeVer = (user) => ["admin", "gerente"].includes(user?.role) && !user?.preview;
const REPETIDA_MS = 10 * 60000;

// Guarda una falla. Si la misma persona falló la misma acción hace menos de 10 minutos
// y nadie la revisó, se suma a esa en vez de crear otra.
export const registrarFalla = async ({ user, origen, tipo, metodo, ruta, accion, codigo = null, mensaje = "", veces = 1, ocurrido_en = new Date() }, executor = null) => {
  if (env.useMemoryDb || !user?.id) return null;
  const pool = executor || getPool();
  const desde = new Date(new Date(ocurrido_en).getTime() - REPETIDA_MS);
  const [[previa]] = await pool.query(
    `SELECT id FROM fallas_equipo
     WHERE user_id = ? AND metodo = ? AND ruta = ? AND tipo = ? AND revisada_en IS NULL AND ocurrido_en >= ?
     ORDER BY id DESC LIMIT 1`,
    [user.id, metodo, ruta, tipo, desde]
  );
  if (previa) {
    await pool.query("UPDATE fallas_equipo SET veces = veces + ?, ocurrido_en = GREATEST(ocurrido_en, ?), mensaje = ?, codigo = ? WHERE id = ?", [veces, ocurrido_en, mensaje, codigo, previa.id]);
    return previa.id;
  }
  const [resultado] = await pool.query(
    `INSERT INTO fallas_equipo (user_id, user_nombre, user_rol, origen, tipo, metodo, ruta, accion, codigo, mensaje, veces, ocurrido_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, String(user.full_name || user.username || "").slice(0, 160), String(user.role || "").slice(0, 32), origen, tipo, metodo, ruta, accion, codigo, String(mensaje || "").slice(0, 300), veces, ocurrido_en]
  );
  return resultado.insertId;
};

// Falla que vio el servidor (la llama el manejador de errores; nunca rompe la respuesta).
export const registrarFallaServidor = ({ user, metodo, ruta, codigo, mensaje }) =>
  registrarFalla({
    user, origen: "servidor", tipo: tipoDeCodigo(codigo), metodo: String(metodo).toUpperCase(),
    ruta: normalizarRuta(ruta), accion: accionDeRuta(metodo, ruta), codigo, mensaje
  }).catch((error) => console.error("No se pudo registrar la falla:", error.message));

// Fallas que el teléfono guardó sin señal.
export const registrarFallasDispositivo = async (cuerpo, user) => {
  if (!user?.id) throw fail("Sesión no válida.", 401);
  const fallas = validarFallasDispositivo(cuerpo);
  for (const falla of fallas) await registrarFalla({ ...falla, user, origen: "dispositivo" });
  return { registradas: fallas.length };
};

export const listarFallas = async (filtros = {}, user) => {
  if (!puedeVer(user)) throw fail("Solo administración y Gerencia ven las fallas del equipo.", 403);
  const limit = Math.min(Math.max(Number(filtros.limit) || 30, 1), 100);
  const pagina = Math.max(Math.floor(Number(filtros.pagina)) || 1, 1);
  if (env.useMemoryDb) return { items: [], total: 0, sin_revisar: 0, por_tipo: {}, personas: [], pagina, por_pagina: limit };
  const where = [];
  const params = [];
  if (filtros.estado !== "todas") where.push("revisada_en IS NULL");
  if (["sin_conexion", "rechazada", "error_servidor"].includes(filtros.tipo)) { where.push("tipo = ?"); params.push(filtros.tipo); }
  if (Number(filtros.persona) > 0) { where.push("user_id = ?"); params.push(Number(filtros.persona)); }
  const filtro = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pool = getPool();
  const [[filas], [[{ total }]], [[{ sin_revisar }]], [tipos], [personas]] = await Promise.all([
    pool.query(`SELECT * FROM fallas_equipo ${filtro} ORDER BY ocurrido_en DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, (pagina - 1) * limit]),
    pool.query(`SELECT COUNT(*) AS total FROM fallas_equipo ${filtro}`, params),
    pool.query("SELECT COUNT(*) AS sin_revisar FROM fallas_equipo WHERE revisada_en IS NULL"),
    pool.query("SELECT tipo, COUNT(*) AS total FROM fallas_equipo WHERE revisada_en IS NULL GROUP BY tipo"),
    pool.query("SELECT user_id AS id, MAX(user_nombre) AS nombre, SUM(revisada_en IS NULL) AS sin_revisar, COUNT(*) AS total FROM fallas_equipo WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY sin_revisar DESC, nombre")
  ]);
  return {
    items: filas.map((fila) => ({
      id: Number(fila.id), user_id: fila.user_id == null ? null : Number(fila.user_id), user_nombre: fila.user_nombre, user_rol: fila.user_rol,
      origen: fila.origen, tipo: fila.tipo, metodo: fila.metodo, ruta: fila.ruta, accion: fila.accion,
      codigo: fila.codigo == null ? null : Number(fila.codigo), mensaje: fila.mensaje, veces: Number(fila.veces),
      ocurrido_en: new Date(fila.ocurrido_en).toISOString(), revisada: Boolean(fila.revisada_en)
    })),
    total: Number(total || 0),
    sin_revisar: Number(sin_revisar || 0),
    por_tipo: Object.fromEntries(tipos.map((fila) => [fila.tipo, Number(fila.total)])),
    personas: personas.map((fila) => ({ id: Number(fila.id), nombre: fila.nombre, sin_revisar: Number(fila.sin_revisar || 0), total: Number(fila.total) })),
    pagina,
    por_pagina: limit
  };
};

// Administración marca como revisadas unas fallas o todas las pendientes.
export const marcarFallasRevisadas = async (cuerpo = {}, user) => {
  if (user?.role !== "admin" || user?.preview) throw fail("Solo administración marca fallas como revisadas.", 403);
  if (env.useMemoryDb) return { revisadas: 0 };
  const ids = Array.isArray(cuerpo.ids) ? cuerpo.ids.map(Number).filter((id) => id > 0).slice(0, 500) : [];
  if (!cuerpo.todas && !ids.length) throw fail("Indica qué fallas marcar.");
  const [resultado] = cuerpo.todas
    ? await getPool().query("UPDATE fallas_equipo SET revisada_en = CURRENT_TIMESTAMP, revisada_por = ? WHERE revisada_en IS NULL", [user.id])
    : await getPool().query("UPDATE fallas_equipo SET revisada_en = CURRENT_TIMESTAMP, revisada_por = ? WHERE revisada_en IS NULL AND id IN (?)", [user.id, ids]);
  return { revisadas: resultado.affectedRows };
};
