import { lazy } from "react";

export const lazyWithRetry = (loader) => lazy(async () => {
  try {
    return await loader();
  } catch (error) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    return loader();
  }
});

export const FieldMap = lazyWithRetry(() => import("../components/FieldMap"));

export const MapPrintDialog = lazyWithRetry(() => import("../components/MapPrintDialog"));

export const FieldValidationWorkspace = lazy(() => import("../components/FieldValidationWorkspace"));

export const MyProfileWorkspace = lazy(() => import("../components/profile/MyProfileWorkspace"));

export const RailwayUsageWorkspace = lazy(() => import("../components/RailwayUsageWorkspace"));

export const PlanosWorkspace = lazy(() => import("../modules/planos/PlanosWorkspace"));

export const ReportsWorkspace = lazy(() => import("../modules/reports/ReportsWorkspace"));

export const PadronRequestsWorkspace = lazy(() => import("../modules/requests/PadronRequestsWorkspace"));

export const DashboardWorkspace = lazy(() => import("../modules/dashboard/DashboardWorkspace"));

export const TransportWorkspace = lazy(() => import("../components/TransportWorkspace"));

export const ImportacionWorkspace = lazy(() => import("../components/ImportacionWorkspace"));

export const SigTerritorialWorkspace = lazy(() => import("../modules/sig/SigTerritorialWorkspace"));

export const ClandestinosPage = lazyWithRetry(() => import("../modules/clandestinos/pages/ClandestinosPage"));

export const InspeccionesPage = lazyWithRetry(() => import("../modules/inspecciones/pages/InspeccionesPage"));

export const EntregasPage = lazyWithRetry(() => import("../modules/entregas/pages/EntregasPage"));

export const NotesPage = lazyWithRetry(() => import("../modules/notes/pages/NotesPage"));

// Los módulos viajan en su propio archivo, así que la primera visita cuesta una
// descarga. Se adelanta en cuanto el puntero (o el foco del teclado) toca su
// ítem del menú: para cuando llega el clic, el código ya está en caché.
export const MODULE_LOADERS = {
  dashboard: () => import("../modules/dashboard/DashboardWorkspace"),
  notes: () => import("../modules/notes/pages/NotesPage"),
  inspecciones: () => import("../modules/inspecciones/pages/InspeccionesPage"),
  entregas: () => import("../modules/entregas/pages/EntregasPage"),
  records: () => import("../modules/clandestinos/pages/ClandestinosPage"),
  importacion: () => import("../components/ImportacionWorkspace"),
  sigTerritorial: () => import("../modules/sig/SigTerritorialWorkspace"),
  map: () => import("../components/FieldMap"),
  fieldValidation: () => import("../components/FieldValidationWorkspace"),
  mapReports: () => import("../modules/reports/ReportsWorkspace"),
  planos: () => import("../modules/planos/PlanosWorkspace"),
  profile: () => import("../components/profile/MyProfileWorkspace"),
  railwayUsage: () => import("../components/RailwayUsageWorkspace")
};

// Un fallo aquí no es un error de la app: el módulo se volverá a pedir al entrar.
export const prefetchModule = (key) => {
  MODULE_LOADERS[key]?.().catch(() => {});
};
