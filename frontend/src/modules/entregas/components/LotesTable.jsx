import { Icon } from "../../../components/Icon";
import {
  estadoClass,
  estadoLoteLabel,
  formatDate,
  formatNumber,
  formatPercent,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";

export default function LotesTable({ model, config, personal, permissions, onOpen, onCerrar }) {
  const { items, loading, error, filters, setFilters, clearFilters, page, setPage, total, total_pages: totalPages } = model;

  return (
    <section className="cl-inbox">
      <div className="cl-inbox-head">
        <div>
          <span className="cl-kicker">Operación diaria</span>
          <h3>Lotes registrados</h3>
          <p>{formatNumber(total)} lote(s) según los filtros aplicados.</p>
        </div>
        <button type="button" className="cl-quiet" onClick={clearFilters}>
          <Icon name="refresh" />
          Limpiar filtros
        </button>
      </div>

      <div className="cl-toolbar ent-toolbar">
        <label className="cl-search">
          Buscar
          <div>
            <Icon name="search" />
            <input
              value={filters.q}
              onChange={(event) => setFilters({ q: event.target.value })}
              placeholder="Responsable o barrio"
            />
          </div>
        </label>
        <label>
          Estado
          <select value={filters.estado} onChange={(event) => setFilters({ estado: event.target.value })}>
            <option value="">Todos</option>
            {config.estados_lote.map((estado) => (
              <option key={estado} value={estado}>
                {estadoLoteLabel(estado)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select value={filters.tipo_documento} onChange={(event) => setFilters({ tipo_documento: event.target.value })}>
            <option value="">Ambos</option>
            {config.tipos_documento.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipoDocumentoLabel(tipo)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Barrio
          <select value={filters.barrio_codigo} onChange={(event) => setFilters({ barrio_codigo: event.target.value })}>
            <option value="">Todos</option>
            {config.barrios.map((item) => (
              <option key={item.codigo} value={item.codigo}>
                {item.barrio}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsable
          <select value={filters.responsable_id} onChange={(event) => setFilters({ responsable_id: event.target.value })}>
            <option value="">Todos</option>
            {personal.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombre_completo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={filters.fecha_desde} onChange={(event) => setFilters({ fecha_desde: event.target.value })} />
        </label>
        <label>
          Hasta
          <input type="date" value={filters.fecha_hasta} onChange={(event) => setFilters({ fecha_hasta: event.target.value })} />
        </label>
      </div>

      {error ? <p className="cl-alert">{error}</p> : null}

      <div className="cl-table-wrap">
        <table className="cl-table ent-table ent-lotes-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Responsable</th>
              <th>Barrio</th>
              <th>Tipo</th>
              <th className="is-num">Asignadas</th>
              <th className="is-num">Entregadas</th>
              <th className="is-num">Sobrantes</th>
              <th>Estado</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {loading && !items.length ? (
              <tr>
                <td colSpan={9} className="cl-empty">
                  Cargando lotes…
                </td>
              </tr>
            ) : null}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={9} className="cl-empty">
                  No hay lotes para los filtros seleccionados.
                </td>
              </tr>
            ) : null}
            {items.map((lote) => (
              <tr key={lote.id}>
                <td>{formatDate(lote.fecha)}</td>
                <td>
                  <button type="button" className="cl-link" onClick={() => onOpen(lote)}>
                    <strong>{lote.responsable_nombre || "—"}</strong>
                    <span>Lote #{lote.id}</span>
                  </button>
                </td>
                <td>{lote.barrio_nombre || "—"}</td>
                <td>{tipoDocumentoLabel(lote.tipo_documento)}</td>
                <td className="is-num">{formatNumber(lote.total_asignadas)}</td>
                <td className="is-num">
                  {lote.estado === "ABIERTO" ? (
                    "—"
                  ) : (
                    <>
                      {formatNumber(lote.total_entregadas)}
                      <small>{formatPercent(lote.efectividad)}</small>
                    </>
                  )}
                </td>
                <td className="is-num">{formatNumber(lote.total_sobrantes)}</td>
                <td>
                  <span className={`cl-status ${estadoClass(lote.estado)}`}>
                    <i />
                    {estadoLoteLabel(lote.estado)}
                  </span>
                </td>
                <td className="ent-acciones-celda">
                  <button type="button" className="cl-icon-button" title="Ver lote" onClick={() => onOpen(lote)}>
                    <Icon name="search" />
                  </button>
                  {lote.estado === "ABIERTO" && permissions.can_close_own_lote ? (
                    <button type="button" className="cl-secondary ent-boton-mini" onClick={() => onCerrar(lote)}>
                      Cerrar lote
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cl-pagination">
        <span>
          Página {page} de {totalPages}
        </span>
        <div>
          <button type="button" onClick={() => setPage(Math.max(page - 1, 1))} disabled={page <= 1}>
            <Icon name="arrowLeft" />
            Anterior
          </button>
          <button type="button" onClick={() => setPage(Math.min(page + 1, totalPages))} disabled={page >= totalPages}>
            Siguiente
            <Icon name="arrowRight" />
          </button>
        </div>
      </div>
    </section>
  );
}
