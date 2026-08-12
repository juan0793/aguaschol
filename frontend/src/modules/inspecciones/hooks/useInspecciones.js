import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "aguas.inspecciones.inbox.v1";
const restore = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const EMPTY_FILTERS = { q: "", estado: "", barrio: "", tecnico_id: "", fecha_desde: "", fecha_hasta: "" };

export const useInspecciones = (api, active = true) => {
  const saved = useMemo(restore, []);
  const [filters, setFiltersState] = useState({ ...EMPTY_FILTERS, ...saved.filters });
  const [page, setPage] = useState(saved.page || 1);
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 10, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!active) return;
      if (!silent) setLoading(true);
      setError("");
      try {
        setData(await api.list({ ...filters, page, limit: 10 }));
      } catch (reason) {
        setError(reason.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [active, api, filters, page]
  );

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!active) return undefined;
    const refresh = () => load({ silent: true });
    const timer = setInterval(refresh, 15000);
    addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      removeEventListener("visibilitychange", refresh);
    };
  }, [active, load]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters, page }));
  }, [filters, page]);

  const setFilters = (patch) => {
    setFiltersState((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const clearFilters = () => {
    setFiltersState(EMPTY_FILTERS);
    setPage(1);
  };

  return { ...data, loading, error, filters, setFilters, clearFilters, page, setPage, reload: () => load() };
};
