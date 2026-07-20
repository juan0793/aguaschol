import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import BatchPicker from "./BatchPicker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { formatCurrency } from "../utils/formatting";
import { getBatchTransferProgress } from "../utils/batchList";

const STATES = ["", "NUEVO", "MODIFICADO", "SIN_CAMBIOS", "CONFLICTO", "ERROR", "APLICADO", "DESCARTADO"];
const statusLabel = (value) => String(value || "").replaceAll("_", " ");
const formatBytes = (value = 0) => `${(Number(value) / 1024 / 1024).toFixed(1)} MB`;
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
  const [activeRequest, setActiveRequest] = useState(null);
  const [r2Status, setR2Status] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [historicalKey, setHistoricalKey] = useState("");
  const [filters, setFilters] = useState({ abonado: "", clave: "", nombre: "", colonia: "", estado: "" });
  const knownBatchIds = useRef(new Set());
  const pageCount = Math.max(1, Math.ceil(total / 50));

  const loadBatches = useCallback(async (announce = false) => {
    setLoading(true);
    try {
      const response = await apiFetch("/integracion/foxpro/lotes?limit=500");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible cargar los lotes.");
      const nextBatches = data.rows || [];
      const added = nextBatches.filter((item) => !knownBatchIds.current.has(item.id)).length;
      knownBatchIds.current = new Set(nextBatches.map((item) => item.id));
      if (announce) setSyncMessage(added ? `${added} paquete${added === 1 ? "" : "s"} nuevo${added === 1 ? "" : "s"} recibido${added === 1 ? "" : "s"}.` : "Todo esta al dia. No hay paquetes nuevos.");
      setBatches(nextBatches);
      setSelectedBatch((current) => added ? nextBatches[0] || null : current && nextBatches.find((item) => item.codigo_lote === current.codigo_lote) || nextBatches[0] || null);
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

  const loadR2Status = useCallback(async () => {
    try {
      const [padronResponse, uploadsResponse] = await Promise.all([
        apiFetch("/integracion/foxpro/r2/padron"),
        apiFetch("/integracion/foxpro/r2/archivos")
      ]);
      const [padron, uploads] = await Promise.all([padronResponse.json(), uploadsResponse.json()]);
      if (!padronResponse.ok) throw new Error(padron.message || "No fue posible consultar R2.");
      if (!uploadsResponse.ok) throw new Error(uploads.message || "No fue posible consultar los archivos.");
      setR2Status(padron);
      setUploadStatus(uploads);
      setHistoricalKey((current) => current || padron.historical_versions?.[0]?.key || "");
    } catch (error) { showAlert(error.message); }
  }, [apiFetch, showAlert]);

  useEffect(() => { loadR2Status(); }, [loadR2Status]);

  const runR2Action = async (path, body, confirmation, success) => {
    if (confirmation) {
      const titles = {
        migrar: "Migrar padrón a Cloudflare R2",
        "archivos/migrar": "Migrar archivos privados",
        restaurar: "Restaurar versión del padrón"
      };
      setPendingConfirmation({
        title: titles[path] || "Confirmar operación",
        description: confirmation,
        confirmLabel: path === "restaurar" ? "Restaurar versión" : "Iniciar migración",
        action: () => runR2Action(path, body, "", success)
      });
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch(`/integracion/foxpro/r2/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible completar la operacion en R2.");
      showAlert(success(data));
      await Promise.all([loadR2Status(), loadBatches()]);
    } catch (error) { showAlert(error.message); } finally { setLoading(false); }
  };

  const refreshRequest = useCallback(async (id) => {
    try {
      const response = await apiFetch(`/integracion/foxpro/solicitudes/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible consultar la solicitud.");
      setActiveRequest(data.request);
      if (data.request.estado === "COMPLETADA") {
        setSyncMessage("Paquete recibido desde FoxPro y listo para revision.");
        await loadBatches();
      } else if (data.request.estado === "ERROR") {
        showAlert(data.request.mensaje_error || "El lector FoxPro reporto un error.");
      }
    } catch (error) { showAlert(error.message); }
  }, [apiFetch, loadBatches, showAlert]);

  useEffect(() => {
    if (!activeRequest?.id || ["COMPLETADA", "ERROR"].includes(activeRequest.estado)) return undefined;
    const timer = window.setInterval(() => refreshRequest(activeRequest.id), 3000);
    return () => window.clearInterval(timer);
  }, [activeRequest?.estado, activeRequest?.id, refreshRequest]);

  const requestUpdate = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/integracion/foxpro/solicitudes", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible solicitar la actualizacion.");
      setActiveRequest(data.request);
      setSyncMessage("Solicitud enviada. El lector FoxPro la atendera automaticamente.");
    } catch (error) { showAlert(error.message); } finally { setLoading(false); }
  };

  const selectedValid = useMemo(
    () => records.filter((row) => selectedIds.has(row.id) && ["NUEVO", "MODIFICADO"].includes(row.estado)).length,
    [records, selectedIds]
  );
  const requestInProgress = ["PENDIENTE", "EN_PROCESO"].includes(activeRequest?.estado);
  const transfer = getBatchTransferProgress(activeRequest);
  const requestTitle = activeRequest?.estado === "PENDIENTE"
    ? "Solicitud enviada; esperando que el lector FoxPro la tome"
    : activeRequest?.estado === "EN_PROCESO" && transfer.complete
      ? "Transferencia completa; validando y clasificando el lote"
      : activeRequest?.estado === "EN_PROCESO" && transfer.totalBlocks
        ? `Recibiendo bloque ${transfer.blocksReceived} de ${transfer.totalBlocks}`
        : activeRequest?.estado === "EN_PROCESO"
          ? "FoxPro esta preparando el lote"
          : activeRequest?.estado === "ERROR"
            ? "La solicitud termino con error"
            : activeRequest?.estado === "COMPLETADA" || selectedBatch
              ? "Paquete recibido y listo para revision"
              : "Listo para solicitar una actualizacion";
  const requestDetail = requestInProgress && transfer.totalBlocks
    ? `${transfer.recordsReceived.toLocaleString("es-HN")} de ${transfer.totalRecords.toLocaleString("es-HN")} registros confirmados por el servidor`
    : requestInProgress
      ? "El estado se consulta directamente al servidor."
      : activeRequest?.codigo_lote
        ? `Lote ${activeRequest.codigo_lote}`
        : selectedBatch
          ? `Lote ${selectedBatch.codigo_lote}`
          : "Pulsa Solicitar actualizacion cuando necesites leer el padron FoxPro.";
  const batchApplicable = ["LISTO", "PARCIALMENTE_APLICADO"].includes(selectedBatch?.estado);
  const changeFilter = (key, value) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const toggle = (id) => setSelectedIds((current) => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const runAction = async (path, body, success, confirmation) => {
    if (!selectedBatch) return;
    if (confirmation) {
      setPendingConfirmation({
        title: path === "descartar" ? "Descartar registros" : "Aplicar cambios al padrón",
        description: confirmation,
        confirmLabel: path === "descartar" ? "Descartar" : "Aplicar cambios",
        action: () => runAction(path, body, success, "")
      });
      return;
    }
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
      <Dialog open={Boolean(pendingConfirmation)} onOpenChange={(open) => !open && setPendingConfirmation(null)}>
        <DialogContent className="padron-confirm-dialog sm:max-w-xl">
          <DialogHeader className="padron-confirm-head">
            <p className="sheet-kicker">Confirmación administrativa</p>
            <DialogTitle>{pendingConfirmation?.title}</DialogTitle>
            <DialogDescription>Revisa el alcance antes de continuar.</DialogDescription>
          </DialogHeader>
          <div className="padron-confirm-body">
            <div className="padron-confirm-effects">
              <strong>Esta operación requiere confirmación</strong>
              <p>{pendingConfirmation?.description}</p>
            </div>
          </div>
          <DialogFooter className="padron-confirm-actions">
            <button type="button" className="button-secondary" onClick={() => setPendingConfirmation(null)}>
              Cancelar
            </button>
            <button type="button" className="padron-confirm-button" onClick={() => {
              const action = pendingConfirmation?.action;
              setPendingConfirmation(null);
              action?.();
            }}>
              <Icon name="refresh" /> {pendingConfirmation?.confirmLabel}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <section className="import-header">
        <pre className="import-ascii-fox" aria-hidden="true">{FOX_ASCII}</pre>
        <div><p className="sheet-kicker">Integracion FoxPro bajo demanda</p><h2>Importacion</h2><p>Solicita la lectura desde aqui; el servidor responde automaticamente.</p></div>
        <button type="button" onClick={requestUpdate} disabled={loading || requestInProgress}><span className={loading || requestInProgress ? "import-refresh-icon is-spinning" : "import-refresh-icon"}><Icon name="refresh" /></span>{requestInProgress ? "Actualizacion en proceso" : "Solicitar actualizacion"}</button>
      </section>

      <section className={`import-sync-strip ${requestInProgress || loading ? "is-loading" : activeRequest?.estado === "COMPLETADA" || selectedBatch ? "is-received" : "is-waiting"}`} role="status" aria-live="polite">
        <span className="import-sync-symbol" aria-hidden="true">{requestInProgress || loading ? "" : activeRequest?.estado === "COMPLETADA" || selectedBatch ? "✓" : "</>"}</span>
        <div>
          <strong>{requestTitle}</strong>
          <span>{requestDetail}</span>
          {requestInProgress && transfer.totalBlocks ? (
            <div className="import-real-progress">
              <progress value={transfer.blocksReceived} max={transfer.totalBlocks} aria-label={`Transferencia real: ${transfer.percent}%`} />
              <span>{transfer.complete ? "Transferencia 100%" : `${transfer.percent}% transferido`}</span>
            </div>
          ) : null}
        </div>
      </section>

      {syncMessage ? <button type="button" className="import-sync-message" onClick={() => setSyncMessage("")} aria-label="Cerrar aviso">{syncMessage}<span aria-hidden="true">×</span></button> : null}

      <section className="import-r2-panel" aria-label="Respaldo privado del padron en R2">
        <div>
          <p className="sheet-kicker">Almacenamiento privado</p>
          <strong>Cloudflare R2</strong>
          <span>{!r2Status?.configured ? "No configurado" : r2Status.reachable ? `Padron activo verificado · ${Number(r2Status.active?.total_records || 0).toLocaleString("es-HN")} registros · ${uploadStatus?.local_files || 0} archivos en volumen (${formatBytes(uploadStatus?.local_bytes)}) · ${uploadStatus?.r2_files || 0} en R2` : "Configurado, sin conexion confirmada"}</span>
        </div>
        <div className="import-r2-actions">
          <button type="button" className="button-secondary" disabled={loading || !r2Status?.configured} onClick={async () => {
            try {
              const response = await apiFetch("/integracion/foxpro/r2/conexion");
              const data = await response.json();
              if (!response.ok) throw new Error(data.message || "R2 no respondio.");
              showAlert("Conexion privada con R2 confirmada.");
              await loadR2Status();
            } catch (error) { showAlert(error.message); }
          }}>Comprobar conexion</button>
          <button type="button" disabled={loading || !r2Status?.configured} onClick={() => runR2Action("migrar", {}, "¿Migrar ahora el snapshot MySQL actual hacia R2? No se borraran datos de MySQL.", (data) => `${Number(data.total_records || 0).toLocaleString("es-HN")} registros migrados y verificados en R2.`)}>Migrar snapshot MySQL</button>
          <button type="button" disabled={loading || !uploadStatus?.configured || !uploadStatus?.local_files} onClick={() => runR2Action("archivos/migrar", { confirmation: "MIGRAR_ARCHIVOS_R2", delete_local: true }, "¿Copiar y verificar todos los archivos del volumen en R2? Cada archivo local se borrara solo despues de volver a descargarlo y comprobar que su contenido es identico.", (data) => `${Number(data.migrated_files || 0).toLocaleString("es-HN")} archivos (${formatBytes(data.migrated_bytes)}) migrados y verificados en R2.`)}>Migrar archivos del volumen</button>
          <select value={historicalKey} onChange={(event) => setHistoricalKey(event.target.value)} disabled={loading || !r2Status?.historical_versions?.length} aria-label="Version historica de R2">
            <option value="">Seleccionar version historica</option>
            {(r2Status?.historical_versions || []).map((item) => <option key={item.key} value={item.key}>{item.key.replace("padron/historico/", "")}</option>)}
          </select>
          <button type="button" className="button-secondary" disabled={loading || !historicalKey} onClick={() => runR2Action("restaurar", { key: historicalKey, confirmation: "RESTAURAR_PADRON_R2" }, "¿Restaurar esta version historica como padron activo? La busqueda cambiara inmediatamente.", (data) => `Version restaurada con ${Number(data.total_records || 0).toLocaleString("es-HN")} registros.`)}>Restaurar version</button>
        </div>
      </section>

      <section className="import-layout">
        <aside className="import-batches">
          <BatchPicker batches={batches} selectedCode={selectedBatch?.codigo_lote} loading={loading} onSelect={(lot) => { setSelectedBatch(lot); setPage(1); }} />
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
                <button type="button" onClick={() => runAction("aplicar", { ids: [...selectedIds] }, (data) => `${data.applied} registros aplicados.`, "¿Aplicar los registros seleccionados al padron activo?")} disabled={loading || !batchApplicable || !selectedValid}>Aplicar seleccionados</button>
                <button type="button" onClick={() => runAction("aplicar", { allValid: true }, (data) => `${data.applied} registros validos aplicados.`, "¿Aplicar todos los registros nuevos y modificados de este lote?")} disabled={loading || !batchApplicable}>{selectedBatch?.estado === "APLICADO" ? "Lote ya aplicado" : "Aplicar todos los validos"}</button>
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
