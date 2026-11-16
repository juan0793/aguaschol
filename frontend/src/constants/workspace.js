// Recargas automáticas (2026-11-15): antes había ciclos de 8 a 30 s en varias
// pantallas y el tablero cada 10 s; eran muchas consultas a Railway para cifras
// que cambian poco. Ahora los datos se recargan cada 2 min, y siempre al volver
// a la pestaña o a la ventana; lo que llega en vivo usa el WebSocket.
export const AUTO_REFRESH_MS = 2 * 60 * 1000;
// Presencia ("en línea") y conteo de mensajes: 1 min.
export const PRESENCE_REFRESH_MS = 60 * 1000;
export const DASHBOARD_REFRESH_INTERVAL_MS = AUTO_REFRESH_MS;

export const MAP_POINT_LIST_INITIAL_LIMIT = 30;

export const MAP_POINT_LIST_STEP = 30;

export const MOBILE_MAP_POINT_LIMIT = 180;

export const MAP_AUTO_REFRESH_MS = AUTO_REFRESH_MS;

export const MOBILE_MAP_AUTO_REFRESH_MS = AUTO_REFRESH_MS;

export const RECORDS_PAGE_SIZE = 10;

export const MAP_DIARY_PRIMARY_LIMIT = 4;

export const PADRON_SYNC_STEPS = [
  { label: "Cache borrado", progress: 24 },
  { label: "Datos reemplazados", progress: 72 },
  { label: "Excel completo verificado", progress: 100 }
];

export const EXECUTIVE_REPORT_CREDIT =
  "Supervisado, desarrollado, implementado y documentado por el Ingeniero Juan Ramón Ordóñez Bonilla, con seguimiento directo del trabajo realizado en campo.";
