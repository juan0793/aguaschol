import { COMMERCIAL_MAP_POINT_COLOR } from "../../constants/formsAndUi.js";

export const FIELD_MAP_MODES = [
  { id: "tipo", label: "Tipo de punto" },
  { id: "cartera", label: "Cartera" },
  { id: "tecnico", label: "Técnico" },
  { id: "precision", label: "Precisión GPS" },
  { id: "validacion", label: "Validación" },
  { id: "jornada", label: "Jornada" },
  { id: "servicios", label: "Servicios" },
  { id: "comercial", label: "Comercial" }
];

const PALETTE = ["#1576d1", "#7c3aed", "#0891b2", "#16a34a", "#d97706", "#db2777", "#475569"];
const hashColor = (value = "") => {
  const hash = String(value).split("").reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);
  return PALETTE[hash % PALETTE.length];
};

const debtColor = (debt) => {
  const value = Number(debt) || 0;
  if (value <= 0) return "#94a3b8";
  if (value <= 5000) return "#22c55e";
  if (value <= 15000) return "#eab308";
  if (value <= 50000) return "#f97316";
  return "#7f1d1d";
};

export const resolveMarkerColor = (point = {}, mode = "tipo", analyticsPoint = {}) => {
  if (mode === "tipo") return point.marker_color || "#1576d1";
  if (mode === "cartera") return debtColor(analyticsPoint.debt);
  if (mode === "tecnico") return hashColor(point.created_by ?? point.created_by_name ?? point.created_by_username ?? "Sin técnico");
  if (mode === "jornada") return hashColor(String(point.diary_date || point.created_at || "Sin jornada").slice(0, 10));
  if (mode === "precision") return ({ excelente: "#15803d", buena: "#22c55e", aceptable: "#eab308", baja: "#f97316", deficiente: "#dc2626", sin_dato: "#64748b" })[analyticsPoint.accuracyBucket] || "#64748b";
  if (mode === "validacion") return ({ approved: "#16a34a", corrected: "#0891b2", needs_correction: "#f97316", pending: "#64748b" })[point.validation_status || "pending"] || "#64748b";
  if (mode === "servicios") {
    if (!analyticsPoint.accounts) return "#64748b";
    if (analyticsPoint.water && analyticsPoint.sewer) return "#16a34a";
    if (analyticsPoint.water || analyticsPoint.sewer) return "#eab308";
    return "#dc2626";
  }
  if (mode === "comercial") return analyticsPoint.business ? COMMERCIAL_MAP_POINT_COLOR : "#1576d1";
  return point.marker_color || "#1576d1";
};

const item = (label, color) => ({ label, color });
export const buildLegend = (mode = "tipo", analytics = {}) => {
  if (mode === "cartera") return [item("Sin deuda", "#94a3b8"), item("Deuda L 1–5,000", "#22c55e"), item("Deuda L 5,001–15,000", "#eab308"), item("Deuda L 15,001–50,000", "#f97316"), item("Deuda mayor a L 50,000", "#7f1d1d")];
  if (mode === "precision") return [item("Excelente (≤5 m)", "#15803d"), item("Buena (≤10 m)", "#22c55e"), item("Aceptable (≤20 m)", "#eab308"), item("Baja (≤30 m)", "#f97316"), item("Deficiente (>30 m)", "#dc2626"), item("Sin dato", "#64748b")];
  if (mode === "validacion") return [item("Aprobado", "#16a34a"), item("Corregido", "#0891b2"), item("Necesita corrección", "#f97316"), item("Pendiente", "#64748b")];
  if (mode === "servicios") return [item("Agua y alcantarillado", "#16a34a"), item("Un servicio", "#eab308"), item("Sin servicios", "#dc2626"), item("Sin abonado", "#64748b")];
  if (mode === "comercial") return [item("Negocio / local comercial", COMMERCIAL_MAP_POINT_COLOR), item("Otros puntos", "#1576d1")];
  if (mode === "tecnico") return (analytics.technicians || []).map((row) => item(row.name, hashColor(row.id ?? row.name)));
  if (mode === "jornada") {
    const dates = Array.from(new Set((analytics.points || []).map((point) => point.date).filter(Boolean)));
    return dates.map((date) => item(date, hashColor(date)));
  }
  return [item("Color registrado del tipo de punto", "#1576d1"), item("Negocio / local comercial", COMMERCIAL_MAP_POINT_COLOR)];
};
