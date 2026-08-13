const itemLabels = {
  inspecciones: "Inspecciones",
  records: "Fichas clandestinas",
  fieldValidation: "Control territorial GPS",
  mapReports: "Reportes de levantamiento",
  planos: "Planos y croquis",
  executiveReport: "Operaciones",
  requests: "Impresión e informes",
  logs: "Auditoría"
};

export const buildSidebarSections = (items = [], dashboardItem = null) => {
  const byKey = new Map(items.map((item) => [item.key, { ...item, label: itemLabels[item.key] || item.label }]));
  const take = (keys) => keys.map((key) => byKey.get(key)).filter(Boolean);

  return [
    { key: "principal", title: "Principal", items: [dashboardItem, ...take(["profile", "inspecciones", "lookup"])].filter(Boolean) },
    { key: "clandestinos", title: "Clandestinos", icon: "records", collapsible: true, items: take(["records", "fieldValidation", "mapReports"]) },
    { key: "levantamiento", title: "Levantamiento", icon: "map", collapsible: true, items: take(["map", "planos"]) },
    { key: "gestion", title: "Gestión", icon: "logs", collapsible: true, items: take(["executiveReport", "requests", "barrioCodes", "padron", "importacion", "logs", "users"]) }
  ].filter((section) => section.items.length);
};
