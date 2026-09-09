import { useState } from "react";
import { Icon } from "../../../components/Icon";
import { estadoClass, estadoLoteLabel, formatDate, formatNumber, formatPercent, tipoDocumentoLabel } from "../utils/entregasFormatters";
import { toLocalIsoDate } from "../utils/entregasDate";

export default function LotesTable({ model, config, personal, permissions, onToday, onOpen, onCerrar }) {
  const { items, loading, error, filters, setFilters, clearFilters, page, setPage, total, total_pages: totalPages, resumen } = model;
  const [advanced, setAdvanced] = useState(false);
  const hoy = config.jornada?.fecha || toLocalIsoDate();
  const extraCount = [filters.tipo_documento, filters.barrio_codigo, filters.responsable_id].filter(Boolean).length + (filters.fecha_desde !== hoy || filters.fecha_hasta !== hoy ? 1 : 0);
  const metrics = [["Lotes", total], ["Responsables", resumen?.responsables], ["Asignadas", resumen?.asignadas], ["Por cerrar", resumen?.abiertos], ["Efectividad", resumen ? formatPercent(resumen.efectividad) : "—"]];
  return (
    <section className="cl-inbox ent-operational-inbox" aria-busy={loading}>
      <div className="cl-inbox-head">
        <div><span className="cl-kicker">Operación diaria</span><h3>Lotes diarios</h3><p>Registra el resultado y cierra cada lote al terminar el recorrido.</p></div>
        <button type="button" className="cl-secondary" onClick={onToday}><Icon name="calendar" />Hoy</button>
      </div>
      <dl className="ent-metrics" aria-label="Totales de todos los resultados filtrados">
        {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{loading ? "…" : typeof value === "string" ? value : value == null ? "—" : formatNumber(value)}</dd></div>)}
      </dl>
      <div className="ent-sticky-tools">
        <div className="ent-search-row">
          <label className="cl-field ent-search-field">Buscar lote<input type="search" value={filters.q} onChange={(event) => setFilters({ q: event.target.value })} placeholder="Responsable o barrio" /></label>
          <label className="cl-field">Estado<select value={filters.estado} onChange={(event) => setFilters({ estado: event.target.value })}><option value="">Todos los estados</option>{config.estados_lote.map((estado) => <option key={estado} value={estado}>{estadoLoteLabel(estado)}</option>)}</select></label>
          <button type="button" className="cl-secondary" aria-expanded={advanced} aria-controls="ent-lotes-filtros" onClick={() => setAdvanced(!advanced)}><Icon name="filter" />Filtros{extraCount ? ` (${extraCount})` : ""}</button>
          {extraCount || filters.q || filters.estado ? <button type="button" className="cl-quiet" onClick={clearFilters}>Limpiar</button> : null}
        </div>
        {advanced ? <div className="ent-advanced" id="ent-lotes-filtros">
          <label className="cl-field">Desde<input type="date" value={filters.fecha_desde} onChange={(event) => setFilters({ fecha_desde: event.target.value })} /></label>
          <label className="cl-field">Hasta<input type="date" value={filters.fecha_hasta} onChange={(event) => setFilters({ fecha_hasta: event.target.value })} /></label>
          <label className="cl-field">Responsable<select value={filters.responsable_id} onChange={(event) => setFilters({ responsable_id: event.target.value })}><option value="">Todos</option>{personal.map((item) => <option key={item.id} value={item.id}>{item.nombre_completo}</option>)}</select></label>
          <label className="cl-field">Barrio<select value={filters.barrio_codigo} onChange={(event) => setFilters({ barrio_codigo: event.target.value })}><option value="">Todos</option>{config.barrios.map((item) => <option key={item.codigo} value={item.codigo}>{item.barrio}</option>)}</select></label>
          <label className="cl-field">Documento<select value={filters.tipo_documento} onChange={(event) => setFilters({ tipo_documento: event.target.value })}><option value="">Todos</option>{config.tipos_documento.map((tipo) => <option key={tipo} value={tipo}>{tipoDocumentoLabel(tipo)}</option>)}</select></label>
        </div> : null}
        <div className="ent-list-caption" role="status"><span>{loading ? "Actualizando…" : `${formatNumber(total)} lotes · ${filters.fecha_desde ? formatDate(filters.fecha_desde) : "Inicio"} — ${filters.fecha_hasta ? formatDate(filters.fecha_hasta) : "Todas las fechas"}`}</span><small>Entregas confirmadas al cerrar</small></div>
      </div>
      {error ? <p className="cl-alert" role="alert">{error} <button type="button" onClick={model.reload}>Reintentar</button></p> : null}
      <table className="cl-table ent-operational-table">
        <thead><tr><th>Lote / responsable</th><th>Recorrido</th><th>Resultado</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{items.map((lote) => {
          const abierto = lote.estado === "ABIERTO";
          const atrasado = abierto && lote.fecha < hoy;
          return <tr key={lote.id} className={atrasado ? "is-overdue" : ""} onClick={() => onOpen(lote)}>
            <td data-label="Lote"><button className="ent-row-link" type="button" onClick={(event) => { event.stopPropagation(); onOpen(lote); }}><strong>{lote.responsable_nombre || "Sin responsable"}</strong><small>#{lote.id} · {formatDate(lote.fecha)}</small></button></td>
            <td data-label="Recorrido"><strong>{lote.barrio_nombre}</strong><small>{tipoDocumentoLabel(lote.tipo_documento)}</small></td>
            <td data-label="Resultado" className="ent-progress-cell"><div className="ent-progress-label"><strong>{abierto ? `${formatNumber(lote.total_asignadas)} asignadas` : `${formatNumber(lote.total_entregadas)} / ${formatNumber(lote.total_asignadas)}`}</strong><span>{abierto ? "Por confirmar" : formatPercent(lote.efectividad)}</span></div>{abierto ? <div className="ent-progress-track is-unconfirmed" /> : <progress max="100" value={lote.efectividad} aria-label={`Efectividad del lote ${lote.id}`} />}<small>{abierto ? `${formatNumber(lote.total_detalle)} no entregadas registradas` : `${formatNumber(lote.total_sobrantes)} no entregadas · ${formatNumber(lote.pendientes)} pendientes`}</small></td>
            <td data-label="Estado"><span className={`cl-status ${atrasado ? "is-overdue" : estadoClass(lote.estado)}`}>{atrasado ? "Cierre atrasado" : estadoLoteLabel(lote.estado)}</span>{atrasado ? <small>Requiere cierre</small> : null}</td>
            <td className="ent-row-action">{abierto && permissions.can_close_own_lote ? <button className="cl-secondary" type="button" onClick={(event) => { event.stopPropagation(); onCerrar(lote); }}>Cerrar lote<Icon name="arrowRight" /></button> : <span aria-hidden="true">→</span>}</td>
          </tr>;
        })}</tbody>
      </table>
      {!items.length && !error ? <p className="cl-empty">{loading ? "Cargando lotes…" : "No hay lotes con estos filtros."}</p> : null}
      <div className="cl-pagination"><span>Página {page} de {totalPages}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" disabled={loading || page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
    </section>
  );
}
