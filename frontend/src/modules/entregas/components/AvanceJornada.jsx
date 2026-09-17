import { Icon } from "../../../components/Icon";
import { avanceDeResumen, avancePorResponsable } from "../selectors/entregasSelectors";
import { formatDate, formatFullDate, formatNumber, formatPercent } from "../utils/entregasFormatters";

// Barra apilada: confirmado (cerrado), no entregado (cerrado) y lo que sigue en
// ruta (lote abierto, todavia sin confirmar). Los anchos ya vienen calculados.
function BarraAvance({ avance, etiqueta }) {
  const descripcion = avance.asignadas
    ? `${etiqueta}: ${formatNumber(avance.confirmadas)} confirmadas, ${formatNumber(avance.no_entregadas)} no entregadas y ${formatNumber(avance.en_ruta)} en ruta de ${formatNumber(avance.asignadas)} asignadas.`
    : `${etiqueta}: sin documentos asignados.`;
  return (
    <div className="ent-avance-track" role="img" aria-label={descripcion}>
      <span className="is-confirmadas" style={{ width: `${avance.tramos.confirmadas}%` }} />
      <span className="is-no-entregadas" style={{ width: `${avance.tramos.no_entregadas}%` }} />
      <span className="is-en-ruta" style={{ width: `${avance.tramos.en_ruta}%` }} />
    </div>
  );
}

export default function AvanceJornada({ model, fecha, onVerAnteriores }) {
  const { lotesHoy, resumenHoy, totalHoy, anterior, totalAnterior, desdeAnterior, loading, error, reload } = model;
  const hoy = avanceDeResumen(resumenHoy, totalHoy);
  const previo = avanceDeResumen(anterior, totalAnterior);
  const filas = avancePorResponsable(lotesHoy);
  const parciales = totalHoy > lotesHoy.length;

  return (
    <section className="ent-avance" aria-labelledby="ent-avance-titulo" aria-busy={loading}>
      <div className="cl-inbox-head">
        <div>
          <span className="cl-kicker">Avance de la jornada</span>
          <h3 id="ent-avance-titulo">{formatFullDate(fecha)}</h3>
          <p>Cómo va hoy cada técnico. De los días anteriores solo se muestra el acumulado, no el detalle por día.</p>
        </div>
        <button type="button" className="cl-quiet" onClick={reload} disabled={loading}>
          <Icon name="refresh" className={loading ? "ent-refresh-icon is-spinning" : "ent-refresh-icon"} />
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error ? <p className="cl-alert" role="alert">{error} <button type="button" onClick={reload}>Reintentar</button></p> : null}

      <div className="ent-avance-total">
        <div className="ent-avance-total-head">
          <strong>{formatNumber(hoy.confirmadas)} de {formatNumber(hoy.asignadas)} confirmadas</strong>
          <span>{formatPercent(hoy.avance)}</span>
        </div>
        <BarraAvance avance={hoy} etiqueta="Jornada de hoy" />
        <small>
          {`${formatNumber(hoy.cerrados)} de ${formatNumber(hoy.lotes)} lotes cerrados`}
          {hoy.en_ruta ? ` · ${formatNumber(hoy.en_ruta)} documentos aún en ruta` : ""}
          {hoy.no_entregadas ? ` · ${formatNumber(hoy.no_entregadas)} no entregadas` : ""}
        </small>
      </div>

      <ul className="ent-avance-lista">
        {filas.map((fila) => (
          <li key={fila.responsable_id ?? fila.responsable_nombre} className={fila.abiertos ? "is-en-ruta" : ""}>
            <div className="ent-avance-quien">
              <strong>{fila.responsable_nombre}</strong>
              <small>{`${formatNumber(fila.lotes)} ${fila.lotes === 1 ? "lote" : "lotes"}`}{fila.barrios.length ? ` · ${fila.barrios.join(", ")}` : ""}</small>
            </div>
            <BarraAvance avance={fila} etiqueta={fila.responsable_nombre} />
            <div className="ent-avance-cifra">
              <strong>{formatNumber(fila.confirmadas)} / {formatNumber(fila.asignadas)}</strong>
              <span>{fila.abiertos ? `${formatNumber(fila.abiertos)} por cerrar` : formatPercent(fila.avance)}</span>
            </div>
          </li>
        ))}
        {!filas.length ? <li className="ent-avance-vacio">{loading ? "Cargando la jornada…" : "Todavía no hay lotes repartidos hoy."}</li> : null}
      </ul>
      {parciales ? <p className="ent-avance-nota">Se muestran los {formatNumber(lotesHoy.length)} lotes más recientes de hoy; los totales de arriba incluyen los {formatNumber(totalHoy)}.</p> : null}

      <div className="ent-avance-anterior">
        <div className="ent-avance-quien">
          <strong>Acumulado anterior</strong>
          <small>{desdeAnterior ? `Desde ${formatDate(desdeAnterior)}` : "Todo lo anterior"} hasta ayer · {formatNumber(previo.lotes)} lotes sumados</small>
        </div>
        <BarraAvance avance={previo} etiqueta="Acumulado anterior" />
        <div className="ent-avance-cifra">
          <strong>{formatPercent(previo.avance)}</strong>
          <span>{previo.abiertos ? `${formatNumber(previo.abiertos)} sin cerrar` : "Todo cerrado"}</span>
        </div>
        {onVerAnteriores ? (
          <button type="button" className="cl-quiet ent-avance-ver" onClick={onVerAnteriores}>
            Ver anteriores
            <Icon name="arrowRight" />
          </button>
        ) : null}
      </div>

      <ul className="ent-avance-leyenda">
        <li><i className="is-confirmadas" />Confirmadas al cerrar</li>
        <li><i className="is-no-entregadas" />No entregadas</li>
        <li><i className="is-en-ruta" />En ruta (sin confirmar)</li>
      </ul>
    </section>
  );
}
