// Formateadores de presentacion del modulo Control de Entregas.

export const TIPO_DOCUMENTO_LABELS = {
  FACTURA: "Factura",
  NOTA_COBRO: "Nota de cobro"
};

export const ESTADO_LOTE_LABELS = {
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
  REVISADO: "Revisado"
};

export const ESTADO_NO_ENTREGADA_LABELS = {
  PENDIENTE: "Pendiente",
  REENTREGADA: "Reentregada",
  NO_LOCALIZADA: "No localizada",
  CANCELADA: "Cancelada"
};

export const RESULTADO_INTENTO_LABELS = {
  SIN_RESPUESTA: "Sin respuesta",
  CASA_CERRADA: "Casa cerrada",
  NO_LOCALIZADO: "No localizado",
  ENTREGADO: "Entregado",
  OTRO: "Otro"
};

export const TIPO_PERSONAL_LABELS = {
  TECNICO: "Técnico",
  COBRADOR: "Cobrador",
  ENTREGA_FACTURAS: "Entrega de facturas",
  OTRO: "Otro"
};

export const ESTADO_REPORTE_LABELS = {
  GENERADO: "Generado",
  CORREGIDO: "Corregido",
  ANULADO: "Anulado"
};

export const tipoDocumentoLabel = (value) => TIPO_DOCUMENTO_LABELS[value] || value || "—";
export const estadoLoteLabel = (value) => ESTADO_LOTE_LABELS[value] || value || "—";
export const estadoDocumentoLabel = (value) => ESTADO_NO_ENTREGADA_LABELS[value] || value || "—";
export const resultadoIntentoLabel = (value) => RESULTADO_INTENTO_LABELS[value] || value || "—";
export const tipoPersonalLabel = (value) => TIPO_PERSONAL_LABELS[value] || value || "—";
export const estadoReporteLabel = (value) => ESTADO_REPORTE_LABELS[value] || value || "—";

export const estadoClass = (value) => `is-${String(value || "").toLowerCase()}`;

export const formatNumber = (value) => Number(value || 0).toLocaleString("es-HN");

export const formatPercent = (value) => `${(Number(value) || 0).toFixed(1)}%`;

export const formatDate = (value) => {
  if (!value) return "—";
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year}`;
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const formatDayLabel = (value) => {
  const iso = String(value || "").slice(0, 10);
  const [year, month, day] = iso.split("-").map(Number);
  if (!year) return "—";
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("es-HN", { weekday: "short", day: "2-digit", timeZone: "UTC" });
};

// Tono visual por antiguedad del pendiente (sobrio: ambar y rojo solo cuando toca).
export const prioridadPendiente = (dias = 0, intentos = 0) => {
  if (Number(dias) > 7) return "is-critico";
  if (Number(dias) > 3 || Number(intentos) >= 2) return "is-atencion";
  return "";
};
