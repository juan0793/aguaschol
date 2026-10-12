// Saludo del encabezado de Gerencia: bienvenida en el primer ingreso y, después,
// según la hora de Honduras.
export const WELCOME_STORAGE_KEY = "aguaschol-bienvenida";
const TIME_ZONE = "America/Tegucigalpa";

export const firstName = (fullName, username = "") => String(fullName || "").trim().split(/\s+/)[0] || String(username || "").trim();

export function hourInHonduras(now = new Date()) {
  const hour = new Intl.DateTimeFormat("es-HN", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now);
  return Number(hour) % 24;
}

export function greetingFor({ fullName, username, firstVisit = false, now = new Date() }) {
  const name = firstName(fullName, username);
  const hour = hourInHonduras(now);
  const salute = firstVisit ? "Te damos la bienvenida" : hour >= 5 && hour < 12 ? "Buenos días" : hour >= 12 && hour < 19 ? "Buenas tardes" : "Buenas noches";
  return name ? `${salute}, ${name}` : salute;
}

export function markWelcome(user) {
  try {
    if (user?.first_login) window.sessionStorage.setItem(WELCOME_STORAGE_KEY, String(user.id));
    else window.sessionStorage.removeItem(WELCOME_STORAGE_KEY);
  } catch { /* sin sessionStorage solo se pierde la bienvenida */ }
}

export function isWelcomeVisit(user) {
  try { return Boolean(user?.id) && window.sessionStorage.getItem(WELCOME_STORAGE_KEY) === String(user.id); }
  catch { return false; }
}
