import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { getSharedProfileWebSocketManager, releaseSharedProfileWebSocketManager } from "../../utils/profileWebSocket.js";
import "./actividad.css";

// Actividad del equipo: lo que hicieron en el sistema los técnicos y operadores
// (leído de la bitácora). Llega en vivo y se filtra por persona, área y periodo.
const PERIODOS = [["hoy", "Hoy", 0], ["7d", "7 días", 6], ["30d", "30 días", 29]];
const AREAS_POR_DEFECTO = { fichas: "Fichas y banco", inspecciones: "Inspecciones", entregas: "Entregas", campo: "GPS y planos", padron: "Padrón y barrios" };
const PAGINA = 60;

const isoDia = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const hace = (dias) => isoDia(new Date(Date.now() - dias * 86400000));
const hora = (value) => new Date(value).toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
const tituloDia = (dia) => {
  const hoy = isoDia(new Date());
  const ayer = hace(1);
  const texto = new Date(`${dia}T12:00:00`).toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" });
  return dia === hoy ? `Hoy · ${texto}` : dia === ayer ? `Ayer · ${texto}` : texto.charAt(0).toUpperCase() + texto.slice(1);
};
const relativo = (value) => {
  if (!value) return "—";
  const minutos = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutos < 1) return "Justo ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  return new Date(value).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
};

