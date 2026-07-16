import { useCallback, useEffect, useState } from "react";
export const useReportes = (api, active = true) => {
  const [query, setQuery] = useState(""); const [state, setState] = useState(""); const [items, setItems] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async ({ silent = false } = {}) => { if (!active) return; if (!silent) setLoading(true); setError(""); try { setItems(await api.reports({ q: query, state })); } catch (reason) { setError(reason.message); } finally { if (!silent) setLoading(false); } }, [active, api, query, state]);
  useEffect(() => { const timer = setTimeout(load, 160); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (!active) return undefined; const refresh = () => load({ silent: true }); const timer = setInterval(refresh, 10000); addEventListener("visibilitychange", refresh); return () => { clearInterval(timer); removeEventListener("visibilitychange", refresh); }; }, [active, load]);
  return { items, loading, error, query, setQuery, state, setState, reload: () => load() };
};
