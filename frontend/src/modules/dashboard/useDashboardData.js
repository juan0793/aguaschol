import { useMemo } from "react";
import { actionIconName } from "../../components/Icon";
import { actionLabel } from "../../utils/formatting";
import { formatMapDiaryLabel, getMapDiaryDateKey } from "../../utils/datesAndBusiness";
import { formatRelativeTime } from "../../utils/timeFormat";
import { getMapPointContextKey, getMapPointTypeLabel } from "../../utils/mapField";
import { getMapReportBarrioZone } from "../../utils/mapReport";
import { getRecordPhotoPath } from "../../utils/recordLabels";
import { humanizeDashboardActivity } from "../../utils/dashboardActivity";
import { lastDaysSeries } from "./dashboardSelectors.js";

export function useDashboardData({
  alcaldiaComparison,
  alertRecords,
  dashboardAlertFilter,
  dashboardNow,
  getRecordBarrioName,
  isAdmin,
  mapDiaryGroups,
  mapPointContexts,
  mapPointsTotal,
  onlineUsers,
  padronMeta,
  recordDeadlineMetaById,
  safeAuditLogs,
  safeBarrioCodes,
  safeMapDiaryGroupsSummary,
  safeMapPoints,
  safeRecords,
  safeUsers,
  todayDateKey
}) {
  const adminInsight = useMemo(() => {
    if (!isAdmin) {
      return null;
    }

    if (!padronMeta?.total_records) {
      return {
        icon: "refresh",
        title: "Padrón pendiente",
        detail: "Conviene validar o actualizar el padrón maestro antes de abrir consultas masivas."
      };
    }

    if (onlineUsers.length >= 4) {
      return {
        icon: "users",
        title: "Equipo conectado",
        detail: `Hay ${onlineUsers.length} usuarios en línea; el tablero te ayuda a monitorear campo, fichas y actividad sin cambiar de módulo.`
      };
    }

    if (mapDiaryGroups.length > 1) {
      return {
        icon: "map",
        title: "Bitácora activa",
        detail: `Ya hay ${mapDiaryGroups.length} jornadas registradas; puedes entrar a Reportes campo para revisar la del día con mejor contexto.`
      };
    }

    if (safeAuditLogs.length > 0) {
      return {
        icon: "logs",
        title: "Actividad reciente",
        detail: "Revisa el historial si necesitas rastrear cambios, ediciones o movimientos del equipo."
      };
    }

    return {
      icon: "dashboard",
      title: "Centro de control listo",
      detail: "Empieza por Tablero para una vista ejecutiva o entra directo al módulo que necesites."
    };
  }, [isAdmin, mapDiaryGroups.length, onlineUsers.length, padronMeta?.total_records, safeAuditLogs.length]);
  const recordsUpdatedToday = useMemo(
    () =>
      safeRecords.filter((record) => getMapDiaryDateKey(record.updated_at || record.created_at) === todayDateKey)
        .length,
    [safeRecords, todayDateKey]
  );
  const mapPointsToday = useMemo(
    () => safeMapDiaryGroupsSummary.length
      ? Number(mapDiaryGroups.find((group) => group.key === todayDateKey)?.total || 0)
      : safeMapPoints.filter((point) => getMapDiaryDateKey(point) === todayDateKey).length,
    [mapDiaryGroups, safeMapDiaryGroupsSummary.length, safeMapPoints, todayDateKey]
  );
  const pendingPhotoRecords = useMemo(
    () => safeRecords.filter((record) => !String(record.foto_path || "").trim()).length,
    [safeRecords]
  );

  // Historial real de los ultimos 7 dias: fichas tocadas por dia y puntos GPS
  // por jornada. La mora no tiene serie porque el padron es una sola foto.
  const dashboardDailySeries = useMemo(() => {
    const recordsByDay = new Map();
    safeRecords.forEach((record) => {
      const key = getMapDiaryDateKey(record.updated_at || record.created_at);
      if (key) recordsByDay.set(key, (recordsByDay.get(key) || 0) + 1);
    });
    const pointsByDay = new Map();
    if (safeMapDiaryGroupsSummary.length) {
      mapDiaryGroups.forEach((group) => pointsByDay.set(group.key, Number(group.total || 0)));
    } else {
      safeMapPoints.forEach((point) => {
        const key = getMapDiaryDateKey(point);
        if (key) pointsByDay.set(key, (pointsByDay.get(key) || 0) + 1);
      });
    }
    return {
      records: lastDaysSeries(recordsByDay, todayDateKey),
      gps: lastDaysSeries(pointsByDay, todayDateKey)
    };
  }, [mapDiaryGroups, safeMapDiaryGroupsSummary.length, safeMapPoints, safeRecords, todayDateKey]);

  const dashboardLiveMetrics = useMemo(
    () => [
      {
        key: "records",
        label: "Fichas activas",
        value: safeRecords.length,
        helper: `${recordsUpdatedToday} movimientos hoy · ${dashboardDailySeries.records.at(-2)?.total || 0} ayer`,
        series: dashboardDailySeries.records,
        icon: "records",
        badge: "En vivo",
        detail: `Registros actualmente en operacion`,
        trend: recordsUpdatedToday ? `+${recordsUpdatedToday} hoy` : "Sin cambios hoy",
        micro: `${recordsUpdatedToday} creadas o actualizadas hoy`,
        progressLabel: `${safeRecords.length} visibles`,
        progress: safeRecords.length ? Math.min(100, Math.max(12, Math.round((safeRecords.length / Math.max(safeRecords.length, padronMeta?.total_records || safeRecords.length)) * 100))) : 0,
        tone: "is-info",
        sparkline: [36, 44, 42, 52, 48, 58, 64]
      },
      {
        key: "gps",
        label: "Puntos GPS",
        value: mapPointsTotal,
        helper: `${mapPointsToday} hoy · promedio ${Math.round(dashboardDailySeries.gps.reduce((sum, day) => sum + day.total, 0) / Math.max(1, dashboardDailySeries.gps.length))} por día`,
        series: dashboardDailySeries.gps,
        icon: "map",
        badge: "Hoy",
        detail: "Levantamiento de campo acumulado",
        trend: mapPointsToday
          ? `Ultimo movimiento ${safeMapPoints[0] ? formatRelativeTime(safeMapPoints[0].created_at || safeMapPoints[0].updated_at, dashboardNow) : formatMapDiaryLabel(mapDiaryGroups[0]?.key)}`
          : "Sin puntos hoy",
        micro: `${mapPointsToday} puntos registrados hoy`,
        progressLabel: `${mapPointsToday} puntos de la jornada`,
        progress: Math.min(100, Math.max(mapPointsToday ? 14 : 0, Math.round((mapPointsToday / Math.max(1, mapPointsToday, 50)) * 100))),
        tone: "is-map",
        sparkline: [18, 28, 34, 36, 48, 55, 62]
      },
      {
        key: "online",
        label: "Usuarios en línea",
        value: onlineUsers.length,
        helper: `${safeUsers.length} usuarios registrados`,
        icon: "users",
        badge: onlineUsers.length ? "En vivo" : "Normal",
        detail: "Actividad simultanea del equipo",
        trend: onlineUsers.length ? "Jornada activa" : "Sin sesiones activas",
        micro: `${onlineUsers.length} conectados ahora`,
        progressLabel: `${onlineUsers.length}/${Math.max(safeUsers.length, 1)} usuarios`,
        progress: Math.min(100, Math.round((onlineUsers.length / Math.max(safeUsers.length, 1)) * 100)),
        tone: "is-live",
        sparkline: [20, 24, 30, 28, 35, 38, 42]
      },
      {
        key: "alerts",
        label: "Alertas",
        value: alertRecords.length,
        helper: alertRecords.length ? "Pendientes con plazo critico" : "Sin alertas pendientes",
        icon: alertRecords.length ? "warning" : "success",
        badge: alertRecords.length ? "Critico" : "Normal",
        detail: "Fichas vencidas o proximas",
        // Desglose por estado del plazo: la tarjeta del tablero lo dibuja por tramos.
        breakdown: {
          overdue: alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length,
          due: alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "due").length,
          upcoming: alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "warning").length
        },
        trend: `${alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length} vencidas / ${alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "due").length} vencen hoy`,
        micro: `${alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length} vencidas o criticas`,
        progressLabel: "Vencidas y por vencer",
        progress: alertRecords.length
          ? Math.round((alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length / alertRecords.length) * 100)
          : 0,
        tone: alertRecords.length ? "is-critical" : "is-calm",
        sparkline: alertRecords.length ? [70, 68, 64, 66, 62, 59, 54] : [10, 10, 8, 8, 7, 7, 6]
      }
    ],
    [
      alertRecords.length,
      dashboardDailySeries,
      dashboardNow,
      mapDiaryGroups,
      mapPointsTotal,
      mapPointsToday,
      onlineUsers.length,
      padronMeta?.total_records,
      recordDeadlineMetaById,
      recordsUpdatedToday,
      safeMapPoints.length,
      safeMapPoints,
      safeRecords.length,
      safeUsers.length
    ]
  );

  const dashboardLiveFeed = useMemo(() => {
    const feed = [];
    const pushFeedItem = (item) => {
      const createdAt = item.createdAt || item.updatedAt;
      if (!createdAt) return;
      feed.push({
        ...item,
        createdAt,
        timestamp: new Date(createdAt).getTime() || 0
      });
    };

    safeAuditLogs.slice(0, 12).forEach((log) => {
      const actionTitle = {
        "auth.login": "Usuario inicio sesion",
        "map_point.created": "Nuevo punto GPS registrado",
        "inmueble.created": "Ficha creada",
        "inmueble.updated": "Ficha actualizada",
        "inmueble.photo_attached": "Ficha lista para imprimir",
        "transport.route_alert": "Alerta generada"
      }[log.action] || actionLabel(log.action);

      pushFeedItem({
        key: `audit-${log.id}`,
        title: actionTitle,
        detail: humanizeDashboardActivity(log),
        user: log.actor_name || log.actor_email || "Sistema",
        icon: actionIconName(log.action),
        tone: log.action?.includes("alert") ? "is-warning" : "is-info",
        createdAt: log.created_at,
        targetView: log.action === "map_point.created" ? "mapReports" : log.action?.startsWith("inmueble.") ? "records" : "logs",
        targetPointId: log.action === "map_point.created" ? log.entity_id : null,
        targetRecordId: log.action?.startsWith("inmueble.") ? log.entity_id : null
      });
    });

    safeMapPoints.slice(0, 6).forEach((point) => {
      pushFeedItem({
        key: `point-${point.id}`,
        title: "GPS registrado",
        detail: `Se agrego ${getMapPointTypeLabel(point.point_type).toLowerCase()} en ${getMapReportBarrioZone(point, mapPointContexts[getMapPointContextKey(point)] ?? null, safeBarrioCodes) || "zona pendiente"}`,
        user: point.created_by_name || point.created_by || "Equipo de campo",
        icon: "map",
        tone: "is-map",
        createdAt: point.created_at || point.updated_at,
        targetView: "mapReports",
        targetPointId: point.id
      });
    });

    safeRecords.slice(0, 8).forEach((record) => {
      pushFeedItem({
        key: `record-${record.id}`,
        title: "Ficha creada",
        detail: `${record.clave_catastral || "Sin clave"} en ${getRecordBarrioName(record, "ubicacion pendiente")}`,
        user: record.levantamiento_datos || "Equipo operativo",
        icon: "records",
        tone: "is-record",
        createdAt: record.created_at,
        targetView: "records",
        targetRecordId: record.id
      });
    });

    alertRecords.slice(0, 6).forEach((record) => {
      const meta = recordDeadlineMetaById[record.id];
      pushFeedItem({
        key: `alert-${record.id}-${meta?.statusKey || "warning"}`,
        title: meta?.statusKey === "overdue" ? "Alerta generada" : "Ficha lista para imprimir",
        detail: `La ficha ${record.clave_catastral || "sin clave"} ${meta?.statusKey === "overdue" ? "vencio su plazo" : "requiere seguimiento"}`,
        user: record.analista_datos || "Sistema",
        icon: meta?.statusKey === "overdue" ? "warning" : "records",
        tone: meta?.statusKey === "overdue" ? "is-warning" : "is-ready",
        createdAt: record.updated_at || record.created_at,
        targetView: "records",
        targetRecordId: record.id
      });
    });

    return feed
      .filter((item) => Number.isFinite(item.timestamp))
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 8);
  }, [alertRecords, mapPointContexts, recordDeadlineMetaById, safeAuditLogs, safeBarrioCodes, safeMapPoints, safeRecords]);
  const dashboardJourneys = useMemo(() => mapDiaryGroups.slice(0, 4), [mapDiaryGroups]);
  const dashboardPriorityItems = useMemo(() => {
    const items = [];

    if (!padronMeta?.total_records) {
      items.push({
        tone: "is-warning",
        title: "Padrón pendiente",
        detail: "Actualiza o valida el padrón maestro para consultas y peticiones confiables.",
        icon: "refresh",
        actionView: "padron",
        actionLabel: "Revisar padrón",
        level: "Atención",
        badge: "Pendiente"
      });
    }

    if (alertRecords.length) {
      items.push({
        tone: "is-warning",
        title: "Fichas con plazo crítico",
        detail: "En alerta o vencidas por la regla de 7 días hábiles.",
        count: alertRecords.length,
        icon: "warning",
        actionView: "records",
        filter: "alerts",
        actionLabel: "Ver alertas",
        level: "Crítico",
        badge: "Crítico"
      });
    }

    if (pendingPhotoRecords >= 3) {
      items.push({
        tone: "is-warning",
        title: "Fichas sin foto",
        detail: "Fichas visibles que aún no tienen evidencia fotográfica.",
        count: pendingPhotoRecords,
        icon: "records",
        actionView: "records",
        actionLabel: "Completar fichas",
        level: "Atención",
        badge: "Pendiente"
      });
    }

    // Cuántos usuarios hay conectados ya se ve en la banda de estado del
    // tablero: no es un asunto pendiente y no compite con las alertas reales.
    if (dashboardJourneys[0]) {
      items.push({
        tone: "is-info",
        title: "Jornada activa",
        detail: `${formatMapDiaryLabel(dashboardJourneys[0].key)}: puntos listos para revisar.`,
        count: dashboardJourneys[0].total,
        icon: "map",
        actionView: "mapReports",
        actionLabel: "Abrir reportes",
        level: "Informativo",
        badge: "En vivo"
      });
    }

    if (!items.length) {
      items.push({
        tone: "is-calm",
        title: "Sistema estable",
        detail: "El tablero está listo para arrancar captura, consulta o control administrativo.",
        icon: "success",
        actionView: "records",
        actionLabel: "Ir a fichas",
        level: "Informativo",
        badge: "Normal"
      });
    }

    return items.slice(0, 3);
  }, [alertRecords.length, dashboardJourneys, padronMeta?.total_records, pendingPhotoRecords]);
  const dashboardAlertRecords = useMemo(() => {
    const recordsWithoutPhoto = safeRecords
      .filter((record) => !getRecordPhotoPath(record))
      .map((record) => ({
        record,
        statusKey: "no-photo",
        status: "Sin foto",
        detail: "Pendiente de evidencia fotografica para cerrar la ficha.",
        actionLabel: "Ver ficha"
      }));
    const deadlineAlerts = alertRecords.map((record) => {
      const meta = recordDeadlineMetaById[record.id];
      const isOverdue = meta?.statusKey === "overdue";
      const isDue = meta?.statusKey === "due";
      return {
        record,
        statusKey: meta?.statusKey || "warning",
        status: isOverdue ? "Vencida" : isDue ? "Vence hoy" : "Atencion",
        detail: isOverdue
          ? "Plazo operativo de 7 dias habiles superado."
          : isDue
            ? "Requiere revision durante la jornada de hoy."
            : "Requiere seguimiento por plazo operativo."
      };
    });

    return [...deadlineAlerts, ...recordsWithoutPhoto]
      .filter((item, index, list) => list.findIndex((other) => other.record.id === item.record.id && other.statusKey === item.statusKey) === index)
      .slice(0, 24);
  }, [alertRecords, recordDeadlineMetaById, safeRecords]);
  const dashboardAlertCounts = useMemo(() => {
    const overdue = dashboardAlertRecords.filter((item) => item.statusKey === "overdue").length;
    const due = dashboardAlertRecords.filter((item) => item.statusKey === "due").length;
    const noPhoto = dashboardAlertRecords.filter((item) => item.statusKey === "no-photo").length;
    const printable = dashboardAlertRecords.filter((item) => ["overdue", "due", "warning"].includes(item.statusKey)).length;

    return {
      all: dashboardAlertRecords.length,
      critical: overdue,
      today: due,
      noPhoto,
      printable
    };
  }, [dashboardAlertRecords]);
  const overdueComparisonRecords = useMemo(
    () =>
      dashboardAlertRecords
        .filter((item) => item.statusKey === "overdue")
        .map((item) => item.record),
    [dashboardAlertRecords]
  );
  const alcaldiaComparisonByClave = useMemo(() => {
    const rows = [
      ...(alcaldiaComparison?.candidates || []),
      ...(alcaldiaComparison?.matched_by_base || []),
      ...(alcaldiaComparison?.matched_exact || [])
    ];
    return rows.reduce((map, row) => {
      [row.clave_catastral, row.clave_aguas_formato].forEach((key) => {
        const cleanKey = String(key || "").trim();
        if (cleanKey && !map.has(cleanKey)) {
          map.set(cleanKey, row);
        }
      });
      return map;
    }, new Map());
  }, [alcaldiaComparison]);
  const filteredDashboardAlertRecords = useMemo(
    () =>
      dashboardAlertRecords.filter((item) => {
        if (dashboardAlertFilter === "critical") return item.statusKey === "overdue";
        if (dashboardAlertFilter === "today") return item.statusKey === "due";
        if (dashboardAlertFilter === "no-photo") return item.statusKey === "no-photo";
        if (dashboardAlertFilter === "printable") return ["overdue", "due", "warning"].includes(item.statusKey);
        return true;
      }),
    [dashboardAlertFilter, dashboardAlertRecords]
  );
  const dashboardTechnicianSummary = useMemo(() => {
    const grouped = safeRecords.reduce((acc, record) => {
      const owner = String(record.levantamiento_datos || record.analista_datos || "Sin asignar").trim() || "Sin asignar";
      if (!acc[owner]) {
        acc[owner] = {
          name: owner,
          total: 0,
          withPhoto: 0,
          alert: 0
        };
      }
      acc[owner].total += 1;
      if (record.foto_path) {
        acc[owner].withPhoto += 1;
      }
      if (recordDeadlineMetaById[record.id]?.status && recordDeadlineMetaById[record.id].status !== "on_track") {
        acc[owner].alert += 1;
      }
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((left, right) => right.total - left.total || right.alert - left.alert || left.name.localeCompare(right.name))
      .slice(0, 5);
  }, [recordDeadlineMetaById, safeRecords]);

  return {
    adminInsight,
    dashboardLiveMetrics,
    dashboardLiveFeed,
    dashboardPriorityItems,
    dashboardAlertCounts,
    overdueComparisonRecords,
    alcaldiaComparisonByClave,
    filteredDashboardAlertRecords,
    dashboardTechnicianSummary
  };
}
