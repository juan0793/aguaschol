import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { syncMapDiaryGroups } from "../../utils/datesAndBusiness";
import {
  classifySendFailure,
  createOutboxItem,
  deleteOutboxItem,
  isReadyToSend,
  loadOutbox,
  outboxItemToPoint,
  retryDelay,
  saveOutboxItem,
  UNDO_WINDOW_MS
} from "./mapPointOutbox";

const SYNC_INTERVAL_MS = 20000;

// Guarda los puntos en el celular y los envía cuando hay señal. El punto aparece
// en el mapa al instante; al llegar al servidor se reemplaza por el definitivo.
export function useMapPointOutbox({ apiFetch, session, setMapPoints, setMapDiaryGroupsSummary, onPointSent }) {
  const userId = session?.user?.id ?? null;
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncProblem, setLastSyncProblem] = useState("");
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const itemsRef = useRef([]);
  const syncingRef = useRef(false);
  const timerRef = useRef(0);
  const onPointSentRef = useRef(onPointSent);
  onPointSentRef.current = onPointSent;

  const commit = useCallback((updater) => {
    setItems((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      itemsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadOutbox(userId).then((loaded) => {
      if (!cancelled) commit(loaded);
    });
    return () => { cancelled = true; };
  }, [commit, userId]);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !session?.token) return;
    const ready = itemsRef.current.filter((item) => isReadyToSend(item));
    if (!ready.length) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      for (const item of ready) {
        let response = null;
        let data = {};
        try {
          response = await apiFetch("/map-points", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload)
          });
          data = await response.json().catch(() => ({}));
        } catch {
          response = null;
        }

        if (response?.ok) {
          await deleteOutboxItem(item.localId);
          commit((current) => current.filter((entry) => entry.localId !== item.localId));
          setMapPoints((current) => [data, ...current.filter((point) => point.id !== data.id)]);
          setMapDiaryGroupsSummary((current) => syncMapDiaryGroups(current, data, null));
          setOnline(true);
          setLastSyncProblem("");
          onPointSentRef.current?.(item.localId, data);
          continue;
        }

        const failure = classifySendFailure({ status: response?.status });
        if (failure === "sin-senal") {
          setOnline(false);
          setLastSyncProblem("Sin señal: los puntos se enviarán solos cuando vuelva.");
          break;
        }
        if (failure === "sesion") {
          setLastSyncProblem("La sesión venció: entra de nuevo para enviar los puntos guardados.");
          break;
        }
        const updated = failure === "rechazado"
          ? { ...item, status: "rechazado", error: data.message || "El servidor no aceptó este punto." }
          : { ...item, attempts: item.attempts + 1, nextAttemptAt: Date.now() + retryDelay(item.attempts + 1), error: "El servidor no respondió; se reintentará." };
        await saveOutboxItem(updated);
        commit((current) => current.map((entry) => (entry.localId === item.localId ? updated : entry)));
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [apiFetch, commit, session?.token, setMapDiaryGroupsSummary, setMapPoints]);

  // Reintentos: al volver la señal, al volver a la pestaña y cada 20 s mientras quede algo.
  useEffect(() => {
    const handleOnline = () => { setOnline(true); syncNow(); };
    const handleOffline = () => setOnline(false);
    const handleVisible = () => { if (document.visibilityState === "visible") syncNow(); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!items.length) return undefined;
    const interval = window.setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [items.length, syncNow]);

  const scheduleSync = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(syncNow, UNDO_WINDOW_MS + 150);
  }, [syncNow]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const enqueue = useCallback(async (payload) => {
    const item = createOutboxItem({ payload, userId });
    const stored = await saveOutboxItem(item);
    if (!stored) return { item, stored: false };
    commit((current) => [...current, item]);
    scheduleSync();
    return { item, stored };
  }, [commit, scheduleSync, userId]);

  const updatePending = useCallback(async (localId, patch) => {
    const item = itemsRef.current.find((entry) => entry.localId === localId);
    if (!item) return false;
    // Corregir un punto rechazado lo devuelve a la cola.
    const updated = { ...item, payload: { ...item.payload, ...patch }, status: "pendiente", error: "", nextAttemptAt: 0 };
    if (!(await saveOutboxItem(updated))) return false;
    commit((current) => current.map((entry) => (entry.localId === localId ? updated : entry)));
    scheduleSync();
    return true;
  }, [commit, scheduleSync]);

  const discard = useCallback(async (localId) => {
    if (!(await deleteOutboxItem(localId))) return false;
    commit((current) => current.filter((entry) => entry.localId !== localId));
    return true;
  }, [commit]);

  const pendingPoints = useMemo(() => items.map(outboxItemToPoint), [items]);
  const rejectedCount = items.filter((item) => item.status === "rechazado").length;

  return {
    outboxPoints: pendingPoints,
    outboxCount: items.length,
    outboxRejectedCount: rejectedCount,
    outboxSyncing: syncing,
    outboxOnline: online,
    outboxProblem: lastSyncProblem,
    enqueueMapPoint: enqueue,
    updatePendingMapPoint: updatePending,
    discardPendingMapPoint: discard,
    syncOutboxNow: syncNow
  };
}
