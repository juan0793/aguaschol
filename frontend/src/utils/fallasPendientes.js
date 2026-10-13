// Fallas que el teléfono no pudo contar al servidor (sin señal): se guardan aquí y se envían
// a "Fallas del equipo" cuando vuelve la conexión. Solo acción y motivo, nunca lo enviado.
const ESCRITURAS = ["POST", "PUT", "PATCH", "DELETE"];
const MAX = 100;
const REPETIDA_MS = 10 * 60000;
const clave = (userId) => `aguaschol-fallas-pendientes-${userId}`;

const leer = (userId, storage) => {
  try { const lista = JSON.parse(storage.getItem(clave(userId)) || "[]"); return Array.isArray(lista) ? lista : []; }
  catch { return []; }
};
const guardar = (userId, lista, storage) => {
  try { storage.setItem(clave(userId), JSON.stringify(lista.slice(-MAX))); } catch { /* sin almacenamiento */ }
};

// Solo las acciones que guardan algo, de quien no es administración ni Gerencia.
export const debeGuardarFalla = ({ metodo = "GET", ruta = "", user = null } = {}) =>
  Boolean(user?.id) && !["admin", "gerente"].includes(user.role) && !user.preview &&
  ESCRITURAS.includes(String(metodo).toUpperCase()) && !String(ruta).startsWith("/fallas");

export function anotarFallaSinSenal(user, { metodo, ruta, mensaje }, { storage = globalThis.localStorage, ahora = Date.now() } = {}) {
  if (!storage || !debeGuardarFalla({ metodo, ruta, user })) return;
  const lista = leer(user.id, storage);
  const limpia = String(ruta).split("?")[0];
  const previa = lista.find((falla) => falla.metodo === metodo.toUpperCase() && falla.ruta === limpia && ahora - Date.parse(falla.ocurrido_en) < REPETIDA_MS);
  if (previa) { previa.veces += 1; previa.ocurrido_en = new Date(ahora).toISOString(); }
  else lista.push({ metodo: metodo.toUpperCase(), ruta: limpia, mensaje: String(mensaje || "Sin conexión con el servidor.").slice(0, 300), veces: 1, ocurrido_en: new Date(ahora).toISOString() });
  guardar(user.id, lista, storage);
}

export const fallasPendientes = (userId, storage = globalThis.localStorage) => (storage ? leer(userId, storage) : []);

// Envía hasta 50 al servidor; si responde bien, las saca de la cola.
export async function enviarFallasPendientes(userId, enviar, storage = globalThis.localStorage) {
  const lista = fallasPendientes(userId, storage);
  if (!lista.length) return 0;
  const lote = lista.slice(0, 50);
  const ok = await enviar(lote).catch(() => false);
  if (!ok) return 0;
  const enviadas = new Set(lote.map((falla) => `${falla.metodo} ${falla.ruta} ${falla.ocurrido_en}`));
  guardar(userId, leer(userId, storage).filter((falla) => !enviadas.has(`${falla.metodo} ${falla.ruta} ${falla.ocurrido_en}`)), storage);
  return lote.length;
}