export default function TeamActivityWorkspace({ apiFetch, session, onOpen }) {
  const [periodo, setPeriodo] = useState("7d");
  const [rango, setRango] = useState({ desde: hace(6), hasta: isoDia(new Date()) });
  const [actor, setActor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState({ items: [], tecnicos: [], categorias: AREAS_POR_DEFECTO, has_more: false });
  const [loading, setLoading] = useState(false);
  const [masLoading, setMasLoading] = useState(false);
  const [error, setError] = useState("");
  const [recientes, setRecientes] = useState(() => new Set());

  const filtros = useMemo(() => {
    const def = PERIODOS.find(([key]) => key === periodo);
    const desde = def ? hace(def[2]) : rango.desde;
    const hasta = def ? isoDia(new Date()) : rango.hasta;
    return { desde, hasta, actor, categoria };
  }, [actor, categoria, periodo, rango]);

  const pedir = useCallback(async (extra = {}) => {
    const params = new URLSearchParams(Object.entries({ ...filtros, limit: PAGINA, ...extra }).filter(([, value]) => value !== "" && value != null));
    const response = await apiFetch(`/admin/team-activity?${params}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "No se pudo cargar la actividad del equipo.");
    return body;
  }, [apiFetch, filtros]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await pedir());
      // Ver la pantalla cuenta como haber visto la actividad: la campana vuelve a cero.
      apiFetch("/admin/team-activity/seen", { method: "POST" }).catch(() => {});
    } catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }, [apiFetch, pedir]);
  useEffect(() => { cargar(); }, [cargar]);

  const cargarMas = async () => {
    const ultimo = data.items[data.items.length - 1];
    if (!ultimo) return;
    setMasLoading(true);
    try {
      const mas = await pedir({ antes: ultimo.id, resumen: 0 });
      setData((actual) => ({ ...actual, items: [...actual.items, ...mas.items], has_more: mas.has_more }));
    } catch (reason) { setError(reason.message); } finally { setMasLoading(false); }
  };

  // En vivo: lo nuevo entra arriba (si cabe en los filtros) y se marca unos segundos.
  const filtrosRef = useRef(filtros);
  useEffect(() => { filtrosRef.current = filtros; }, [filtros]);
  const sessionToken = session?.token || session?.sessionToken || "";
  useEffect(() => {
    if (!sessionToken) return undefined;
    const manager = getSharedProfileWebSocketManager(sessionToken);
    if (!manager) return undefined;
    const entra = (activity) => {
      const actual = filtrosRef.current;
      if (actual.hasta < isoDia(new Date())) return;
      const cuadra = (!actual.actor || String(activity.actor_id) === String(actual.actor)) && (!actual.categoria || activity.categoria === actual.categoria);
      setData((prev) => {
        const tecnicos = [...prev.tecnicos];
        const index = tecnicos.findIndex((item) => item.id === activity.actor_id);
        const base = index >= 0 ? tecnicos[index] : { id: activity.actor_id, nombre: activity.actor_name, total: 0, hoy: 0, finalizados: 0, ultima: null };
        const nuevo = { ...base, total: base.total + 1, hoy: base.hoy + 1, finalizados: base.finalizados + (activity.final ? 1 : 0), ultima: activity.created_at };
        if (index >= 0) tecnicos[index] = nuevo; else tecnicos.push(nuevo);
        const items = cuadra && !prev.items.some((item) => item.id === activity.id) ? [activity, ...prev.items] : prev.items;
        return { ...prev, items, tecnicos };
      });
      if (cuadra) {
        setRecientes((prev) => new Set(prev).add(activity.id));
        setTimeout(() => setRecientes((prev) => { const next = new Set(prev); next.delete(activity.id); return next; }), 6000);
      }
    };
    manager.on("team_activity", entra);
    manager.connect().catch(() => {});
    return () => { manager.off("team_activity", entra); releaseSharedProfileWebSocketManager(sessionToken); };
  }, [sessionToken]);

  const porDia = useMemo(() => {
    const grupos = new Map();
    for (const item of data.items) {
      const dia = isoDia(new Date(item.created_at));
      if (!grupos.has(dia)) grupos.set(dia, []);
      grupos.get(dia).push(item);
    }
    return [...grupos.entries()];
  }, [data.items]);
  const areas = data.categorias || AREAS_POR_DEFECTO;
  const personaActiva = data.tecnicos.find((item) => String(item.id) === String(actor));
  const totalPeriodo = data.tecnicos.reduce((sum, item) => sum + item.total, 0);
  const finalizadosPeriodo = data.tecnicos.reduce((sum, item) => sum + item.finalizados, 0);

  return <section className="ta" aria-label="Actividad del equipo">
    <header className="ta-head">
      <div>
        <h1>Actividad del equipo</h1>
        <p>Lo que hacen en el sistema técnicos y operadores, al momento. <span className="ta-live"><i aria-hidden="true" />En vivo</span></p>
      </div>
      <button type="button" className="ta-quiet" disabled={loading} onClick={cargar}><Icon name="refresh" />{loading ? "Actualizando…" : "Actualizar"}</button>
    </header>

    <div className="ta-filters">
      <div className="ta-segmented" role="group" aria-label="Periodo">
        {PERIODOS.map(([key, label]) => <button type="button" key={key} aria-pressed={periodo === key} className={periodo === key ? "is-active" : ""} onClick={() => setPeriodo(key)}>{label}</button>)}
        <button type="button" aria-pressed={periodo === "rango"} className={periodo === "rango" ? "is-active" : ""} onClick={() => setPeriodo("rango")}>Fechas</button>
      </div>
      {periodo === "rango" ? <div className="ta-range">
        <label><span>Desde</span><input type="date" value={rango.desde} max={rango.hasta} onChange={(event) => setRango((actual) => ({ ...actual, desde: event.target.value }))} /></label>
        <label><span>Hasta</span><input type="date" value={rango.hasta} min={rango.desde} onChange={(event) => setRango((actual) => ({ ...actual, hasta: event.target.value }))} /></label>
      </div> : null}
      <label className="ta-select"><span>Persona</span><select value={actor} onChange={(event) => setActor(event.target.value)}><option value="">Todo el equipo</option>{data.tecnicos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
    </div>
    <div className="ta-areas" role="group" aria-label="Área del sistema">
      {[["", "Todas"], ...Object.entries(areas), ["otros", "Otros"]].map(([key, label]) => <button type="button" key={key || "todas"} aria-pressed={categoria === key} className={categoria === key ? "is-active" : ""} onClick={() => setCategoria(key)}>{label}</button>)}
    </div>
    {error ? <p className="ta-error" role="alert">{error} <button type="button" onClick={cargar}>Reintentar</button></p> : null}

    <div className="ta-split">
      <section className="ta-people" aria-labelledby="ta-people-title">
        <header><h2 id="ta-people-title">Por persona</h2><p>{totalPeriodo} {totalPeriodo === 1 ? "acción" : "acciones"} en el periodo · {finalizadosPeriodo} {finalizadosPeriodo === 1 ? "trabajo cerrado" : "trabajos cerrados"}</p></header>
        {data.tecnicos.length ? <table>
          <thead><tr><th scope="col">Persona</th><th scope="col" className="is-num">Hoy</th><th scope="col" className="is-num">Periodo</th><th scope="col" className="is-num">Cerrados</th><th scope="col" className="is-num">Última</th></tr></thead>
          <tbody>{data.tecnicos.map((item) => <tr key={item.id} className={String(item.id) === String(actor) ? "is-active" : ""}>
            <td><button type="button" onClick={() => setActor(String(item.id) === String(actor) ? "" : String(item.id))} title={String(item.id) === String(actor) ? "Ver todo el equipo" : `Ver solo lo de ${item.nombre}`}>{item.nombre}</button></td>
            <td className="is-num">{item.hoy}</td>
            <td className="is-num">{item.total}</td>
            <td className="is-num"><strong className={item.finalizados ? "" : "is-zero"}>{item.finalizados}</strong></td>
            <td className="is-num ta-muted">{relativo(item.ultima)}</td>
          </tr>)}</tbody>
        </table> : <p className="ta-empty">{loading ? "Cargando…" : "Nadie del equipo registró actividad en este periodo."}</p>}
      </section>

      <section className="ta-feed" aria-labelledby="ta-feed-title" aria-busy={loading}>
        <header><h2 id="ta-feed-title">{personaActiva ? `Lo que hizo ${personaActiva.nombre}` : "Lo que hizo el equipo"}</h2><p>Lo más reciente primero. Lo marcado con <Icon name="checkCircle" /> cierra un trabajo.</p></header>
        {porDia.length ? porDia.map(([dia, items]) => <div className="ta-day" key={dia}>
          <h3>{tituloDia(dia)}<span>{items.length}</span></h3>
          <ol>
            {items.map((item) => <li key={item.id} className={`${item.final ? "is-final" : ""} ${recientes.has(item.id) ? "is-new" : ""}`.trim()}>
              <time dateTime={item.created_at}>{hora(item.created_at)}</time>
              <span className="ta-who">{item.actor_name}</span>
              <span className="ta-what">{item.final ? <Icon name="checkCircle" /> : null}<span>{item.summary}</span></span>
              <span className="ta-area">{areas[item.categoria] || "Otros"}</span>
              {item.enlace ? <button type="button" className="ta-open" onClick={() => onOpen?.(item)}>Abrir<Icon name="arrowRight" /></button> : <span />}
            </li>)}
          </ol>
        </div>) : <p className="ta-empty">{loading ? "Cargando…" : "No hay actividad con estos filtros."}</p>}
        {data.has_more ? <button type="button" className="ta-more" disabled={masLoading} onClick={cargarMas}>{masLoading ? "Cargando…" : "Cargar más"}</button> : null}
      </section>
    </div>
  </section>;
}
