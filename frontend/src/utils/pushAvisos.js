// Avisos con la app cerrada (Web Push) del lado del navegador. El service worker
// (public/sw.js) muestra la notificación y abre la pantalla del aviso al tocarla.

// La clave pública VAPID llega en base64url; PushManager la pide en bytes.
export const claveEnBytes = (base64url = "") => {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  return Uint8Array.from(binario, (letra) => letra.charCodeAt(0));
};

const esIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || "") ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

// Qué puede hacer este navegador: "si", "ios-instalar" (iPhone sin instalar en la
// pantalla de inicio: Safari solo permite push a la app instalada, iOS 16.4+) o "no".
export const soportePush = () => {
  if (typeof window === "undefined") return "no";
  const completo = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (esIos() && !instalada()) return "ios-instalar";
  return completo ? "si" : "no";
};

// El service worker solo se registra en producción (main.jsx); sin él no hay push.
export const registroActivo = async () => {
  if (!("serviceWorker" in navigator)) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return registro?.active ? registro : null;
};

export const suscripcionActual = async () => {
  const registro = await registroActivo();
  return registro ? registro.pushManager.getSubscription() : null;
};

const leer = async (respuesta, mensaje) => {
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(cuerpo.message || mensaje);
  return cuerpo;
};

export const estadoServidor = async (apiFetch) => leer(await apiFetch("/profile/push"), "No se pudo consultar los avisos.");

// Se llama desde un clic: el permiso del navegador solo se puede pedir con un gesto.
export const activarAvisos = async (apiFetch, clavePublica) => {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso;
  const registro = await registroActivo();
  if (!registro) throw new Error("Abre la app desde www.controlaguas.com para activar los avisos.");
  const suscripcion = (await registro.pushManager.getSubscription()) ||
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveEnBytes(clavePublica) }));
  await enviarSuscripcion(apiFetch, suscripcion);
  return "granted";
};

export const enviarSuscripcion = async (apiFetch, suscripcion) => leer(await apiFetch("/profile/push/subscription", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ subscription: suscripcion.toJSON() })
}), "No se pudo guardar este dispositivo.");

// Al desactivar o cerrar sesión: el servidor deja de avisar a este dispositivo.
export const desactivarAvisos = async (apiFetch) => {
  const suscripcion = await suscripcionActual().catch(() => null);
  if (!suscripcion) return;
  await apiFetch("/profile/push/subscription", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: suscripcion.endpoint })
  }).catch(() => {});
  await suscripcion.unsubscribe().catch(() => {});
};
