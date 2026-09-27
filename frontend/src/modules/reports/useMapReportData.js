import { useMemo } from "react";
import { FIELD_DEBT_SERVICE_DEFINITIONS, getFieldDebtResultLabel } from "../../utils/fieldDebt";
import { formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import { getMapPointContextKey, getMapPointTypeLabel } from "../../utils/mapField";
import {
  getMapReportBarrioZone,
  getMapReportPointClave,
  getMapReportZoneOverrideKey,
  getMapZoneClavesLabel
} from "../../utils/mapReport";
import { selectReportZones } from "./utils/reportSelectors";

export function useMapReportData({
  fieldDebtReport,
  mapDiaryGroups,
  mapPointContexts,
  mapReportPage,
  mapReportSettings,
  safeBarrioCodes,
  visibleMapPoints
}) {
  const mapReportData = useMemo(() => {
    try {
      const points = [...visibleMapPoints].sort((left, right) => {
        const leftContext = mapPointContexts[getMapPointContextKey(left)] ?? null;
        const rightContext = mapPointContexts[getMapPointContextKey(right)] ?? null;
        const leftZone = getMapReportBarrioZone(left, leftContext, safeBarrioCodes);
        const rightZone = getMapReportBarrioZone(right, rightContext, safeBarrioCodes);
        const zoneDiff = leftZone.localeCompare(rightZone, "es");
        if (zoneDiff !== 0) return zoneDiff;
        return new Date(right.created_at) - new Date(left.created_at);
      });

      const zoneMap = new Map();
      const totalsByType = points.reduce((totals, point) => {
        const typeLabel = getMapPointTypeLabel(point.point_type);
        totals[typeLabel] = (totals[typeLabel] ?? 0) + 1;
        return totals;
      }, {});

      points.forEach((point) => {
        const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
        const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
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
        if (pointClave) {
          current.claves.add(pointClave);
        }
        current.items.push({
          ...point,
          report_key: pointClave,
          report_zone_label: pointClave ? `${zone} | Clave ${pointClave}` : zone,
          suggested_zone: zone,
          suggested_reference: context?.reference || "",
          suggested_display_name: context?.display_name || ""
        });
        current.pointTypes.add(getMapPointTypeLabel(point.point_type));
        if (context?.reference) {
          current.nearbyReferences.add(context.reference);
        }
        if (context?.display_name) {
          current.locationHints.add(context.display_name);
        }
        if (Number.isFinite(Number(point.accuracy_meters))) {
          current.accuracyValues.push(Number(point.accuracy_meters));
        }
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

      return {
        totalPoints: points.length,
        totalZones: zones.length,
        totalsByType,
        zones
      };
    } catch (error) {
      console.error("mapReportData failed", error);
      return {
        totalPoints: Array.isArray(visibleMapPoints) ? visibleMapPoints.length : 0,
        totalZones: 0,
        totalsByType: {},
        zones: []
      };
    }
  }, [mapPointContexts, safeBarrioCodes, visibleMapPoints]);
  const mapReportPrintData = useMemo(() => {
    const manualBarrio = mapReportSettings.manual_barrio.trim();
    const applyZoneOverrides = (data) => ({
      ...data,
      zones: data.zones.map((zone, index) => {
        const overrideKey = getMapReportZoneOverrideKey(zone.zone);
        const override = mapReportSettings.zone_overrides?.[overrideKey] ?? {};
        const displayName = String(override.name || manualBarrio || zone.zone || "").trim() || zone.zone;
        const displayKicker = String(override.kicker || `Zona ${index + 1}`).trim() || `Zona ${index + 1}`;
        const displayReference =
          String(override.reference || zone.nearbyReferencesLabel || "").trim() || zone.nearbyReferencesLabel;
        const displayLocation =
          String(override.location || mapReportSettings.manual_location || zone.primaryLocationLabel || "").trim() ||
          zone.primaryLocationLabel;

        return {
          ...zone,
          overrideKey,
          displayKicker,
          displayName,
          displayReference,
          displayLocation,
          items: zone.items.map((point) => ({
            ...point,
            report_zone_label: displayName
          }))
        };
      })
    });

    return applyZoneOverrides(mapReportData);
  }, [mapReportData, mapReportSettings.manual_barrio, mapReportSettings.manual_location, mapReportSettings.zone_overrides]);
  const getSelectedMapReportData = (includedZoneKeys) =>
    selectReportZones(mapReportPrintData, includedZoneKeys, getMapPointTypeLabel);
  const getSelectedCajaTotal = (reportData) => reportData.zones.reduce(
    (total, zone) => total + zone.items.filter((point) => point.point_type === "caja_registro").length,
    0
  );

  const fieldDebtSummary = useMemo(() => {
    const matches = Array.isArray(fieldDebtReport?.results)
      ? fieldDebtReport.results.flatMap((item) => item.matches || [])
      : [];
    const uniqueAccounts = new Set(matches.map((match) => match.clave_catastral || match.abonado).filter(Boolean));
    const services = FIELD_DEBT_SERVICE_DEFINITIONS.reduce((accumulator, service) => {
      accumulator[service.field] = matches.filter((match) => String(match[service.field] || "").toUpperCase() === "S").length;
      return accumulator;
    }, {});

    return {
      totalKeys: fieldDebtReport?.keys?.length ?? 0,
      totalPoints: fieldDebtReport?.pointRows?.length ?? 0,
      foundKeys: fieldDebtReport?.results?.filter((item) => item.exists)?.length ?? 0,
      missingKeys: fieldDebtReport?.results?.filter((item) => !item.exists)?.length ?? 0,
      accounts: uniqueAccounts.size,
      totalDebt: Number(matches.reduce((sum, match) => sum + Number(match.total ?? 0), 0).toFixed(2)),
      services
    };
  }, [fieldDebtReport]);
  const fieldDebtChartData = useMemo(() => {
    const rows = Array.isArray(fieldDebtReport?.results)
      ? fieldDebtReport.results.flatMap((result) => {
          if (!result.matches?.length) {
            return [
              {
                key: getFieldDebtResultLabel(result),
                abonado: "--",
                nombre: result.error || "Sin coincidencia en padron",
                barrio: "--",
                valor: 0,
                intereses: 0,
                total: 0,
                reportes: Number(fieldDebtReport?.keyCounts?.[result.key] || 0),
                exists: false
              }
            ];
          }

          return result.matches.map((match) => ({
            key: match.clave_catastral || match.clave_aguas_formato || result.key,
            abonado: match.abonado || "--",
            nombre: match.inquilino || match.nombre || "--",
            barrio: match.barrio_colonia || "--",
            valor: Number(match.valor || 0),
            intereses: Number(match.intereses || 0),
            total: Number(match.total || 0),
            reportes: Number(fieldDebtReport?.keyCounts?.[result.key] || 0),
            exists: true
          }));
        })
      : [];
    const debtRows = rows
      .filter((row) => row.exists)
      .sort((left, right) => Number(right.total || 0) - Number(left.total || 0));
    const topRows = debtRows.slice(0, 8);
    const maxDebt = Math.max(1, ...topRows.map((row) => Number(row.total || 0)));
    const totalDebt = debtRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const criticalRows = debtRows.filter((row) => Number(row.total || 0) >= 1000);

    return {
      rows,
      debtRows,
      topRows,
      maxDebt,
      totalDebt,
      criticalRows,
      missingRows: rows.filter((row) => !row.exists)
    };
  }, [fieldDebtReport]);

  const mapReportPagination = useMemo(() => {
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(mapReportPrintData.zones.length / pageSize));
    const currentPage = Math.min(mapReportPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      pageSize,
      totalPages,
      currentPage,
      zones: mapReportPrintData.zones.slice(start, start + pageSize)
    };
  }, [mapReportPrintData.zones, mapReportPage]);
  const mapAnalyticsData = useMemo(() => {
    const journeySeries = [...mapDiaryGroups]
      .slice(0, 10)
      .reverse()
      .map((group) => ({
        ...group,
        label: formatMapDiaryLabel(group.key)
      }));
    const typeSeries = Object.entries(mapReportData.totalsByType)
      .map(([label, total]) => ({ label, total }))
      .sort((left, right) => right.total - left.total);
    const zoneSeries = [...mapReportData.zones]
      .sort((left, right) => right.total - left.total)
      .slice(0, 8)
      .map((zone) => ({
        label: zone.zone,
        total: zone.total,
        accuracy: zone.averageAccuracy
      }));
    const accuracyBuckets = visibleMapPoints.reduce(
      (accumulator, point) => {
        const accuracy = Number(point.accuracy_meters);
        if (!Number.isFinite(accuracy)) {
          accumulator[3].total += 1;
          return accumulator;
        }
        if (accuracy <= 5) {
          accumulator[0].total += 1;
          return accumulator;
        }
        if (accuracy <= 15) {
          accumulator[1].total += 1;
          return accumulator;
        }
        accumulator[2].total += 1;
        return accumulator;
      },
      [
        { label: "0 a 5 m", total: 0, tone: "is-good" },
        { label: "6 a 15 m", total: 0, tone: "is-mid" },
        { label: "Más de 15 m", total: 0, tone: "is-warn" },
        { label: "Sin dato", total: 0, tone: "is-empty" }
      ]
    );

    return {
      journeySeries,
      typeSeries,
      zoneSeries,
      accuracyBuckets,
      maxJourneyTotal: Math.max(1, ...journeySeries.map((item) => item.total)),
      maxTypeTotal: Math.max(1, ...typeSeries.map((item) => item.total)),
      maxZoneTotal: Math.max(1, ...zoneSeries.map((item) => item.total))
    };
  }, [mapDiaryGroups, mapReportData.totalsByType, mapReportData.zones, visibleMapPoints]);

  return {
    mapReportData,
    mapReportPrintData,
    getSelectedMapReportData,
    getSelectedCajaTotal,
    fieldDebtSummary,
    fieldDebtChartData,
    mapReportPagination,
    mapAnalyticsData
  };
}
