import { Icon } from "../../../components/Icon";
import { trendDelta } from "../selectors/entregasSelectors";
import { formatNumber, formatPercent } from "../utils/entregasFormatters";

const flechaTendencia = (direction) => (direction === "up" ? "▲" : direction === "down" ? "▼" : "—");

// Cuatro KPI principales + efectividad, segun la especificacion del modulo.
// Cada uno muestra su tendencia frente al periodo anterior de igual longitud
// (resumen.comparativo, calculado en el backend) para que el numero no quede suelto.
export default function EntregasStats({ resumen, onSelect }) {
  const comparativo = resumen?.comparativo;
  const tarjetas = [
    { key: "asignadas", label: "Asignadas", value: resumen?.asignadas, previo: comparativo?.asignadas, icon: "archive" },
    { key: "entregadas", label: "Entregadas", value: resumen?.entregadas, previo: comparativo?.entregadas, icon: "success" },
    {
      key: "pendientes",
      label: "Pendientes",
      value: resumen?.pendientes,
      previo: comparativo?.pendientes,
      tono: "is-atencion",
      icon: "warning"
    },
    {
      key: "reentregadas",
      label: "Reentregadas",
      value: resumen?.reentregadas,
      previo: comparativo?.reentregadas,
      tono: "is-exito",
      icon: "refresh"
    }
  ];

  const tendenciaEfectividad =
    resumen && comparativo
      ? trendDelta(resumen.efectividad, comparativo.efectividad)
      : null;
  const puntosEfectividad =
    resumen && comparativo ? Math.round((resumen.efectividad - comparativo.efectividad) * 10) / 10 : 0;

  return (
    <div className="ent-kpis">
      {tarjetas.map((tarjeta) => {
        const tendencia = resumen && comparativo ? trendDelta(tarjeta.value, tarjeta.previo) : null;
        return (
          <button
            key={tarjeta.key}
            type="button"
            className={`ent-kpi ${tarjeta.tono || ""}`}
            onClick={() => onSelect?.(tarjeta.key)}
          >
            <span className="ent-kpi-label">
              <Icon name={tarjeta.icon} />
              {tarjeta.label}
            </span>
            <span className="ent-kpi-value-row">
              <strong>{resumen ? formatNumber(tarjeta.value) : "—"}</strong>
              {tendencia ? (
                <span className={`ent-kpi-trend is-${tendencia.direction}`}>
                  {flechaTendencia(tendencia.direction)} {tendencia.label}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      <div className="ent-kpi ent-kpi-efectividad">
        <span className="ent-kpi-label">
          <Icon name="activity" />
          Efectividad
        </span>
        <span className="ent-kpi-value-row">
          <strong>{resumen ? formatPercent(resumen.efectividad) : "—"}</strong>
          {tendenciaEfectividad ? (
            <span className={`ent-kpi-trend is-${tendenciaEfectividad.direction}`}>
              {flechaTendencia(tendenciaEfectividad.direction)} {Math.abs(puntosEfectividad)} pts
            </span>
          ) : null}
        </span>
        <i>
          <em style={{ width: `${Math.min(Number(resumen?.efectividad) || 0, 100)}%` }} />
        </i>
      </div>
    </div>
  );
}
