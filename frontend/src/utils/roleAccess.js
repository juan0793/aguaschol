export const MANAGER_NAVIGATION = [
  { key: "requests", label: "Consultas e informes", icon: "records", helper: "Informes PDF gerenciales" },
  { key: "inspecciones", label: "Inspecciones", icon: "activity", helper: "Consulta y desempeño" },
  { key: "entregas", label: "Control de entregas", icon: "archive", helper: "Seguimiento de reparto" },
  { key: "records", label: "Clandestinos", icon: "records", helper: "Fichas y evidencias" },
  { key: "lookup", label: "Buscar clave", icon: "search", helper: "Consulta del padrón" },
  { key: "sigTerritorial", label: "SIG Territorial", icon: "map", helper: "Cartografía institucional" },
  { key: "fieldValidation", label: "Puntos GPS", icon: "map", helper: "Consulta territorial" },
  { key: "planos", label: "Planos autorizados", icon: "map", helper: "Aprobados y publicados" },
  { key: "pozos", label: "Pozos", icon: "water", helper: "Inventario y calidad del agua" },
  { key: "teamActivity", label: "Actividad del equipo", icon: "users", helper: "Seguimiento institucional" },
  { key: "fallas", label: "Fallas del equipo", icon: "fallas", helper: "Lo que no se pudo guardar" }
];

export const canOpenWorkspace = (role, view) => role !== "gerente" || view === "dashboard" || MANAGER_NAVIGATION.some((item) => item.key === view);
