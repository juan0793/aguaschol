import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import ReportDialog from "./ReportDialog";
import { downloadManagerReport } from "./managerReportPdf.js";
import logo from "../../assets/logo-aguas-choluteca.png";
import "./managerReports.css";

const TYPES = [["executive", "Resumen ejecutivo"], ["portfolio", "Cartera por barrio"], ["inspections", "Inspecciones"], ["deliveries", "Entregas"], ["clandestinos", "Fichas clandestinas"], ["gps", "Seguimiento GPS"], ["team", "Actividad del equipo"]];
export default function ManagerReportControls({ apiFetch, month }) {
  const [type, setType] = useState("executive");
  const [barrio, setBarrio] = useState("");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const canFilterBarrio = ["portfolio", "inspections", "clandestinos"].includes(type);
  const prepare = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/reports/manager", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, month, barrio: canFilterBarrio ? barrio : "" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No se pudo preparar el informe.");
      if (active.current) setReport(result);
    } catch (reason) { if (active.current) setError(reason.message); }
    finally { if (active.current) setBusy(false); }
  };
  const download = async () => {
    setBusy(true); setError("");
    try { await downloadManagerReport(report, apiFetch, { logo, isActive: () => active.current }); }
    catch (reason) { if (active.current) setError(reason.message); }
    finally { if (active.current) setBusy(false); }
  };
  return <section className="manager-reports" aria-label="Consultas e informes gerenciales">
    <form onSubmit={prepare}>
      <label>Informe<select value={type} disabled={busy} onChange={(event) => setType(event.target.value)}>{TYPES.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      {canFilterBarrio ? <label>Barrio (opcional)<input value={barrio} maxLength={180} disabled={busy} onChange={(event) => setBarrio(event.target.value)} placeholder="Nombre exacto del barrio" /></label> : null}
      <button type="submit" disabled={busy}><Icon name="records" />{busy ? "Preparando…" : "Consultar informe"}</button>
    </form>
    <p>Cartera y fichas usan el estado actual; los otros informes usan el mes seleccionado. PDF en tamaño carta.</p>
    {error ? <p role="alert" className="manager-report-error">{error}</p> : null}
    <ReportDialog open={Boolean(report)} onClose={() => { if (!busy) setReport(null); }} title={report?.title || "Informe gerencial"}>
      {report ? <>
        <div className="manager-report-preview"><p>ID {report.report_id} · Preparado {new Date(report.created_at).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" })}</p>{report.period ? <p>Período {report.period.from} al {report.period.to}</p> : null}{report.filters.barrio ? <p>Barrio: {report.filters.barrio}</p> : null}{report.notes.map((note) => <p key={note}>{note}</p>)}
          {report.sections.map((item) => <section key={item.title}><h3>{item.title}</h3><div className="manager-report-table"><table><thead><tr>{item.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{item.rows.slice(0, 20).map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>{item.rows.length > 20 ? <p>Vista previa: 20 de {item.rows.length} filas. El PDF incluye todas las filas de la consulta.</p> : !item.rows.length ? <p>Sin registros para los filtros seleccionados.</p> : null}</section>)}
        </div>
        <footer>{error ? <p role="alert" className="manager-report-error">{error}</p> : null}<button type="button" onClick={download} disabled={busy}><Icon name="download" />{busy ? "Generando PDF…" : "Descargar PDF"}</button><button type="button" disabled={busy} onClick={() => setReport(null)}>Cerrar</button></footer>
      </> : null}
    </ReportDialog>
  </section>;
}
