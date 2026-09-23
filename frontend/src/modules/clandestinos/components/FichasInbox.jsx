import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import SpringCheck from "../../../components/micro/SpringCheck";
import { getRecordDeadlineMeta } from "../../../utils/records";
import { TableSkeleton } from "../../../components/ds/Skeleton";

const STATE_LABELS = { draft: "Borrador", pending: "Pendiente", visit: "Visita", confirmed: "Confirmada", regularization: "Regularización", regularized: "Regularizada", discarded: "Descartada" };
const STATE_OPTIONS = { draft: "Borrador · completar datos", pending: "Pendiente · programar visita", visit: "Visita · registrar hallazgos", confirmed: "Confirmada · preparar aviso", regularization: "Regularización · dar seguimiento", regularized: "Regularizada · caso cerrado", discarded: "Descartada · no procede" };
const FLOW_GUIDE = [
  ["1", "Preparar ficha", "Completar datos y validar padrones"],
  ["2", "Realizar visita", "Registrar hallazgos y evidencias"],
  ["3", "Confirmar caso", "Revisar que sí corresponde"],
  ["4", "Entregar aviso", "Editar fechas, texto y firma"],
  ["5", "Cerrar seguimiento", "Marcar regularizada o descartar"]
];
const ALERT_FOCUS_KEY = "aguas.clandestinos.focus";
const ETAPAS = [["draft","Borradores","edit"],["pending","Por visitar","calendar"],["visit","En visita","map"],["confirmed","Aviso pendiente","mail"],["regularization","En seguimiento","history"],["regularized","Cerradas","success"],["discarded","Descartadas","archive"]];
const stateLabel = (value) => STATE_LABELS[value] || "Pendiente";

