// Cómo se leen los reclamos de entrega en pantalla.
const ZONA = "America/Tegucigalpa";

export const ESTADOS = {
  SIN_RESPUESTA: { label: "Sin respuesta", tono: "ocre" },
  RESPONDIDO: { label: "Respondido", tono: "azul" },
  CERRADO: { label: "Archivado", tono: "verde" }
};

// Un reclamo sin respuesta de más de 3 días ya es atraso real.
export const DIAS_ATRASO = 3;

export const diasDesde = (iso, ahora = Date.now()) => Math.max(0, Math.floor((ahora - Date.parse(iso)) / 86400000));

export const fechaCorta = (valor) => {
  if (!valor) return "";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return fecha.toLocaleDateString("es-HN", { timeZone: ZONA, day: "numeric", month: "long" });
};

export const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString("es-HN", { timeZone: ZONA, day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "";

export function haceCuanto(iso, ahora = Date.now()) {
  const minutos = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60000));
  if (!Number.isFinite(minutos)) return "";
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

// Periodo del archivo en hora de Honduras: "2026-10-15", "2026-10" o "2026".
const PARTES_HN = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
export const periodoHn = (iso, agrupar = "dia") => {
  if (!iso) return "";
  const dia = PARTES_HN.format(new Date(iso));
  return agrupar === "anio" ? dia.slice(0, 4) : agrupar === "mes" ? dia.slice(0, 7) : dia;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const tituloPeriodo = (periodo, agrupar = "dia") => {
  const [anio, mes, dia] = String(periodo).split("-");
  if (agrupar === "anio") return anio;
  if (agrupar === "mes") return `${MESES[Number(mes) - 1]} de ${anio}`;
  const hoy = periodoHn(new Date().toISOString());
  const ayer = periodoHn(new Date(Date.now() - 86400000).toISOString());
  const fecha = `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${anio}`;
  return periodo === hoy ? `Hoy · ${fecha}` : periodo === ayer ? `Ayer · ${fecha}` : fecha;
};

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export const documentos = (cantidad, tipo) =>
  tipo === "NOTA_COBRO" ? plural(cantidad, "nota de cobro", "notas de cobro") : plural(cantidad, "factura", "facturas");

// De dónde sale el técnico: el lote del ciclo, el reparto o la oficina.
export const origenTexto = ({ origen, lote } = {}) => {
  if (origen === "LOTE" && lote) return `Lote #${lote.id} del ${fechaCorta(lote.fecha)}${lote.estado === "ABIERTO" ? ", todavía abierto" : ""}`;
  if (origen === "REPARTO") return "Por el reparto: el barrio no tiene lote en este ciclo";
  if (origen === "OFICINA") return "Asignado por la oficina";
  return "Nadie tiene este barrio en el reparto";
};

export const inicial = (nombre = "") => String(nombre).trim().charAt(0).toUpperCase() || "?";

export const nombrePropio = (texto = "") =>
  String(texto).toLowerCase().replace(/(^|[\s.-])(\p{L})/gu, (_, borde, letra) => borde + letra.toUpperCase());

// Borrador de la respuesta, por usuario y reclamo: si falla el envío o se recarga la
// pestaña, lo escrito no se pierde (sessionStorage no sale de esta pestaña).
const llaveBorrador = (userId, reclamoId) => `aguaschol:reclamo-respuesta:${userId}:${reclamoId}`;
export const leerBorrador = (userId, reclamoId) => {
  try { return window.sessionStorage.getItem(llaveBorrador(userId, reclamoId)) || ""; } catch { return ""; }
};
export const guardarBorrador = (userId, reclamoId, texto) => {
  try {
    if (texto) window.sessionStorage.setItem(llaveBorrador(userId, reclamoId), texto);
    else window.sessionStorage.removeItem(llaveBorrador(userId, reclamoId));
  } catch { /* sin almacenamiento: el texto sigue en pantalla */ }
};

// Sin señal, fetch falla con un TypeError en inglés ("Failed to fetch"); se dice en
// palabras del equipo.
export const SIN_CONEXION = "Sin conexión. Se cargará cuando vuelva la señal.";
export const textoError = (error, sinRed = SIN_CONEXION) =>
  error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error?.message || "") ? sinRed : error?.message || "Algo falló.";

export const leerJson = async (response, mensaje) => {
  const cuerpo = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(cuerpo.message || mensaje);
  return cuerpo;
};
