// Accesos adicionales por usuario (ver userAccesosRules.js). Solo administración los
// da y los quita desde Usuarios; cada alta y baja va a la auditoría.

import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { jornadaEntregas } from "./entregasReminderService.js";
import { ACCESOS, accesoDelCatalogo, accesoVigente, normalizarAcceso } from "./userAccesosRules.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const hoyLocal = () => jornadaEntregas().fecha;
const isoDe = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) {
    const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  return String(valor).slice(0, 10);
};

const cargarUsuario = async (userId) => {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw fail("Usuario inválido.");
  const [[usuario]] = await getPool().query("SELECT id, full_name, username, role FROM app_users WHERE id = ? LIMIT 1", [id]);
  if (!usuario) throw fail("Usuario no encontrado.", 404);
  return usuario;
};

const filaPublica = (fila, { hoy, role }) => ({
  clave: fila.acceso,
  alcance: fila.alcance,
  vence: isoDe(fila.vence),
  vigente: accesoVigente({ ...fila, vence: isoDe(fila.vence) }, { hoy, role }),
  otorgado_por_nombre: fila.otorgado_por_nombre || "",
  actualizado: fila.updated_at || fila.created_at || null
});

// Lo que Usuarios muestra de una persona: los accesos que su perfil puede recibir y
// los que ya tiene.
export const listarAccesosDe = async (userId) => {
  const usuario = await cargarUsuario(userId);
  const hoy = hoyLocal();
  const [filas] = await getPool().query(
    "SELECT acceso, alcance, vence, otorgado_por_nombre, created_at, updated_at FROM app_user_accesos WHERE user_id = ? ORDER BY acceso",
    [usuario.id]
  );
  return {
    hoy,
    catalogo: ACCESOS.filter((item) => item.perfiles.includes(usuario.role)).map(({ perfiles, ...item }) => item),
    accesos: filas.map((fila) => filaPublica(fila, { hoy, role: usuario.role }))
  };
};

const auditar = async ({ actor, action, usuario, summary, details }) => {
  try {
    await createAuditLog({
      actorUserId: actor?.id ?? null,
      actorName: actor?.full_name || actor?.username || "",
      action,
      entityType: "user",
      entityId: String(usuario.id),
      summary,
      details
    });
  } catch (error) {
    console.error(`Auditoría de accesos (${action}) fallida:`, error.message);
  }
};

export const guardarAcceso = async (userId, clave, payload = {}, actor) => {
  if (actor?.preview) throw fail("La vista previa de perfil no cambia accesos.", 403);
  const usuario = await cargarUsuario(userId);
  const hoy = hoyLocal();
  const acceso = normalizarAcceso({ ...payload, clave, role: usuario.role }, { hoy });
  await getPool().query(
    `INSERT INTO app_user_accesos (user_id, acceso, alcance, vence, otorgado_por, otorgado_por_nombre)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE alcance = VALUES(alcance), vence = VALUES(vence),
       otorgado_por = VALUES(otorgado_por), otorgado_por_nombre = VALUES(otorgado_por_nombre)`,
    [usuario.id, acceso.clave, acceso.alcance, acceso.vence, actor?.id ?? null, actor?.full_name || actor?.username || ""]
  );
  const catalogo = accesoDelCatalogo(acceso.clave);
  const alcance = catalogo.alcances.find((item) => item.valor === acceso.alcance)?.titulo || acceso.alcance;
  await auditar({
    actor,
    action: "ACCESO_OTORGADO",
    usuario,
    summary: `Acceso "${catalogo.titulo}" para ${usuario.full_name || usuario.username}: ${alcance.toLowerCase()}${acceso.vence ? `, hasta el ${acceso.vence}` : ", sin fecha"}.`,
    details: acceso
  });
  return listarAccesosDe(usuario.id);
};

export const quitarAcceso = async (userId, clave, actor) => {
  if (actor?.preview) throw fail("La vista previa de perfil no cambia accesos.", 403);
  const usuario = await cargarUsuario(userId);
  const catalogo = accesoDelCatalogo(clave);
  if (!catalogo) throw fail("Ese acceso no existe.");
  const [resultado] = await getPool().query("DELETE FROM app_user_accesos WHERE user_id = ? AND acceso = ?", [usuario.id, catalogo.clave]);
  if (resultado.affectedRows) {
    await auditar({
      actor,
      action: "ACCESO_QUITADO",
      usuario,
      summary: `Se quitó el acceso "${catalogo.titulo}" a ${usuario.full_name || usuario.username}.`,
      details: { clave: catalogo.clave }
    });
  }
  return listarAccesosDe(usuario.id);
};

// El acceso vigente de un usuario, o null. Lo usan los módulos para abrir la pantalla.
export const accesoDe = async (user, clave) => {
  if (!user?.id || user.preview) return null;
  const [[fila]] = await getPool().query(
    "SELECT acceso, alcance, vence FROM app_user_accesos WHERE user_id = ? AND acceso = ? LIMIT 1",
    [user.id, clave]
  );
  if (!fila) return null;
  const normal = { ...fila, vence: isoDe(fila.vence) };
  return accesoVigente(normal, { hoy: hoyLocal(), role: user.role }) ? normal : null;
};

// Cuántos accesos vigentes tiene cada usuario, para la lista de Usuarios.
export const contarAccesosVigentes = async () => {
  const hoy = hoyLocal();
  const [filas] = await getPool().query(
    `SELECT app_user_accesos.user_id, app_user_accesos.acceso, app_user_accesos.vence, app_users.role
     FROM app_user_accesos INNER JOIN app_users ON app_users.id = app_user_accesos.user_id`
  );
  const cuenta = new Map();
  for (const fila of filas) {
    if (!accesoVigente({ ...fila, vence: isoDe(fila.vence) }, { hoy, role: fila.role })) continue;
    cuenta.set(Number(fila.user_id), (cuenta.get(Number(fila.user_id)) || 0) + 1);
  }
  return cuenta;
};
