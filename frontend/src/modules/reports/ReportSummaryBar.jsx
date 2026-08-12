import MetricRow from "../../components/ds/Metrics";

export default function ReportSummaryBar({ total, zones, ready, pending }) {
  return (
    <MetricRow
      aria-label="Métricas de la jornada"
      metrics={[
        { label: "Puntos", value: total },
        { label: "Barrios", value: zones },
        { label: "Listos", value: ready },
        { label: "Pendientes", value: pending }
      ]}
    />
  );
}
