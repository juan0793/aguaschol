import { useCallback, useEffect, useMemo, useState } from "react";

// Se piden todos los reportes (son pocos) y el estado se filtra aquí: así las
// etiquetas de estado muestran cuántos hay en cada uno sin otra consulta.
export const useReportes = (api, active = true) => {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!active) return;
    if (!silent) setLoading(true);
    setError("");
    try { setAll(await api.reports({ q: query })); } catch (reason) { setError(reason.message); } finally { if (!silent) setLoading(false); }
  }, [active, api, query]);
  useEffect(() => { const timer = setTimeout(load, 160); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!active) return undefined;
    const refresh = () => load({ silent: true });
    const timer = setInterval(refresh, 10000);
    addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); removeEventListener("visibilitychange", refresh); };
  }, [active, load]);
  const counts = useMemo(() => all.reduce((acc, item) => ({ ...acc, [item.estado]: (acc[item.estado] || 0) + 1 }), {}), [all]);
  const items = useMemo(() => (state ? all.filter((item) => item.estado === state) : all), [all, state]);
  return { items, total: all.length, counts, loading, error, query, setQuery, state, setState, reload: () => load() };
};
