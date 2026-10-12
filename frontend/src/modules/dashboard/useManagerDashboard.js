import { useCallback, useEffect, useRef, useState } from "react";
import { managerMonthRange } from "./managerDashboardSelectors.js";

export const managerToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function useManagerDashboard(apiFetch, { enabled = true } = {}) {
  const [month, setMonth] = useState(() => managerToday().slice(0, 7));
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestRef = useRef(null);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const range = managerMonthRange(month, managerToday());
      const paths = {
        padron: "/claves/services/report", meta: "/claves/meta",
        inspections: `/inspecciones/resumen?mes=${month}`,
        deliveries: `/entregas/resumen?fecha_desde=${range.from}&fecha_hasta=${range.to}`,
        fichas: "/clandestinos/fichas?limit=1", gps: "/map-points/diary-groups",
        activity: "/admin/team-activity?limit=5&resumen=0"
      };
      const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
        const response = await apiFetch(path, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || `No se pudo consultar ${key}.`);
        return [key, body];
      }));
      if (controller.signal.aborted) return;
      setSnapshot({ ...Object.fromEntries(entries), month });
      setUpdatedAt(new Date());
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason.message || "No se pudieron actualizar los indicadores.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [apiFetch, month, enabled]);
  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60000);
    return () => { clearInterval(timer); requestRef.current?.abort(); };
  }, [refresh, enabled]);
  return { month, setMonth, snapshot, loading, error, updatedAt, refresh };
}
