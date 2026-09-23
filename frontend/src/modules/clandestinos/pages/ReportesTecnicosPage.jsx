import { useState } from "react";
import { Icon } from "../../../components/Icon";
import ReporteTecnicoForm from "../components/ReporteTecnicoForm";

export const REPORT_LABELS = { new: "Nuevo", review: "En revisión", info_requested: "Información solicitada", approved: "Aprobado", linked: "Vinculado", duplicate: "Duplicado", discarded: "Descartado" };
// Orden del recorrido de un reporte, con icono, para las etiquetas de filtro.
// ("new" existe en el catálogo pero el backend crea los reportes ya en revisión.)
const REPORT_FLOW = [["review", "En revisión", "search"], ["info_requested", "Falta información", "warning"], ["approved", "Aprobados", "checkCircle"], ["linked", "Vinculados", "records"], ["duplicate", "Duplicados", "copy"], ["discarded", "Descartados", "archive"]];
// Texto de cada botón según a qué estado lleva (más claro que el nombre del estado).
const ACTION_LABELS = { review: "Pasar a revisión", info_requested: "Pedir información", approved: "Aprobar", duplicate: "Marcar duplicado", discarded: "Descartar" };
const GUIDE = [
  ["1", "El técnico reporta", "Desde campo, con «Nuevo reporte»: clave o abonado (o «sin registro»), lo que encontró, GPS y foto."],
  ["2", "Administración revisa", "Llega en revisión: se aprueba, se pide más información (y vuelve a revisión) o se descarta. El padrón no se toca."],
  ["3", "Se vincula a una ficha", "Un reporte aprobado se une a la ficha del inmueble como evidencia del caso."]
];
const GUIDE_KEY = "aguas.clandestinos.reportes.guia";

