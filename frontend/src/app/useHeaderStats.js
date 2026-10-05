import { useMemo } from "react";
import { getMapPointContextKey, getMapPointTypeLabel } from "../utils/mapField";
import { getMapReportBarrioZone } from "../utils/mapReport";

export function useHeaderStats({
  draftForm,
  form,
  isAdmin,
  isTransport,
  loadingMapPoints,
  loadingPadronRequest,
  locatingUser,
  lookupResult,
  mapDiaryGroups,
  mapPointContexts,
  mapPointsTotal,
  mapReportData,
  mapStatus,
  onlineUsers,
  padronMeta,
  padronRequestResult,
  safeAuditLogs,
  safeBarrioCodes,
  safeRecords,
  selectedMapPoint,
  uploadingPadron,
  visibleMapPoints,
  workspaceView
}) {
  const headerStats = useMemo(() => {
    // El tablero ya muestra estas cifras en su propio cuerpo; repetirlas en la
    // barra superior solo duplicaba lectura.
    if (workspaceView === "dashboard") {
      return [];
    }

    // El mapa de operaciones lleva sus propias cifras por paso.
    if (workspaceView === "executiveReport") {
      return [];
    }

    if (workspaceView === "lookup") {
      return [
        {
          icon: "search",
          label: "Modo",
          value: "Consulta"
        },
        {
          icon: "records",
          label: "Coincidencias",
          value: String(lookupResult?.total_matches ?? 0)
        },
        {
          icon: lookupResult?.exists ? "success" : "activity",
          label: "Resultado",
          value: lookupResult
            ? lookupResult.exists
              ? "Registrada"
              : "Posible clandestino"
            : "Sin consulta"
        }
      ];
    }

    if (workspaceView === "padron") {
      return [
        {
          icon: "refresh",
          label: "Estado",
          value: uploadingPadron ? "Actualizando" : "Listo"
        },
        {
          icon: "records",
          label: "Claves activas",
          value: String(padronMeta?.total_records ?? 0)
        },
        {
          icon: "activity",
          label: "Archivo",
          value: padronMeta?.file_name || "Sin padrón"
        }
      ];
    }

    if (workspaceView === "importacion") {
      return [
        { icon: "refresh", label: "Origen", value: "FoxPro" },
        { icon: "success", label: "Flujo", value: "Manual" },
        { icon: "records", label: "Destino", value: "Revision" }
      ];
    }

    if (workspaceView === "barrioCodes") {
      return [
        {
          icon: "map",
          label: "Codigos",
          value: String(safeBarrioCodes.length)
        },
        {
          icon: "success",
          label: "Activos",
          value: String(safeBarrioCodes.filter((item) => item.activo !== false).length)
        },
        {
          icon: "records",
          label: "Uso",
          value: "Fichas"
        }
      ];
    }

    if (workspaceView === "map") {
      return [
        {
          icon: "map",
          label: "Puntos guardados",
          value: String(visibleMapPoints.length)
        },
        {
          icon: locatingUser ? "refresh" : "activity",
          label: "Geolocalización",
          value: locatingUser ? "Buscando" : mapStatus
        },
        {
          icon: selectedMapPoint ? "success" : "map",
          label: "Selección",
          value: selectedMapPoint ? getMapPointTypeLabel(selectedMapPoint.point_type) : "Sin punto"
        }
      ];
    }

    if (workspaceView === "mapReports") {
      const zones = new Set(
        visibleMapPoints.map((point) =>
          getMapReportBarrioZone(point, mapPointContexts[getMapPointContextKey(point)] ?? null, safeBarrioCodes)
        )
      );
      return [
        {
          icon: "map",
          label: "Puntos incluidos",
          value: String(visibleMapPoints.length)
        },
        {
          icon: "records",
          label: "Zonas",
          value: String(zones.size)
        },
        {
          icon: "activity",
          label: "Estado",
          value: loadingMapPoints ? "Actualizando" : "Listo para imprimir"
        }
      ];
    }

    if (workspaceView === "fieldValidation") {
      return [
        {
          icon: "map",
          label: "Cobertura",
          value: "Historico GPS"
        },
        {
          icon: "records",
          label: "Seleccion",
          value: "Por barrios"
        },
        {
          icon: "activity",
          label: "Analisis",
          value: "Claves y cartera"
        }
      ];
    }

    if (workspaceView === "mapAnalytics") {
      return [
        {
          icon: "map",
          label: "Puntos en jornada",
          value: String(mapReportData.totalPoints)
        },
        {
          icon: "records",
          label: "Zonas",
          value: String(mapReportData.totalZones)
        },
        {
          icon: "activity",
          label: "Analítica",
          value: loadingMapPoints ? "Actualizando" : "Lista"
        }
      ];
    }

    if (workspaceView === "transport") {
      return [
        {
          icon: "transport",
          label: "Módulo",
          value: isAdmin ? "Control" : "Conductor"
        },
        {
          icon: "map",
          label: "Ruta",
          value: isTransport ? "Asignada" : "Monitoreo"
        },
        {
          icon: "activity",
          label: "Estado",
          value: "Tiempo real"
        }
      ];
    }

    // Las cifras de abajo hablan del formulario de fichas: solo valen en esa vista.
    // Los demás módulos (Entregas, Inspecciones, Consultas…) ya muestran las suyas
    // en su propia pantalla, y aquí solo confundían ("Modo: Nueva ficha" en Entregas).
    if (workspaceView !== "records") {
      return [];
    }

    return [
      {
        icon: "records",
        label: "Registros visibles",
        value: String(safeRecords.length)
      },
      {
        icon: form.id ? "activity" : "plus",
        label: "Modo",
        value: form.id ? "Edición" : "Nueva ficha"
      },
      {
        icon: draftForm ? "success" : "refresh",
        label: "Borrador",
        value: draftForm ? "Disponible" : "Sin cambios"
      }
    ];
  }, [
    draftForm,
    form.id,
    locatingUser,
    lookupResult,
    mapDiaryGroups.length,
    mapStatus,
    mapPointContexts,
    onlineUsers.length,
    padronMeta,
    loadingMapPoints,
    visibleMapPoints.length,
    safeRecords.length,
    mapPointsTotal,
    safeBarrioCodes,
    safeAuditLogs.length,
    selectedMapPoint,
    padronRequestResult,
    loadingPadronRequest,
    uploadingPadron,
    isAdmin,
    isTransport,
    workspaceView
  ]);

  return { headerStats };
}
