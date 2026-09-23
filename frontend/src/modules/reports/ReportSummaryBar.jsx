import { Icon } from "../../components/Icon";
import LiveNumber from "../../components/micro/LiveNumber";

// Números de la jornada que sirven para decidir si ya se puede entregar el
// documento. Antes había "Listos/Pendientes", que solo contaba si el punto tenía
// coordenadas (todo punto GPS las tiene): siempre igual al total y 0.
export default function ReportSummaryBar({ total, zones, points = [] }) {
  const estado = (point) => point.validation_status || "pending";
  const validados = points.filter((point) => ["approved", "corrected"].includes(estado(point))).length;
  const porCorregir = points.filter((point) => estado(point) === "needs_correction").length;
  const sinRevisar = points.filter((point) => estado(point) === "pending").length;
  const pct = total ? Math.round((validados / total) * 100) : 0;
  const metrics = [
    { key: "puntos", icon: "map", label: "Puntos GPS", value: total, hint: "en esta jornada" },
    { key: "barrios", icon: "flag", label: "Barrios", value: zones, hint: zones === 1 ? "barrio recorrido" : "barrios recorridos" },
    { key: "validados", icon: "checkCircle", label: "Validados", value: validados, hint: `${pct}% de la jornada`, tone: total && validados === total ? "is-good" : "" },
    { key: "revisar", icon: "warning", label: "Por revisar", value: sinRevisar + porCorregir, hint: porCorregir ? `${porCorregir} por corregir` : sinRevisar ? "sin validar en Control territorial" : "nada pendiente", tone: porCorregir ? "is-bad" : sinRevisar ? "is-warn" : "is-good" }
  ];
  return (
    <section className="rp-metrics" aria-label="Métricas de la jornada">
      {metrics.map((metric) => (
        <div key={metric.key} className={`rp-metric ${metric.tone || ""}`.trim()}>
          <span className="rp-metric-icon"><Icon name={metric.icon} /></span>
          <span className="rp-metric-label">{metric.label}</span>
          <LiveNumber as="strong" value={metric.value} flash=".rp-metric" />
          <small>{metric.hint}</small>
        </div>
      ))}
    </section>
  );
}
