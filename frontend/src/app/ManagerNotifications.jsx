import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Icon } from "../components/Icon";
import { NOTIFICATION_SOUND_MUTED_STORAGE_KEY } from "../constants/storageKeys";
import { playNotificationSound } from "../utils/notificationSound.js";
import { activityKind, markManagerActivitySeen, relativeTime, subscribeManagerActivity } from "../utils/managerActivityFeed.js";
import "./managerActivity.css";

export function useManagerActivity(apiFetch) {
  const [feed, setFeed] = useState({ items: [], unread: 0, seenAt: null, error: "", loadedAt: null, fresh: [] });
  useEffect(() => subscribeManagerActivity(apiFetch, setFeed), [apiFetch]);
  return feed;
}

// Campana de Gerencia: avisa cuando el equipo cierra un trabajo (inspección finalizada,
// lote cerrado, punto del banco pasado a ficha...). Suena al llegar algo nuevo.
export default function ManagerNotifications({ apiFetch, session, onOpenView }) {
  const feed = useManagerActivity(apiFetch);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => { try { return window.localStorage.getItem(NOTIFICATION_SOUND_MUTED_STORAGE_KEY) === "1"; } catch { return false; } });
  const [seenAtOpen, setSeenAtOpen] = useState(null);
  const ref = useRef(null);
  const preview = Boolean(session?.user?.preview);

  useEffect(() => { if (feed.fresh.length && !muted) playNotificationSound({ muted }).catch(() => {}); }, [feed.fresh, muted]);
  useEffect(() => { try { window.localStorage.setItem(NOTIFICATION_SOUND_MUTED_STORAGE_KEY, muted ? "1" : "0"); } catch { /* sin almacenamiento */ } }, [muted]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setSeenAtOpen(feed.seenAt);
      // En una prueba de perfil la cuenta sigue siendo de administración: no se marca nada.
      if (feed.unread && !preview) markManagerActivitySeen(apiFetch).catch(() => {});
    }
    setOpen((value) => !value);
  };
  const isNew = (item) => !seenAtOpen || Date.parse(item.created_at) > Date.parse(seenAtOpen);
  const go = (item) => { setOpen(false); onOpenView(item.enlace?.view === "banco" ? "records" : item.enlace?.view || "teamActivity"); };

  return <div className="mn" ref={ref}>
    <button type="button" className={`mn-bell${feed.unread ? " has-unread" : ""}`} onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label={feed.unread ? `Notificaciones: ${feed.unread} sin ver` : "Notificaciones"}>
      <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
      {feed.unread ? <b key={feed.unread}>{feed.unread > 99 ? "99+" : feed.unread}</b> : null}
    </button>
    {open ? <section className="mn-panel" role="dialog" aria-label="Trabajo cerrado por el equipo">
      <header>
        <div><h2>Trabajo cerrado por el equipo</h2><p><span className="mn-live" aria-hidden="true" />En vivo · se revisa cada 30 s</p></div>
        <button type="button" className="mn-mute" onClick={() => setMuted((value) => !value)} aria-pressed={muted} aria-label={muted ? "Activar sonido" : "Silenciar sonido"} title={muted ? "Activar sonido" : "Silenciar sonido"}>{muted ? <BellOff size={16} /> : <Bell size={16} />}</button>
      </header>
      {feed.error && !feed.items.length ? <p className="mn-empty">No se pudo consultar. Se reintenta solo.</p> : null}
      {!feed.error && feed.loadedAt && !feed.items.length ? <p className="mn-empty">Aún no hay trabajos cerrados esta semana.</p> : null}
      <ul>
        {feed.items.slice(0, 12).map((item) => {
          const kind = activityKind(item.action);
          return <li key={item.id}><button type="button" onClick={() => go(item)}>
            <span className={`mn-icon is-${kind.tone}`} aria-hidden="true"><Icon name={kind.icon} /></span>
            <span className="mn-text"><strong>{kind.label}</strong><span>{item.actor_name} · {item.summary}</span></span>
            <span className="mn-time">{isNew(item) ? <i className="mn-dot" title="Nueva" /> : null}{relativeTime(item.created_at)}</span>
          </button></li>;
        })}
      </ul>
      <footer><button type="button" onClick={() => { setOpen(false); onOpenView("teamActivity"); }}>Ver toda la actividad del equipo<Icon name="arrowRight" /></button></footer>
    </section> : null}
  </div>;
}