export default function ReportesTecnicosPage({ api, config, notify, model }) {
  const [mode, setMode] = useState("list");
  const [reason, setReason] = useState("");
  const [linkId, setLinkId] = useState("");
  const [guia, setGuia] = useState(() => { try { return localStorage.getItem(GUIDE_KEY) !== "oculta"; } catch { return true; } });
  const toggleGuia = () => setGuia((current) => { try { localStorage.setItem(GUIDE_KEY, current ? "oculta" : "visible"); } catch { /* sin almacenamiento */ } return !current; });
  const transition = async (report, state) => { try { await api.reportState(report.id, state, reason); setReason(""); await model.reload(); notify(`Reporte ${report.codigo}: ${REPORT_LABELS[state].toLowerCase()}.`); } catch (error) { notify(error.message); } };
  const link = async (report) => { try { await api.linkReport(report.id, Number(linkId)); setLinkId(""); await model.reload(); notify("Reporte vinculado a la ficha sin alterar datos del padrón."); } catch (error) { notify(error.message); } };
  const porAtender = (model.counts.new || 0) + (model.counts.review || 0) + (model.counts.info_requested || 0);

  return <section className="cl-reports">
    <header className="cl-reports-head">
      <p><Icon name="activity" />{model.total ? <><strong>{porAtender}</strong> por atender de {model.total} {model.total === 1 ? "reporte" : "reportes"}</> : "Todavía no hay reportes de campo"}</p>
      <div>
        <button type="button" className="cl-quiet" aria-expanded={guia} onClick={toggleGuia}><Icon name="clipboard" />{guia ? "Ocultar guía" : "¿Para qué sirve?"}</button>
        {config.permissions.can_create_report ? <button type="button" className="cl-primary" onClick={() => setMode(mode === "form" ? "list" : "form")}><Icon name={mode === "form" ? "arrowLeft" : "plus"} />{mode === "form" ? "Volver a reportes" : "Nuevo reporte"}</button> : null}
      </div>
    </header>
    {guia ? <div className="cl-reports-guide" aria-label="Cómo funcionan los reportes técnicos">
      <p className="cl-reports-guide-lead">Un <strong>reporte técnico</strong> es un hallazgo que un técnico registra desde campo sobre un inmueble: una conexión sin cuenta, un servicio distinto al registrado, una ampliación… Sirve para documentarlo con foto y GPS y que administración decida qué hacer.</p>
      <ol>{GUIDE.map(([numero, titulo, detalle]) => <li key={numero}><span>{numero}</span><div><strong>{titulo}</strong><small>{detalle}</small></div></li>)}</ol>
      <p className="cl-reports-guide-note"><Icon name="inbox" />No es lo mismo que el <strong>Banco</strong>: el Banco trae los puntos importados del levantamiento de QField; un reporte lo crea un técnico desde la app, uno por uno.</p>
    </div> : null}
    {mode === "form" ? <ReporteTecnicoForm api={api} notify={notify} onCreated={() => { model.reload(); setMode("list"); }} /> : <>
      <div className="cl-indicators cl-report-states" role="group" aria-label="Filtrar por estado">
        <button type="button" aria-pressed={!model.state} className={!model.state ? "is-active" : ""} onClick={() => model.setState("")}><Icon name="records" /><span>Todos</span><strong>{model.total}</strong></button>
        {REPORT_FLOW.map(([key, label, icon]) => <button type="button" key={key} aria-pressed={model.state === key} className={model.state === key ? "is-active" : ""} onClick={() => model.setState(model.state === key ? "" : key)}><Icon name={icon} /><span>{label}</span><strong>{model.counts[key] || 0}</strong></button>)}
      </div>
      <div className="cl-toolbar cl-report-toolbar"><label className="cl-search"><span>Buscar reporte</span><div><Icon name="search" /><input value={model.query} onChange={(event) => model.setQuery(event.target.value)} placeholder="Código, clave, abonado o barrio" /></div></label></div>
      {model.error ? <p className="cl-alert">{model.error}</p> : null}
      <div className="cl-report-list">{model.loading ? <p className="cl-empty">Cargando reportes…</p> : model.items.length ? model.items.map((report) => {
        const transitions = config.report_transitions[report.estado] || [];
        // "linked" se hace con el campo de ficha; los demás estados son botones.
        const acciones = transitions.filter((state) => state !== "linked");
        return <article key={report.id}>
          <header><div><span className={`cl-status is-${report.estado}`}><i />{REPORT_LABELS[report.estado] || report.estado}</span><h3>{report.codigo}</h3><p>{report.clave_consultada || report.abonado_consultado || "Inmueble sin registro"} · {report.barrio_colonia || "Sin barrio"}</p></div><time>{new Date(report.created_at).toLocaleString("es-HN")}</time></header>
          <p className="cl-report-finding">{report.hallazgo}</p>
          <div className="cl-report-meta"><span><Icon name="map" />{report.latitude ? `${report.latitude}, ${report.longitude}` : "Sin GPS"}</span><span><Icon name="eye" />{report.evidences?.length || 0} evidencias</span><span><Icon name="users" />{report.creator_name || "Sin técnico"}</span></div>
          {config.permissions.can_review_report && transitions.length ? <footer>{acciones.some((state) => ["info_requested", "duplicate", "discarded"].includes(state)) ? <label><span>Motivo</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Para pedir información, duplicar o descartar" /></label> : <span />}<div>{acciones.map((state) => <button type="button" className={state === "discarded" ? "cl-danger" : state === "approved" || state === "review" ? "cl-primary" : "cl-secondary"} key={state} onClick={() => transition(report, state)}>{ACTION_LABELS[state] || REPORT_LABELS[state]}</button>)}</div>{transitions.includes("linked") ? <><label><span>ID de ficha</span><input inputMode="numeric" value={linkId} onChange={(event) => setLinkId(event.target.value)} placeholder="Ej. 24" /></label><button type="button" className="cl-primary" disabled={!linkId} onClick={() => link(report)}>Vincular a ficha</button></> : null}</footer> : null}
        </article>;
      }) : <div className="cl-empty-state"><Icon name="activity" /><strong>{model.total ? "No hay reportes con estos filtros" : "Aún no hay reportes de campo"}</strong><span>{model.total ? "Prueba con otro estado o quita la búsqueda." : "Cuando un técnico encuentre algo en campo, lo registra con «Nuevo reporte» y aparece aquí para revisarlo."}</span>{!model.total && config.permissions.can_create_report ? <button type="button" className="cl-primary" onClick={() => setMode("form")}><Icon name="plus" />Registrar un hallazgo</button> : null}</div>}</div>
    </>}
  </section>;
}
