import {
  ALERT_MAP_POINT_COLOR,
  ALERT_MAP_POINT_TYPE,
  COMMERCIAL_MAP_POINT_COLOR,
  COMMERCIAL_MAP_POINT_TYPE,
  defaultMapReportSettings,
  defaultMapReportStaff
} from "../constants/formsAndUi";
import {
  FIELD_DEBT_SERVICE_DEFINITIONS,
  extractFieldDebtLookupReferences,
  getFieldDebtServiceShortLabels
} from "./fieldDebt";
import { MAP_REPORT_SETTINGS_STORAGE_KEY } from "../constants/storageKeys";
import { deriveMapPointZone, getMapPointTypeLabel } from "./mapField";
import { escapeHtml } from "./html";
import { extractClaveFromText, getBarrioNameFromClave } from "./barrioCodes";
import { getMapDiaryDateKey } from "./datesAndBusiness";
import { stripServicesFromDescription } from "../modules/reports/utils/reportSelectors";

export const REPORT_POINT_DANGER_RGB = [220, 38, 38];

export const REPORT_POINT_DANGER_FILL_RGB = [254, 242, 242];

export const REPORT_POINT_DANGER_BORDER_RGB = [248, 113, 113];

export const REPORT_POINT_ALERT_RGB = [146, 64, 14];

export const REPORT_POINT_ALERT_FILL_RGB = [255, 251, 235];

export const REPORT_POINT_ALERT_BORDER_RGB = [245, 158, 11];

export const isRedReportPoint = (point = {}) =>
  point.point_type === COMMERCIAL_MAP_POINT_TYPE ||
  String(point.marker_color || "").trim().toLowerCase() === COMMERCIAL_MAP_POINT_COLOR;

export const isAlertReportPoint = (point = {}) =>
  point.point_type === ALERT_MAP_POINT_TYPE ||
  String(point.marker_color || "").trim().toLowerCase() === ALERT_MAP_POINT_COLOR;

export const getDefaultMapPointColor = (pointType = "", fallback = "#1576d1") => {
  if (pointType === COMMERCIAL_MAP_POINT_TYPE) return COMMERCIAL_MAP_POINT_COLOR;
  if (pointType === ALERT_MAP_POINT_TYPE) return ALERT_MAP_POINT_COLOR;
  return fallback;
};

export const getReportPointRowClassName = (point = {}, baseClassName = "") =>
  [
    baseClassName,
    isRedReportPoint(point) ? "is-red-report-point" : "",
    isAlertReportPoint(point) ? "is-alert-report-point" : ""
  ].filter(Boolean).join(" ");

export const getMapReportZoneOverrideKey = (zoneName) => String(zoneName || "Zona no especificada").trim() || "Zona no especificada";

export const getMapReportTechnicians = (staff) => {
  const names = Array.isArray(staff?.field_technician_names)
    ? staff.field_technician_names
    : [staff?.field_technicians, staff?.field_technician_secondary];
  const normalizedNames = names.map((name) => String(name ?? "").trim());
  return normalizedNames.length ? normalizedNames : [""];
};

export const normalizeMapReportStaff = (staff) => {
  const technicians = getMapReportTechnicians(staff);
  return {
    ...defaultMapReportStaff,
    ...(staff && typeof staff === "object" ? staff : {}),
    field_technician_names: technicians.length ? technicians : [""],
    field_technicians: technicians[0] ?? "",
    field_technician_secondary: technicians[1] ?? ""
  };
};

export const buildMapReportStaffMarkup = (staff) => {
  const normalizedStaff = normalizeMapReportStaff(staff);
  return `
    <div class="field-report-staff">
      ${normalizedStaff.field_technician_names
        .map(
          (name, index) => `
            <div>
              <strong>Tecnico de campo ${index + 1}</strong>
              <span>${escapeHtml(name || "--")}</span>
            </div>
          `
        )
        .join("")}
      <div>
        <strong>Ingeniero de datos</strong>
        <span>${escapeHtml(normalizedStaff.data_engineer || "--")}</span>
      </div>
    </div>
  `;
};

export const getMapReportTechniciansLabel = (staff) => {
  const names = getMapReportTechnicians(staff).filter(Boolean);
  return names.length ? names.join(" / ") : "--";
};

export const getMapReportBarrioZone = (point = {}, context = null, barrios = []) => {
  const rawZone = String(context?.zone || deriveMapPointZone(point) || "").trim();
  const source = [
    rawZone,
    point.reference_note,
    point.reference,
    point.description
  ].filter(Boolean).join(" ");
  const clave = extractClaveFromText(source);
  const barrio = getBarrioNameFromClave(clave, barrios);

  if (!barrio) {
    return rawZone || "Zona no especificada";
  }

  const prefix = String(clave || "").split("-").filter(Boolean)[0] || "";
  return `${prefix} - ${barrio}`;
};

export const getMapReportPointClave = (point = {}, context = null) =>
  extractClaveFromText(
    [
      context?.zone,
      point.reference_note,
      point.reference,
      point.description
    ].filter(Boolean).join(" ")
  );


export const getMapZoneClavesLabel = (zone = {}) => Array.from(zone.claves || []).join(", ");

export const MAP_REPORT_SERVICE_LEGEND = "Servicios activos extraídos de la descripción de campo";

export const getMapPointPadronNames = (point = {}, nameIndex = new Map()) =>
  Array.from(
    new Set(
      extractFieldDebtLookupReferences(
        [point.report_key, point.reference_note, point.reference, point.description].filter(Boolean).join("\n")
      )
        .map((reference) => nameIndex.get(reference.key))
        .filter(Boolean)
    )
  ).join(", ") || "--";

