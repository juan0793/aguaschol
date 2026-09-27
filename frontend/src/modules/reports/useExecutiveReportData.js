import { useMemo } from "react";
import { actionLabel } from "../../utils/formatting";
import { formatMapDiaryLabel, formatMonthGroup, getMapDiaryDateKey } from "../../utils/datesAndBusiness";
import { getMapPointContextKey, getMapPointTypeLabel } from "../../utils/mapField";
import { getMapReportBarrioZone } from "../../utils/mapReport";

export function useExecutiveReportData({
  alcaldiaMeta,
  dashboardTechnicianSummary,
  getRecordBarrioName,
  mapDiaryGroups,
  mapPointContexts,
  mapReportData,
  onlineUsers,
  padronMeta,
  padronRequestResult,
  recordDeadlineMetaById,
  safeAuditLogs,
  safeBarrioCodes,
  safeMapPoints,
  safeRecords,
  safeUsers
}) {
  const executiveReportData = useMemo(() => {
    const allDates = [
      ...safeRecords.flatMap((record) => [record.created_at, record.updated_at, record.fecha_aviso]),
      ...safeMapPoints.flatMap((point) => [point.created_at, point.updated_at]),
      ...safeAuditLogs.map((log) => log.created_at)
    ]
      .map((value) => {
        const stamp = Date.parse(value || "");
        return Number.isFinite(stamp) ? stamp : null;
      })
      .filter(Boolean);
    const firstDate = allDates.length ? new Date(Math.min(...allDates)) : null;
    const lastDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();
    const statusTotals = safeRecords.reduce(
      (acc, record) => {
        const status = record.estado_padron || "clandestino";
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      { clandestino: 0, reportada: 0, varios_padrones: 0 }
    );
    const mapTypeTotals = safeMapPoints.reduce((acc, point) => {
      const label = getMapPointTypeLabel(point.point_type);
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    const mapZoneTotals = safeMapPoints.reduce((acc, point) => {
      const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
      const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
      acc[zone] = (acc[zone] ?? 0) + 1;
      return acc;
    }, {});
    const gpsZoneDetails = safeMapPoints.reduce((acc, point) => {
      const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
      const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
      const typeLabel = getMapPointTypeLabel(point.point_type);
      if (!acc[zone]) {
        acc[zone] = {
          label: zone,
          total: 0,
          types: {},
          accuracyValues: [],
          firstDate: "",
          lastDate: ""
        };
      }
      acc[zone].total += 1;
      acc[zone].types[typeLabel] = (acc[zone].types[typeLabel] ?? 0) + 1;
      if (Number.isFinite(Number(point.accuracy_meters))) {
        acc[zone].accuracyValues.push(Number(point.accuracy_meters));
      }
      const dateKey = getMapDiaryDateKey(point);
      if (dateKey) {
        acc[zone].firstDate = !acc[zone].firstDate || dateKey < acc[zone].firstDate ? dateKey : acc[zone].firstDate;
        acc[zone].lastDate = !acc[zone].lastDate || dateKey > acc[zone].lastDate ? dateKey : acc[zone].lastDate;
      }
      return acc;
    }, {});
    const recordZoneTotals = safeRecords.reduce((acc, record) => {
      const zone = getRecordBarrioName(record, "Sin barrio");
      if (!acc[zone]) {
        acc[zone] = {
          label: zone,
          total: 0,
          clandestino: 0,
          reportada: 0,
          varios_padrones: 0,
          withPhoto: 0,
          alert: 0
        };
      }
      const status = record.estado_padron || "clandestino";
      acc[zone].total += 1;
      acc[zone][status] = (acc[zone][status] ?? 0) + 1;
      if (String(record.foto_path || "").trim()) {
        acc[zone].withPhoto += 1;
      }
      if (recordDeadlineMetaById[record.id]) {
        acc[zone].alert += 1;
      }
      return acc;
    }, {});
    const monthlyTotals = [...safeRecords, ...safeMapPoints].reduce((acc, item) => {
      const dateKey = getMapDiaryDateKey(item.updated_at || item.created_at || item.fecha_aviso);
      if (!dateKey) return acc;
      const monthKey = dateKey.slice(0, 7);
      if (!acc[monthKey]) {
        acc[monthKey] = {
          label: formatMonthGroup(`${monthKey}-01`),
          records: 0,
          points: 0
        };
      }
      if ("clave_catastral" in item) {
        acc[monthKey].records += 1;
      } else {
        acc[monthKey].points += 1;
      }
      return acc;
    }, {});
    const auditTotals = safeAuditLogs.reduce((acc, log) => {
      const key = actionLabel(log.action);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const photoCount = safeRecords.filter((record) => String(record.foto_path || "").trim()).length;
    const archivedEvents = safeAuditLogs.filter((log) => log.action === "inmueble.archived").length;
    const printedReadyRecords = safeRecords.filter((record) => record.fecha_aviso && record.levantamiento_datos && record.analista_datos).length;
    const fieldJourneyRows = mapDiaryGroups.map((journey) => {
      const dayPoints = safeMapPoints.filter((point) => getMapDiaryDateKey(point) === journey.key);
      const dayRecords = safeRecords.filter((record) => getMapDiaryDateKey(record.updated_at || record.created_at) === journey.key);
      const dayZones = new Set(
        dayPoints.map((point) => {
          const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
          return getMapReportBarrioZone(point, context, safeBarrioCodes);
        })
      );

      return {
        key: journey.key,
        label: formatMapDiaryLabel(journey.key),
        points: dayPoints.length,
        records: dayRecords.length,
        photos: dayRecords.filter((record) => String(record.foto_path || "").trim()).length,
        zones: dayZones.size
      };
    });
    const fieldResponsibleRows = dashboardTechnicianSummary.map((item) => ({
      name: item.name,
      records: item.total,
      withPhoto: item.withPhoto,
      alert: item.alert
    }));

    return {
      generatedAt: new Date(),
      firstDate,
      lastDate,
      statusTotals,
      photoCount,
      pendingPhotoCount: Math.max(0, safeRecords.length - photoCount),
      printedReadyRecords,
      archivedEvents,
      fieldJourneyRows,
      fieldResponsibleRows,
      statusRows: [
        { label: "Clandestinas", total: statusTotals.clandestino || 0 },
        { label: "Reportadas", total: statusTotals.reportada || 0 },
        { label: "Varios padrones", total: statusTotals.varios_padrones || 0 }
      ],
      recordZoneRows: Object.values(recordZoneTotals)
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
      monthlyRows: Object.entries(monthlyTotals)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value),
      gpsZoneDetailRows: Object.values(gpsZoneDetails)
        .map((zone) => ({
          ...zone,
          averageAccuracy: zone.accuracyValues.length
            ? Number((zone.accuracyValues.reduce((sum, value) => sum + value, 0) / zone.accuracyValues.length).toFixed(1))
            : null,
          typeLabel: Object.entries(zone.types)
            .sort((left, right) => right[1] - left[1])
            .map(([label, total]) => `${label}: ${total}`)
            .join(", ")
        }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
      mapTypeRows: Object.entries(mapTypeTotals)
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
      mapZoneRows: Object.entries(mapZoneTotals)
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
        .slice(0, 8),
      auditRows: Object.entries(auditTotals)
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
        .slice(0, 10),
      applicationFunctions: [
        ["Registro de fichas", "Crear, editar, buscar y clasificar inmuebles por clave catastral, barrio, abonado y estado operativo."],
        ["Validación de padrones", "Comparar información entre padrón maestro, Alcaldía y registros de Aguas para detectar coincidencias o posibles clandestinos."],
        ["Evidencia fotográfica", "Adjuntar fotografía por ficha y dejar respaldo visual del levantamiento realizado en campo."],
        ["Geolocalización GPS", "Capturar puntos técnicos, zonas, precisión, jornadas y referencias para sustentar el recorrido territorial."],
        ["Mapa de campo", "Visualizar puntos levantados, agruparlos por zona y generar reportes de coordenadas para supervisión."],
        ["Avisos y fichas imprimibles", "Generar ficha técnica, aviso formal e impresión rápida por lote con selección de copias."],
        ["Reportes PDF", "Descargar reportes de campo, solicitudes de padrón y resumen consolidado para presentación institucional."],
        ["Bitácora y usuarios", "Registrar sesiones, cambios, operaciones, restauraciones y actividad por usuario para trazabilidad."]
      ],
      timeSavingsRows: [
        ["Búsqueda de clave y validación", "10 a 15 minutos manuales", "1 a 2 minutos en la aplicación", "Reduce revisión en Excel, cruces manuales y errores de digitación."],
        ["Elaboración de ficha", "15 a 20 minutos manuales", "4 a 6 minutos en la aplicación", "Centraliza datos, estado, fotografía y formato imprimible."],
        ["Generación de aviso", "8 a 12 minutos manuales", "1 a 2 minutos en la aplicación", "El aviso se genera desde la ficha sin volver a redactar la información."],
        ["Reporte de campo por zona", "1 a 2 horas manuales", "5 a 10 minutos en la aplicación", "Agrupa GPS, zonas, totales y jornadas automáticamente."],
        ["Consolidado para supervisión", "Medio día de revisión manual", "10 a 20 minutos en la aplicación", "Resume fichas, barrios, GPS, usuarios, bitácora y estadísticas."],
        ["Impresión de varias fichas/avisos", "30 a 60 minutos manuales", "5 a 10 minutos con impresión rápida", "Permite seleccionar copias por ficha y aviso en un solo flujo."]
      ],
      modules: [
        {
          title: "Fichas catastrales",
          detail: "Registro, edición, búsqueda por clave catastral, clasificación por padrón, fotografía, ficha visual, aviso y procesamiento a reportadas.",
          evidence: `${safeRecords.length} fichas activas visibles, ${statusTotals.reportada || 0} reportadas y ${photoCount} con evidencia fotográfica.`
        },
        {
          title: "Trabajo realizado en campo",
          detail: "Captura GPS en sitio, levantamiento de fichas, evidencia fotográfica, jornadas por fecha, zonas cubiertas y puntos técnicos ubicados en mapa.",
          evidence: `${safeMapPoints.length} puntos geolocalizados, ${mapDiaryGroups.length} jornadas y ${photoCount} fichas con fotografía.`
        },
        {
          title: "Reportes institucionales",
          detail: "Reporte de levantamiento por zonas, estadísticas de campo, descarga PDF, impresión, reporte de solicitudes al padrón y consulta por clave.",
          evidence: `${mapReportData.totalZones} zonas en la jornada activa y ${padronRequestResult?.summary?.total_registros ?? 0} registros en la última petición.`
        },
        {
          title: "Padrones y validación",
          detail: "Carga de padrón maestro, carga de padrón de Alcaldía, comparación contra Aguas y detección de inmuebles clandestinos o repetidos en varios padrones.",
          evidence: `${padronMeta?.total_records ?? 0} claves en padrón maestro y ${alcaldiaMeta?.total_records ?? 0} registros de Alcaldía.`
        },
        {
          title: "Operación y trazabilidad",
          detail: "Usuarios, roles, sesiones, bitácora de eventos, auditoría de cambios, restauración y archivo administrativo.",
          evidence: `${safeUsers.length} usuarios registrados, ${onlineUsers.length} en línea y ${safeAuditLogs.length} eventos auditados.`
        },
        {
          title: "Impresión y avisos",
          detail: "Ficha imprimible con formato institucional, aviso editable, impresión individual y lote rápido con selección de copias por ficha o aviso.",
          evidence: `${printedReadyRecords} fichas cuentan con datos base para generar aviso.`
        }
      ]
    };
  }, [
    alcaldiaMeta?.total_records,
    mapDiaryGroups.length,
    mapPointContexts,
    mapReportData.totalZones,
    onlineUsers.length,
    padronMeta?.total_records,
    padronRequestResult?.summary?.total_registros,
    recordDeadlineMetaById,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeRecords,
    dashboardTechnicianSummary,
    safeUsers.length
  ]);

  return { executiveReportData };
}
