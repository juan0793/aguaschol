// Cola de puntos de campo por enviar. Cada punto marcado se guarda primero en el
// celular (IndexedDB) y después se envía; si no hay señal, espera y se reintenta
// solo. Nunca se descarta en silencio: lo que el servidor rechaza queda marcado
// para que el técnico lo corrija o lo descarte a mano.

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";
export const UNDO_WINDOW_MS = 6000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

export const isOutboxId = (id) => typeof id === "string" && id.startsWith("cel-");

export const diaryKeyFor = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: HONDURAS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

export const createOutboxItem = ({ payload, userId, now = Date.now(), random = Math.random }) => {
  const localId = `cel-${now.toString(36)}-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
  const capturedAt = new Date(now).toISOString();
  return {
    localId,
    userId: userId ?? null,
    payload: { ...payload, client_ref: localId, captured_at: capturedAt },
    createdAt: now,
    sendAfter: now + UNDO_WINDOW_MS,
    nextAttemptAt: 0,
    attempts: 0,
    status: "pendiente",
    error: ""
  };
};

// Forma de punto que entiende el resto del módulo (mapa, lista, detalle).
export const outboxItemToPoint = (item) => ({
  id: item.localId,
  localId: item.localId,
  pending: true,
  outboxStatus: item.status,
  outboxError: item.error,
  point_type: item.payload.point_type,
  latitude: Number(item.payload.latitude),
  longitude: Number(item.payload.longitude),
  accuracy_meters: item.payload.accuracy_meters ?? null,
  description: item.payload.description || "",
  reference_note: item.payload.reference || "",
  housing_units: item.payload.housing_units ?? 1,
  marker_color: item.payload.marker_color,
  created_at: item.payload.captured_at,
  diary_date: diaryKeyFor(item.payload.captured_at)
});

export const isReadyToSend = (item, now = Date.now()) =>
  item.status !== "rechazado" && now >= item.sendAfter && now >= (item.nextAttemptAt || 0);

// sin-senal: no hubo respuesta; sesion: hay que volver a entrar; servidor: 5xx,
// se reintenta con espera creciente; rechazado: el dato no es válido y pide al técnico.
export const classifySendFailure = ({ status } = {}) => {
  if (!status) return "sin-senal";
  if (status === 401) return "sesion";
  if (status >= 500 || status === 408 || status === 429) return "servidor";
  return "rechazado";
};

export const retryDelay = (attempts) => Math.min(MAX_RETRY_DELAY_MS, 15000 * 2 ** Math.max(0, attempts - 1));

export const getOutboxSyncState = ({ outboxCount = 0, outboxRejectedCount = 0, outboxOnline = true }) => {
  const rejected = Math.max(0, outboxRejectedCount);
  const pending = Math.max(0, outboxCount - rejected);
  const parts = [];
  if (pending) parts.push(`${pending} ${pending === 1 ? "punto por enviar" : "puntos por enviar"}`);
  if (rejected) parts.push(`${rejected} ${rejected === 1 ? "punto rechazado" : "puntos rechazados"}`);
  if (!outboxOnline) parts.push("sin señal");
  return {
    text: parts.join(" · ") || "Todo enviado",
    tone: rejected ? "is-rejected" : !outboxOnline ? "is-offline" : pending ? "is-pending" : "is-sent"
  };
};

export const mergeOutboxItems = (stored = [], fallback = []) => {
  const byId = new Map(stored.map((item) => [item.localId, item]));
  fallback.forEach((item) => {
    const current = byId.get(item.localId);
    if (!current || (item.updatedAt ?? item.createdAt) >= (current.updatedAt ?? current.createdAt)) {
      byId.set(item.localId, item);
    }
  });
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
};

// ---------- almacenamiento ----------
const DB_NAME = "aguaschol-campo";
const STORE = "puntos_por_enviar";
const FALLBACK_KEY = "aguaschol.campo.puntosPorEnviar.v1";

let dbPromise = null;
const openDb = () => {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB no disponible"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "localId" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
};

const withStore = async (mode, work) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const readFallback = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(FALLBACK_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
const writeFallback = (items) => {
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
};

export const loadOutbox = async (userId) => {
  let stored = [];
  try {
    stored = await withStore("readonly", (store) => store.getAll());
  } catch {}
  const sameUser = (item) => (item.userId ?? null) === (userId ?? null);
  return mergeOutboxItems((stored || []).filter(sameUser), readFallback().filter(sameUser));
};

export const saveOutboxItem = async (item) => {
  const savedItem = { ...item, updatedAt: Date.now() };
  try {
    await withStore("readwrite", (store) => store.put(savedItem));
    writeFallback(readFallback().filter((current) => current.localId !== savedItem.localId));
    return true;
  } catch {
    return writeFallback([...readFallback().filter((current) => current.localId !== savedItem.localId), savedItem]);
  }
};

export const deleteOutboxItem = async (localId) => {
  let deleted = false;
  try {
    await withStore("readwrite", (store) => store.delete(localId));
    deleted = true;
  } catch {}
  const fallback = readFallback();
  const hadFallback = fallback.some((current) => current.localId === localId);
  const fallbackDeleted = !hadFallback || writeFallback(fallback.filter((current) => current.localId !== localId));
  return deleted || (hadFallback && fallbackDeleted);
};
