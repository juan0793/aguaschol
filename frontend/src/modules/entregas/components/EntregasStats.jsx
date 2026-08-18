import { formatNumber, formatPercent } from "../utils/entregasFormatters";

// Cuatro KPI principales + efectividad, segun la especificacion del modulo.
export default function EntregasStats({ resumen, onSelect }) {
  const tarjetas = [
    { key: "asignadas", label: "Asignadas", value: resumen?.asignadas },
    { key: "entregadas", label: "Entregadas", value: resumen?.entregadas },
    { key: "pendientes", label: "Pendientes", value: resumen?.pendientes, tono: "is-atencion" },
    { key: "reentregadas", label: "Reentregadas", value: resumen?.reentregadas, tono: "is-exito" }
  ];

  return (
    <div className="ent-kpis">
      {tarjetas.map((tarjeta) => (
        <button
          key={tarjeta.key}
          type="button"
          className={`ent-kpi ${tarjeta.tono || ""}`}
          onClick={() => onSelect?.(tarjeta.key)}
        >
          <span>{tarjeta.label}</span>
          <strong>{resumen ? formatNumber(tarjeta.value) : "—"}</strong>
        </button>
      ))}
      <div className="ent-kpi ent-kpi-efectividad">
        <span>Efectividad</span>
        <strong>{resumen ? formatPercent(resumen.efectividad) : "—"}</strong>
        <i>
          <em style={{ width: `${Math.min(Number(resumen?.efectividad) || 0, 100)}%` }} />
        </i>
      </div>
    </div>
  );
}
