import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { getRecordDeadlineMeta } from "../../../utils/records";
import LiveNumber from "../../../components/micro/LiveNumber";
import { DonutChart, MeterLegend, StackedBars } from "./ClCharts";

// Etapas de la ficha en el orden del proceso.
const ETAPAS = [["draft", "Borradores"], ["pending", "Por visitar"], ["visit", "En visita"], ["confirmed", "Aviso pendiente"], ["regularization", "En seguimiento"], ["regularized", "Cerradas"], ["discarded", "Descartadas"]];
const ETAPAS_ACTIVAS = ["draft", "pending", "visit", "confirmed", "regularization"];
const DICTAMENES = [["clandestino", "Clandestino", "warning", "#c2414b"], ["probable", "Probable", "flag", "#d08a1f"], ["sin_determinar", "Sin determinar", "search", "#8fa3b8"]];
const REPORTES_POR_ATENDER = ["new", "review", "info_requested"];
const FICHA_COLOR = "#1769e0";
const TECNICO_COLOR = "#0f8a80";
// Cada minuto se revisa el backend en silencio mientras la pestaña está a la vista.
const REFRESCO_MS = 60000;

/**
 * Resumen del módulo: lo que hay en cada parte del proceso y lo que pide
 * atención. Todo es seleccionable y lleva a la pestaña con ese filtro puesto.
 */
