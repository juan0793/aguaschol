import { useState } from "react";
import { Icon } from "../../../components/Icon";
import { useReportes } from "../hooks/useReportes";
import ReporteTecnicoForm from "../components/ReporteTecnicoForm";

const labels = { new: "Nuevo", review: "En revisión", info_requested: "Información solicitada", approved: "Aprobado", linked: "Vinculado", duplicate: "Duplicado", discarded: "Descartado" };

export default function ReportesTecnicosPage({ api, config, notify }) {
  const model = useReportes(api);
  const [mode, setMode] = useState("list");
  const [reason, setReason] = useState("");
  const [linkId, setLinkId] = useState("");
  const transition = async (report, state) => { try { await api.reportState(report.id, state, reason); setReason(""); await model.reload(); notify("Reporte actualizado y auditado."); } catch (error) { notify(error.message); } };
  const link = async (report) => { try { await api.linkReport(report.id, Number(linkId)); setLinkId(""); await model.reload(); notify("Reporte vinculado sin alterar datos del padrón."); } catch (error) { notify(error.message); } };

  return <section className="cl-reports">
    <header className="cl-page-head"><div><span className="cl-kicker">Control de campo</span><h2>Reportes técnicos</h2><p>Recepción, revisión y vínculo controlado con fichas.</p></div><button type="button" className="cl-primary" onClick={() => setMode(mode === "form" ? "list" : "form")}><Icon name={mode === "form" ? "arrowLeft" : "plus"} />{mode === "form" ? "Volver a reportes" : "Nuevo reporte"}</button></header>
    {mode === "form" ? <ReporteTecnicoForm api={api} notify={notify} onCreated={() => { model.reload(); setMode("list"); }} /> : <>
      <div className="cl-toolbar"><label className="cl-search"><span>Buscar reporte</span><div><Icon name="search" /><input value={model.query} onChange={(event) => model.setQuery(event.target.value)} placeholder="Código, clave, abonado o barrio" /></div></label><label><span>Estado</span><select value={model.state} onChange={(event) => model.setState(event.target.value)}><option value="">Todos</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {model.error ? <p className="cl-alert">{model.error}</p> : null}
      <div className="cl-report-list">{model.loading ? <p className="cl-empty">Cargando reportes…</p> : model.items.length ? model.items.map((report) => {
        const transitions = config.report_transitions[report.estado] || [];
        return <article key={report.id}>
          <header><div><span className={`cl-status is-${report.estado}`}><i />{labels[report.estado] || report.estado}</span><h3>{report.codigo}</h3><p>{report.clave_consultada || report.abonado_consultado || "Inmueble sin registro"} · {report.barrio_colonia || "Sin barrio"}</p></div><time>{new Date(report.created_at).toLocaleString("es-HN")}</time></header>
          <p className="cl-report-finding">{report.hallazgo}</p>
          <div className="cl-report-meta"><span><Icon name="map" />{report.latitude ? `${report.latitude}, ${report.longitude}` : "Sin GPS"}</span><span><Icon name="activity" />{report.evidences?.length || 0} evidencias</span><span><Icon name="users" />{report.creator_name || "Sin técnico"}</span></div>
          {config.permissions.can_review_report && transitions.length ? <footer><label><span>Motivo</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Para solicitar, duplicar o descartar" /></label><div>{transitions.filter((state) => !["linked", "review"].includes(state)).map((state) => <button type="button" className={state === "discarded" ? "cl-danger" : "cl-secondary"} key={state} onClick={() => transition(report, state)}>{labels[state]}</button>)}</div>{transitions.includes("linked") ? <><label><span>ID de ficha</span><input inputMode="numeric" value={linkId} onChange={(event) => setLinkId(event.target.value)} placeholder="Ej. 24" /></label><button type="button" className="cl-primary" disabled={!linkId} onClick={() => link(report)}>Vincular</button></> : null}</footer> : null}
        </article>;
      }) : <p className="cl-empty">No hay reportes con estos filtros.</p>}</div>
    </>}
  </section>;
}
