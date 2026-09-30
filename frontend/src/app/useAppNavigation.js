import { useMemo } from "react";
import { buildSidebarSections } from "../components/sidebar/sidebarConfig";

export function useAppNavigation({
  isAdmin,
  isFieldValidator,
  mapPointsTotal,
  mapReportData,
  padronMeta,
  padronRequestResult,
  puntosJornadaLabel,
  safeAuditLogs,
  safeBarrioCodes,
  safeRecords,
  safeUsers,
  visibleMapPoints,
  workspaceView
}) {
  const headerMeta = useMemo(
    () =>
      (
        {
          records: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Panel operativo",
            title: "Registro de inmuebles clandestinos",
            lead: "Gestión centralizada de fichas, avisos y seguimiento operativo del sistema.",
            kicker: "Operación segura"
          },
          users: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Administración de accesos",
            title: "Gestión de usuarios",
            lead: "Creación de cuentas, control de perfiles y entrega de credenciales con un flujo claro.",
            kicker: "Control de acceso"
          },
          entregas: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Operación de reparto",
            title: "Control de entregas",
            lead: "Seguimiento de lotes, cierres diarios y documentos pendientes.",
            kicker: "Cierre diario"
          },
          dashboard: {
            panelClass: "hero-panel-dashboard",
            cardClass: "search-card-dashboard",
            toplineLabel: "Centro administrativo",
            // Mismo nombre que en el menú lateral: la pantalla se llama Tablero.
            title: "Tablero",
            lead: "Resumen operativo con actividad reciente y accesos rápidos para gestionar toda la plataforma.",
            kicker: "Visión general"
          },
          executiveReport: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-users",
            toplineLabel: "Operaciones realizadas",
            title: "Resumen de Operaciones realizadas",
            lead: "Informe consolidado desde el primer día de trabajo: fichas, geolocalización, mapeo, reportes, padrones, avisos, funciones desarrolladas, ahorro de tiempo y trazabilidad.",
            kicker: "Memoria operativa"
          },
          padron: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Administración de padrón",
            title: "Padrón maestro",
            lead: "Carga y reemplazo del archivo maestro usado por la consulta rápida de claves.",
            kicker: "Actualización central"
          },
          importacion: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Integracion FoxPro",
            title: "Importacion",
            lead: "Revision y aplicacion manual de lotes recibidos desde el servidor FoxPro.",
            kicker: "Zona temporal"
          },
          barrioCodes: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Catalogo territorial",
            title: "Codigos de barrios",
            lead: "Gestiona el prefijo inicial de las claves catastrales para completar barrios en fichas y reportes.",
            kicker: "Barrios"
          },
          lookup: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Consulta rápida",
            title: "Buscar clave catastral",
            lead: "Consulta apartada del módulo de fichas para validar si una clave ya existe en el padrón maestro.",
            kicker: "Uso en campo"
          },
          map: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Geolocalización operativa",
            title: "Mapa de campo",
            lead: "Módulo independiente para ubicar y registrar puntos técnicos de cajas y descargas en terreno.",
            kicker: "Trabajo en sitio"
          },
          fieldValidation: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Inteligencia territorial GPS",
            title: "Control territorial GPS",
            lead: "Consulta el historico, selecciona barrios y cruza claves, abonados y cartera para preparar nuevas jornadas.",
            kicker: "Historico y zonas"
          },
          mapReports: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-users",
            toplineLabel: "Administración de campo",
            title: "Reportes de levantamiento",
            lead: "Centro de reportes compacto para imprimir coordenadas, totales y zonas del trabajo levantado en campo.",
            kicker: "Reporte institucional"
          },
          mapAnalytics: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-users",
            toplineLabel: "Analítica de campo",
            title: "Estadísticas del levantamiento",
            lead: "Gráficos y lectura estadística del trabajo de campo, separados del reporte institucional para no interferir con impresión.",
            kicker: "Lectura ejecutiva"
          },
          transport: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Monitoreo de transporte",
            title: "Seguimiento del vehículo recolector",
            lead: "Traza la calle autorizada, ve el recorrido en verde y detecta a tiempo si el vehículo se sale de la ruta.",
            kicker: "Ruta supervisada"
          },
          planos: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Planos y croquis",
            title: "Planos y Croquis",
            lead: "Actualiza croquis de barrios usando el PDF como fondo y una capa editable para revision.",
            kicker: "Croquis editable"
          },
          requests: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Peticiones institucionales",
            title: "Consultas del padrón",
            lead: "Servicios, deuda y abonados por barrio desde el padrón maestro, listos para imprimir y PDF.",
            kicker: "Análisis ejecutivo"
          },
          logs: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-logs",
            toplineLabel: "Bitácora profesional",
            title: "Historial de actividad",
            lead: "Seguimiento continuo de movimientos relevantes con una lectura más limpia y trazable.",
            kicker: "Trazabilidad"
          },
          notes: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Uso administrativo",
            title: "Apuntes",
            lead: "Tablero personal para anotar cualquier cosa en segundos y organizarla después.",
            kicker: "Privado del administrador"
          }
        }[workspaceView] ?? {
          panelClass: "hero-panel-records",
          cardClass: "search-card-records",
          toplineLabel: "Panel operativo",
          title: "Registro de inmuebles clandestinos",
          lead: "Gestión centralizada de fichas, avisos y seguimiento operativo del sistema.",
          kicker: "Operación segura"
        }
      ),
    [workspaceView]
  );

  const adminWorkspaceItems = useMemo(
    () =>
      isAdmin
        ? [
            { key: "dashboard", section: "vision", label: "Tablero", icon: "dashboard", meta: "Vista ejecutiva", tone: "is-vision" },
            { key: "profile", section: "vision", label: "Mi perfil", icon: "users", meta: "Rendimiento personal", tone: "is-users" },
            { key: "inspecciones", section: "operacion", label: "Inspecciones", icon: "activity", meta: "Asignación y seguimiento", tone: "is-records" },
            { key: "entregas", section: "operacion", label: "Control de entregas", icon: "archive", meta: "Facturas y notas de cobro", tone: "is-report" },
            { key: "records", section: "operacion", label: "Clandestinos", icon: "records", meta: `${safeRecords.length} visibles`, tone: "is-records" },
            { key: "lookup", section: "operacion", label: "Buscar clave", icon: "search", meta: "Consulta rápida", tone: "is-lookup" },
            { key: "sigTerritorial", section: "operacion", label: "SIG Territorial", icon: "map", meta: "Cartografía operativa", tone: "is-map" },
            { key: "map", section: "operacion", label: "Puntos GPS", icon: "map", meta: `${mapPointsTotal} puntos`, tone: "is-map" },
            { key: "fieldValidation", section: "control", label: "Control territorial GPS", icon: "success", meta: "Historico y zonas", tone: "is-map" },
            { key: "mapReports", section: "control", label: "Reportes GPS", icon: "records", meta: `${mapReportData.totalZones} zonas`, tone: "is-report" },
            { key: "requests", section: "control", label: "Informes", icon: "dashboard", meta: `${padronRequestResult?.summary?.total_registros ?? 0} filas`, tone: "is-report" },
            { key: "users", section: "control", label: "Usuarios", icon: "users", meta: `${safeUsers.length} registrados`, tone: "is-users" },
            { key: "barrioCodes", section: "control", label: "Barrios", icon: "map", meta: `${safeBarrioCodes.length} codigos`, tone: "is-map" },
            { key: "padron", section: "control", label: "Padrón", icon: "refresh", meta: `${padronMeta?.total_records ?? 0} claves`, tone: "is-padron" },
            { key: "importacion", section: "control", label: "Importación", icon: "refresh", meta: "FoxPro manual", tone: "is-padron" },
            { key: "logs", section: "control", label: "Historial", icon: "logs", meta: `${safeAuditLogs.length} eventos`, tone: "is-logs" }
          ]
        : [],
    [
      isAdmin,
      isFieldValidator,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalPoints,
      mapReportData.totalZones,
      padronMeta?.total_records,
      safeAuditLogs.length,
      safeBarrioCodes.length,
      mapPointsTotal,
      safeRecords.length,
      safeUsers.length
    ]
  );
  const adminWorkspaceSections = useMemo(() => {
    const sectionMeta = {
      vision: {
        title: "Visión",
        detail: "Lectura rápida del sistema y acceso al tablero."
      },
      operacion: {
        title: "Operación",
        detail: "Trabajo diario de fichas, consulta y levantamiento."
      },
      control: {
        title: "Control",
        detail: "Supervisión, reportes, usuarios y padrón maestro."
      }
    };

    return Object.entries(sectionMeta)
      .map(([key, meta]) => ({
        key,
        ...meta,
        items: adminWorkspaceItems.filter((item) => item.section === key)
      }))
      .filter((section) => section.items.length);
  }, [adminWorkspaceItems]);
  const moduleNavigationItems = useMemo(
    () =>
      (isAdmin
        ? [
            { key: "profile", label: "Mi perfil", icon: "users", group: "principal", helper: "Estadisticas y mensajes" },
            { key: "railwayUsage", label: "Uso en Railway", icon: "barChart", group: "principal", helper: "Consumo y horas pico" },
            { key: "inspecciones", label: "Inspecciones", icon: "activity", group: "operacion", helper: "Asignación y seguimiento" },
            { key: "entregas", label: "Control de entregas", icon: "archive", group: "operacion", helper: "Facturas y notas de cobro" },
            { key: "records", label: "Clandestinos", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rápida" },
            { key: "sigTerritorial", label: "SIG Territorial", icon: "map", group: "operacion", helper: "Cartografía operativa" },
            { key: "map", label: "Puntos GPS", icon: "map", group: "gps", helper: puntosJornadaLabel },
            { key: "fieldValidation", label: "Control territorial GPS", icon: "success", group: "gps", helper: "Historico y zonas" },
            { key: "mapReports", label: "Reportes GPS", icon: "records", group: "gps", helper: `${mapReportData.totalZones} zonas` },
            { key: "planos", label: "Planos y Croquis", icon: "map", group: "gps", helper: "Croquis PDF" },
            { key: "requests", label: "Informes", icon: "dashboard", group: "control", helper: "Peticiones y estadisticas" },
            { key: "barrioCodes", label: "Barrios", icon: "map", group: "control", helper: `${safeBarrioCodes.length} codigos` },
            { key: "padron", label: "Padrón", icon: "refresh", group: "control", helper: `${padronMeta?.total_records ?? 0} claves` },
            { key: "importacion", label: "Importación", icon: "refresh", group: "control", helper: "Lotes FoxPro" },
            { key: "teamActivity", label: "Actividad del equipo", icon: "users", group: "control", helper: "Lo que hacen los técnicos" },
            { key: "logs", label: "Historial", icon: "logs", group: "control", helper: `${safeAuditLogs.length} eventos` },
            { key: "users", label: "Usuarios", icon: "users", group: "administracion", helper: `${safeUsers.length} registrados` },
            { key: "notes", label: "Apuntes", icon: "notes", group: "administracion", helper: "Notas internas" }
          ]
        : [
            { key: "profile", label: "Mi perfil", icon: "users", group: "principal", helper: "Estadisticas y mensajes" },
            { key: "inspecciones", label: "Inspecciones", icon: "activity", group: "operacion", helper: "Asignación y seguimiento" },
            { key: "entregas", label: "Control de entregas", icon: "archive", group: "operacion", helper: "Facturas y notas de cobro" },
            { key: "records", label: "Clandestinos", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rápida" },
            { key: "sigTerritorial", label: "SIG Territorial", icon: "map", group: "operacion", helper: "Cartografía operativa" },
            { key: "map", label: "Puntos GPS", icon: "map", group: "gps", helper: puntosJornadaLabel },
            ...(isFieldValidator
              ? [{ key: "fieldValidation", label: "Control territorial GPS", icon: "success", group: "gps", helper: "Historico y zonas" }]
              : []),
            { key: "planos", label: "Planos y Croquis", icon: "map", group: "gps", helper: "Croquis PDF" }
          ]),
    [
      isAdmin,
      isFieldValidator,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalPoints,
      mapReportData.totalZones,
      padronMeta?.total_records,
      safeAuditLogs.length,
      safeBarrioCodes.length,
      safeRecords.length,
      safeUsers.length,
      visibleMapPoints.length,
    ]
  );
  const mobilePrimaryModuleKeys = useMemo(
    () => ["profile", "inspecciones", "records", "lookup", "map"],
    []
  );
  const primaryModuleNavigationItems = useMemo(
    () => moduleNavigationItems.filter((item) => mobilePrimaryModuleKeys.includes(item.key)),
    [mobilePrimaryModuleKeys, moduleNavigationItems]
  );
  const secondaryModuleNavigationItems = useMemo(
    () => moduleNavigationItems.filter((item) => !mobilePrimaryModuleKeys.includes(item.key)),
    [mobilePrimaryModuleKeys, moduleNavigationItems]
  );
  const currentModuleNavigation = useMemo(
    () => moduleNavigationItems.find((item) => item.key === workspaceView) ?? null,
    [moduleNavigationItems, workspaceView]
  );
  const sidebarNavigationSections = useMemo(() => {
    const badgeByKey = {
      records: safeRecords.length,
      padron: padronMeta?.total_records ?? 0,
      logs: safeAuditLogs.length,
      barrioCodes: safeBarrioCodes.length,
      users: safeUsers.length,
      map: visibleMapPoints.length,
      planos: null,
      mapReports: mapReportData.totalZones,
      requests: padronRequestResult?.summary?.total_registros ?? 0
    };
    const normalizeItem = (item) => ({
      ...item,
      badge: badgeByKey[item.key] ?? null
    });
    const items = moduleNavigationItems.map(normalizeItem);
    const dashboardItem = isAdmin
      ? { key: "dashboard", label: "Tablero", icon: "dashboard", helper: "Control", badge: null }
      : null;

    return buildSidebarSections(items, dashboardItem);
  }, [
    isAdmin,
    mapReportData.totalPoints,
    mapReportData.totalZones,
    moduleNavigationItems,
    padronMeta?.total_records,
    padronRequestResult?.summary?.total_registros,
    safeAuditLogs.length,
    safeBarrioCodes.length,
    safeRecords.length,
    safeUsers.length,
    visibleMapPoints.length
  ]);

  return {
    headerMeta,
    adminWorkspaceSections,
    moduleNavigationItems,
    primaryModuleNavigationItems,
    secondaryModuleNavigationItems,
    currentModuleNavigation,
    sidebarNavigationSections
  };
}
