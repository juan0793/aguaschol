import { Icon } from "../../../components/Icon";
import {
  estadoClass,
  estadoDocumentoLabel,
  formatDate,
  formatNumber,
  prioridadPendiente,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";

export default function NoEntregadasTable({ model, config, personal, onOpen }) {
  const { items, loading, error, filters, setFilters, clearFilters, page, setPage, total, total_pages: totalPages } = model;

  return (
    <section className="cl-inbox">
      <div className="cl-inbox-head">
        <div>
          <span className="cl-kicker">Seguimiento</span>
          <h3>Documentos no entregados</h3>
          <p>{formatNumber(total)} documento(s) según los filtros aplicados.</p>
        </div>
        <button type="button" className="cl-quiet" onClick={clearFilters}>
          <Icon name="refresh" />
          Limpiar filtros
        </button>
      </div>

      <div className="cl-toolbar ent-toolbar">
        <label className="cl-search">
          Abonado
          <div>
            <Icon name="search" />
            <input
              value={filters.numero_abonado}
              onChange={(event) => setFilters({ numero_abonado: event.target.value })}
              placeholder="Número de abonado"
            />
          </div>
        </label>
        <label>
          Clave catastral
          <input
            value={filters.clave_catastral}
            onChange={(event) => setFilters({ clave_catastral: event.target.value })}
            placeholder="10-20-03-04"
          />
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
          Motivo
          <select value={filters.motivo} onChange={(event) => setFilters({ motivo: event.target.value })}>
            <option value="">Todos</option>
            {config.motivos.map((motivo) => (
              <option key={motivo.codigo} value={motivo.codigo}>
                {motivo.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={filters.estado} onChange={(event) => setFilters({ estado: event.target.value })}>
            <option value="">Todos</option>
            {config.estados_no_entregada.map((estado) => (
              <option key={estado} value={estado}>
                {estadoDocumentoLabel(estado)}
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
        <label>
          Días pendiente (mínimo)
          <input
            type="number"
            min="0"
            step="1"
            value={filters.dias_minimos}
            onChange={(event) => setFilters({ dias_minimos: event.target.value })}
            placeholder="Ej. 3"
          />
        </label>
      </div>

      {error ? <p className="cl-alert">{error}</p> : null}

      <div className="cl-table-wrap">
        <table className="cl-table ent-table ent-pendientes-table">
          <thead>
            <tr>
              <th>Abonado</th>
              <th>Clave catastral</th>
              <th>Barrio</th>
              <th>Responsable</th>
              <th>Documento</th>
              <th>Motivo</th>
              <th>Desde</th>
              <th className="is-num">Días</th>
              <th>Estado</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {loading && !items.length ? (
              <tr>
                <td colSpan={10} className="cl-empty">
                  Cargando documentos…
                </td>
              </tr>
            ) : null}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={10} className="cl-empty">
                  No hay documentos no entregados con esos filtros.
                </td>
              </tr>
            ) : null}
            {items.map((documento) => (
              <tr key={documento.id} className={prioridadPendiente(documento.dias_pendiente, documento.intentos)}>
                <td>
                  <button type="button" className="cl-link" onClick={() => onOpen(documento)}>
                    <strong>{documento.numero_abonado || "—"}</strong>
                    <span>{documento.abonado_nombre || `Lote #${documento.lote_id}`}</span>
                  </button>
                </td>
                <td>{documento.clave_catastral || "—"}</td>
                <td>{documento.barrio_nombre || "—"}</td>
                <td>{documento.responsable_nombre || "—"}</td>
                <td>{tipoDocumentoLabel(documento.tipo_documento)}</td>
                <td>{config.motivos.find((item) => item.codigo === documento.motivo)?.etiqueta || documento.motivo}</td>
                <td>{formatDate(documento.fecha_lote)}</td>
                <td className="is-num">
                  {formatNumber(documento.dias_pendiente)}
                  {documento.intentos > 1 ? <small>{documento.intentos} intentos</small> : null}
                </td>
                <td>
                  <span className={`cl-status ${estadoClass(documento.estado)}`}>
                    <i />
                    {estadoDocumentoLabel(documento.estado)}
                  </span>
                </td>
                <td>
                  <button type="button" className="cl-icon-button" onClick={() => onOpen(documento)} aria-label="Ver detalle">
                    <Icon name="history" />
                  </button>
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
