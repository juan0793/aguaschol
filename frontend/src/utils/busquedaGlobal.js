// Buscador de la barra superior → "Buscar clave".
// La pantalla de búsqueda ya interpreta texto libre (clave, abonado o nombre,
// parseLookupChatMessage). El buscador global solo le pasa el texto: lo deja
// pendiente en sessionStorage (si la pantalla todavía no está abierta) y avisa
// con un evento (si ya lo está). La pantalla lo toma una sola vez y lo consulta.

export const BUSQUEDA_EVENTO = "aguas:buscar";
const PENDIENTE_KEY = "aguas.busqueda.pendiente";

const almacen = () => {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
};

export const pedirBusqueda = (texto, { storage = almacen(), target = globalThis } = {}) => {
  const valor = String(texto ?? "").trim();
  if (!valor) return false;
  try {
    storage?.setItem(PENDIENTE_KEY, valor);
  } catch {
    // Sin almacenamiento queda el evento, que basta con la pantalla ya abierta.
  }
  if (typeof target?.dispatchEvent === "function" && typeof CustomEvent === "function") {
    target.dispatchEvent(new CustomEvent(BUSQUEDA_EVENTO, { detail: valor }));
  }
  return true;
};

// Devuelve el texto pendiente y lo borra: cada búsqueda se consulta una vez.
export const tomarBusquedaPendiente = ({ storage = almacen() } = {}) => {
  try {
    const valor = storage?.getItem(PENDIENTE_KEY) || "";
    if (valor) storage.removeItem(PENDIENTE_KEY);
    return valor;
  } catch {
    return "";
  }
};
