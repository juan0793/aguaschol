import { Icon } from "../../../components/Icon";
import { ESTADO_LABELS, estadoClass, estadoLabel, formatDate, printStatusLabel } from "../utils/inspeccionesFormatters";

export default function InspeccionesTable({ model, tecnicos = [], isAdmin, onOpen }) {
  const { items, total, page, total_pages: totalPages, loading, error, filters, setFilters, clearFilters, setPage } = model;

  return (
    <section className="cl-inbox">
      <div className="cl-toolbar">
        <label>
          <span>Buscar</span>
          <input placeholder="Número, clave o abonado" value={filters.q} onChange={(event) => setFilters({ q: event.target.value })} />
        </label>
        <label>
          <span>Estado</span>
          <select value={filters.estado} onChange={(event) => setFilters({ estado: event.target.value })}>
            <option value="">Todos</option>
            {Object.entries(ESTADO_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        {isAdmin ? (
          <label>
            <span>Técnico</span>
            <select value={filters.tecnico_id} onChange={(event) => setFilters({ tecnico_id: event.target.value })}>
              <option value="">Todos</option>
              {tecnicos.map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>{tecnico.full_name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span>Barrio</span>
          <input placeholder="Barrio o colonia" value={filters.barrio} onChange={(event) => setFilters({ barrio: event.target.value })} />
        </label>
        <label>
          <span>Desde</span>
          <input type="date" value={filters.fecha_desde} onChange={(event) => setFilters({ fecha_desde: event.target.value })} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={filters.fecha_hasta} onChange={(event) => setFilters({ fecha_hasta: event.target.value })} />
        </label>
        <button type="button" className="cl-quiet" onClick={clearFilters}>
          <Icon name="refresh" />Limpiar
        </button>
      </div>

      {error ? <p className="cl-alert">{error}</p> : null}

      <div className="cl-table-wrap">
        <table className="cl-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Inspección</th>
              <th>Clave</th>
              <th>Abonado</th>
              <th>Barrio</th>
              <th>Técnico</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Impresión</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="cl-empty">Cargando inspecciones…</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={10} className="cl-empty">Sin inspecciones para los filtros actuales.</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className={item.estado === "SEGUIMIENTO" ? "is-critical" : ""}>
                  <td>{(page - 1) * model.limit + index + 1}</td>
                  <td>
                    <button type="button" className="cl-link" onClick={() => onOpen(item)}>
                      <strong>{item.numero_inspeccion}</strong>
                      <span>{item.motivo}</span>
                    </button>
                  </td>
                  <td>{item.clave_catastral}</td>
                  <td>{item.abonado_nombre_snapshot || "General"}</td>
                  <td>{item.barrio_snapshot || "—"}</td>
                  <td>{item.tecnico_responsable_nombre || "—"}</td>
                  <td>
                    <span className={`cl-status ${estadoClass(item.estado)}`}><i />{estadoLabel(item.estado)}</span>
                  </td>
                  <td>{formatDate(item.fecha_asignacion)}</td>
                  <td>
                    <div className="ins-print-badges">
                      <span className={`cl-print-state ${item.print_status?.ORDEN?.impreso ? "is-printed" : ""}`}>Orden: {printStatusLabel(item.print_status?.ORDEN)}</span>
                      <span className={`cl-print-state ${item.print_status?.REPORTE?.impreso ? "is-printed" : ""}`}>Reporte: {printStatusLabel(item.print_status?.REPORTE)}</span>
                    </div>
                  </td>
                  <td>
                    <button type="button" className="cl-icon-button" onClick={() => onOpen(item)} aria-label="Ver inspección">
                      <Icon name="search" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="cl-pagination">
        <span>Mostrando {items.length ? (page - 1) * model.limit + 1 : 0}-{(page - 1) * model.limit + items.length} de {total} inspecciones</span>
        <div>
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
        </div>
      </div>
    </section>
  );
}
