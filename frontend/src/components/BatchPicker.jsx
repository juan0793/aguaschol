import { useMemo, useState } from "react";
import { formatDateTime } from "../utils/datesAndBusiness";
import { filterAndSortBatches } from "../utils/batchList";

const statusLabel = (value) => String(value || "").replaceAll("_", " ");

export default function BatchPicker({ batches = [], selectedCode = "", onSelect, title = "Lotes recibidos", loading = false }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [order, setOrder] = useState("newest");
  const statuses = useMemo(() => [...new Set(batches.map((item) => item.estado).filter(Boolean))].sort(), [batches]);
  const visible = useMemo(() => filterAndSortBatches(batches, { query, status, order }), [batches, order, query, status]);

  return <div className="batch-picker">
    <header><div><h3>{title}</h3><span>{visible.length} de {batches.length}</span></div><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lote..." aria-label="Buscar lote" /></header>
    <div className="batch-picker-filters"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar lotes por estado"><option value="">Todos los estados</option>{statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select><select value={order} onChange={(event) => setOrder(event.target.value)} aria-label="Ordenar lotes"><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option><option value="code">Código A–Z</option></select></div>
    <div className="batch-picker-list" role="listbox" aria-label={title}>{visible.map((lot, index) => <button key={lot.id ?? lot.codigo_lote} type="button" role="option" aria-selected={selectedCode === lot.codigo_lote} className={`batch-picker-item ${selectedCode === lot.codigo_lote ? "is-active" : ""}`} onClick={() => onSelect(lot)}><span className="batch-picker-sequence">#{String(index + 1).padStart(2, "0")}</span><time>{formatDateTime(lot.fecha_recepcion || lot.fecha_extraccion)}</time><strong title={lot.codigo_lote}>{lot.codigo_lote}</strong><div><small className={`import-status is-${String(lot.estado).toLowerCase()}`}>{statusLabel(lot.estado)}</small><b>{Number(lot.total_registros || 0).toLocaleString("es-HN")} registros</b></div><footer><span>+ {Number(lot.registros_nuevos || 0).toLocaleString("es-HN")} nuevos</span><span>↻ {Number(lot.registros_modificados || 0).toLocaleString("es-HN")} modificados</span>{Number(lot.registros_error || 0) ? <span className="has-errors">! {Number(lot.registros_error).toLocaleString("es-HN")} errores</span> : null}</footer></button>)}</div>
    {!visible.length && !loading ? <p className="batch-picker-empty">No hay lotes que coincidan con los filtros.</p> : null}
  </div>;
}
