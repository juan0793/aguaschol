import { scaleSeries } from "../selectors/entregasSelectors";
import { toLocalIsoDate } from "../utils/entregasDate";
import { formatDayLabel, formatNumber, formatPercent } from "../utils/entregasFormatters";

// Gráficos sobrios en HTML/CSS: se imprimen bien en blanco y negro, no dependen
// de canvas ni de librerías externas y no llevan animación.

export function GraficoPorDia({ rows = [] }) {
  // El backend ya rellena con ceros cada dia del rango (incluye los que aun no
  // ocurren). La escala de las barras solo debe considerar dias que ya pasaron:
  // si no, un dia futuro en 0 no distorsiona el maximo, pero tampoco queremos
  // dibujarle una barra — se marca aparte como "sin datos aun".
  const hoy = toLocalIsoDate();
  const ocurridos = rows.filter((fila) => fila.fecha <= hoy);
  const escalaPorFecha = new Map(
    scaleSeries(ocurridos, ["entregadas", "no_entregadas"]).map((fila) => [fila.fecha, fila._escala])
  );

  return (
    <figure className="ent-chart">
      <figcaption>Entregadas vs no entregadas por día</figcaption>
      <div className="ent-chart-bars">
        {rows.map((fila) => {
          const esFuturo = fila.fecha > hoy;
          const esHoy = fila.fecha === hoy;
          const escala = escalaPorFecha.get(fila.fecha);
          return (
            <div key={fila.fecha} className={`ent-chart-col${esHoy ? " is-hoy" : ""}`}>
              {esFuturo ? (
                <div className="ent-chart-stack is-vacio" title="Todavía no ocurre" />
              ) : (
                <div className="ent-chart-stack">
                  <span
                    className="ent-bar is-entregadas"
                    style={{ height: `${escala?.entregadas || 0}%` }}
                    title={`Entregadas: ${formatNumber(fila.entregadas)}`}
                  />
                  <span
                    className="ent-bar is-no-entregadas"
                    style={{ height: `${escala?.no_entregadas || 0}%` }}
                    title={`No entregadas: ${formatNumber(fila.no_entregadas)}`}
                  />
                </div>
              )}
              <small>{formatDayLabel(fila.fecha)}</small>
              {esHoy ? <span className="ent-chart-hoy">Hoy · parcial</span> : null}
            </div>
          );
        })}
        {!rows.length ? <p className="ent-chart-empty">Sin movimientos en el período.</p> : null}
      </div>
      <ul className="ent-chart-legend">
        <li>
          <i className="is-entregadas" />
          Entregadas
        </li>
        <li>
          <i className="is-no-entregadas" />
          No entregadas
        </li>
        <li>
          <i className="is-vacio" />
          Sin datos aún
        </li>
      </ul>
    </figure>
  );
}

export function GraficoEfectividadResponsable({ rows = [] }) {
  const datos = rows.slice(0, 8);

  return (
    <figure className="ent-chart">
      <figcaption>Efectividad por responsable</figcaption>
      <ul className="ent-chart-rows">
        {datos.map((fila) => (
          <li key={fila.responsable_id || fila.responsable_nombre}>
            <span>{fila.responsable_nombre}</span>
            <i>
              <em style={{ width: `${Math.min(fila.efectividad, 100)}%` }} />
            </i>
            <strong>{formatPercent(fila.efectividad)}</strong>
          </li>
        ))}
        {!datos.length ? <li className="ent-chart-empty">Sin lotes en el período.</li> : null}
      </ul>
    </figure>
  );
}

export function GraficoMotivos({ rows = [] }) {
  const datos = rows.slice(0, 6);
  const maximo = Math.max(1, ...datos.map((fila) => fila.total));

  return (
    <figure className="ent-chart">
      <figcaption>Principales motivos de no entrega</figcaption>
      <ul className="ent-chart-rows">
        {datos.map((fila) => (
          <li key={fila.motivo}>
            <span>{fila.motivo_etiqueta}</span>
            <i>
              <em style={{ width: `${(fila.total / maximo) * 100}%` }} />
            </i>
            <strong>
              {formatNumber(fila.total)} · {formatPercent(fila.porcentaje)}
            </strong>
          </li>
        ))}
        {!datos.length ? <li className="ent-chart-empty">Sin documentos no entregados.</li> : null}
      </ul>
    </figure>
  );
}
