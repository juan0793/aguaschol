import { useState } from "react";
import { Icon } from "../../../components/Icon";
import { estadoClass, estadoDocumentoLabel, formatDate, formatNumber, prioridadPendiente, tipoDocumentoLabel } from "../utils/entregasFormatters";
import { NO_ENTREGADAS_FILTROS_INICIALES } from "../hooks/useNoEntregadas";

export default function NoEntregadasTable({ model, config, personal, onOpen }) {
  const { items, loading, error, filters, setFilters, clearFilters, page, setPage, total, total_pages: totalPages } = model;
  const [advanced, setAdvanced] = useState(false);
  const count = Object.entries(filters).filter(([key, value]) => !["estado", "q"].includes(key) && value).length;
  const quick = (patch) => setFilters({ ...NO_ENTREGADAS_FILTROS_INICIALES, ...patch });
  const selects = [
    ["barrio_codigo", "Barrio", config.barrios.map((item) => [item.codigo, item.barrio])],
    ["responsable_id", "Responsable", personal.map((item) => [item.id, item.nombre_completo])],
    ["tipo_documento", "Documento", config.tipos_documento.map((item) => [item, tipoDocumentoLabel(item)])],
    ["motivo", "Motivo", config.motivos.map((item) => [item.codigo, item.etiqueta])]
  ];
  return <section className="cl-inbox ent-operational-inbox" aria-busy={loading}>
    <div className="cl-inbox-head"><div><span className="cl-kicker">Bandeja operativa</span><h3>No entregadas</h3><p>Atiende primero los documentos más antiguos. Abre una fila para registrar el siguiente intento.</p></div></div>
    <div className="ent-sticky-tools">
      <div className="ent-search-row">
        <label className="cl-field ent-search-field">Buscar documento<input type="search" value={filters.q || ""} onChange={(event) => setFilters({ q: event.target.value })} placeholder="Abonado, nombre o clave catastral" /></label>
        <label className="cl-field">Estado<select value={filters.estado} onChange={(event) => setFilters({ estado: event.target.value })}><option value="">Todos los estados</option>{config.estados_no_entregada.map((estado) => <option key={estado} value={estado}>{estadoDocumentoLabel(estado)}</option>)}</select></label>
        <button type="button" className="cl-secondary" aria-expanded={advanced} aria-controls="ent-documentos-filtros" onClick={() => setAdvanced(!advanced)}><Icon name="filter" />Filtros{count ? ` (${count})` : ""}</button>
        {count || filters.q || filters.estado !== "PENDIENTE" ? <button type="button" className="cl-quiet" onClick={clearFilters}>Limpiar</button> : null}
      </div>
      {advanced ? <div className="ent-advanced" id="ent-documentos-filtros">
        {selects.map(([key, label, options]) => <label key={key} className="cl-field">{label}<select value={filters[key]} onChange={(event) => setFilters({ [key]: event.target.value })}><option value="">Todos</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
        <label className="cl-field">Abonado exacto/parcial<input value={filters.numero_abonado} onChange={(event) => setFilters({ numero_abonado: event.target.value })} /></label>
        <label className="cl-field">Clave catastral<input value={filters.clave_catastral} onChange={(event) => setFilters({ clave_catastral: event.target.value })} /></label>
        <label className="cl-field">Desde<input type="date" value={filters.fecha_desde} onChange={(event) => setFilters({ fecha_desde: event.target.value })} /></label>
        <label className="cl-field">Hasta<input type="date" value={filters.fecha_hasta} onChange={(event) => setFilters({ fecha_hasta: event.target.value })} /></label>
        <label className="cl-field">Más de (días)<input type="number" min="0" step="1" value={filters.dias_minimos} onChange={(event) => setFilters({ dias_minimos: event.target.value })} /></label>
      </div> : null}
      <div className="ent-quick-filters" aria-label="Prioridad de seguimiento">
        {[ ["Pendientes", {}], ["Más de 3 días", { dias_minimos: "3" }], ["Críticos · +7 días", { dias_minimos: "7" }], ["Sin intentos", { sin_intentos: "1" }] ].map(([label, patch]) => <button key={label} type="button" aria-pressed={filters.estado === "PENDIENTE" && (filters.dias_minimos || "") === (patch.dias_minimos || "") && (filters.sin_intentos || "") === (patch.sin_intentos || "")} onClick={() => quick(patch)}>{label}</button>)}
      </div>
      <p className="ent-list-caption" role="status">{loading ? "Actualizando…" : `${formatNumber(total)} documentos · más antiguos primero`}</p>
    </div>
    {error ? <p className="cl-alert" role="alert">{error} <button type="button" onClick={model.reload}>Reintentar</button></p> : null}
    <table className="cl-table ent-operational-table ent-documents-table"><thead><tr><th>Abonado / clave</th><th>Recorrido</th><th>Motivo</th><th>Seguimiento</th><th>Estado</th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id} className={item.estado === "PENDIENTE" ? prioridadPendiente(item.dias_pendiente, item.intentos) : ""} onClick={() => onOpen(item)}>
        <td data-label="Abonado"><button type="button" className="ent-row-link" onClick={(event) => { event.stopPropagation(); onOpen(item); }}><strong>{item.numero_abonado || item.clave_catastral}</strong><span>{item.abonado_nombre || "Sin nombre registrado"}</span><small>{item.clave_catastral || "Sin clave"}</small></button></td>
        <td data-label="Recorrido"><strong>{item.barrio_nombre}</strong><small>{item.responsable_nombre}</small><small>{tipoDocumentoLabel(item.tipo_documento)} · Lote #{item.lote_id}</small></td>
        <td data-label="Motivo">{config.motivos.find((motivo) => motivo.codigo === item.motivo)?.etiqueta || item.motivo}</td>
        <td data-label="Seguimiento"><strong>{formatNumber(item.dias_pendiente)} días</strong><small>{item.intentos} intentos · {item.fecha_ultimo_intento ? `Último ${formatDate(item.fecha_ultimo_intento)}` : "Sin intento"}</small><small>Desde {formatDate(item.fecha_lote)}</small></td>
        <td data-label="Estado"><span className={`cl-status ${estadoClass(item.estado)}`}>{estadoDocumentoLabel(item.estado)}</span></td>
      </tr>)}
    </tbody></table>
    {!items.length && !error ? <p className="cl-empty">{loading ? "Cargando documentos…" : "No hay documentos con estos filtros."}</p> : null}
    <div className="cl-pagination"><span>Página {page} de {totalPages}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" disabled={loading || page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
  </section>;
}
