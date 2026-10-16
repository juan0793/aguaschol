// Arma los datos del informe de campo (zonas, totales por tipo) a partir de los puntos
// de una jornada. Es puro para poder usarlo con la jornada activa y con otras jornadas
// que se juntan en un mismo informe.
import { getMapPointContextKey, getMapPointTypeLabel } from "../../../utils/mapField";
import {
  getMapReportBarrioZone,
  getMapReportPointClave,
  getMapReportZoneOverrideKey,
  getMapZoneClavesLabel
} from "../../../utils/mapReport";

export const buildMapReportData = ({ points = [], contexts = {}, barrioCodes = [] } = {}) => {
  const sorted = [...points].sort((left, right) => {
    const leftZone = getMapReportBarrioZone(left, contexts[getMapPointContextKey(left)] ?? null, barrioCodes);
    const rightZone = getMapReportBarrioZone(right, contexts[getMapPointContextKey(right)] ?? null, barrioCodes);
    const zoneDiff = leftZone.localeCompare(rightZone, "es");
    if (zoneDiff !== 0) return zoneDiff;
    return new Date(right.created_at) - new Date(left.created_at);
  });

  const zoneMap = new Map();
  const totalsByType = sorted.reduce((totals, point) => {
    const typeLabel = getMapPointTypeLabel(point.point_type);
    totals[typeLabel] = (totals[typeLabel] ?? 0) + 1;
    return totals;
  }, {});

  sorted.forEach((point) => {
    const context = contexts[getMapPointContextKey(point)] ?? null;
    const zone = getMapReportBarrioZone(point, context, barrioCodes);
    const pointClave = getMapReportPointClave(point, context);
    const current = zoneMap.get(zone) ?? {
      zone,
      total: 0,
      items: [],
      accuracyValues: [],
      pointTypes: new Set(),
      claves: new Set(),
      nearbyReferences: new Set(),
      locationHints: new Set()
    };

    current.total += 1;
    if (pointClave) current.claves.add(pointClave);
    current.items.push({
      ...point,
      report_key: pointClave,
      report_zone_label: pointClave ? `${zone} | Clave ${pointClave}` : zone,
      suggested_zone: zone,
      suggested_reference: context?.reference || "",
      suggested_display_name: context?.display_name || ""
    });
    current.pointTypes.add(getMapPointTypeLabel(point.point_type));
    if (context?.reference) current.nearbyReferences.add(context.reference);
    if (context?.display_name) current.locationHints.add(context.display_name);
    if (Number.isFinite(Number(point.accuracy_meters))) current.accuracyValues.push(Number(point.accuracy_meters));
    zoneMap.set(zone, current);
  });

  const zones = Array.from(zoneMap.values()).map((zone) => ({
    ...zone,
    averageAccuracy: zone.accuracyValues.length
      ? Number((zone.accuracyValues.reduce((sum, value) => sum + value, 0) / zone.accuracyValues.length).toFixed(1))
      : null,
    pointTypesLabel: Array.from(zone.pointTypes).join(", "),
    clavesLabel: getMapZoneClavesLabel(zone),
    clavesTotal: zone.claves.size,
    nearbyReferencesLabel: Array.from(zone.nearbyReferences).slice(0, 3).join(" | "),
    primaryLocationLabel: Array.from(zone.locationHints)[0] || ""
  }));

  return { totalPoints: sorted.length, totalZones: zones.length, totalsByType, zones };
};

// Nombres, referencias y ubicación que la oficina corrigió a mano para cada barrio.
// Se guardan por nombre de barrio, así que valen para cualquier jornada.
export const applyMapReportZoneOverrides = (data, settings = {}) => {
  const manualBarrio = String(settings.manual_barrio || "").trim();
  return {
    ...data,
    zones: data.zones.map((zone, index) => {
      const overrideKey = getMapReportZoneOverrideKey(zone.zone);
      const override = settings.zone_overrides?.[overrideKey] ?? {};
      const displayName = String(override.name || manualBarrio || zone.zone || "").trim() || zone.zone;
      const displayKicker = String(override.kicker || `Zona ${index + 1}`).trim() || `Zona ${index + 1}`;
      const displayReference = String(override.reference || zone.nearbyReferencesLabel || "").trim() || zone.nearbyReferencesLabel;
      const displayLocation =
        String(override.location || settings.manual_location || zone.primaryLocationLabel || "").trim() || zone.primaryLocationLabel;
      return {
        ...zone,
        overrideKey,
        displayKicker,
        displayName,
        displayReference,
        displayLocation,
        items: zone.items.map((point) => ({ ...point, report_zone_label: displayName }))
      };
    })
  };
};
