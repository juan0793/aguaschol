import { MAP_POINT_TYPES } from "../constants/formsAndUi.js";

export const deriveMapPointZone = (point = {}) => {
  const source = String(point.reference_note || point.reference || point.description || "").trim();
  if (!source) return "Zona no especificada";

  const normalized =
    source
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean)[0] || source;

  const firstSegment = normalized.split(/\s+[|-]\s+|[;|]/)[0]?.trim() || normalized;
  return firstSegment.slice(0, 96);
};

export const getMapPointContextKey = (point = {}) => {
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
};

export const formatCoordinate = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : "--";
};

export const buildMapReportDraftFromPoint = (point = {}) => ({
  latitude: Number(point.latitude).toFixed(6),
  longitude: Number(point.longitude).toFixed(6),
  accuracy_meters: point.accuracy_meters ?? "",
  point_type: point.point_type || "caja_registro",
  description: point.description || "",
  reference: point.reference_note || "",
  marker_color: point.marker_color || "#1576d1",
  is_terminal_point: Boolean(point.is_terminal_point)
});

export const buildExternalMapUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;

export const getMapPointTypeLabel = (value) =>
  MAP_POINT_TYPES.find((option) => option.value === value)?.label ?? "Punto de campo";
