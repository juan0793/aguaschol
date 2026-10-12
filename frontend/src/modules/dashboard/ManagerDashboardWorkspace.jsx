import { useMemo, useState } from "react";
import DashboardWorkspace from "./DashboardWorkspace";
import { GraficoPorDia } from "../entregas/components/ReporteCharts";
import { buildManagerDashboardModel } from "./managerDashboardSelectors.js";
import { buildManagerOverview } from "./managerOverview.js";
import { managerToday, useManagerDashboard } from "./useManagerDashboard";
import { ModuleSkeleton } from "../../components/ds/Skeleton";
import { Icon } from "../../components/Icon";
import ManagerReportsWorkspace from "../reports/ManagerReportsWorkspace";
import { usePlatformCost } from "./ManagerPlatformCost";
import { BarrioSummary, DeliveryEffectiveness, InspectionDonut, KpiTiles, TeamToday } from "./ManagerOverviewPanels";
import ManagerLivePanel from "./ManagerLivePanel";
import "../entregas/styles/entregas.css";
import "./managerDashboard.css";

const formatNumber = (value) => Number(value || 0).toLocaleString("es-HN");
const monthLabel = (month) => {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString("es-HN", { month: "long", year: "numeric" });
};
const TABS = [["operacion", "Operación", "activity"], ["cartera", "Cartera y padrón", "water"]];

export default function ManagerDashboardWorkspace({ apiFetch, navigate, reportsOnly = false }) {
  if (reportsOnly) return <ManagerReportsWorkspace apiFetch={apiFetch} />;
  return <ManagerDashboard apiFetch={apiFetch} navigate={navigate} />;
}

function ManagerDashboard({ apiFetch, navigate }) {
  const state = useManagerDashboard(apiFetch, { enabled: true });
  const cost = usePlatformCost(apiFetch);
  const [tab, setTab] = useState("operacion");
  const model = useMemo(() => {
    if (!state.snapshot) return null;
    try { return { data: buildManagerDashboardModel(state.snapshot, navigate), overview: buildManagerOverview(state.snapshot) }; }
    catch (error) { return { error: error.message }; }
  }, [state.snapshot, navigate]);
  const data = state.snapshot;
  const updated = state.updatedAt?.toLocaleTimeString("es-HN", { timeZone: "America/Tegucigalpa", hour: "numeric", minute: "2-digit" });
  return <section className="manager-dashboard">
    <header className="manager-toolbar">
      <h2 className="manager-sr-only">Gerencia</h2>
      <button type="button" className="manager-reports-link" onClick={() => navigate("requests")}><Icon name="records" /><span><strong>Consultas e informes</strong><small>Gráficos, detalle y PDF de cada área</small></span><Icon name="chevronRight" /></button>
      <div className="manager-toolbar-end">
        <p className="manager-updated" aria-live="polite"><span className={state.error ? "is-error" : state.loading ? "is-loading" : ""} aria-hidden="true" />{state.error ? "No se pudo actualizar" : state.loading ? "Actualizando…" : updated ? `Actualizado ${updated}` : ""}<button type="button" onClick={state.refresh} disabled={state.loading} aria-label="Actualizar ahora" title="Actualizar ahora"><Icon name="refresh" /></button></p>
        <label className="manager-period">Período de seguimiento<input type="month" value={state.month} max={managerToday().slice(0, 7)} onChange={(event) => { if (event.target.value) state.setMonth(event.target.value); }} /></label>
      </div>
    </header>
    {state.error || model?.error ? <div className="manager-error" role="alert"><p>{state.error || model.error}{data ? ` Se conserva la consulta del período ${data.month}.` : ""}</p><button type="button" onClick={state.refresh} disabled={state.loading}>Reintentar</button></div> : null}
    {!data && state.loading ? <ModuleSkeleton title="Gerencia" /> : null}
    {model?.data ? <>
      <div className="manager-tabs" role="tablist" aria-label="Vistas de Gerencia">
        {TABS.map(([key, label, icon]) => <button type="button" role="tab" key={key} id={`manager-tab-${key}`} aria-selected={tab === key} aria-controls="manager-panel" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}><Icon name={icon} />{label}</button>)}
        <span className="manager-tabs-note">{tab === "operacion" ? `${monthLabel(data.month)} · comparado con el mes anterior` : "Corte del padrón vigente"}</span>
      </div>
      <div id="manager-panel" role="tabpanel" aria-labelledby={`manager-tab-${tab}`}>
        {tab === "operacion" ? <div className="manager-operation">
          <KpiTiles kpis={model.overview.kpis} cost={cost} navigate={navigate} />
          <div className="manager-row-3">
            <InspectionDonut estados={model.overview.estados} navigate={navigate} />
            <DeliveryEffectiveness rows={model.overview.efectividadBarrios} navigate={navigate} />
            <TeamToday equipo={model.overview.equipo} navigate={navigate} />
          </div>
          <section className="manager-tracking">
            <article className="dw-panel"><header className="dw-panel-head"><h2>Entregas de {monthLabel(data.month)}</h2></header><div className="manager-chart-scroll" tabIndex={0} role="region" aria-label="Seguimiento diario de entregas; desplazamiento horizontal"><div style={{ minWidth: Math.max(560, data.deliveries.por_dia.length * 44) }}><GraficoPorDia rows={data.deliveries.por_dia} /></div></div></article>
            <article className="dw-panel"><header className="dw-panel-head"><h2>Carga actual por técnico</h2></header><ul className="manager-workload">{data.inspections.carga_tecnicos.map((item) => { const max = Math.max(1, ...data.inspections.carga_tecnicos.map((row) => Number(row.activas) || 0)); return <li key={item.tecnico_id}><span className="manager-workload-name">{item.nombre || "Sin nombre"}</span><span className="manager-workload-bar" aria-hidden="true"><span style={{ width: `${Math.max(2, (Number(item.activas) || 0) / max * 100)}%` }} /></span><strong aria-label={`${formatNumber(item.activas)} inspecciones activas`}>{formatNumber(item.activas)}</strong></li>; })}</ul>{!data.inspections.carga_tecnicos.length ? <p className="dw-empty">No hay inspecciones activas asignadas.</p> : null}<p className="manager-scope">Incluye inspecciones pendientes de todos los períodos.</p></article>
          </section>
          <BarrioSummary rows={model.overview.barrios} />
        </div> : <DashboardWorkspace model={{ ...model.data, metrics: [], quickActions: [], hideSync: true, aside: <ManagerLivePanel apiFetch={apiFetch} navigate={navigate} />, refresh: state.refresh, refreshing: state.loading, manualRefreshing: state.loading, connectionStatus: state.error ? "retrying" : "synced", syncLabel: state.error ? "No se pudo actualizar" : state.loading ? "Actualizando…" : `Consultado ${updated || ""}`, fetchServiceAccounts: async (field, limit) => { const response = await apiFetch(`/claves/services/accounts?field=${encodeURIComponent(field)}&limit=${encodeURIComponent(limit)}`); const body = await response.json(); if (!response.ok) throw new Error(body.message); return body; } }} />}
      </div>
    </> : null}
  </section>;
}
