import { useMemo, useState } from "react";
import { filterReportPoints, paginate } from "../utils/reportSelectors";

export default function ReportRecordsTab({ points, debtKeys, onEditPoint, onOpenMap }) {
  const [filters, setFilters] = useState({ query: "", barrio: "", type: "", status: "", debt: "" });
  const [page, setPage] = useState(1);
  const barrios = [...new Set(points.map((point) => point.report_zone))].sort();
  const types = [...new Set(points.map((point) => point.point_type).filter(Boolean))].sort();
  const filtered = useMemo(() => filterReportPoints(points, filters, debtKeys), [points, filters, debtKeys]);
  const result = paginate(filtered, Math.min(page, Math.max(1, Math.ceil(filtered.length / 10))));
  const change = (event) => { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })); setPage(1); };
  return <section className="reports-tab-panel" role="tabpanel">
    <div className="report-filters reports-solid-panel"><input name="query" type="search" value={filters.query} onChange={change} placeholder="Buscar clave, barrio o referencia..." aria-label="Buscar registros" />
      <select name="barrio" value={filters.barrio} onChange={change} aria-label="Filtrar por barrio"><option value="">Todos los barrios</option>{barrios.map((item) => <option key={item}>{item}</option>)}</select>
      <select name="type" value={filters.type} onChange={change} aria-label="Filtrar por tipo"><option value="">Todos los tipos</option>{types.map((item) => <option key={item}>{item}</option>)}</select>
      <select name="status" value={filters.status} onChange={change} aria-label="Filtrar por estado"><option value="">Todos los estados</option><option value="ready">Listo</option><option value="pending">Pendiente</option></select>
      <select name="debt" value={filters.debt} onChange={change} aria-label="Filtrar por mora"><option value="">Toda la mora</option><option value="with">Con mora</option><option value="without">Sin mora</option></select></div>
    <div className="report-table-shell reports-solid-panel"><table><thead><tr><th>N.º</th><th>Clave / referencia</th><th>Barrio</th><th>Tipo</th><th>Coordenadas</th><th>Mora</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {result.items.map((point, index) => { const key = String(point.report_key || point.reference || ""); const ready = Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)); return <tr key={point.id}><td>{(result.page - 1) * 10 + index + 1}</td><td>{key || "--"}</td><td>{point.report_zone}</td><td>{point.point_type || "--"}</td><td><button type="button" className="report-link" onClick={() => onOpenMap(point)}>Ver mapa</button></td><td><span className={`report-status-badge ${debtKeys.has(key) ? "is-danger" : "is-neutral"}`}>{debtKeys.has(key) ? "Con mora" : "--"}</span></td><td><span className={`report-status-badge ${ready ? "is-success" : "is-warning"}`}>{ready ? "Listo" : "Pendiente"}</span></td><td><button type="button" className="report-link" onClick={() => onEditPoint(point.id)}>Ver detalle</button></td></tr>; })}
      {!result.items.length ? <tr><td colSpan="8"><div className="report-empty"><strong>Sin registros</strong><span>Ajusta los filtros o selecciona otra jornada.</span></div></td></tr> : null}</tbody></table></div>
    <footer className="report-pagination"><span>{result.total} registros · Página {result.page} de {result.totalPages}</span><div><button type="button" className="button-secondary" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={result.page === 1}>Anterior</button><button type="button" className="button-secondary" onClick={() => setPage((value) => Math.min(result.totalPages, value + 1))} disabled={result.page === result.totalPages}>Siguiente</button></div></footer>
  </section>;
}
