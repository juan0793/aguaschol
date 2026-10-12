import { useMemo } from "react";
import DashboardWorkspace from "./DashboardWorkspace";
import { GraficoPorDia } from "../entregas/components/ReporteCharts";
import { buildManagerDashboardModel } from "./managerDashboardSelectors.js";
import { managerToday, useManagerDashboard } from "./useManagerDashboard";
import { ModuleSkeleton } from "../../components/ds/Skeleton";
import { Icon } from "../../components/Icon";
import ManagerReportControls from "../reports/ManagerReportControls";
import ManagerPlatformCost from "./ManagerPlatformCost";
import "../entregas/styles/entregas.css";
import "./managerDashboard.css";

const formatNumber = (value) => Number(value || 0).toLocaleString("es-HN");
const monthLabel = (month) => {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString("es-HN", { month: "long", year: "numeric" });
};
const compareReadout = (previous) => Number.isFinite(Number(previous)) && previous !== null && previous !== undefined ? `${formatNumber(previous)} el mes anterior` : "En el período";

function buildIndicators(data) {
  const { inspections, deliveries } = data;
  const asignadas = Number(deliveries.asignadas) || 0;
  const vencidas = Number(deliveries.vencidas) || 0;
  return [
    { label: "Inspecciones creadas", value: inspections.creadas_mes, view: "inspecciones", readout: compareReadout(inspections.creadas_mes_anterior) },
    { label: "Inspecciones finalizadas", value: inspections.finalizadas_mes, view: "inspecciones", readout: compareReadout(inspections.finalizadas_mes_anterior) },
    { label: "Documentos entregados", value: deliveries.entregadas, view: "entregas", readout: asignadas ? `${Math.round((Number(deliveries.entregadas) || 0) / asignadas * 100)}% de ${formatNumber(asignadas)} asignados` : "En el período" },
    { label: "Documentos pendientes", value: deliveries.pendientes, view: "entregas", readout: vencidas ? `${formatNumber(vencidas)} ${vencidas === 1 ? "vencido" : "vencidos"}` : "Ninguno vencido", tone: vencidas ? "is-critical" : "" }
  ];
}

export default function ManagerDashboardWorkspace({ apiFetch, navigate, reportsOnly = false }) {
  const state = useManagerDashboard(apiFetch, { enabled: !reportsOnly });
  const model = useMemo(() => {
    if (!state.snapshot) return null;
    try { return { data: buildManagerDashboardModel(state.snapshot, navigate) }; }
    catch (error) { return { error: error.message }; }
  }, [state.snapshot, navigate]);
  const data = state.snapshot;
  return <section className="manager-dashboard">
    <header className="manager-toolbar">
      <h2 className="manager-sr-only">{reportsOnly ? "Consultas e informes" : "Gerencia"}</h2>
      <ManagerReportControls apiFetch={apiFetch} month={state.month} />
      <label className="manager-period">Período de seguimiento<input type="month" value={state.month} max={managerToday().slice(0, 7)} onChange={(event) => { if (event.target.value) state.setMonth(event.target.value); }} /><small>La cartera usa el corte del padrón.</small></label>
    </header>
    {state.error || model?.error ? <div className="manager-error" role="alert"><p>{state.error || model.error}{data ? ` Se conserva la consulta del período ${data.month}.` : ""}</p><button type="button" onClick={state.refresh} disabled={state.loading}>Reintentar</button></div> : null}
    {!data && state.loading ? <ModuleSkeleton title="Gerencia" /> : null}
    {!reportsOnly && model?.data ? <>
      <section className="manager-indicators" aria-labelledby="manager-indicators-title">
        <h2 id="manager-indicators-title">Seguimiento de {monthLabel(data.month)}</h2>
        <div className="manager-indicator-grid">
          {buildIndicators(data).map((item) => <button type="button" key={item.label} onClick={() => navigate(item.view)} aria-label={`${item.label}: ${formatNumber(item.value)}. ${item.readout}. Abrir ${item.view === "entregas" ? "Control de entregas" : "Inspecciones"}`}>
            <span className="manager-indicator-label">{item.label}<Icon name="chevronRight" className="manager-indicator-go" /></span>
            <strong>{formatNumber(item.value)}</strong>
            <small className={item.tone}>{item.readout}</small>
          </button>)}
        </div>
      </section>
      <ManagerPlatformCost apiFetch={apiFetch} />
      <section className="manager-tracking">
        <article className="dw-panel"><header className="dw-panel-head"><h2>Entregas de {monthLabel(data.month)}</h2></header><div className="manager-chart-scroll" tabIndex={0} role="region" aria-label="Seguimiento diario de entregas; desplazamiento horizontal"><div style={{ minWidth: Math.max(560, data.deliveries.por_dia.length * 44) }}><GraficoPorDia rows={data.deliveries.por_dia} /></div></div></article>
        <article className="dw-panel"><header className="dw-panel-head"><h2>Carga actual por técnico</h2></header><ul className="manager-workload">{data.inspections.carga_tecnicos.map((item) => { const max = Math.max(1, ...data.inspections.carga_tecnicos.map((row) => Number(row.activas) || 0)); return <li key={item.tecnico_id}><span className="manager-workload-name">{item.nombre || "Sin nombre"}</span><span className="manager-workload-bar" aria-hidden="true"><span style={{ width: `${Math.max(2, (Number(item.activas) || 0) / max * 100)}%` }} /></span><strong aria-label={`${formatNumber(item.activas)} inspecciones activas`}>{formatNumber(item.activas)}</strong></li>; })}</ul>{!data.inspections.carga_tecnicos.length ? <p className="dw-empty">No hay inspecciones activas asignadas.</p> : null}<p className="manager-scope">Incluye inspecciones pendientes de todos los períodos.</p></article>
      </section>
      <DashboardWorkspace model={{ ...model.data, refresh: state.refresh, refreshing: state.loading, manualRefreshing: state.loading, connectionStatus: state.error ? "retrying" : "synced", syncLabel: state.error ? "No se pudo actualizar" : state.loading ? "Actualizando…" : `Consultado ${state.updatedAt?.toLocaleTimeString("es-HN", { timeZone: "America/Tegucigalpa", hour: "2-digit", minute: "2-digit" })}`, fetchServiceAccounts: async (field, limit) => { const response = await apiFetch(`/claves/services/accounts?field=${encodeURIComponent(field)}&limit=${encodeURIComponent(limit)}`); const body = await response.json(); if (!response.ok) throw new Error(body.message); return body; } }} />
    </> : null}
  </section>;
}
