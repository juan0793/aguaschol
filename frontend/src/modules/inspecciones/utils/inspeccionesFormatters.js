export const MOTIVOS_SUGERIDOS = [
  "Verificación de conexión",
  "Posible irregularidad",
  "Revisión solicitada",
  "Seguimiento de caso"
];

export const ESTADO_LABELS = {
  ASIGNADA: "Asignada",
  EN_PROCESO: "En proceso",
  SEGUIMIENTO: "Seguimiento",
  FINALIZADA: "Finalizada"
};

export const ESTADO_ICONS = {
  ASIGNADA: "clipboard",
  EN_PROCESO: "play",
  SEGUIMIENTO: "flag",
  FINALIZADA: "checkCircle"
};

export const estadoLabel = (estado) => ESTADO_LABELS[estado] || estado || "—";
export const estadoClass = (estado) => `is-${String(estado || "").toLowerCase()}`;

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const printStatusLabel = (status) => (status?.impreso ? "YA IMPRESA" : "NO IMPRESA");

/* --- Resumen ---------------------------------------------------------------- */

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// Abreviaturas fijas: toLocaleDateString("es-HN") devuelve "sept", y la especificación pide "sep".
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const hondurasParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" });

const hondurasDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const [year, month, day] = hondurasParts.format(date).split("-").map(Number);
  return { year, month, day };
};

/** "11 sep 2026", o "11 sep" con `withYear: false`. */
export const formatShortDate = (value, { withYear = true } = {}) => {
  const parts = hondurasDate(value);
  if (!parts) return "—";
  const base = `${parts.day} ${MESES_CORTOS[parts.month - 1]}`;
  return withYear ? `${base} ${parts.year}` : base;
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** "2026-09" -> "Septiembre 2026" (o "Sep 2026" con `short`). */
export const monthLabel = (mes, { short = false } = {}) => {
  const [year, month] = String(mes || "").split("-").map(Number);
  if (!year || !month) return "";
  return `${capitalize((short ? MESES_CORTOS : MESES)[month - 1])} ${year}`;
};

export const monthName = (mes) => MESES[Number(String(mes || "").split("-")[1]) - 1] || "";

/** "2026-09-01".."2026-09-16" -> "Del 1 al 16 de septiembre". */
export const rangoLabel = (rango) => {
  if (!rango?.desde || !rango?.hasta) return "";
  const [, month, dayFrom] = rango.desde.split("-").map(Number);
  const dayTo = Number(rango.hasta.split("-")[2]);
  return `Del ${dayFrom} al ${dayTo} de ${MESES[month - 1]}`;
};

/** Los últimos 12 meses terminando en `mesActual`, del más reciente al más antiguo. */
export const lastMonths = (mesActual, count = 12) => {
  const [year, month] = String(mesActual || "").split("-").map(Number);
  if (!year || !month) return [];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
};

const LOWERCASE_PARTICLES = new Set(["de", "del", "la", "las", "los", "y"]);
/** "ADOLFO FLORES GOMEZ" -> "Adolfo Flores Gomez". Un texto que ya mezcla mayúsculas y
 *  minúsculas ("Inspección general de la clave") se respeta tal cual. */
export const titleCase = (value) => {
  const text = String(value || "").trim();
  const isMixed = text !== text.toLocaleUpperCase("es") && text !== text.toLocaleLowerCase("es");
  return isMixed ? text : toTitle(text);
};
const toTitle = (text) =>
  text
    .toLocaleLowerCase("es")
    .split(/(\s+)/)
    .map((word, index) => (index > 0 && LOWERCASE_PARTICLES.has(word) ? word : word.charAt(0).toLocaleUpperCase("es") + word.slice(1)))
    .join("");

export const initial = (value) => String(value || "").trim().charAt(0).toLocaleUpperCase("es") || "?";

export const pluralDias = (dias) => (dias === 1 ? "1 día" : `${dias} días`);
export const antiguedadLabel = (dias) => (dias == null ? "—" : dias === 0 ? "hoy" : pluralDias(dias));
export const antiguedadLargaLabel = (dias) => (dias == null ? "" : dias === 0 ? "hoy" : `hace ${pluralDias(dias)}`);

// Umbrales propuestos en la especificación (pendientes de confirmar con el equipo):
// gris hasta 2 días, naranja de 3 a 6, rojo desde 7.
export const ANTIGUEDAD_UMBRALES = { atencion: 3, atrasada: 7 };
export const antiguedadTone = (dias) => {
  if (dias == null || dias < ANTIGUEDAD_UMBRALES.atencion) return "is-reciente";
  return dias < ANTIGUEDAD_UMBRALES.atrasada ? "is-atencion" : "is-atrasada";
};

/** Filtros de la bandeja; la clave es la que va en la URL (?estado=proceso). */
export const BANDEJA_FILTROS = [
  { key: "", estado: "", label: "Todas" },
  { key: "asignadas", estado: "ASIGNADA", label: "Asignadas" },
  { key: "proceso", estado: "EN_PROCESO", label: "En proceso" },
  { key: "seguimiento", estado: "SEGUIMIENTO", label: "Seguimiento" }
];

export const BANDEJA_VACIA = {
  "": { icon: "checkCircle", title: "Todo al día", text: "No hay inspecciones que requieran acción." },
  asignadas: { icon: "clipboard", title: "Sin inspecciones asignadas", text: "Todo lo asignado ya está en marcha." },
  proceso: { icon: "play", title: "Nada en proceso", text: "Cuando un técnico inicie una inspección en campo aparecerá aquí." },
  seguimiento: { icon: "flag", title: "Sin seguimientos pendientes", text: "Las inspecciones que necesiten una segunda visita aparecerán aquí." }
};

/** Texto de un evento de historial_estados para "Actividad reciente". */
export const actividadTexto = (evento) => {
  switch (evento.estado_nuevo) {
    case "ASIGNADA":
      return evento.tecnico_responsable_nombre ? `asignada a ${evento.tecnico_responsable_nombre}` : "creada";
    case "EN_PROCESO":
      return evento.estado_anterior === "SEGUIMIENTO" ? "retomada en campo" : "iniciada en campo";
    case "SEGUIMIENTO":
      return "pasó a seguimiento";
    case "FINALIZADA":
      return "finalizada";
    default:
      return estadoLabel(evento.estado_nuevo).toLowerCase();
  }
};