export default function FichasInbox({ model, selectedIds, onToggle, onToggleVisible, onSelectAll, onClearSelection, onCompare, onPrintSummary, comparison, bulkLoading, onOpen, onNew, canCreate = false }) {
  const [alertsOnly, setAlertsOnly] = useState(() => sessionStorage.getItem(ALERT_FOCUS_KEY) === "alerts");
  const barrios = [...new Set(model.items.map((item) => item.barrio_colonia).filter(Boolean))].sort();
  const comparisons = new Map((comparison?.rows || []).map((item) => [String(item.id), item]));
  const deadlineById = useMemo(() => new Map(model.items.map((item) => [String(item.id), getRecordDeadlineMeta(item)])), [model.items]);
  const alertItems = useMemo(() => model.items.filter((item) => ["warning", "due", "overdue"].includes(deadlineById.get(String(item.id))?.statusKey)), [deadlineById, model.items]);
  const overdueCount = alertItems.filter((item) => deadlineById.get(String(item.id))?.statusKey === "overdue").length;
  const alertTitle = overdueCount
    ? `${overdueCount} ${overdueCount === 1 ? "ficha vencida" : "fichas vencidas"}`
    : `${alertItems.length} ${alertItems.length === 1 ? "ficha próxima" : "fichas próximas"} a vencer`;
  const visibleItems = alertsOnly ? alertItems : model.items;
  const allVisibleSelected = Boolean(visibleItems.length && visibleItems.every((item) => selectedIds.has(String(item.id))));
  const serviceStats = model.service_stats || {};
  const serviceTotal = Number(serviceStats.total || model.total || 0);
  const serviceMetrics = [
    ["agua_potable", "Agua potable", "water", "is-water"],
    ["aguas_residuales", "Aguas negras / residuales", "sewer", "is-sewer"],
    ["ambos", "Ambos servicios", "success", "is-both"],
    ["solo_agua", "Solo agua potable", "water", "is-water-soft"],
    ["solo_aguas_residuales", "Solo aguas residuales", "sewer", "is-sewer-soft"],
    ["ninguno", "Sin conexión declarada", "activity", "is-none"]
  ];
  useEffect(() => { sessionStorage.removeItem(ALERT_FOCUS_KEY); }, []);
  // Indicador que se desliza hasta la etapa activa: el cambio se ve en el acto,
  // antes de que lleguen las filas.
  const etapasRef = useRef(null);
  const [marca, setMarca] = useState(null);
  useLayoutEffect(() => {
    const medir = () => {
      const activo = etapasRef.current?.querySelector("button.is-active");
      setMarca(activo ? { left: activo.offsetLeft, top: activo.offsetTop + activo.offsetHeight - 2, width: activo.offsetWidth } : null);
    };
    medir();
    addEventListener("resize", medir);
    return () => removeEventListener("resize", medir);
  }, [model.filters.state, model.counts]);
  const hayFiltros = Boolean(model.filters.query || model.filters.state || model.filters.barrio || alertsOnly);
  const [guia, setGuia] = useState(false);
  // Total de expedientes en todas las etapas (con la busqueda y el barrio
  // aplicados): es la referencia del "7 de 55" del encabezado.
  const totalExpedientes = Object.values(model.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const etapaActiva = ETAPAS.find(([key]) => key === model.filters.state);
  const quitarTodo = () => { model.filters.clear(); setAlertsOnly(false); };
  return <section className="cl-inbox" aria-label="Bandeja de trabajo de fichas">
    {/* El encabezado dice que se esta viendo: la etapa (con su icono), cuantas
        fichas de cuantas, y los filtros activos, cada uno removible. */}
    <header className="cl-inbox-head">
      <span className="cl-inbox-emblem" aria-hidden="true" key={etapaActiva?.[0] || "todas"}><Icon name={alertsOnly ? "warning" : etapaActiva?.[2] || "records"} /></span>
      <div className="cl-inbox-title">
        <h2>{alertsOnly ? "Con plazo crítico" : etapaActiva ? etapaActiva[1] : "Todas las etapas"}</h2>
        <p className="cl-inbox-scope" aria-live="polite">
          <span className="cl-scope-count">{alertsOnly ? `${alertItems.length} en esta página` : etapaActiva ? `${model.total} de ${totalExpedientes} expedientes` : `${model.total} ${model.total === 1 ? "expediente" : "expedientes"}`}</span>
          {model.filters.barrio ? <span className="cl-scope-chip">{model.filters.barrio}<button type="button" onClick={() => model.filters.setBarrio("")} aria-label={`Quitar el barrio ${model.filters.barrio}`}><Icon name="close" /></button></span> : null}
          {model.filters.query.trim() ? <span className="cl-scope-chip">“{model.filters.query.trim()}”<button type="button" onClick={() => model.filters.setQuery("")} aria-label="Quitar la búsqueda"><Icon name="close" /></button></span> : null}
          {hayFiltros ? <button type="button" className="cl-scope-clear" onClick={quitarTodo}>Ver todas</button> : null}
        </p>
      </div>
      <div className="cl-inbox-actions">
        <button type="button" className="cl-quiet" aria-expanded={guia} aria-controls="cl-guia-proceso" onClick={() => setGuia((actual) => !actual)}><Icon name="clipboard" /><span>Guía<span className="cl-hide-sm"> del proceso</span></span></button>
        {canCreate ? <button type="button" className="cl-primary" onClick={onNew}><Icon name="plus" />Nueva ficha</button> : null}
      </div>
    </header>
    {guia ? <div className="cl-workflow-help" id="cl-guia-proceso"><section className="cl-workflow-guide" aria-label="Proceso recomendado para una ficha clandestina">{FLOW_GUIDE.map(([number, title, detail]) => <article key={number}><span>{number}</span><div><strong>{title}</strong><small>{detail}</small></div></article>)}</section></div> : null}
    {alertItems.length ? <section className={`cl-deadline-banner ${alertsOnly ? "is-filtered" : ""}`} role="status"><span className="cl-deadline-icon"><Icon name="warning" /></span><div className="cl-deadline-copy"><small>Atención prioritaria</small><strong>{alertsOnly ? `Mostrando ${alertTitle.toLowerCase()}` : alertTitle}</strong><span>{overdueCount ? `Revisa el plazo y registra la siguiente acción para poner${alertItems.length === 1 ? "la" : "las"} al día.` : `Quedan dos días hábiles o menos para atender${alertItems.length === 1 ? "la" : "las"}.`}</span></div><button type="button" className="cl-deadline-action" onClick={() => setAlertsOnly((current) => !current)}>{alertsOnly ? "Ver todas" : "Revisar ahora"}<Icon name={alertsOnly ? "refresh" : "arrowRight"} /></button></section> : null}
    <div className="cl-toolbar">
      <label className="cl-search"><span>Buscar ficha</span><div><Icon name="search" /><input value={model.filters.query} onChange={(event) => model.filters.setQuery(event.target.value)} placeholder="Clave, abonado o barrio" /></div></label>
      <label><span>Barrio</span><select value={model.filters.barrio} onChange={(event) => model.filters.setBarrio(event.target.value)}><option value="">Todos</option>{barrios.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    {/* La etapa se elige solo aqui (antes tambien habia un selector con lo
        mismo). Al pasar el cursor o enfocar se adelanta la consulta. */}
    <div className="cl-indicators" role="group" aria-label="Filtrar por etapa" ref={etapasRef}>
      {ETAPAS.map(([key, label, icon]) => <button type="button" key={key} aria-pressed={model.filters.state === key} className={model.filters.state === key ? "is-active" : ""} title={STATE_OPTIONS[key]} onPointerEnter={() => model.prefetchState?.(key)} onFocus={() => model.prefetchState?.(key)} onClick={() => { setAlertsOnly(false); model.filters.setState(model.filters.state === key ? "" : key); }}><Icon name={icon} /><span>{label}</span><strong>{model.counts[key] || 0}</strong></button>)}
      {marca ? <i className="cl-indicators-mark" aria-hidden="true" style={{ transform: `translate(${marca.left}px, ${marca.top}px)`, width: marca.width }} /> : null}
    </div>
    {serviceTotal ? <section className="cl-service-stats" aria-label="Conexiones de servicios registradas">
      <header className="cl-service-stats-head"><h3>Servicios registrados</h3><p>{serviceTotal ? `Sobre ${serviceTotal} ${serviceTotal === 1 ? "ficha" : "fichas"} con los filtros actuales` : "Sin fichas para resumir"}</p></header>
      <dl className="cl-service-stats-grid">{serviceMetrics.map(([key, label, icon, tone]) => { const value = Number(serviceStats[key] || 0); const percent = serviceTotal ? Math.round((value / serviceTotal) * 100) : 0; return <div className={`cl-service-stat ${tone}`} key={key}><dt><Icon name={icon} />{label}</dt><dd><strong>{value}</strong><span>{percent}%</span></dd></div>; })}</dl>
    </section> : null}
    <div className="cl-bulk-actions"><button type="button" className="cl-secondary" onClick={onSelectAll} disabled={bulkLoading || !model.total}><Icon name="clipboard" />Seleccionar todas ({model.total})</button>{selectedIds.size ? <button type="button" className="cl-quiet" onClick={onClearSelection}><Icon name="close" />Limpiar selección</button> : null}<span>{selectedIds.size ? `${selectedIds.size} ${selectedIds.size === 1 ? "seleccionada" : "seleccionadas"}` : "Marca fichas para compararlas o imprimir un resumen"}</span>{selectedIds.size ? <span className="cl-bulk-selected"><button type="button" className="cl-secondary" onClick={onCompare} disabled={bulkLoading}><Icon name="search" />{bulkLoading ? "Procesando..." : "Comparar con Alcaldía"}</button><button type="button" className="cl-primary" onClick={onPrintSummary}><Icon name="print" />Imprimir resumen</button></span> : null}</div>
    {comparison?.summary ? <div className="cl-comparison-summary"><strong>{comparison.summary.total} comparadas</strong><span>En ambos: {comparison.summary.both}</span><span>Solo Alcaldía: {comparison.summary.alcaldia_only}</span><span>Solo Aguas: {comparison.summary.aguas_only}</span><span>En ninguno: {comparison.summary.neither}</span></div> : null}
    {model.error ? <p className="cl-alert">{model.error}</p> : null}
    <div className={`cl-table-wrap ${model.refreshing ? "is-refreshing" : ""}`.trim()} aria-busy={model.loading || model.refreshing}>{model.refreshing ? <span className="cl-table-progress" role="status" aria-label="Actualizando fichas" /> : null}<table className="cl-table"><thead><tr><th><SpringCheck checked={allVisibleSelected} onChange={() => onToggleVisible(visibleItems)} ariaLabel="Seleccionar las fichas visibles" /></th><th>Clave / abonado</th><th>Responsable</th><th>Barrio</th><th>Padrones</th><th>Etapa</th><th>Impresión</th><th>Plazo</th><th /></tr></thead><tbody key={model.viewKey || "inicial"} className="cl-rows">
      {model.loading ? <TableSkeleton columns={9} label="Cargando fichas…" /> : visibleItems.length ? visibleItems.map((item) => { const match = comparisons.get(String(item.id)); const deadline = deadlineById.get(String(item.id)); const rowClasses = [selectedIds.has(String(item.id)) ? "is-selected" : "", ["warning","due","overdue"].includes(deadline?.statusKey) ? "is-critical" : ""].filter(Boolean).join(" "); return <tr key={item.id} className={rowClasses}><td><SpringCheck checked={selectedIds.has(String(item.id))} onChange={() => onToggle(item)} ariaLabel={`Seleccionar ${item.clave_catastral}`} /></td><td><button type="button" className="cl-link" onClick={() => onOpen(item)}><strong>{item.clave_catastral}</strong><span>{item.abonado || "Sin abonado"}</span></button></td><td>{item.levantamiento_datos || "Sin asignar"}</td><td>{item.barrio_colonia || "Sin ubicación"}</td><td>{match ? <span className={`cl-padron-badge ${match.appears_in_alcaldia && !match.appears_in_aguas ? "is-warning" : ""}`}>{match.appears_in_alcaldia ? "Alcaldía" : "No Alcaldía"} / {match.appears_in_aguas ? "Aguas" : "No Aguas"}</span> : <span className="cl-muted">Sin comparar</span>}</td><td><span className={`cl-status is-${item.estado_operativo || "pending"}`}><i />{stateLabel(item.estado_operativo)}</span></td><td>{item.printed_at ? <span className="cl-print-state is-printed"><Icon name="success" />Impresa {new Date(item.printed_at).toLocaleDateString("es-HN")}</span> : <span className="cl-print-state">No impresa</span>}</td><td>{deadline ? <span className={`cl-deadline is-${deadline.statusKey}`}><strong>{deadline.label}</strong><small>{deadline.helper}</small><small>{deadline.deadlineLabel}</small></span> : <span className="cl-muted">Sin plazo activo</span>}</td><td><button type="button" className="cl-icon-button" onClick={() => onOpen(item)} aria-label="Abrir ficha"><Icon name="arrowRight" /></button></td></tr>; }) : <tr><td colSpan="9" className="cl-empty">{alertsOnly ? "No hay fichas con plazo crítico en esta página." : "No hay fichas con estos filtros."}</td></tr>}
    </tbody></table></div>
    <footer className="cl-pagination"><span>Página {model.page} de {model.total_pages}</span><div><button type="button" disabled={model.page <= 1} onClick={() => model.filters.setPage(model.page - 1)}><Icon name="arrowLeft" />Anterior</button><button type="button" disabled={model.page >= model.total_pages} onClick={() => model.filters.setPage(model.page + 1)}>Siguiente<Icon name="arrowRight" /></button></div></footer>
  </section>;
}
