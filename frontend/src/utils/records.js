import { emptyForm } from "../constants/formsAndUi.js";
import {
  addBusinessDays,
  countBusinessDaysBetween,
  formatSpanishDate,
  normalizeAlertDate,
  normalizeDateField
} from "./datesAndBusiness.js";

export const hasDraftContent = (candidate) =>
  Object.entries(emptyForm).some(([key, defaultValue]) => {
    if (["id", "foto_path"].includes(key)) return false;
    return (candidate?.[key] ?? "") !== defaultValue;
  });

export const getRecordValidationIssues = (form = {}, hasExistingPhoto = false, selectedFile = null) => {
  const issues = [];

  if (!String(form.clave_catastral || "").trim()) {
    issues.push({ field: "clave_catastral", section: "abonado", text: "Falta la clave catastral." });
  }

  if (
    !String(form.abonado || "").trim() &&
    !String(form.nombre_catastral || "").trim() &&
    !String(form.inquilino || "").trim()
  ) {
    issues.push({ field: "abonado", section: "abonado", text: "Agrega al menos abonado, catastral o inquilino." });
  }

  if (!String(form.barrio_colonia || "").trim()) {
    issues.push({ field: "barrio_colonia", section: "abonado", text: "Falta barrio, colonia o lotificacion." });
  }

  if (String(form.accion_inspeccion || "").trim().length < 12) {
    issues.push({ field: "accion_inspeccion", section: "inmueble", text: "Describe mejor la inspeccion del inmueble." });
  }

  if (!String(form.fecha_aviso || "").trim()) {
    issues.push({ field: "fecha_aviso", section: "aviso", text: "Selecciona la fecha del aviso." });
  }

  if (!String(form.levantamiento_datos || "").trim()) {
    issues.push({ field: "levantamiento_datos", section: "aviso", text: "Indica quien levanto los datos." });
  }

  if (!String(form.analista_datos || "").trim()) {
    issues.push({ field: "analista_datos", section: "aviso", text: "Indica el analista de datos." });
  }

  if (!hasExistingPhoto && !selectedFile) {
    issues.push({ field: "foto_path", section: "aviso", text: "Conviene adjuntar una fotografia antes de guardar." });
  }

  return issues;
};

export const getRecordDeadlineMeta = (record = {}, referenceDate = new Date()) => {
  if (!record || record.archived_at) return null;

  const sourceDate = record.created_at || record.fecha_aviso || record.updated_at;
  const createdDate = normalizeAlertDate(sourceDate);
  if (!createdDate) return null;

  const deadlineDate = addBusinessDays(createdDate, 7);
  const today = normalizeAlertDate(referenceDate);
  if (!deadlineDate || !today) return null;

  const delta = countBusinessDaysBetween(today, deadlineDate);

  if (delta < 0) {
    return {
      tone: "is-overdue",
      label: "Vencida",
      helper: `${Math.abs(delta)} dias habiles vencidos`,
      deadlineLabel: formatSpanishDate(deadlineDate),
      icon: "activity",
      statusKey: "overdue"
    };
  }

  if (delta === 0) {
    return {
      tone: "is-due",
      label: "Vence hoy",
      helper: "Ultimo dia habil",
      deadlineLabel: formatSpanishDate(deadlineDate),
      icon: "warning",
      statusKey: "due"
    };
  }

  if (delta <= 2) {
    return {
      tone: "is-warning",
      label: "En alerta",
      helper: `${delta} dias habiles restantes`,
      deadlineLabel: formatSpanishDate(deadlineDate),
      icon: "warning",
      statusKey: "warning"
    };
  }

  return {
    tone: "is-on-track",
    label: "En plazo",
    helper: `${delta} dias habiles restantes`,
    deadlineLabel: formatSpanishDate(deadlineDate),
    icon: "success",
    statusKey: "on_track"
  };
};

export const getRecordGroupDate = (record, recordView) =>
  recordView === "archived"
    ? record?.archived_at || record?.updated_at || record?.created_at
    : record?.updated_at || record?.created_at || record?.fecha_aviso;

export const comparableFormShape = (candidate = {}) => ({
  clave_catastral: candidate.clave_catastral ?? "",
  abonado: candidate.abonado ?? "",
  nombre_catastral: candidate.nombre_catastral ?? "",
  inquilino: candidate.inquilino ?? "",
  barrio_colonia: candidate.barrio_colonia ?? "",
  identidad: candidate.identidad ?? "",
  telefono: candidate.telefono ?? "",
  accion_inspeccion: candidate.accion_inspeccion ?? "",
  situacion_inmueble: candidate.situacion_inmueble ?? "",
  tendencia_inmueble: candidate.tendencia_inmueble ?? "",
  uso_suelo: candidate.uso_suelo ?? "",
  actividad: candidate.actividad ?? "",
  codigo_sector: candidate.codigo_sector ?? "",
  comentarios: candidate.comentarios ?? "",
  estado_padron: candidate.estado_padron ?? "clandestino",
  clave_alcaldia: candidate.clave_alcaldia ?? "",
  nombre_alcaldia: candidate.nombre_alcaldia ?? "",
  barrio_alcaldia: candidate.barrio_alcaldia ?? "",
  conexion_agua: candidate.conexion_agua ?? "",
  conexion_alcantarillado: candidate.conexion_alcantarillado ?? "",
  recoleccion_desechos: candidate.recoleccion_desechos ?? "",
  fecha_aviso: normalizeDateField(candidate.fecha_aviso ?? ""),
  firmante_aviso: candidate.firmante_aviso ?? "",
  cargo_firmante: candidate.cargo_firmante ?? "",
  levantamiento_datos: candidate.levantamiento_datos ?? "",
  analista_datos: candidate.analista_datos ?? ""
});
