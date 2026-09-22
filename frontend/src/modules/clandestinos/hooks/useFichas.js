import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "aguas.clandestinos.inbox.v1";
const PAGE_SIZE = 15;
// Respuestas recordadas por combinacion de filtros. Con pocas decenas alcanza
// para todas las etapas y las paginas que se recorren en una sesion.
const CACHE_LIMIT = 24;
// Solo el texto del buscador espera a que se termine de escribir; una pestaña,
// un barrio o una pagina se piden en el acto.
const TYPING_DELAY = 250;
const ETAPAS = ["draft", "pending", "visit", "confirmed", "regularization", "regularized", "discarded"];

const restore = () => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
export const fichasKey = ({ query = "", state = "", barrio = "", page = 1 }) => JSON.stringify([query.trim(), state, barrio, page]);

export const useFichas = (api, active = true) => {
  const saved = useMemo(restore, []);
  const [query, setQuery] = useState(saved.query || "");
  const [state, setState] = useState(saved.state || "");
  const [barrio, setBarrio] = useState(saved.barrio || "");
  const [page, setPage] = useState(saved.page || 1);
  const [data, setData] = useState({ items: [], counts: {}, total: 0, page: 1, total_pages: 1, key: "" });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasData = useRef(false);
  const requestSequence = useRef(0);
  const cache = useRef(new Map());
  const inFlight = useRef(new Map());
  const lastQuery = useRef(query);
  const key = fichasKey({ query, state, barrio, page });

  // Una sola peticion por combinacion aunque la pidan la precarga y el clic.
  const request = useCallback((params) => {
    const entryKey = fichasKey(params);
    if (inFlight.current.has(entryKey)) return inFlight.current.get(entryKey);
    const promise = api
      .fichas({ q: params.query.trim(), state: params.state, barrio: params.barrio, page: params.page, limit: PAGE_SIZE })
      .then((next) => {
        const value = { ...next, key: entryKey };
        // Lo mas reciente al final; al pasar el limite sale lo mas viejo.
        cache.current.delete(entryKey);
        cache.current.set(entryKey, value);
        if (cache.current.size > CACHE_LIMIT) cache.current.delete(cache.current.keys().next().value);
        return value;
      })
      .finally(() => inFlight.current.delete(entryKey));
    inFlight.current.set(entryKey, promise);
    return promise;
  }, [api]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!active) return;
    const requestId = ++requestSequence.current;
    if (!silent) hasData.current ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const next = await request({ query, state, barrio, page });
      if (requestId !== requestSequence.current) return;
      hasData.current = true;
      setData(next);
    } catch (reason) {
      if (requestId === requestSequence.current) setError(reason.message);
    } finally {
      if (requestId === requestSequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, [active, barrio, page, query, request, state]);

  // Si la combinacion ya se vio, se muestra al instante y se revalida en
  // silencio; si no, se pide ya (o al terminar de escribir en el buscador).
  useEffect(() => {
    const cached = cache.current.get(key);
    if (cached) { hasData.current = true; setData(cached); }
    const typing = lastQuery.current !== query;
    lastQuery.current = query;
    const timer = setTimeout(() => load({ silent: Boolean(cached) }), typing ? TYPING_DELAY : 0);
    return () => clearTimeout(timer);
  }, [key, load, query]);

  // Precarga: con la respuesta se piden en segundo plano las demas etapas con
  // fichas, para que cambiar de pestaña no espere a la red (en el telefono no
  // hay "pasar el mouse" que anticipe el clic). Con texto en el buscador no se
  // precarga: cada busqueda terminada dispararia siete consultas.
  const counts = data.counts;
  useEffect(() => {
    if (!active || !counts || page !== 1 || query.trim()) return undefined;
    const pendientes = ["", ...ETAPAS].filter((etapa) => etapa !== state && (etapa === "" || Number(counts[etapa] || 0) > 0));
    const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 300));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => {
      pendientes.forEach((etapa) => {
        const params = { query, state: etapa, barrio, page: 1 };
        if (!cache.current.has(fichasKey(params))) request(params).catch(() => {});
      });
    });
    return () => cancel(handle);
  }, [active, barrio, counts, page, query, request, state]);

  useEffect(() => { if (!active) return undefined; const refresh = () => load({ silent: true }); const timer = setInterval(refresh, 10000); addEventListener("visibilitychange", refresh); return () => { clearInterval(timer); removeEventListener("visibilitychange", refresh); }; }, [active, load]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query, state, barrio, page })); }, [barrio, page, query, state]);

  // Adelanta una etapa al pasar el cursor o enfocar su pestaña.
  const prefetchState = (etapa) => {
    const params = { query, state: etapa, barrio, page: 1 };
    if (!cache.current.has(fichasKey(params))) request(params).catch(() => {});
  };

  const filters = { query, state, barrio, page, setQuery: (value) => { setQuery(value); setPage(1); }, setState: (value) => { setState(value); setPage(1); }, setBarrio: (value) => { setBarrio(value); setPage(1); }, setPage, clear: () => { setQuery(""); setState(""); setBarrio(""); setPage(1); } };
  // Tras guardar una ficha lo recordado ya no vale: se descarta y se recarga.
  const reload = () => { cache.current.clear(); return load(); };
  return { ...data, viewKey: data.key, loading, refreshing, error, filters, prefetchState, reload };
};
