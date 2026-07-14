import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { formatCurrency } from "../utils/formatting";
import { formatDateTime } from "../utils/datesAndBusiness";

const STATES = ["", "NUEVO", "MODIFICADO", "SIN_CAMBIOS", "CONFLICTO", "ERROR", "APLICADO", "DESCARTADO"];
const statusLabel = (value) => String(value || "").replaceAll("_", " ");
const FOX_ASCII = String.raw`
                    /\     /\
              _____/  \___/  \_____
       DBF > /      0       0      \ < SQL
            /            ^           \
           /        \  _____  /       \
          /__________\_______/_________\
                  /  /|     |\  \
            _____/  / | FOX | \  \_____
       0101_____/__/  | PRO |  \__\_____1010
                    __|_____|__
                   /___/   \___\
        SELECT  ·  VALIDATE  ·  SEND  ·  REVIEW
`;

export default function ImportacionWorkspace({ apiFetch, showAlert }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [filters, setFilters] = useState({ abonado: "", clave: "", nombre: "", colonia: "", estado: "" });
  const knownBatchIds = useRef(new Set());
  const pageCount = Math.max(1, Math.ceil(total / 50));

  const loadBatches = useCallback(async (announce = false) => {
    setLoading(true);
    try {
      const response = await apiFetch("/integracion/foxpro/lotes?limit=50");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible cargar los lotes.");
      const nextBatches = data.rows || [];
      const added = nextBatches.filter((item) => !knownBatchIds.current.has(item.id)).length;
      knownBatchIds.current = new Set(nextBatches.map((item) => item.id));
      if (announce) setSyncMessage(added ? `${added} paquete${added === 1 ? "" : "s"} nuevo${added === 1 ? "" : "s"} recibido${added === 1 ? "" : "s"}.` : "Todo esta al dia. No hay paquetes nuevos.");
      setBatches(nextBatches);
      setSelectedBatch((current) => current && nextBatches.find((item) => item.codigo_lote === current.codigo_lote) || nextBatches[0] || null);
    } catch (error) { showAlert(error.message); } finally { setLoading(false); }
  }, [apiFetch, showAlert]);

  const loadRecords = useCallback(async () => {
    if (!selectedBatch?.codigo_lote) { setRecords([]); return; }
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "50" });
      Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
      const response = await apiFetch(`/integracion/foxpro/lotes/${encodeURIComponent(selectedBatch.codigo_lote)}/registros?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible cargar el detalle.");
      setRecords(data.rows || []);
      setTotal(data.total || 0);
      setSelectedIds(new Set());
    } catch (error) { showAlert(error.message); } finally { setLoading(false); }
  }, [apiFetch, filters, page, selectedBatch?.codigo_lote, showAlert]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const selectedValid = useMemo(
    () => records.filter((row) => selectedIds.has(row.id) && ["NUEVO", "MODIFICADO"].includes(row.estado)).length,
    [records, selectedIds]
  );
  const changeFilter = (key, value) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const toggle = (id) => setSelectedIds((current) => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const runAction = async (path, body, success, confirmation) => {
    if (!selectedBatch) return;
    if (confirmation && !window.confirm(confirmation)) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/integracion/foxpro/lotes/${encodeURIComponent(selectedBatch.codigo_lote)}/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible completar la accion.");
      showAlert(success(data));
      await Promise.all([loadBatches(), loadRecords()]);
    } catch (error) { showAlert(error.message); } finally { setLoading(false); }
  };

  return (
    <main className="import-workspace no-print">
      <pre className="import-ascii-fox" aria-hidden="true">{FOX_ASCII}</pre>
      <section className="import-header">
        <div><p className="sheet-kicker">Integracion manual FoxPro</p><h2>Importacion</h2><p>Los datos permanecen temporales hasta que un administrador los revise y aplique.</p></div>
        <button type="button" className="button-secondary" onClick={() => loadBatches(true)} disabled={loading}><span className={loading ? "import-refresh-icon is-spinning" : "import-refresh-icon"}><Icon name="refresh" /></span>{loading ? "Consultando..." : "Buscar paquetes"}</button>
      </section>

      <section className={`import-sync-strip ${loading ? "is-loading" : selectedBatch ? "is-received" : "is-waiting"}`} role="status" aria-live="polite">
        <span className="import-sync-symbol" aria-hidden="true">{loading ? "" : selectedBatch ? "✓" : "</>"}</span>
        <div>
          <strong>{loading ? "Sincronizando con Control Aguas" : selectedBatch ? "Paquete recibido y listo para revision" : "Esperando un paquete desde FoxPro"}</strong>
          <span>{loading ? "Consultando lotes y preparando la informacion..." : selectedBatch ? `Lote ${selectedBatch.codigo_lote}` : "El envio ocurre solamente cuando se pulsa el boton en el lector del servidor."}</span>
        </div>
        {loading ? <span className="import-progress-line" aria-hidden="true" /> : null}
      </section>

      {syncMessage ? <button type="button" className="import-sync-message" onClick={() => setSyncMessage("")} aria-label="Cerrar aviso">{syncMessage}<span aria-hidden="true">×</span></button> : null}

      <section className="import-layout">
        <aside className="import-batches">
          <h3>Lotes recibidos</h3>
          {batches.map((lot) => (
            <button key={lot.id} type="button" className={selectedBatch?.id === lot.id ? "is-active" : ""} onClick={() => { setSelectedBatch(lot); setPage(1); }}>
              <strong>{lot.codigo_lote}</strong><span>{formatDateTime(lot.fecha_recepcion)}</span>
              <small className={`import-status is-${String(lot.estado).toLowerCase()}`}>{statusLabel(lot.estado)}</small>
            </button>
          ))}
          {!batches.length && !loading ? <p className="helper-text">Todavia no hay lotes enviados.</p> : null}
        </aside>

        <div className="import-detail">
          {selectedBatch ? (
            <>
              <div className="import-summary-grid">
                {[
                  ["Total", selectedBatch.total_registros], ["Nuevos", selectedBatch.registros_nuevos],
                  ["Modificados", selectedBatch.registros_modificados], ["Sin cambios", selectedBatch.registros_sin_cambios],
                  ["Conflictos", selectedBatch.registros_conflicto], ["Errores", selectedBatch.registros_error],
                  ["Aplicados", selectedBatch.registros_aplicados], ["Descartados", selectedBatch.registros_descartados]
                ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString("es-HN")}</strong></div>)}
              </div>

              <div className="import-filters">
                {[["abonado", "Abonado"], ["clave", "Clave"], ["nombre", "Nombre"], ["colonia", "Colonia"]].map(([key, label]) => (
                  <label key={key}><span>{label}</span><input value={filters[key]} onChange={(event) => changeFilter(key, event.target.value)} /></label>
                ))}
                <label><span>Estado</span><select value={filters.estado} onChange={(event) => changeFilter("estado", event.target.value)}>{STATES.map((state) => <option key={state} value={state}>{state ? statusLabel(state) : "Todos"}</option>)}</select></label>
              </div>

              <div className="import-actions">
                <button type="button" onClick={() => runAction("aplicar", { ids: [...selectedIds] }, (data) => `${data.applied} registros aplicados.`, "¿Aplicar los registros seleccionados al padron activo?")} disabled={loading || !selectedValid}>Aplicar seleccionados</button>
                <button type="button" onClick={() => runAction("aplicar", { allValid: true }, (data) => `${data.applied} registros validos aplicados.`, "¿Aplicar todos los registros nuevos y modificados de este lote?")} disabled={loading}>Aplicar todos los validos</button>
                <button type="button" className="button-secondary" onClick={() => runAction("descartar", { ids: [...selectedIds] }, (data) => `${data.discarded} registros descartados.`, "¿Descartar los registros seleccionados?")} disabled={loading || !selectedIds.size}>Descartar seleccionados</button>
                <button type="button" className="button-secondary" onClick={() => changeFilter("estado", "ERROR")}>Ver errores</button>
              </div>

              <div className="import-table-wrap">
                <table className="import-table">
                  <thead><tr><th></th><th>Abonado / clave</th><th>Nombre / colonia</th><th>Servicios</th><th>Saldo</th><th>Estado</th><th></th></tr></thead>
                  <tbody>{records.map((row, index) => (
                    <Fragment key={row.id}>
                      <tr className="import-data-row" style={{ "--import-row-delay": `${Math.min(index, 12) * 35}ms` }}>
                        <td><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Seleccionar ${row.codigo_abonado}`} /></td>
                        <td><strong>{row.codigo_abonado || "--"}</strong><span>{row.clave_catastral || "--"}</span></td>
                        <td><strong>{row.nombre || "--"}</strong><span>{row.colonia || "--"}</span></td>
                        <td><span>A {row.agua_original || "-"} · AL {row.alcantarillado_original || "-"} · B {row.barrido_original || "-"} · T {row.tren_aseo_original || "-"} · BO {row.bombeo_original || "-"}</span></td>
                        <td><strong>{formatCurrency(row.saldo_total || 0)}</strong><span>{formatCurrency(row.valor || 0)} + {formatCurrency(row.intereses || 0)}</span></td>
                        <td><small className={`import-status is-${String(row.estado).toLowerCase()}`}>{statusLabel(row.estado)}</small>{row.mensaje_error ? <span>{row.mensaje_error}</span> : null}</td>
                        <td><button type="button" className="button-secondary" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>{expandedId === row.id ? "Cerrar" : "Diferencias"}</button></td>
                      </tr>
                      {expandedId === row.id ? <tr key={`${row.id}-detail`} className="import-difference-row"><td colSpan="7">
                        {row.diferencias ? Object.entries(row.diferencias).map(([field, values]) => <div key={field}><strong>{field}</strong><span>Actual: {String(values.actual ?? "--")}</span><span>Recibido: {String(values.recibido ?? "--")}</span></div>) : <p>Este registro no tiene diferencias estructuradas.</p>}
                      </td></tr> : null}
                    </Fragment>
                  ))}</tbody>
                </table>
              </div>
              <div className="import-pagination"><button type="button" className="button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Pagina {page} de {pageCount} · {total.toLocaleString("es-HN")} registros</span><button type="button" className="button-secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
            </>
          ) : <div className="empty-state"><h3>Sin lote seleccionado</h3><p>Ejecuta el lector en el servidor FoxPro y refresca esta pantalla.</p></div>}
        </div>
      </section>
    </main>
  );
}
