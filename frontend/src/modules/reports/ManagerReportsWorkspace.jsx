import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { downloadManagerReport } from "./managerReportPdf.js";
import { reportPanels } from "./ManagerReportVisuals.jsx";
import { filterRows, monthLabel, pageNumbers, paginate } from "./managerReportFormat.js";
import logo from "../../assets/logo-aguas-choluteca.png";
import "./managerReportsWorkspace.css";

const REPORTS = [
  { key: "executive", name: "Resumen ejecutivo", hint: "Cartera, fichas y seguimiento del mes", icon: "dashboard", month: true },
  { key: "portfolio", name: "Cartera por barrio", hint: "Mora, capital e intereses del padrón", icon: "water", barrio: true },
  { key: "clandestinos", name: "Fichas clandestinas", hint: "Etapas, barrios y banco de clandestinos", icon: "records", barrio: true },
  { key: "inspections", name: "Inspecciones", hint: "Asignadas, estados y responsables", icon: "activity", month: true, barrio: true },
  { key: "deliveries", name: "Entregas", hint: "Documentos entregados y pendientes", icon: "send", month: true },
  { key: "gps", name: "Seguimiento GPS", hint: "Puntos levantados en campo", icon: "map", month: true },
  { key: "team", name: "Actividad del equipo", hint: "Acciones registradas por persona", icon: "users", month: true }
];
const PAGE_SIZE = 12;
const TZ = "America/Tegucigalpa";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const stamp = (value) => new Date(value).toLocaleString("es-HN", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const shortDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
const isNumeric = (value) => /^(L\s)?-?[\d.,]+$/.test(String(value ?? "").trim());

export default function ManagerReportsWorkspace({ apiFetch }) {
  const [type, setType] = useState("executive");
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [barrioDraft, setBarrioDraft] = useState("");
  const [barrio, setBarrio] = useState("");
  const [state, setState] = useState({ loading: false, error: "", report: null });
  const [tab, setTab] = useState("resumen");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyPdf, setBusyPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [reload, setReload] = useState(0);
  const cache = useRef(new Map());
  const forceRef = useRef(false);
  const active = useRef(true);
  const meta = REPORTS.find((item) => item.key === type);
  const appliedBarrio = meta.barrio ? barrio : "";

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  // Cada informe se prepara una vez por combinación de filtros; volver a él no lo repite.
  useEffect(() => {
    const key = `${type}|${meta.month ? month : ""}|${appliedBarrio}`;
    const cached = cache.current.get(key);
    const force = forceRef.current;
    forceRef.current = false;
    setTab("resumen"); setSearch(""); setPage(1); setPdfError("");
    if (cached && !force) { setState({ loading: false, error: "", report: cached }); return; }
    let current = true;
    setState((previous) => ({ loading: true, error: "", report: previous.report?.type === type ? previous.report : null }));
    (async () => {
      try {
        const response = await apiFetch("/reports/manager", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, month, barrio: appliedBarrio }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "No se pudo preparar el informe.");
        cache.current.set(key, body);
        if (current && active.current) setState({ loading: false, error: "", report: body });
      } catch (error) {
        if (current && active.current) setState({ loading: false, error: error.message || "No se pudo preparar el informe.", report: null });
      }
    })();
    return () => { current = false; };
  }, [apiFetch, type, month, appliedBarrio, meta.month, reload]);

  const report = state.report?.type === type ? state.report : null;
  const select = (label) => { setSearch(label); setPage(1); if (label && report?.sections?.length) setTab("detalle-0"); };
  const panels = report ? reportPanels(report, { onSelect: select, selected: search }) : [];
  const detailTabs = (report?.sections || []).map((section, index) => ({ key: `detalle-${index}`, label: section.title, count: section.rows.length, section }));
  const tabs = [...panels.map((panel) => ({ key: panel.key, label: panel.label })), ...detailTabs.map(({ key, label, count }) => ({ key, label, count }))];
  const currentTab = tabs.some((item) => item.key === tab) ? tab : tabs[0]?.key;
  const panel = panels.find((item) => item.key === currentTab);
  const detail = detailTabs.find((item) => item.key === currentTab)?.section;
  const rows = detail ? filterRows(detail.rows, search) : [];
  const pageData = paginate(rows, page, PAGE_SIZE);

  const refresh = () => { forceRef.current = true; setReload((value) => value + 1); };
  const download = async () => {
    setBusyPdf(true); setPdfError("");
    try { await downloadManagerReport(report, apiFetch, { logo, isActive: () => active.current }); }
    catch (error) { if (active.current) setPdfError(error.message || "No se pudo generar el PDF."); }
    finally { if (active.current) setBusyPdf(false); }
  };

  return <section className="mr" aria-labelledby="mr-title">
    <header className="mr-head">
      <div><h1 id="mr-title">Consultas e informes</h1><p>Elige un informe del índice. Cada consulta queda registrada y se descarga en PDF tamaño carta.</p></div>
    </header>
    <div className="mr-layout">
      <nav className="mr-index" aria-label="Informes">
        {REPORTS.map((item) => <button type="button" key={item.key} className={item.key === type ? "is-active" : ""} aria-current={item.key === type ? "page" : undefined} onClick={(event) => { setType(item.key); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>
          <Icon name={item.icon} /><span><strong>{item.name}</strong><small>{item.hint}</small></span>
        </button>)}
      </nav>
      <article className="mr-body" aria-busy={state.loading}>
        <header className="mr-report-head">
          <div>
            <h2>{meta.name}</h2>
            <p>{report ? <>Preparado {stamp(report.created_at)}{report.period ? ` · ${shortDate(report.period.from)} al ${shortDate(report.period.to)}` : " · Estado actual"}{report.cutoff ? ` · corte del padrón ${shortDate(String(report.cutoff).slice(0, 10))}` : ""}{report.filters?.barrio ? ` · ${report.filters.barrio}` : ""}</> : state.loading ? "Preparando el informe…" : meta.hint}</p>
          </div>
          <div className="mr-filters">
            {meta.month ? <label>Mes<input className="mr-input" type="month" value={month} max={today().slice(0, 7)} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }} /></label> : <span className="mr-filter-note">Usa el estado actual</span>}
            {meta.barrio ? <form onSubmit={(event) => { event.preventDefault(); setBarrio(barrioDraft.trim()); }}>
              <label>Barrio<span className="mr-barrio"><input className="mr-input" value={barrioDraft} maxLength={180} placeholder="Todos" onChange={(event) => setBarrioDraft(event.target.value)} />{barrio ? <button type="button" aria-label="Quitar barrio" onClick={() => { setBarrio(""); setBarrioDraft(""); }}><Icon name="close" /></button> : null}</span></label>
            </form> : null}
            <button type="button" className="mr-icon-button" onClick={refresh} disabled={state.loading} aria-label="Volver a consultar" title="Volver a consultar"><Icon name="refresh" /></button>
            <button type="button" className="mr-primary" onClick={download} disabled={!report || busyPdf || state.loading}><Icon name="download" />{busyPdf ? "Generando…" : "Descargar PDF"}</button>
          </div>
        </header>
        {pdfError ? <p className="mr-error" role="alert">{pdfError}</p> : null}
        {state.error ? <div className="mr-error" role="alert"><p>{state.error}</p><button type="button" onClick={refresh}>Reintentar</button></div> : null}
        {state.loading && !report ? <div className="mr-skeleton" aria-hidden="true"><span /><span /><span /></div> : null}
        {report ? <>
          {report.notes?.length ? <p className="mr-notes">{report.notes.join(" ")}</p> : null}
          <div className="mr-tabs" role="tablist" aria-label="Partes del informe">
            {tabs.map((item) => <button type="button" role="tab" key={item.key} id={`mr-tab-${item.key}`} aria-selected={item.key === currentTab} aria-controls="mr-panel" className={item.key === currentTab ? "is-active" : ""} onClick={() => { setTab(item.key); setPage(1); }}>
              {item.label}{item.count != null ? <span>{item.count.toLocaleString("es-HN")}</span> : null}
            </button>)}
          </div>
          <div id="mr-panel" role="tabpanel" aria-labelledby={`mr-tab-${currentTab}`} className={state.loading ? "is-refreshing" : ""}>
            {panel ? panel.content : null}
            {detail ? <section className="mr-detail">
              <div className="mr-detail-tools">
                <label className="mr-search"><Icon name="search" /><input className="mr-input" type="search" value={search} placeholder="Buscar en esta tabla" aria-label={`Buscar en ${detail.title}`} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
                <p>{pageData.total ? `${pageData.from.toLocaleString("es-HN")}–${pageData.to.toLocaleString("es-HN")} de ${pageData.total.toLocaleString("es-HN")}` : "Sin filas"}{search ? ` · filtrado por “${search}”` : ""}</p>
              </div>
              <div className="mr-table-wrap">
                <table className="mr-table">
                  <thead><tr>{detail.columns.map((column, index) => <th key={column} className={detail.rows.length && isNumeric(detail.rows[0][index]) ? "is-number" : ""}>{column}</th>)}</tr></thead>
                  <tbody>{pageData.items.map((row, rowIndex) => <tr key={`${pageData.from}-${rowIndex}`}>{row.map((cell, index) => <td key={index} className={isNumeric(cell) ? "is-number" : ""}>{cell ?? "—"}</td>)}</tr>)}</tbody>
                </table>
                {!pageData.total ? <p className="mr-empty">{search ? "Ninguna fila coincide con la búsqueda." : "Sin registros para los filtros seleccionados."}</p> : null}
              </div>
              {pageData.totalPages > 1 ? <nav className="mr-pager" aria-label="Páginas del detalle">
                <button type="button" onClick={() => setPage(pageData.page - 1)} disabled={pageData.page === 1} aria-label="Página anterior"><Icon name="arrowLeft" /></button>
                {pageNumbers(pageData.page, pageData.totalPages).map((value, index) => value === "…" ? <span key={`gap-${index}`} aria-hidden="true">…</span> : <button type="button" key={value} className={value === pageData.page ? "is-active" : ""} aria-current={value === pageData.page ? "page" : undefined} onClick={() => setPage(value)}>{value}</button>)}
                <button type="button" onClick={() => setPage(pageData.page + 1)} disabled={pageData.page === pageData.totalPages} aria-label="Página siguiente"><Icon name="arrowRight" /></button>
              </nav> : null}
            </section> : null}
          </div>
          <p className="mr-id">Informe {report.report_id}{meta.month ? ` · ${monthLabel(month)}` : ""}</p>
        </> : null}
      </article>
    </div>
  </section>;
}
