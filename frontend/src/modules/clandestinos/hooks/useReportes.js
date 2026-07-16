import { useCallback, useEffect, useState } from "react";
export const useReportes = (api, active = true) => {
  const [query, setQuery] = useState(""); const [state, setState] = useState(""); const [items, setItems] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { if (!active) return; setLoading(true); setError(""); try { setItems(await api.reports({ q: query, state })); } catch (reason) { setError(reason.message); } finally { setLoading(false); } }, [active, api, query, state]);
  useEffect(() => { const timer = setTimeout(load, 160); return () => clearTimeout(timer); }, [load]);
  return { items, loading, error, query, setQuery, state, setState, reload: load };
};
