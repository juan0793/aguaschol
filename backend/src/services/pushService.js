// Web Push: los avisos de la campana también llegan como notificación del sistema
// cuando la app está cerrada o en segundo plano. Se envían desde emitProfileMessage
// (profileRealtimeService.js), así que cubren los mismos eventos que la campana.
// Las reglas puras están en pushRules.js. Un envío fallido nunca afecta a la acción
// que generó el aviso.

import { createHash } from "node:crypto";
import webpush from "web-push";
import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { avisoPushDe, normalizarSuscripcion, suscripcionVencida } from "./pushRules.js";

let configurado = false;
const configurar = () => {
  if (configurado || !env.usePush) return env.usePush;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  configurado = true;
  return true;
};

const hashDe = (endpoint) => createHash("sha256").update(endpoint).digest("hex");
const fail = (message, status = 400) => Object.assign(new Error(message), { status, statusCode: status });

// Quién puede activar avisos: el personal con campana (no Gerencia ni la vista previa de un rol).
const puedeSuscribirse = (user) => Boolean(user?.id) && !user?.preview && user?.role !== "gerente";

export const estadoPush = (user) => ({
  disponible: env.usePush && !env.useMemoryDb && puedeSuscribirse(user),
  clave_publica: env.usePush ? env.vapidPublicKey : ""
});

export const guardarSuscripcion = async (user, cuerpo = {}, userAgent = "") => {
  if (!puedeSuscribirse(user)) throw fail("Tu perfil no recibe avisos en este dispositivo.", 403);
  if (!env.usePush || env.useMemoryDb) throw fail("Los avisos con la app cerrada no están configurados en el servidor.", 503);
  const suscripcion = normalizarSuscripcion(cuerpo?.subscription ?? cuerpo);
  if (!suscripcion) throw fail("La suscripción del navegador no es válida.");
  // El mismo navegador puede pasar a otro usuario (cambio de sesión): la fila se reasigna.
  await getPool().query(
    `INSERT INTO push_subscriptions (user_id, endpoint_hash, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)`,
    [user.id, hashDe(suscripcion.endpoint), suscripcion.endpoint, suscripcion.p256dh, suscripcion.auth, String(userAgent || "").slice(0, 255)]
  );
  return { ok: true };
};

export const borrarSuscripcion = async (user, cuerpo = {}) => {
  const endpoint = String(cuerpo?.endpoint ?? "").trim();
  if (!user?.id || !endpoint || env.useMemoryDb) return { ok: true };
  await getPool().query("DELETE FROM push_subscriptions WHERE endpoint_hash = ? AND user_id = ?", [hashDe(endpoint), user.id]);
  return { ok: true };
};

// Envía a todos los dispositivos del usuario. Devuelve cuántos lo recibieron.
export const enviarPushAUsuario = async (userId, payload) => {
  if (!configurar() || env.useMemoryDb) return 0;
  const pool = getPool();
  const [filas] = await pool.query("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", [userId]);
  let enviados = 0;
  await Promise.all(filas.map(async (fila) => {
    try {
      await webpush.sendNotification(
        { endpoint: fila.endpoint, keys: { p256dh: fila.p256dh, auth: fila.auth } },
        JSON.stringify(payload),
        // Un aviso que no se entrega en 12 h ya no sirve; "high" despierta el teléfono.
        { TTL: 12 * 3600, urgency: "high", topic: String(payload.tag || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined }
      );
      enviados += 1;
      await pool.query("UPDATE push_subscriptions SET last_success_at = CURRENT_TIMESTAMP WHERE id = ?", [fila.id]);
    } catch (error) {
      if (suscripcionVencida(error?.statusCode)) {
        await pool.query("DELETE FROM push_subscriptions WHERE id = ?", [fila.id]).catch(() => {});
      } else {
        console.error(`Aviso push al usuario ${userId} fallido:`, error?.statusCode || "", error?.message || error);
      }
    }
  }));
  return enviados;
};

// Punto de entrada desde emitProfileMessage: decide si el mensaje sale como push y lo
// envía en segundo plano, sin esperar ni lanzar errores.
export const avisarPorPush = (mensaje) => {
  if (!env.usePush || env.useMemoryDb) return;
  const aviso = avisoPushDe(mensaje);
  if (!aviso) return;
  enviarPushAUsuario(aviso.userId, aviso.payload).catch((error) => {
    console.error("Aviso push fallido:", error?.message || error);
  });
};
