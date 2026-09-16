const itemLabels = {
  inspecciones: "Inspecciones",
  entregas: "Control de entregas",
  sigTerritorial: "SIG Territorial",
  records: "Fichas clandestinas",
  fieldValidation: "Control territorial GPS",
  mapReports: "Reportes de levantamiento",
  planos: "Planos y croquis",
  executiveReport: "Operaciones",
  requests: "Impresión e informes",
  logs: "Auditoría",
  notes: "Apuntes"
};

const routeViews = {
  "/dashboard": "dashboard",
  "/tablero": "dashboard",
  "/perfil": "profile",
  "/inspecciones": "inspecciones",
  "/entregas": "entregas",
  "/clandestinos": "records",
  "/buscar": "lookup",
  "/sig-territorial": "sigTerritorial",
  "/mapa": "map",
  "/control-territorial": "fieldValidation",
  "/reportes-gps": "mapReports",
  "/planos": "planos",
  "/informes": "requests",
  "/barrios": "barrioCodes",
  "/padron": "padron",
  "/importacion": "importacion",
  "/auditoria": "logs",
  "/usuarios": "users",
  "/apuntes": "notes"
};

export const getWorkspaceViewFromPath = (pathname = "") => routeViews[String(pathname).replace(/\/$/, "").toLowerCase()] ?? null;

// Ruta canonica de cada vista (la primera declarada en routeViews). Las vistas sin ruta propia
// vuelven a "/" para que una recarga no reabra la ultima vista enlazada.
const viewPaths = Object.entries(routeViews).reduce((paths, [path, view]) => (paths[view] ? paths : { ...paths, [view]: path }), {});
export const getPathForWorkspaceView = (view) => viewPaths[view] ?? "/";

export const buildSidebarSections = (items = [], dashboardItem = null) => {
  const byKey = new Map(items.map((item) => [item.key, { ...item, label: itemLabels[item.key] || item.label }]));
  const take = (keys) => keys.map((key) => byKey.get(key)).filter(Boolean);

  return [
    { key: "dashboard", title: "Dashboard", helper: "Vista general", icon: "home", collapsible: true, items: [dashboardItem, ...take(["notes"])].filter(Boolean) },
    { key: "operacion", title: "Operación", helper: "Procesos diarios", icon: "activity", collapsible: true, items: take(["inspecciones", "entregas", "records", "lookup"]) },
    { key: "gestion", title: "Gestión", helper: "Datos y administración", icon: "records", collapsible: true, items: take(["requests", "barrioCodes", "padron", "importacion", "logs", "users"]) },
    { key: "territorio", title: "Territorio", helper: "Mapas y zonas", icon: "map", collapsible: true, items: take(["sigTerritorial", "map", "fieldValidation", "mapReports", "planos"]) },
    { key: "sistema", title: "Sistema", helper: "Cuenta y configuración", icon: "settings", collapsible: true, items: take(["profile"]) }
  ].filter((section) => section.items.length);
};
