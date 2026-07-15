export default function ReportSummaryBar({ total, zones, ready, pending }) {
  return <section className="report-summary-bar reports-glass" aria-label="Métricas de la jornada">
    {[['Puntos', total], ['Barrios', zones], ['Listos', ready], ['Pendientes', pending]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
  </section>;
}
