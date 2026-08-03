import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { getRecordDeadlineMeta } from "../../../utils/records";

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
  useEffect(() => { sessionStorage.removeItem(ALERT_FOCUS_KEY); }, []);
  return <section className="cl-inbox" aria-label="Bandeja de trabajo de fichas">
    <header className="cl-inbox-head"><div><span className="cl-kicker">Bandeja de trabajo</span><h2>Fichas clandestinas</h2><p>{alertsOnly ? `${alertItems.length} ${alertItems.length === 1 ? "ficha que requiere" : "fichas que requieren"} atención en esta página` : `${model.total} expedientes en el resultado actual`}</p></div>{canCreate ? <button type="button" className="cl-primary" onClick={onNew}><Icon name="plus" />Nueva ficha</button> : null}</header>
    <section className="cl-workflow-guide" aria-label="Proceso recomendado para una ficha clandestina">{FLOW_GUIDE.map(([number, title, detail]) => <article key={number}><span>{number}</span><div><strong>{title}</strong><small>{detail}</small></div></article>)}</section>
    {alertItems.length ? <section className={`cl-deadline-banner ${alertsOnly ? "is-filtered" : ""}`} role="status"><span className="cl-deadline-icon"><Icon name="warning" /></span><div className="cl-deadline-copy"><small>Atención prioritaria</small><strong>{alertsOnly ? `Mostrando ${alertTitle.toLowerCase()}` : alertTitle}</strong><span>{overdueCount ? `Revisa el plazo y registra la siguiente acción para poner${alertItems.length === 1 ? "la" : "las"} al día.` : `Quedan dos días hábiles o menos para atender${alertItems.length === 1 ? "la" : "las"}.`}</span></div><button type="button" className="cl-deadline-action" onClick={() => setAlertsOnly((current) => !current)}>{alertsOnly ? "Ver todas" : "Revisar ahora"}<Icon name={alertsOnly ? "refresh" : "arrowRight"} /></button></section> : null}
    <div className="cl-toolbar">
      <label className="cl-search"><span>Buscar ficha</span><div><Icon name="search" /><input value={model.filters.query} onChange={(event) => model.filters.setQuery(event.target.value)} placeholder="Clave, abonado o barrio" /></div></label>
      <label><span>Etapa del proceso</span><select value={model.filters.state} onChange={(event) => model.filters.setState(event.target.value)}><option value="">Todas las etapas</option>{Object.entries(STATE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Barrio</span><select value={model.filters.barrio} onChange={(event) => model.filters.setBarrio(event.target.value)}><option value="">Todos</option>{barrios.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button type="button" className="cl-quiet" onClick={() => { model.filters.clear(); setAlertsOnly(false); }}><Icon name="refresh" />Limpiar</button>
    </div>
    <div className="cl-indicators">{[["pending","Por visitar"],["visit","En visita"],["confirmed","Aviso pendiente"],["regularization","En seguimiento"],["regularized","Cerradas"]].map(([key,label]) => <button type="button" key={key} className={model.filters.state === key ? "is-active" : ""} onClick={() => { setAlertsOnly(false); model.filters.setState(model.filters.state === key ? "" : key); }}><span>{label}</span><strong>{model.counts[key] || 0}</strong></button>)}</div>
    <div className="cl-bulk-actions"><button type="button" className="cl-secondary" onClick={onSelectAll} disabled={bulkLoading || !model.total}>Seleccionar todas ({model.total})</button>{selectedIds.size ? <button type="button" className="cl-quiet" onClick={onClearSelection}>Limpiar selección</button> : null}<span>{selectedIds.size} seleccionadas</span><button type="button" className="cl-secondary" onClick={onCompare} disabled={bulkLoading || !selectedIds.size}><Icon name="search" />{bulkLoading ? "Procesando..." : "Comparar con Alcaldía"}</button><button type="button" className="cl-primary" onClick={onPrintSummary} disabled={!selectedIds.size}><Icon name="print" />Imprimir resumen</button></div>
    {comparison?.summary ? <div className="cl-comparison-summary"><strong>{comparison.summary.total} comparadas</strong><span>En ambos: {comparison.summary.both}</span><span>Solo Alcaldía: {comparison.summary.alcaldia_only}</span><span>Solo Aguas: {comparison.summary.aguas_only}</span><span>En ninguno: {comparison.summary.neither}</span></div> : null}
    {model.error ? <p className="cl-alert">{model.error}</p> : null}
    <div className="cl-table-wrap"><table className="cl-table"><thead><tr><th><input type="checkbox" checked={allVisibleSelected} onChange={() => onToggleVisible(visibleItems)} aria-label="Seleccionar las fichas visibles" /></th><th>Clave / abonado</th><th>Responsable</th><th>Barrio</th><th>Padrones</th><th>Etapa</th><th>Impresión</th><th>Plazo</th><th /></tr></thead><tbody>
      {model.loading ? <tr><td colSpan="9" className="cl-empty">Cargando fichas…</td></tr> : visibleItems.length ? visibleItems.map((item) => { const match = comparisons.get(String(item.id)); const deadline = deadlineById.get(String(item.id)); const rowClasses = [selectedIds.has(String(item.id)) ? "is-selected" : "", ["warning","due","overdue"].includes(deadline?.statusKey) ? "is-critical" : ""].filter(Boolean).join(" "); return <tr key={item.id} className={rowClasses}><td><input type="checkbox" checked={selectedIds.has(String(item.id))} onChange={() => onToggle(item)} aria-label={`Seleccionar ${item.clave_catastral}`} /></td><td><button type="button" className="cl-link" onClick={() => onOpen(item)}><strong>{item.clave_catastral}</strong><span>{item.abonado || "Sin abonado"}</span></button></td><td>{item.levantamiento_datos || "Sin asignar"}</td><td>{item.barrio_colonia || "Sin ubicación"}</td><td>{match ? <span className={`cl-padron-badge ${match.appears_in_alcaldia && !match.appears_in_aguas ? "is-warning" : ""}`}>{match.appears_in_alcaldia ? "Alcaldía" : "No Alcaldía"} / {match.appears_in_aguas ? "Aguas" : "No Aguas"}</span> : <span className="cl-muted">Sin comparar</span>}</td><td><span className={`cl-status is-${item.estado_operativo || "pending"}`}><i />{stateLabel(item.estado_operativo)}</span></td><td>{item.printed_at ? <span className="cl-print-state is-printed"><Icon name="success" />Impresa {new Date(item.printed_at).toLocaleDateString("es-HN")}</span> : <span className="cl-print-state">No impresa</span>}</td><td>{deadline ? <span className={`cl-deadline is-${deadline.statusKey}`}><strong>{deadline.label}</strong><small>{deadline.helper}</small><small>{deadline.deadlineLabel}</small></span> : <span className="cl-muted">Sin plazo activo</span>}</td><td><button type="button" className="cl-icon-button" onClick={() => onOpen(item)} aria-label="Abrir ficha"><Icon name="arrowRight" /></button></td></tr>; }) : <tr><td colSpan="9" className="cl-empty">{alertsOnly ? "No hay fichas con plazo crítico en esta página." : "No hay fichas con estos filtros."}</td></tr>}
    </tbody></table></div>
    <footer className="cl-pagination"><span>Página {model.page} de {model.total_pages}</span><div><button type="button" disabled={model.page <= 1} onClick={() => model.filters.setPage(model.page - 1)}><Icon name="arrowLeft" />Anterior</button><button type="button" disabled={model.page >= model.total_pages} onClick={() => model.filters.setPage(model.page + 1)}>Siguiente<Icon name="arrowRight" /></button></div></footer>
  </section>;
}
