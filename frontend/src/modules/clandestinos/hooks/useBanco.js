import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "aguas.clandestinos.banco.v1";
const restore = () => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };

export const useBanco = (api, active = true) => {
  const saved = useMemo(restore, []);
  const [query, setQuery] = useState(saved.query || "");
  const [dictamen, setDictamen] = useState(saved.dictamen || "");
  const [estado, setEstado] = useState(saved.estado ?? "pendiente");
  const [barrio, setBarrio] = useState(saved.barrio || "");
  const [page, setPage] = useState(saved.page || 1);
  const [data, setData] = useState({ items: [], counts: {}, estados: {}, barrios: [], total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasData = useRef(false);
  const requestSequence = useRef(0);
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!active) return;
    const requestId = ++requestSequence.current;
    if (!silent) hasData.current ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const next = await api.banco({ q: query, dictamen, estado, barrio, page, limit: 20 });
      if (requestId !== requestSequence.current) return;
      hasData.current = true;
      setData(next);
    } catch (reason) {
      if (requestId === requestSequence.current) setError(reason.message);
    } finally {
      if (!silent && requestId === requestSequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, [active, api, barrio, dictamen, estado, page, query]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query, dictamen, estado, barrio, page })); }, [barrio, dictamen, estado, page, query]);
  const reset = (setter) => (value) => { setter(value); setPage(1); };
  const filters = { query, dictamen, estado, barrio, page, setQuery: reset(setQuery), setDictamen: reset(setDictamen), setEstado: reset(setEstado), setBarrio: reset(setBarrio), setPage, clear: () => { setQuery(""); setDictamen(""); setEstado("pendiente"); setBarrio(""); setPage(1); } };
  return { ...data, loading, refreshing, error, filters, reload: (options) => load(options) };
};
