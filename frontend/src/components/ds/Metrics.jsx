import { Icon } from "../Icon";

// KPI compacto estilo Tremor: número grande, label pequeño, tendencia opcional.
// Fondo neutro compartido entre celdas (sin borde azul individual por KPI).
export function Metric({ label, value, icon, trend }) {
  return (
    <div className="ds-metric">
      <span className="ds-metric-label">{icon ? <Icon name={icon} /> : null}{label}</span>
      <strong className="ds-metric-value">{value}</strong>
      {trend ? (
        <span className={`ds-metric-trend ${trend.direction === "down" ? "is-down" : "is-up"}`}>
          {trend.direction === "down" ? "↓" : "↑"} {trend.label}
        </span>
      ) : null}
    </div>
  );
}

export default function MetricRow({ metrics = [], ...rest }) {
  return (
    <section className="ds-metric-row" {...rest}>
      {metrics.map((metric) => <Metric key={metric.label} {...metric} />)}
    </section>
  );
}
