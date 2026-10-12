import { useState } from "react";
import { Icon } from "../../components/Icon";
import { useManagerActivity } from "../../app/ManagerNotifications.jsx";
import { activityKind, refreshManagerActivity, relativeTime } from "../../utils/managerActivityFeed.js";
import "../../app/managerActivity.css";

const FILTERS = [["todo", "Todo"], ["inspecciones", "Inspecciones"], ["entregas", "Entregas"], ["fichas", "Fichas"]];

// Panel "En vivo" de Gerencia: lo último que el equipo cerró, con filtro por área.
// Lo recién llegado se resalta; comparte la consulta con la campana del encabezado.
export default function ManagerLivePanel({ apiFetch, navigate }) {
  const feed = useManagerActivity(apiFetch);
  const [filter, setFilter] = useState("todo");
  const items = feed.items.filter((item) => filter === "todo" || activityKind(item.action).area === filter);
  const counts = Object.fromEntries(FILTERS.map(([key]) => [key, key === "todo" ? feed.items.length : feed.items.filter((item) => activityKind(item.action).area === key).length]));
  return <article className="dw-panel ml">
    <header className="ml-head">
      <div><h2>En vivo</h2><p><span className={`mn-live${feed.error ? " is-error" : ""}`} aria-hidden="true" />{feed.error ? "Sin conexión, se reintenta solo" : feed.loadedAt ? `Revisado ${relativeTime(new Date(feed.loadedAt).toISOString()).toLowerCase()}` : "Conectando…"}</p></div>
      <button type="button" className="ml-refresh" onClick={() => refreshManagerActivity()} aria-label="Revisar ahora" title="Revisar ahora"><Icon name="refresh" /></button>
    </header>
    <div className="ml-filters" role="group" aria-label="Filtrar por área">
      {FILTERS.map(([key, label]) => <button type="button" key={key} className={filter === key ? "is-active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{counts[key]}</span></button>)}
    </div>
    {!items.length ? <p className="ml-empty">{feed.loadedAt ? "Nada cerrado en esta área todavía." : "Cargando…"}</p> : <ol className="ml-list" aria-live="polite">
      {items.slice(0, 8).map((item) => {
        const kind = activityKind(item.action);
        return <li key={item.id} className={feed.fresh.includes(item.id) ? "is-fresh" : ""}>
          <button type="button" onClick={() => navigate(item.enlace?.view === "banco" ? "records" : item.enlace?.view || "teamActivity")}>
            <span className={`mn-icon is-${kind.tone}`} aria-hidden="true"><Icon name={kind.icon} /></span>
            <span className="mn-text"><strong>{kind.label}</strong><span>{item.actor_name} · {item.summary}</span></span>
            <span className="mn-time">{relativeTime(item.created_at)}</span>
          </button>
        </li>;
      })}
    </ol>}
    <button type="button" className="ml-all" onClick={() => navigate("teamActivity")}>Ver toda la actividad<Icon name="arrowRight" /></button>
  </article>;
}
