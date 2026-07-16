import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "aguas.clandestinos.inbox.v1";
const restore = () => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };

export const useFichas = (api, active = true) => {
  const saved = useMemo(restore, []);
  const [query, setQuery] = useState(saved.query || "");
  const [state, setState] = useState(saved.state || "");
  const [barrio, setBarrio] = useState(saved.barrio || "");
  const [page, setPage] = useState(saved.page || 1);
  const [data, setData] = useState({ items: [], counts: {}, total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => { if (!active) return; setLoading(true); setError(""); try { setData(await api.fichas({ q: query, state, barrio, page, limit: 15 })); } catch (reason) { setError(reason.message); } finally { setLoading(false); } }, [active, api, barrio, page, query, state]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query, state, barrio, page })); }, [barrio, page, query, state]);
  const filters = { query, state, barrio, page, setQuery: (value) => { setQuery(value); setPage(1); }, setState: (value) => { setState(value); setPage(1); }, setBarrio: (value) => { setBarrio(value); setPage(1); }, setPage, clear: () => { setQuery(""); setState(""); setBarrio(""); setPage(1); } };
  return { ...data, loading, error, filters, reload: load };
};
