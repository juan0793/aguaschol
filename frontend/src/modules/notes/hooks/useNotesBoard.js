import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compareNotes, matchesQuery, matchesView } from "../utils/notesOrder";

const PAGE_SIZE = 40;
const SEARCH_DEBOUNCE_MS = 300;
const TOAST_MS = 7000;
const SORT_STORAGE_KEY = "aguas.notes.sort.v1";

const readSort = () => {
  try {
    const saved = window.localStorage.getItem(SORT_STORAGE_KEY);
    return ["manual", "updated", "created"].includes(saved) ? saved : "manual";
  } catch {
    return "manual";
  }
};

const byId = (notes) => Object.fromEntries(notes.map((note) => [note.id, note]));

/**
 * Estado del tablero. Las notas viven en un mapa por id; el listado base y los resultados de
 * busqueda solo guardan ids, asi una mutacion se refleja en ambos sin duplicar datos.
 * Las mutaciones simples son optimistas y se revierten si el servidor falla.
 */
export const useNotesBoard = (api) => {
  const [view, setViewState] = useState("all");
  const [sort, setSortState] = useState(readSort);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState({});
  const [baseIds, setBaseIds] = useState([]);
  const [baseCursor, setBaseCursor] = useState(null);
  const [searchIds, setSearchIds] = useState(null);
  const [searchCursor, setSearchCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [categories, setCategories] = useState([]);

  const recordsRef = useRef(records);
  recordsRef.current = records;
  const queues = useRef(new Map());
  const toastTimer = useRef(null);
  const trimmedQuery = query.trim();

  // Al cambiar de vista se vacia el listado para mostrar el esqueleto en lugar de notas de la
  // vista anterior mientras llega la nueva pagina.
  const setView = (value) => {
    if (value === view) return;
    setBaseIds([]);
    setBaseCursor(null);
    setSearchIds(null);
    setViewState(value);
  };

  const setSort = (value) => {
    setSortState(value);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // Preferencia de conveniencia: si no se puede guardar, se usa el orden manual.
    }
  };

  const showToast = useCallback((message, action = null) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const listParams = useMemo(() => ({
    archived: view === "archived" ? "1" : "",
    pinned: view === "pinned" ? "1" : "",
    sort,
    limit: PAGE_SIZE
  }), [view, sort]);

  const merge = (notes) => setRecords((current) => ({ ...current, ...byId(notes) }));

  const loadCategories = useCallback(() => {
    api.categories().then((data) => setCategories(data.items || [])).catch(() => {});
  }, [api]);

  // Listado base: cambia con la vista y el orden, nunca con la busqueda.
  const loadBase = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.list(listParams, { signal });
      setRecords((current) => ({ ...byId(Object.values(current).filter((note) => note.pending)), ...byId(data.items) }));
      setBaseIds(data.items.map((note) => note.id));
      setBaseCursor(data.next_cursor);
    } catch (reason) {
      if (reason.name !== "AbortError") setError(reason.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [api, listParams]);

  useEffect(() => {
    const controller = new AbortController();
    loadBase(controller.signal);
    return () => controller.abort();
  }, [loadBase]);

  useEffect(loadCategories, [loadCategories]);

  // Busqueda en dos capas: el filtro local responde al instante y la consulta al servidor
  // (con debounce) la reemplaza para incluir notas que aun no se han cargado.
  useEffect(() => {
    if (!trimmedQuery) {
      setSearchIds(null);
      setSearchCursor(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await api.list({ ...listParams, q: trimmedQuery }, { signal: controller.signal });
        merge(data.items);
        setSearchIds(data.items.map((note) => note.id));
        setSearchCursor(data.next_cursor);
      } catch (reason) {
        if (reason.name !== "AbortError") setError(reason.message);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, listParams, trimmedQuery]);

  const loadMore = async () => {
    const searching = Boolean(trimmedQuery && searchIds);
    const cursor = searching ? searchCursor : baseCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.list({ ...listParams, cursor, ...(searching ? { q: trimmedQuery } : {}) });
      merge(data.items);
      const ids = data.items.map((note) => note.id);
      if (searching) {
        setSearchIds((current) => [...(current || []), ...ids]);
        setSearchCursor(data.next_cursor);
      } else {
        setBaseIds((current) => [...current, ...ids]);
        setBaseCursor(data.next_cursor);
      }
    } catch (reason) {
      showToast(reason.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleNotes = useMemo(() => {
    const ids = trimmedQuery && searchIds ? searchIds : [...new Set([...baseIds, ...Object.keys(records).map(Number).filter((id) => records[id]?.pending || records[id]?.created_here)])];
    return ids
      .map((id) => records[id])
      .filter(Boolean)
      .filter((note) => !note.deleted && matchesView(note, view) && (searchIds && trimmedQuery ? true : matchesQuery(note, trimmedQuery)))
      .sort(compareNotes(sort));
  }, [baseIds, records, searchIds, sort, trimmedQuery, view]);

  // Serializa las escrituras de una misma nota para que cada una lleve el updated_at vigente.
  const enqueue = (id, task) => {
    const previous = queues.current.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.current.set(id, next);
    return next;
  };

  const upsert = useCallback((note) => setRecords((current) => ({ ...current, [note.id]: { ...current[note.id], ...note, pending: false } })), []);
  const patchLocal = (id, changes) => setRecords((current) => (current[id] ? { ...current, [id]: { ...current[id], ...changes } } : current));

  const create = async ({ title = "", content, color = "default", category = "" }) => {
    const tempId = -Date.now();
    const minOrder = Math.min(0, ...Object.values(recordsRef.current).map((note) => note.sort_order));
    const now = new Date().toISOString();
    setRecords((current) => ({
      ...current,
      [tempId]: { id: tempId, title, content, color, category, is_pinned: false, is_archived: false, sort_order: minOrder - 1000, created_at: now, updated_at: now, links: [], pending: true }
    }));
    try {
      const created = await api.create({ title, content, color, category });
      setRecords((current) => {
        const { [tempId]: _temp, ...rest } = current;
        return { ...rest, [created.id]: { ...created, created_here: true } };
      });
      if (view === "archived") setView("all");
      if (category) loadCategories();
      return created;
    } catch (reason) {
      setRecords((current) => {
        const { [tempId]: _temp, ...rest } = current;
        return rest;
      });
      throw reason;
    }
  };

  /** Edicion con reversion. Con `checkConflict` manda el updated_at vigente y deja pasar el 409. */
  const update = async (id, changes, { optimistic = true, checkConflict = false } = {}) => {
    const previous = recordsRef.current[id];
    if (!previous || previous.pending) return null;
    if (optimistic) patchLocal(id, changes);
    try {
      const saved = await enqueue(id, () => api.update(id, {
        ...changes,
        ...(checkConflict ? { expected_updated_at: recordsRef.current[id]?.updated_at } : {})
      }));
      upsert(saved);
      if ("category" in changes) loadCategories();
      return saved;
    } catch (reason) {
      if (optimistic) patchLocal(id, Object.fromEntries(Object.keys(changes).map((key) => [key, previous[key]])));
      if (reason.status !== 409 || !checkConflict) showToast(reason.message);
      throw reason;
    }
  };

  const quiet = (promise) => promise.catch(() => null);

  const togglePin = (note) => quiet(update(note.id, { is_pinned: !note.is_pinned }));
  const setColor = (note, color) => quiet(update(note.id, { color }));

  const archive = async (note) => {
    const saved = await quiet(update(note.id, { is_archived: true, is_pinned: false }));
    if (!saved) return;
    showToast("Apunte archivado", {
      label: "Deshacer",
      run: () => quiet(update(note.id, { is_archived: false, is_pinned: note.is_pinned }))
    });
  };

  const unarchive = async (note) => {
    const saved = await quiet(update(note.id, { is_archived: false }));
    if (saved) showToast("Apunte restaurado al tablero");
  };

  const remove = async (note) => {
    patchLocal(note.id, { deleted: true });
    try {
      await enqueue(note.id, () => api.remove(note.id));
      showToast("Apunte eliminado", {
        label: "Deshacer",
        run: async () => {
          try {
            const restored = await api.restore(note.id);
            upsert({ ...restored, deleted: false });
            if (!baseIds.includes(note.id)) setBaseIds((current) => [...current, note.id]);
          } catch (reason) {
            showToast(reason.message);
          }
        }
      });
    } catch (reason) {
      patchLocal(note.id, { deleted: false });
      showToast(reason.message);
    }
  };

  const duplicate = async (note) => {
    try {
      const copy = await api.duplicate(note.id);
      setRecords((current) => ({ ...current, [copy.id]: { ...copy, created_here: true } }));
      if (view !== "all") setView("all");
      showToast("Apunte duplicado");
      return copy;
    } catch (reason) {
      showToast(reason.message);
      return null;
    }
  };

  const move = async (note, { before_id: beforeId, after_id: afterId, sort_order: sortOrder }) => {
    const previousOrder = note.sort_order;
    patchLocal(note.id, { sort_order: sortOrder });
    try {
      const saved = await enqueue(note.id, () => api.move(note.id, { before_id: beforeId, after_id: afterId }));
      upsert(saved);
      // Si el servidor ubico la nota en otro valor (vecino real distinto o renumeracion),
      // el resto del orden local puede estar desfasado: se recarga en silencio.
      if (Math.abs(saved.sort_order - sortOrder) > 1e-6) loadBase();
    } catch (reason) {
      patchLocal(note.id, { sort_order: previousOrder });
      showToast(reason.status === 409 ? "El tablero cambió; se recargó el orden." : reason.message);
      loadBase();
    }
  };

  const addLink = async (id, payload) => {
    const saved = await api.link(id, payload);
    upsert(saved);
    return saved;
  };

  const hasMore = Boolean(trimmedQuery && searchIds ? searchCursor : baseCursor);
  const searchPending = Boolean(trimmedQuery) && searchIds === null;

  return {
    view, setView, sort, setSort, query, setQuery,
    records, visibleNotes, loading, loadingMore, hasMore, loadMore, error, searchPending,
    categories, toast, showToast, dismissToast,
    create, update, upsert, togglePin, setColor, archive, unarchive, remove, duplicate, move, addLink,
    reload: () => loadBase()
  };
};
