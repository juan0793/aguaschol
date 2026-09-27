import { useCallback } from "react";

export function useDashboardRefresh({
  isAdmin,
  isAuthenticated,
  loadAuditLogs,
  loadMapDiaryGroups,
  loadRecordSummary,
  setDashboardConnectionStatus,
  setDashboardLastUpdatedAt,
  setDashboardRefreshing,
  workspaceView
}) {
  const refreshDashboard = useCallback(
    async ({ force = false } = {}) => {
      if (!isAuthenticated || !isAdmin || workspaceView !== "dashboard") return;
      if (!force && document.visibilityState !== "visible") return;

      setDashboardRefreshing(true);
      setDashboardConnectionStatus("updating");
      try {
        // `loadUsers` no va aqui: el efecto de usuarios en linea ya es su dueño
        // unico y lo refresca cada 20 s, ademas de al enfocar la ventana y al
        // volver a la pestaña. Teniendolo tambien en este ciclo de 10 s, /users
        // salia dos veces al abrir el tablero y nueve veces por minuto.
        await Promise.all([
          loadRecordSummary({ silent: true }),
          loadMapDiaryGroups({ silent: true }),
          loadAuditLogs({ silent: true })
        ]);
        setDashboardLastUpdatedAt(Date.now());
        setDashboardConnectionStatus("synced");
      } catch {
        setDashboardConnectionStatus("retrying");
      } finally {
        setDashboardRefreshing(false);
      }
    },
    [isAuthenticated, isAdmin, workspaceView]
  );

  return { refreshDashboard };
}
