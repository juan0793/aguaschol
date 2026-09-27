import { useState } from "react";

export function useDashboardState() {
  const [dashboardNow, setDashboardNow] = useState(() => Date.now());
  const [dashboardLastUpdatedAt, setDashboardLastUpdatedAt] = useState(() => Date.now());
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  // Solo la recarga pedida con el botón: la automática de cada 10 s no debe
  // deshabilitar ni hacer girar el botón Actualizar.
  const [dashboardManualRefreshing, setDashboardManualRefreshing] = useState(false);
  const [dashboardConnectionStatus, setDashboardConnectionStatus] = useState("synced");
  const [dashboardAlertFilter, setDashboardAlertFilter] = useState("all");

  return {
    dashboardNow,
    setDashboardNow,
    dashboardLastUpdatedAt,
    setDashboardLastUpdatedAt,
    dashboardRefreshing,
    setDashboardRefreshing,
    dashboardManualRefreshing,
    setDashboardManualRefreshing,
    dashboardConnectionStatus,
    setDashboardConnectionStatus,
    dashboardAlertFilter,
    setDashboardAlertFilter
  };
}
