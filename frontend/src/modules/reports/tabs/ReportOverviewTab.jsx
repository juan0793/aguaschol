export default function ReportOverviewTab({ data, settings, activeLabel, debt, onPreview }) {
  const types = Object.entries(data.totalsByType || {});
  return <section className="reports-tab-panel" role="tabpanel">
    <div className="reports-panel-head"><div><span>Resumen ejecutivo</span><h2>Jornada {activeLabel}</h2></div><button type="button" className="button-secondary" onClick={onPreview}>Ver vista previa</button></div>
    <div className="report-overview-grid">
      <article className="reports-solid-panel"><h3>Distribución por barrio</h3>{(data.zones || []).slice(0, 8).map((zone) => <div className="report-rank-row" key={zone.zone}><span>{zone.displayName || zone.zone}</span><strong>{zone.total} puntos</strong></div>)}</article>
      <article className="reports-solid-panel"><h3>Estado de registros</h3><dl><div><dt>Con coordenadas</dt><dd>{data.totalPoints}</dd></div><div><dt>Barrios detectados</dt><dd>{data.totalZones}</dd></div><div><dt>Referencias verificadas</dt><dd>{debt?.totalKeys ?? "Pendiente"}</dd></div><div><dt>Mora total</dt><dd>{debt?.totalDebtLabel || "Pendiente"}</dd></div></dl></article>
      <article className="reports-solid-panel"><h3>Tipos de punto</h3>{types.length ? types.map(([label, total]) => <div className="report-rank-row" key={label}><span>{label}</span><strong>{total}</strong></div>) : <p>Sin puntos en esta jornada.</p>}</article>
      <article className="reports-solid-panel"><h3>Observaciones generales</h3><p>{settings.report_notes || "Sin observaciones adicionales."}</p><small>Configuración guardada por jornada.</small></article>
    </div>
  </section>;
}
