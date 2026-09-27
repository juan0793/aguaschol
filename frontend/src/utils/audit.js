// La auditoria se lee siempre en hora de Honduras: agrupar por la fecha local del
// navegador movia eventos de la noche al dia siguiente y desalineaba la hora del
// evento con la marca completa que imprime formatDateTime.
export const AUDIT_TIME_ZONE = "America/Tegucigalpa";

export const auditDayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AUDIT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export const auditDayLabelFormatter = new Intl.DateTimeFormat("es-HN", {
  timeZone: AUDIT_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric"
});

export const auditTimeFormatter = new Intl.DateTimeFormat("es-HN", {
  timeZone: AUDIT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export const groupAuditLogsByDay = (logs) => {
  const groups = new Map();
  logs.forEach((log) => {
    const date = new Date(log.created_at);
    const key = Number.isNaN(date.getTime()) ? "sin-fecha" : auditDayKeyFormatter.format(date);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key === "sin-fecha" ? "Sin fecha" : auditDayLabelFormatter.format(date),
        logs: []
      });
    }
    groups.get(key).logs.push(log);
  });
  return [...groups.values()];
};

export const EMPTY_AUDIT_FILTERS = {
  action: "",
  entity_type: "",
  actor: "",
  search: "",
  date_from: "",
  date_to: ""
};

export const AUDIT_FILTER_KEYS = Object.keys(EMPTY_AUDIT_FILTERS);

export const AUDIT_ACTION_OPTIONS = [
  { value: "auth.login", label: "Inicio de sesion" },
  { value: "auth.logout", label: "Cierre de sesion" },
  { value: "user.created", label: "Usuario creado" },
  { value: "padron.updated", label: "Padron actualizado" },
  { value: "inmueble.created", label: "Ficha creada" },
  { value: "inmueble.updated", label: "Ficha actualizada" },
  { value: "inmueble.archived", label: "Ficha archivada" },
  { value: "inmueble.restored", label: "Ficha restaurada" },
  { value: "inmueble.deleted", label: "Ficha eliminada" },
  { value: "report.generated", label: "Reporte generado" }
];

export const AUDIT_ENTITY_OPTIONS = [
  { value: "user", label: "Usuario" },
  { value: "inmueble", label: "Ficha" },
  { value: "padron", label: "Padron" },
  { value: "report", label: "Reporte" }
];

// Cada familia de eventos toma un acento propio para leer el stream de un vistazo
// sin tener que detenerse a leer la etiqueta.
export const auditActionTone = (action = "") => {
  if (action.startsWith("auth.")) return "auth";
  if (action.startsWith("user.")) return "user";
  if (action.startsWith("padron.")) return "padron";
  if (action.startsWith("report.")) return "report";
  if (action.startsWith("map_point.") || action.startsWith("transport.")) return "field";
  if (action.startsWith("inmueble.")) return "record";
  return "system";
};

export const formatAuditTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : auditTimeFormatter.format(date);
};

// El encabezado del dia gana un "Hoy"/"Ayer" para ubicarse sin leer la fecha completa.
export const auditRelativeDayLabel = (key) => {
  if (key === "sin-fecha") return "";
  const today = new Date();
  if (key === auditDayKeyFormatter.format(today)) return "Hoy";
  const yesterday = new Date(today.getTime() - 86400000);
  return key === auditDayKeyFormatter.format(yesterday) ? "Ayer" : "";
};
