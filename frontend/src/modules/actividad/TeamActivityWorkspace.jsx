import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { getSharedProfileWebSocketManager, releaseSharedProfileWebSocketManager } from "../../utils/profileWebSocket.js";
import { agruparActividad, resumenTrabajo } from "./agruparActividad";
import "./actividad.css";

// Actividad del equipo: lo que hicieron en el sistema los técnicos y operadores
// (leído de la bitácora). Llega en vivo, se filtra por persona, área y periodo, se
// pagina con números y un índice por día salta a la página donde empieza cada día.
const PERIODOS = [["hoy", "Hoy", 0], ["7d", "7 días", 6], ["30d", "30 días", 29]];
const AREAS_POR_DEFECTO = { fichas: "Fichas y banco", inspecciones: "Inspecciones", entregas: "Entregas", campo: "GPS y planos", padron: "Padrón y barrios" };
const PAGINA = 50;
const TZ = new Date().getTimezoneOffset();

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
// Etiqueta corta del índice: "Hoy", "Ayer" o "sáb 3 oct".
const diaCorto = (dia) => {
  if (dia === isoDia(new Date())) return "Hoy";
  if (dia === hace(1)) return "Ayer";
  return new Date(`${dia}T12:00:00`).toLocaleDateString("es-HN", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
};
const plural = (n, uno, varios) => `${n.toLocaleString("es-HN")} ${n === 1 ? uno : varios}`;
const suave = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
// Páginas a mostrar: la primera, la última y las vecinas de la actual; lo demás es "…".
const paginasVisibles = (actual, total) => {
  const orden = [...new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b);
  return orden.flatMap((n, i) => (i && n - orden[i - 1] > 1 ? ["…", n] : [n]));
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
  const [data, setData] = useState({ items: [], tecnicos: [], dias: [], total: 0, categorias: AREAS_POR_DEFECTO });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recientes, setRecientes] = useState(() => new Set());

  const filtros = useMemo(() => {
    const def = PERIODOS.find(([key]) => key === periodo);
    const desde = def ? hace(def[2]) : rango.desde;
    const hasta = def ? isoDia(new Date()) : rango.hasta;
    return { desde, hasta, actor, categoria };
  }, [actor, categoria, periodo, rango]);
  // La página va atada a los filtros: otro filtro, otra lista, y se vuelve a la primera.
  const claveFiltros = JSON.stringify(filtros);
  const [paginaElegida, setPaginaElegida] = useState({ clave: claveFiltros, numero: 1 });
  const pagina = paginaElegida.clave === claveFiltros ? paginaElegida.numero : 1;
  const setPagina = (numero) => setPaginaElegida({ clave: claveFiltros, numero });

  const pedir = useCallback(async () => {
    const params = new URLSearchParams(Object.entries({ ...filtros, tz: TZ, pagina, limit: PAGINA }).filter(([, value]) => value !== "" && value != null));
    const response = await apiFetch(`/admin/team-activity?${params}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "No se pudo cargar la actividad del equipo.");
    return body;
  }, [apiFetch, filtros, pagina]);

  // Solo cuenta la última respuesta pedida: un clic rápido entre páginas no mezcla listas.
  const turno = useRef(0);
  const cargar = useCallback(async () => {
    const mio = ++turno.current;
    setLoading(true);
    setError("");
    try {
      const body = await pedir();
      if (mio !== turno.current) return;
      setData(body);
      // Ver la pantalla cuenta como haber visto la actividad: la campana vuelve a cero.
      apiFetch("/admin/team-activity/seen", { method: "POST" }).catch(() => {});
    } catch (reason) { if (mio === turno.current) setError(reason.message); } finally { if (mio === turno.current) setLoading(false); }
  }, [apiFetch, pedir]);
  useEffect(() => { cargar(); }, [cargar]);

  // Al cambiar de página se sube al inicio del registro; desde el índice, al día elegido.
  const feedRef = useRef(null);
  const destino = useRef(null);
  useEffect(() => {
    if (loading || !destino.current) return;
    const target = destino.current === "inicio" ? feedRef.current : document.getElementById(`ta-dia-${destino.current}`);
    destino.current = null;
    target?.scrollIntoView({ block: "start", behavior: suave() });
  }, [loading, data.items]);
  const irAPagina = (numero) => { destino.current = "inicio"; setPagina(numero); };

  // En vivo: lo nuevo entra arriba (si cabe en los filtros y se está en la primera página) y se marca unos segundos.
  const filtrosRef = useRef({ ...filtros, pagina });
  useEffect(() => { filtrosRef.current = { ...filtros, pagina }; }, [filtros, pagina]);
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
        const repetido = prev.items.some((item) => item.id === activity.id);
        if (!cuadra || repetido) return { ...prev, tecnicos };
        // Cuenta en el índice siempre; la línea solo entra si se está mirando la primera página.
        const dia = isoDia(new Date(activity.created_at));
        const dias = prev.dias?.[0]?.dia === dia ? [{ ...prev.dias[0], acciones: prev.dias[0].acciones + 1 }, ...prev.dias.slice(1)] : [{ dia, acciones: 1 }, ...(prev.dias || [])];
        const items = actual.pagina === 1 ? [activity, ...prev.items] : prev.items;
        return { ...prev, items, tecnicos, dias, total: (prev.total || 0) + 1 };
      });
      if (cuadra && actual.pagina === 1) {
        setRecientes((prev) => new Set(prev).add(activity.id));
        setTimeout(() => setRecientes((prev) => { const next = new Set(prev); next.delete(activity.id); return next; }), 6000);
      }
    };
    manager.on("team_activity", entra);
    manager.connect().catch(() => {});
    return () => { manager.off("team_activity", entra); releaseSharedProfileWebSocketManager(sessionToken); };
  }, [sessionToken]);

  // Por día y, dentro de cada día, por trabajo: lo que una persona hizo sobre el mismo
  // registro en pocos minutos va en una línea que se despliega con cada acción.
  const porDia = useMemo(() => {
    const grupos = new Map();
    for (const item of data.items) {
      const dia = isoDia(new Date(item.created_at));
      if (!grupos.has(dia)) grupos.set(dia, []);
      grupos.get(dia).push(item);
    }
    return [...grupos.entries()].map(([dia, items]) => ({ dia, acciones: items.length, trabajos: agruparActividad(items) }));
  }, [data.items]);
  const [desplegados, setDesplegados] = useState(() => new Set());
  const alternar = (id) => setDesplegados((actual) => { const next = new Set(actual); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const rangoHora = (trabajo) => (trabajo.items.length > 1 && hora(trabajo.desde) !== hora(trabajo.hasta) ? `${hora(trabajo.desde).replace(/\s?[ap]\.\s?m\./i, "")}–${hora(trabajo.hasta)}` : hora(trabajo.hasta));
  const areas = data.categorias || AREAS_POR_DEFECTO;
  const personaActiva = data.tecnicos.find((item) => String(item.id) === String(actor));
  const totalPeriodo = data.tecnicos.reduce((sum, item) => sum + item.total, 0);
  const finalizadosPeriodo = data.tecnicos.reduce((sum, item) => sum + item.finalizados, 0);
  const maxPersona = Math.max(1, ...data.tecnicos.map((item) => item.total));

  // Índice por día: en qué página empieza cada día y cuáles se ven en esta.
  const total = data.total || 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGINA));
  const indice = useMemo(() => {
    let antes = 0;
    return (data.dias || []).map(({ dia, acciones }) => {
      const item = { dia, acciones, pagina: Math.floor(antes / PAGINA) + 1 };
      antes += acciones;
      return item;
    });
  }, [data.dias]);
  const maxDia = Math.max(1, ...indice.map((item) => item.acciones));
  const diasEnPagina = new Set(porDia.map(({ dia }) => dia));
  const irADia = (item) => {
    if (item.pagina === pagina && !loading) {
      document.getElementById(`ta-dia-${item.dia}`)?.scrollIntoView({ block: "start", behavior: suave() });
      return;
    }
    destino.current = item.dia;
    setPagina(item.pagina);
  };
  const primero = total ? (pagina - 1) * PAGINA + 1 : 0;
  const ultimo = Math.min(total, (pagina - 1) * PAGINA + data.items.length);
  const unaPersona = Boolean(actor);
  const unaArea = Boolean(categoria);

  // Arriba, compacto (rango y flechas); abajo, con los números de página.
  const paginador = (abajo) => (totalPaginas > 1 ? <nav className={`ta-pager${abajo ? " is-bottom" : ""}`} aria-label={abajo ? "Páginas del registro, abajo" : "Páginas del registro"}>
    <p>{primero.toLocaleString("es-HN")}–{ultimo.toLocaleString("es-HN")} <span>de {plural(total, "acción", "acciones")}</span></p>
    <div>
      <button type="button" className="ta-step" disabled={pagina <= 1 || loading} onClick={() => irAPagina(pagina - 1)} aria-label="Página anterior"><Icon name="arrowLeft" />{abajo ? <span className="ta-step-label">Anterior</span> : null}</button>
      {abajo
        ? paginasVisibles(pagina, totalPaginas).map((n, i) => (n === "…" ? <span key={`gap-${i}`} className="ta-gap" aria-hidden="true">…</span> : <button type="button" key={n} aria-current={n === pagina ? "page" : undefined} aria-label={`Página ${n}`} disabled={loading && n !== pagina} onClick={() => n !== pagina && irAPagina(n)}>{n}</button>))
        : <span className="ta-of">Página {pagina} de {totalPaginas}</span>}
      <button type="button" className="ta-step" disabled={pagina >= totalPaginas || loading} onClick={() => irAPagina(pagina + 1)} aria-label="Página siguiente">{abajo ? <span className="ta-step-label">Siguiente</span> : null}<Icon name="arrowRight" /></button>
    </div>
  </nav> : null);

  return <section className="ta" aria-label="Actividad del equipo">
    <header className="ta-head">
      <div>
        <h1>Actividad del equipo</h1>
        <p>Lo que hacen en el sistema técnicos y operadores, al momento. <span className="ta-live"><i aria-hidden="true" />En vivo</span></p>
      </div>
      <button type="button" className="ta-quiet" disabled={loading} onClick={cargar}><Icon name="refresh" />{loading ? "Actualizando…" : "Actualizar"}</button>
    </header>

    <div className="ta-filters">
      <div className="ta-field"><span id="ta-periodo">Periodo</span><div className="ta-segmented" role="group" aria-labelledby="ta-periodo">
        {PERIODOS.map(([key, label]) => <button type="button" key={key} aria-pressed={periodo === key} className={periodo === key ? "is-active" : ""} onClick={() => setPeriodo(key)}>{label}</button>)}
        <button type="button" aria-pressed={periodo === "rango"} className={periodo === "rango" ? "is-active" : ""} onClick={() => setPeriodo("rango")}>Fechas</button>
      </div></div>
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
      <aside className="ta-rail">
        <section className="ta-people" aria-labelledby="ta-people-title">
          <header><h2 id="ta-people-title">Por persona</h2><p>{plural(totalPeriodo, "acción", "acciones")} · {plural(finalizadosPeriodo, "trabajo cerrado", "trabajos cerrados")}</p></header>
          {data.tecnicos.length ? <table>
            <thead><tr><th scope="col">Persona</th><th scope="col" className="is-num">Hoy</th><th scope="col" className="is-num">Periodo</th><th scope="col" className="is-num">Cerrados</th><th scope="col" className="is-num">Última</th></tr></thead>
            <tbody>{data.tecnicos.map((item) => {
              const activa = String(item.id) === String(actor);
              return <tr key={item.id} className={activa ? "is-active" : ""}>
                <td><button type="button" aria-pressed={activa} onClick={() => setActor(activa ? "" : String(item.id))} title={activa ? "Ver todo el equipo" : `Ver solo lo de ${item.nombre}`}>{item.nombre}</button><i className="ta-bar" aria-hidden="true"><b style={{ width: `${(item.total / maxPersona) * 100}%` }} /></i></td>
                <td className={`is-num${item.hoy ? "" : " ta-muted"}`}>{item.hoy}</td>
                <td className="is-num">{item.total}</td>
                <td className="is-num"><strong className={item.finalizados ? "" : "is-zero"}>{item.finalizados}</strong></td>
                <td className="is-num ta-muted">{relativo(item.ultima)}</td>
              </tr>;
            })}</tbody>
          </table> : <p className="ta-empty">{loading ? "Cargando…" : "Nadie del equipo registró actividad en este periodo."}</p>}
        </section>

        {indice.length ? <nav className="ta-days" aria-labelledby="ta-days-title">
          <header><h2 id="ta-days-title">Por día</h2><p>{plural(indice.length, "día", "días")} con actividad{totalPaginas > 1 ? ` en ${plural(totalPaginas, "página", "páginas")}` : ""}</p></header>
          <ol>{indice.map((item) => {
            const aqui = diasEnPagina.has(item.dia);
            return <li key={item.dia}><button type="button" className={aqui ? "is-here" : ""} aria-current={aqui ? "true" : undefined} onClick={() => irADia(item)} title={`${tituloDia(item.dia)} · página ${item.pagina}`}>
              <span className="ta-day-name">{diaCorto(item.dia)}</span>
              <i className="ta-bar" aria-hidden="true"><b style={{ width: `${(item.acciones / maxDia) * 100}%` }} /></i>
              <span className="ta-day-count">{item.acciones.toLocaleString("es-HN")}</span>
              {totalPaginas > 1 ? <span className="ta-day-page">p. {item.pagina}</span> : null}
            </button></li>;
          })}</ol>
        </nav> : null}
      </aside>

      <section className={`ta-feed${unaPersona ? " is-one-person" : ""}${unaArea ? " is-one-area" : ""}`} ref={feedRef} aria-labelledby="ta-feed-title" aria-busy={loading}>
        <header className="ta-feed-head">
          <div><h2 id="ta-feed-title">{personaActiva ? `Lo que hizo ${personaActiva.nombre}` : "Lo que hizo el equipo"}</h2><p>Lo más reciente primero. Lo marcado con <Icon name="checkCircle" /> cierra un trabajo.</p></div>
          {paginador(false)}
        </header>
        <div className={loading ? "ta-days-list is-loading" : "ta-days-list"}>
          {porDia.length ? porDia.map(({ dia, acciones, trabajos }) => {
            const delDia = indice.find((item) => item.dia === dia)?.acciones || acciones;
            return <div className="ta-day" key={dia} id={`ta-dia-${dia}`}>
              <h3>{tituloDia(dia)}<span>{delDia > acciones ? `${plural(delDia, "acción", "acciones")} · ${acciones} en esta página` : `${plural(trabajos.length, "trabajo", "trabajos")} · ${plural(acciones, "acción", "acciones")}`}</span></h3>
              <ol>
                {trabajos.map((trabajo) => {
                  const varias = trabajo.items.length > 1;
                  const abierto = desplegados.has(trabajo.id);
                  const nuevo = trabajo.items.some((item) => recientes.has(item.id));
                  return <li key={trabajo.id} className={`${trabajo.final ? "is-final" : ""} ${varias ? "is-group" : ""} ${nuevo ? "is-new" : ""} ${abierto ? "is-open" : ""}`.trim()}>
                    <div className="ta-row">
                      <time dateTime={trabajo.hasta}>{rangoHora(trabajo)}</time>
                      {unaPersona ? null : <span className="ta-who">{trabajo.actor_name}</span>}
                      <span className="ta-what">
                        {trabajo.final ? <Icon name="checkCircle" /> : <i className="ta-dot" aria-hidden="true" />}
                        <span>{varias && trabajo.titulo ? <b>{trabajo.titulo}</b> : null}{varias && trabajo.titulo ? " · " : null}{resumenTrabajo(trabajo)}</span>
                        {varias ? <button type="button" className="ta-count" aria-expanded={abierto} onClick={() => alternar(trabajo.id)} title={abierto ? "Ocultar el detalle" : "Ver cada acción"}>{trabajo.items.length} acciones<Icon name="chevronDown" /></button> : null}
                      </span>
                      {unaArea ? null : <span className="ta-area">{areas[trabajo.categoria] || "Otros"}</span>}
                      {trabajo.enlace ? <button type="button" className="ta-open" onClick={() => onOpen?.({ ...trabajo.items[0], enlace: trabajo.enlace })}>Abrir<Icon name="arrowRight" /></button> : <span />}
                    </div>
                    {varias && abierto ? <ol className="ta-steps">
                      {[...trabajo.items].reverse().map((item) => <li key={item.id} className={item.final ? "is-final" : ""}><time dateTime={item.created_at}>{hora(item.created_at)}</time><span>{item.summary}</span></li>)}
                    </ol> : null}
                  </li>;
                })}
              </ol>
            </div>;
          }) : <p className="ta-empty">{loading ? "Cargando…" : "No hay actividad con estos filtros."}</p>}
        </div>
        {paginador(true)}
      </section>
    </div>
  </section>;
}
