import { createElement, lazy } from "react";

// Si el módulo no se puede bajar (sin señal y sin copia guardada en el teléfono), se
// muestra este aviso en vez de dejar la app en blanco.
function ModuloNoDisponible() {
  const sinRed = typeof navigator !== "undefined" && navigator.onLine === false;
  return createElement("section", { className: "module-unavailable", role: "alert" },
    createElement("strong", null, "Esta pantalla no se pudo abrir"),
    createElement("p", null, sinRed
      ? "No hay señal y esta pantalla todavía no está guardada en el teléfono. Ábrela una vez con conexión y después funcionará sin señal."
      : "No se pudo descargar esta parte de la app. Revisa la conexión e intenta de nuevo."),
    createElement("button", { type: "button", onClick: () => window.location.reload() }, "Reintentar"));
}

export const lazyWithRetry = (loader) => lazy(async () => {
  try {
    return await loader();
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    try {
      return await loader();
    } catch {
      return { default: ModuloNoDisponible };
    }
  }
});

export const FieldMap = lazyWithRetry(() => import("../components/FieldMap"));

export const MapPrintDialog = lazyWithRetry(() => import("../components/MapPrintDialog"));

export const FieldValidationWorkspace = lazyWithRetry(() => import("../components/FieldValidationWorkspace"));

export const MyProfileWorkspace = lazyWithRetry(() => import("../components/profile/MyProfileWorkspace"));

export const RailwayUsageWorkspace = lazyWithRetry(() => import("../components/RailwayUsageWorkspace"));

export const TeamActivityWorkspace = lazyWithRetry(() => import("../modules/actividad/TeamActivityWorkspace"));
export const FallasWorkspace = lazyWithRetry(() => import("../modules/fallas/FallasWorkspace"));

export const PlanosWorkspace = lazyWithRetry(() => import("../modules/planos/PlanosWorkspace"));
export const PozosWorkspace = lazyWithRetry(() => import("../modules/pozos/PozosWorkspace"));
export const ManagerDashboardWorkspace = lazyWithRetry(() => import("../modules/dashboard/ManagerDashboardWorkspace"));

export const ReportsWorkspace = lazyWithRetry(() => import("../modules/reports/ReportsWorkspace"));

export const PadronRequestsWorkspace = lazyWithRetry(() => import("../modules/requests/PadronRequestsWorkspace"));

export const DashboardWorkspace = lazyWithRetry(() => import("../modules/dashboard/DashboardWorkspace"));

export const TransportWorkspace = lazyWithRetry(() => import("../components/TransportWorkspace"));

export const ImportacionWorkspace = lazyWithRetry(() => import("../components/ImportacionWorkspace"));

export const SigTerritorialWorkspace = lazyWithRetry(() => import("../modules/sig/SigTerritorialWorkspace"));

export const ClandestinosPage = lazyWithRetry(() => import("../modules/clandestinos/pages/ClandestinosPage"));

export const InspeccionesPage = lazyWithRetry(() => import("../modules/inspecciones/pages/InspeccionesPage"));

export const EntregasPage = lazyWithRetry(() => import("../modules/entregas/pages/EntregasPage"));

export const ReclamosWorkspace = lazyWithRetry(() => import("../modules/reclamos/ReclamosWorkspace"));

export const NotesPage = lazyWithRetry(() => import("../modules/notes/pages/NotesPage"));

// Los módulos viajan en su propio archivo, así que la primera visita cuesta una
// descarga. Se adelanta en cuanto el puntero (o el foco del teclado) toca su
// ítem del menú: para cuando llega el clic, el código ya está en caché.
export const MODULE_LOADERS = {
  dashboard: () => import("../modules/dashboard/DashboardWorkspace"),
  notes: () => import("../modules/notes/pages/NotesPage"),
  inspecciones: () => import("../modules/inspecciones/pages/InspeccionesPage"),
  entregas: () => import("../modules/entregas/pages/EntregasPage"),
  reclamos: () => import("../modules/reclamos/ReclamosWorkspace"),
  records: () => import("../modules/clandestinos/pages/ClandestinosPage"),
  importacion: () => import("../components/ImportacionWorkspace"),
  sigTerritorial: () => import("../modules/sig/SigTerritorialWorkspace"),
  map: () => import("../components/FieldMap"),
  fieldValidation: () => import("../components/FieldValidationWorkspace"),
  mapReports: () => import("../modules/reports/ReportsWorkspace"),
  planos: () => import("../modules/planos/PlanosWorkspace"),
  pozos: () => import("../modules/pozos/PozosWorkspace"),
  profile: () => import("../components/profile/MyProfileWorkspace"),
  railwayUsage: () => import("../components/RailwayUsageWorkspace"),
  teamActivity: () => import("../modules/actividad/TeamActivityWorkspace"),
  fallas: () => import("../modules/fallas/FallasWorkspace")
};

// Un fallo aquí no es un error de la app: el módulo se volverá a pedir al entrar.
export const prefetchModule = (key) => {
  MODULE_LOADERS[key]?.().catch(() => {});
};
