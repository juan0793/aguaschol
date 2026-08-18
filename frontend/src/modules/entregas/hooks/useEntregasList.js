import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Hook de listado paginado y filtrado, compartido por lotes y no entregadas.
// Mantiene los filtros en sessionStorage para no perder el contexto al navegar
// entre subvistas del modulo. No hace polling: solo recarga bajo demanda.
export const useEntregasList = ({ fetcher, storageKey, defaultFilters = {}, active = true, limit = 12 }) => {
  const restaurado = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  }, [storageKey]);

  const [filters, setFiltersState] = useState({ ...defaultFilters, ...restaurado.filters });
  const [page, setPage] = useState(restaurado.page || 1);
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!active) return;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetcher({ ...filters, page, limit });
      if (id !== requestId.current) return; // respuesta obsoleta: una carga mas nueva ya esta en curso
      setData(result);
    } catch (reason) {
      if (id !== requestId.current) return;
      setError(reason.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [active, fetcher, filters, limit, page]);

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ filters, page }));
  }, [filters, page, storageKey]);

  const setFilters = useCallback((patch) => {
    setFiltersState((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return { ...data, loading, error, filters, setFilters, clearFilters, page, setPage, reload: load };
};
