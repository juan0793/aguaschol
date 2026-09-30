import { env } from "../config/env.js";
import { getPool } from "../config/db.js";

// Ajustes del módulo Clandestinos que administración cambia desde Configuración.
// Hoy: el nombre del "Analista de datos" que firma las fichas técnicas.
export const AJUSTES_DEFECTO = { analista_datos: "Ing. Juan Ordoñez Bonilla" };
const LIMITES = { analista_datos: 180 };
const memoria = new Map();
const clean = (value) => String(value ?? "").trim();

export const getAjustes = async () => {
  if (env.useMemoryDb) return { ...AJUSTES_DEFECTO, ...Object.fromEntries(memoria) };
  const [rows] = await getPool().query("SELECT clave, valor FROM clandestinos_ajustes WHERE clave IN (?)", [Object.keys(AJUSTES_DEFECTO)]);
  return { ...AJUSTES_DEFECTO, ...Object.fromEntries(rows.map((row) => [row.clave, row.valor])) };
};

export const getAnalistaDatos = async () => clean((await getAjustes()).analista_datos);

export const updateAjustes = async (cambios = {}, user) => {
  if (user?.role !== "admin") throw Object.assign(new Error("Solo administración cambia la configuración del módulo."), { status: 403 });
  const validos = Object.entries(cambios).filter(([clave]) => clave in AJUSTES_DEFECTO).map(([clave, valor]) => [clave, clean(valor).slice(0, LIMITES[clave] || 255)]);
  if (!validos.length) throw Object.assign(new Error("No hay ajustes para guardar."), { status: 400 });
  if (env.useMemoryDb) validos.forEach(([clave, valor]) => memoria.set(clave, valor));
  else {
    for (const [clave, valor] of validos) {
      await getPool().query(
        "INSERT INTO clandestinos_ajustes (clave, valor, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_by = VALUES(updated_by)",
        [clave, valor, user?.id || null]
      );
    }
  }
  return getAjustes();
};
