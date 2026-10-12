// Trabajo cerrado por el equipo, para Gerencia: una sola consulta compartida por la campana
// y el panel "En vivo". Gerencia no usa sockets; se revisa cada 30 s con la pestaña visible.
const POLL_MS = 30000;
const LIMIT = 20;

// Cómo se nombra cada trabajo cerrado en la campana y en el panel.
const KINDS = {
  "inspeccion.finalized": { label: "Inspección finalizada", icon: "checkCircle", tone: "green", area: "inspecciones" },
  LOTE_CERRADO: { label: "Lote de entregas cerrado", icon: "archive", tone: "blue", area: "entregas" },
  DOCUMENTO_REENTREGADO: { label: "Documento reentregado", icon: "send", tone: "blue", area: "entregas" },
  "banco_clandestinos.sent_to_ficha": { label: "Punto del banco pasado a ficha", icon: "records", tone: "red", area: "fichas" },
  "banco_clandestinos.discarded": { label: "Punto del banco descartado", icon: "archive", tone: "slate", area: "fichas" },
  "technical_report.created": { label: "Reporte técnico enviado", icon: "clipboard", tone: "amber", area: "fichas" },
  "transport.route_completed": { label: "Recorrido completado", icon: "transport", tone: "slate", area: "campo" }
};
export const activityKind = (action) => KINDS[action] || { label: "Trabajo cerrado", icon: "checkCircle", tone: "slate", area: "otros" };

export function relativeTime(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Date(iso).toLocaleDateString("es-HN", { timeZone: "America/Tegucigalpa", day: "numeric", month: "short" });
}

// Ids que llegaron desde la consulta anterior; la primera carga no cuenta como nueva.
export const freshIds = (previous, next, firstLoad) => (firstLoad ? [] : next.filter((item) => !previous.some((old) => old.id === item.id)).map((item) => item.id));

let state = { items: [], unread: 0, seenAt: null, error: "", loadedAt: null, fresh: [] };
const listeners = new Set();
let fetcher = null;
let timer = null;
let inflight = null;
const emit = () => listeners.forEach((listener) => listener(state));
const onVisible = () => { if (document.visibilityState === "visible") poll(); };

async function poll() {
  if (!fetcher || document.visibilityState !== "visible") return undefined;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetcher(`/admin/team-activity?resumen=0&hitos=1&limit=${LIMIT}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No se pudo consultar la actividad del equipo.");
      const items = body.items || [];
      state = { items, unread: Number(body.unread || 0), seenAt: body.seen_at || null, error: "", loadedAt: Date.now(), fresh: freshIds(state.items, items, !state.loadedAt) };
    } catch (error) {
      state = { ...state, error: error.message || "Sin conexión.", fresh: [] };
    } finally {
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

export function subscribeManagerActivity(apiFetch, listener) {
  fetcher = apiFetch;
  listeners.add(listener);
  listener(state);
  if (!timer) {
    poll();
    timer = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

export const refreshManagerActivity = () => poll();

// Marca lo visto en la cuenta. Los puntos de "nueva" siguen hasta cerrar la campana.
export async function markManagerActivitySeen(apiFetch) {
  const response = await apiFetch("/admin/team-activity/seen", { method: "POST" });
  if (response.ok) { state = { ...state, unread: 0, fresh: [] }; emit(); }
  return response.ok;
}
