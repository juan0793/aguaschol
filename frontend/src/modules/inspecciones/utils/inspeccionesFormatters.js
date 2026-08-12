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
