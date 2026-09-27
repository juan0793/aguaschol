import { formatDateTime, formatSpanishDate } from "./datesAndBusiness";

export const getPadronStatusLabel = (status) => {
  if (status === "varios_padrones") return "Varios padrones";
  if (status === "reportada") return "Impresa";
  return "Clandestina";
};

export const clampPrintCopies = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(5, Math.max(0, parsed));
};

export const getRecordPhotoPath = (record) =>
  record?.foto_path || record?.foto_url || record?.fotografia || record?.photo_path || "";

export const getRecordDisplayName = (record, alcaldiaMatch = null) => {
  const doesNotAppearInAguas = ["clandestino", "reportada"].includes(record?.estado_padron || "clandestino");
  const recordKey = String(record?.clave_catastral || "").trim();
  const candidates = doesNotAppearInAguas
    ? [alcaldiaMatch?.nombre, record?.nombre_alcaldia, record?.abonado, record?.nombre_catastral, record?.inquilino]
    : [record?.abonado, record?.nombre_catastral, record?.inquilino, alcaldiaMatch?.nombre, record?.nombre_alcaldia];
  const name = candidates.find((value) => {
    const cleanValue = String(value || "").trim();
    return cleanValue && cleanValue !== recordKey;
  });
  return name || "--";
};

export const getRecordAguasPresenceLabel = (record) => {
  if (record?.estado_padron === "varios_padrones") return "Si aparece en Aguas";
  if (["clandestino", "reportada"].includes(record?.estado_padron || "clandestino")) return "No aparece en Aguas";
  return "Pendiente de validar";
};

export const getRecordFichaDateLabel = (record) =>
  formatSpanishDate(record?.created_at || record?.fecha_ficha || record?.fecha_registro || record?.fecha_aviso || record?.updated_at);

export const getRecordPrintedDateLabel = (record) => formatDateTime(record?.printed_at);