export const getMapPointReportReferenceLabel = (point = {}) =>
  extractFieldDebtLookupReferences(
    [point.report_key, point.reference_note, point.reference, point.description].filter(Boolean).join("\n")
  )
    .map((reference) => reference.label)
    .join(", ") || point.report_key || "--";

export const getMapReportTypeChartRows = (reportData = {}, limit = 6) =>
  Object.entries(reportData.totalsByType || {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);

export const buildMapReportTypeChartMarkup = (reportData = {}) => {
  const rows = getMapReportTypeChartRows(reportData);
  const max = Math.max(1, ...rows.map(([, total]) => Number(total || 0)));
  return rows.length
    ? `<section class="map-report-chart"><h2>Distribución de puntos</h2>${rows
        .map(
          ([label, total]) =>
            `<div><span>${escapeHtml(label)}</span><i><b style="width:${Math.max(5, (Number(total || 0) / max) * 100)}%"></b></i><strong>${total}</strong></div>`
        )
        .join("")}</section>`
    : "";
};

export const buildMapReportBriefRows = (reportData = {}, nameIndex = new Map()) => {
  const rows = [];
  (reportData.zones || []).forEach((zone) => {
    const items = zone.items?.length ? zone.items : [null];
    items.forEach((point) => {
      const servicesLabel = point ? getMapPointServicesLabel(point) : getMapZoneServicesLabel(zone);
      rows.push([
        String(rows.length + 1),
        zone.displayName || zone.zone || "--",
        point ? getMapPointReportReferenceLabel(point) : "--",
        point ? getMapPointPadronNames(point, nameIndex) : "--",
        point ? getMapPointTypeLabel(point.point_type) : zone.pointTypesLabel || "--",
        point ? getMapPointTechnicalDescription(point) || "--" : "--",
        servicesLabel
      ]);
    });
  });
  return rows;
};

export const getMapPointHousingUnits = (point = {}) => {
  const numeric = Math.round(Number(point.housing_units || 1));
  return Number.isFinite(numeric) ? Math.max(1, numeric) : 1;
};

export const normalizeHousingUnitsInput = (value) => {
  const numeric = Math.round(Number(value || 1));
  return Number.isFinite(numeric) ? String(Math.max(1, Math.min(999, numeric))) : "1";
};


export const getMapPointServicesLabel = (point = {}) => {
  const source = `${point.reference_note || ""}\n${point.description || ""}`;
  const activeServices = FIELD_DEBT_SERVICE_DEFINITIONS.filter((service) => {
    return getFieldDebtServiceShortLabels(service).some((label) => {
      const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*S(?:i|\\u00ed)`, "i");
      return pattern.test(source);
    });
  }).map((service) => service.shortLabel);

  return activeServices.length ? activeServices.join(", ") : "Sin servicios activos";
};

export const getMapZoneServicesLabel = (zone = {}) => {
  const services = new Set();
  (zone.items || []).forEach((point) => {
    getMapPointServicesLabel(point)
      .split(",")
      .map((service) => service.trim())
      .filter((service) => service && service !== "--")
      .forEach((service) => services.add(service));
  });
  return services.size ? Array.from(services).join(", ") : "--";
};

export const MAP_DESCRIPTION_PADRON_BLOCK_PATTERN =
  /\n?\s*(?:Datos del padron(?: \([^)]+\))?:\n?)?(?:(?:Abonado|Nombre|Barrio\/colonia|Direccion):.*\n)+Servicios:.*(?=\n{2,}|$)/i;

export const stripMapDescriptionPadronBlock = (value = "") =>
  String(value ?? "").replace(MAP_DESCRIPTION_PADRON_BLOCK_PATTERN, "").trimEnd();

export const getMapPointTechnicalDescription = (point = {}) =>
  stripServicesFromDescription(stripMapDescriptionPadronBlock(point.description || ""));

export const getMapPointReferenceNote = (point = {}) =>
  String(point.reference_note || point.reference || "").trim();

export const normalizeMapReportSettings = (value) => ({
  ...defaultMapReportSettings,
  ...(value && typeof value === "object" ? value : {}),
  zone_overrides: value?.zone_overrides && typeof value.zone_overrides === "object" ? value.zone_overrides : {},
  map_image_data_url: typeof value?.map_image_data_url === "string" ? value.map_image_data_url : "",
  map_image_name: typeof value?.map_image_name === "string" ? value.map_image_name : ""
});

export const stripTransientMapReportSettings = (settings) => {
  const { map_image_data_url, map_image_name, ...settingsToStore } = normalizeMapReportSettings(settings);
  return settingsToStore;
};

export const loadMapReportSettingsByDate = () => {
  const saved = window.localStorage.getItem(MAP_REPORT_SETTINGS_STORAGE_KEY);
  if (!saved) return {};

  try {
    const parsed = JSON.parse(saved);
    if (parsed?.by_date && typeof parsed.by_date === "object") {
      return Object.fromEntries(
        Object.entries(parsed.by_date).map(([dateKey, settings]) => [
          dateKey,
          normalizeMapReportSettings(settings)
        ])
      );
    }

    if (parsed && typeof parsed === "object") {
      return {
        [getMapDiaryDateKey(new Date())]: normalizeMapReportSettings(parsed)
      };
    }
  } catch {
    window.localStorage.removeItem(MAP_REPORT_SETTINGS_STORAGE_KEY);
  }

  return {};
};