export default function ResumenClandestinos({ api, onOpenFichas, onOpenBanco, onOpenReportes }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const firma = useRef("");
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [fichas, banco, reportes] = await Promise.all([
        api.fichas({ page: 1, limit: 500 }),
        api.banco({ estado: "pendiente", limit: 5 }),
        api.reports({})
      ]);
      const plazos = (fichas.items || []).map((item) => getRecordDeadlineMeta(item)?.statusKey);
      // Solo lo que el resumen muestra; si llega igual, no se toca nada (sin
      // re-render ni animaciones). Si cambió, solo se mueve lo que cambió.
      const siguiente = {
        counts: fichas.counts || {},
        banco: { counts: banco.counts || {}, sin_asignar: banco.sin_asignar || 0, asignaciones: banco.asignaciones || [] },
        reportes: reportes.reduce((acc, item) => ({ ...acc, [item.estado]: (acc[item.estado] || 0) + 1 }), {}),
        vencidas: plazos.filter((key) => key === "overdue").length,
        porVencer: plazos.filter((key) => ["warning", "due"].includes(key)).length
      };
      const nueva = JSON.stringify(siguiente);
      if (nueva !== firma.current) {
        firma.current = nueva;
        setData({ ...siguiente, actualizado: new Date() });
      }
    } catch (reason) { if (!silent) setError(reason.message); } finally { if (!silent) setLoading(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const revisar = () => { if (document.visibilityState === "visible") load({ silent: true }); };
    const timer = setInterval(revisar, REFRESCO_MS);
    document.addEventListener("visibilitychange", revisar);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", revisar); };
  }, [load]);

  if (!data) return <section className="cl-resumen" aria-busy="true">{error ? <p className="cl-alert">{error}</p> : <div className="cl-resumen-grid is-skeleton">{Array.from({ length: 5 }, (_, index) => <div key={index} className="cl-bcard is-skeleton" />)}</div>}</section>;

  const counts = data.counts || {};
  const activas = ETAPAS_ACTIVAS.reduce((sum, key) => sum + Number(counts[key] || 0), 0);
  // Lo que de verdad queda por revisar: los pendientes que no están en Aguas
  // (esos salen del banco con "Verificar").
  const bancoPendiente = DICTAMENES.reduce((sum, [key]) => sum + Number(data.banco.counts?.[key] || 0), 0);
  const enAguas = Number(data.banco.counts?.registrado || 0);
  const reportesPorAtender = REPORTES_POR_ATENDER.reduce((sum, key) => sum + Number(data.reportes[key] || 0), 0);
  const kpis = [
    { key: "activas", icon: "records", label: "Expedientes activos", value: activas, hint: `${counts.regularized || 0} cerrados`, onClick: () => onOpenFichas("") },
    { key: "aviso", icon: "mail", label: "Con aviso pendiente", value: counts.confirmed || 0, hint: "Confirmados sin aviso entregado", onClick: () => onOpenFichas("confirmed") },
    { key: "plazo", icon: "warning", label: "Plazo crítico", value: data.vencidas + data.porVencer, hint: data.vencidas ? `${data.vencidas} vencidas` : "Ninguna vencida", tone: data.vencidas ? "is-danger" : data.porVencer ? "is-warning" : "", atencion: data.vencidas + data.porVencer > 0, onClick: () => onOpenFichas("", { alertas: true }) },
    { key: "banco", icon: "inbox", label: "Banco por revisar", value: bancoPendiente, hint: enAguas ? `${enAguas} ya están en Aguas: usa Verificar` : `${data.banco.sin_asignar || 0} sin asignar a técnico`, tone: enAguas ? "is-warning" : "", onClick: () => onOpenBanco({}) },
    { key: "reportes", icon: "activity", label: "Reportes por atender", value: reportesPorAtender, hint: data.reportes.info_requested ? `${data.reportes.info_requested} esperan información` : `${data.reportes.review || 0} en revisión`, onClick: () => onOpenReportes(data.reportes.review ? "review" : "") }
  ];

  return <section className="cl-resumen" aria-label="Resumen del módulo">
    <header className="cl-resumen-head">
      <p>Toca cualquier número o barra para abrir esa lista ya filtrada.</p>
      <button type="button" className="cl-quiet" disabled={loading} onClick={() => load()}><Icon name="refresh" />{loading ? "Actualizando…" : `Actualizado ${data.actualizado.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}`}</button>
    </header>
    <div className="cl-resumen-kpis">
      {kpis.map((kpi) => <button type="button" key={kpi.key} className={`cl-resumen-kpi ${kpi.tone || ""}`.trim()} onClick={kpi.onClick}>
        {/* Solo lo que pide atención late, tres veces al aparecer o al cambiar la cifra. */}
        <span className="cl-resumen-kpi-icon"><span key={kpi.atencion ? kpi.value : "quieto"} className={kpi.atencion ? "live-attention" : undefined}><Icon name={kpi.icon} /></span></span>
        <span className="cl-resumen-kpi-label">{kpi.label}</span>
        <LiveNumber as="strong" value={kpi.value} flash=".cl-resumen-kpi" />
        <small>{kpi.hint}</small>
      </button>)}
    </div>
    <div className="cl-resumen-grid">
      <div className="cl-banco-chart">
        <header><h3>Fichas por etapa</h3><p>Del borrador al cierre</p></header>
        <StackedBars label="Fichas por etapa" onSelect={(key) => key && onOpenFichas(key)} emptyText="Sin fichas" rows={ETAPAS.map(([key, label]) => ({ key, label, total: Number(counts[key] || 0), parts: [{ key, label, value: Number(counts[key] || 0), color: FICHA_COLOR }] }))} />
      </div>
      <div className="cl-banco-chart">
        <header><h3>Banco por revisar</h3><p>Dictamen de los pendientes</p></header>
        <div className="cl-banco-donut-row">
          <DonutChart size={124} label="Pendientes del banco por dictamen" centerCaption="por revisar" onSelect={(key) => key && onOpenBanco({ dictamen: key })} segments={DICTAMENES.map(([key, label, , color]) => ({ key, label, color, value: data.banco.counts?.[key] || 0 }))} />
          <MeterLegend onSelect={(key) => key && onOpenBanco({ dictamen: key })} renderIcon={(item) => <Icon name={item.icon} />} items={DICTAMENES.map(([key, label, icon, color]) => ({ key, label, icon, color, value: data.banco.counts?.[key] || 0 }))} />
        </div>
      </div>
      <div className="cl-banco-chart">
        <header><h3>Carga por técnico</h3><p>Candidatos asignados sin convertir en ficha</p></header>
        <StackedBars label="Carga por técnico" onSelect={(key) => key && onOpenBanco({ asignado: key })} emptyText="Nadie tiene candidatos asignados todavía. Asígnalos desde el Banco." rows={[
          ...(data.banco.sin_asignar ? [{ key: "none", label: "Sin asignar", total: data.banco.sin_asignar, parts: [{ key: "none", label: "Sin asignar", value: data.banco.sin_asignar, color: "#8fa3b8" }] }] : []),
          ...(data.banco.asignaciones || []).map((item) => ({ key: String(item.id), label: item.nombre, total: item.pendientes, parts: [{ key: "p", label: "Pendientes", value: item.pendientes, color: TECNICO_COLOR }] }))
        ]} />
      </div>
      <div className="cl-banco-chart">
        <header><h3>Reportes técnicos</h3><p>Hallazgos de campo por estado</p></header>
        <StackedBars label="Reportes por estado" onSelect={(key) => key && onOpenReportes(key)} emptyText="Aún no hay reportes de campo." rows={[["review", "En revisión"], ["info_requested", "Falta información"], ["approved", "Aprobados"], ["linked", "Vinculados"]].filter(([key]) => data.reportes[key]).map(([key, label]) => ({ key, label, total: data.reportes[key], parts: [{ key, label, value: data.reportes[key], color: REPORTES_POR_ATENDER.includes(key) ? "#d08a1f" : "#1f9463" }] }))} />
      </div>
    </div>
  </section>;
}
