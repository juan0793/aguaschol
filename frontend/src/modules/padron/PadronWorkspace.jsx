import BatchPicker from "../../components/BatchPicker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "../../components/Icon";
import { PADRON_SYNC_STEPS } from "../../constants/workspace";
import { formatDateTime } from "../../utils/datesAndBusiness";
import { formatPercent } from "../../utils/timeFormat";

export default function PadronWorkspace({ model }) {
  const {
    activatingPadronBatch,
    alcaldiaComparison,
    alcaldiaFile,
    alcaldiaImportSummary,
    alcaldiaMeta,
    alcaldiaSyncState,
    confirmActivatePadronBatch,
    confirmingPadronBatch,
    downloadingPadron,
    downloadingPadronBatch,
    handleActivatePadronBatch,
    handleAlcaldiaFileChange,
    handleDownloadPadron,
    handleDownloadPadronBatch,
    handlePadronFileChange,
    handleReprocessPadron,
    handleUploadAlcaldia,
    handleUploadPadron,
    handleVerifyPadronBatch,
    loadAlcaldiaComparison,
    loadAlcaldiaMeta,
    loadPadronMeta,
    loadingAlcaldiaComparison,
    loadingAlcaldiaMeta,
    loadingPadronBatches,
    loadingPadronMeta,
    padronBatches,
    padronFile,
    padronImportSummary,
    padronMeta,
    padronSyncState,
    reprocessingPadron,
    selectedPadronBatch,
    selectedPadronBatchCode,
    setAlcaldiaFile,
    setConfirmingPadronBatch,
    setPadronFile,
    setSelectedPadronBatchCode,
    uploadingAlcaldia,
    uploadingPadron,
    verifyingPadronBatch
  } = model;

  return (
    <main className="lookup-layout">
      <section className="lookup-shell no-print">
        {padronSyncState.status === "running" ? (
          <div className="padron-system-overlay" role="status" aria-live="polite">
            <div>
              <span className="padron-system-spinner"><Icon name="refresh" /></span>
              <p className="sheet-kicker">Sincronizando sistema</p>
              <h2>Actualizando padrón maestro</h2>
              <strong>{padronSyncState.progress}%</strong>
              <div className="padron-system-progress"><span style={{ width: `${padronSyncState.progress}%` }} /></div>
              <p>{padronSyncState.message}</p>
              <div className="padron-system-modules">
                <span>Buscar clave</span>
                <span>Verificar deuda</span>
                <span>Reportes</span>
                <span>Comparativas</span>
              </div>
            </div>
          </div>
        ) : null}
        {alcaldiaSyncState.status === "running" ? (
          <div className="padron-system-overlay" role="status" aria-live="polite">
            <div>
              <span className="padron-system-spinner"><Icon name="refresh" /></span>
              <p className="sheet-kicker">Sincronizando sistema</p>
              <h2>Actualizando padron Alcaldia</h2>
              <strong>{alcaldiaSyncState.progress}%</strong>
              <div className="padron-system-progress"><span style={{ width: `${alcaldiaSyncState.progress}%` }} /></div>
              <p>{alcaldiaSyncState.message}</p>
              <div className="padron-system-modules">
                <span>Buscar Alcaldia</span>
                <span>Comparativas</span>
                <span>Fichas</span>
                <span>Reportes</span>
              </div>
            </div>
          </div>
        ) : null}

        <Dialog open={Boolean(confirmingPadronBatch)} onOpenChange={(open) => !open && setConfirmingPadronBatch(null)}>
          <DialogContent className="padron-confirm-dialog sm:max-w-xl">
            <DialogHeader className="padron-confirm-head">
              <p className="sheet-kicker">Confirmar cambio de fuente</p>
              <DialogTitle>Activar lote FoxPro</DialogTitle>
              <DialogDescription>
                Revisa el lote antes de convertirlo en el padrón maestro del sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="padron-confirm-body">
              <div className="padron-confirm-lot">
                <span>Lote seleccionado</span>
                <strong>{confirmingPadronBatch?.codigo_lote}</strong>
              </div>
              <div className="padron-confirm-summary">
                <span><b>{Number(confirmingPadronBatch?.total_registros || 0).toLocaleString("es-HN")}</b> registros</span>
                <span><b>{Number(confirmingPadronBatch?.registros_error || 0).toLocaleString("es-HN")}</b> errores excluidos</span>
                <span><b>{String(confirmingPadronBatch?.estado || "").replaceAll("_", " ")}</b> estado</span>
              </div>
              <div className="padron-confirm-effects">
                <strong>Al continuar:</strong>
                <ul>
                  <li>Este lote reemplazará el padrón activo.</li>
                  <li>Se limpiarán búsquedas, deuda, reportes y comparativas anteriores.</li>
                  <li>El Excel guardado seguirá disponible como alternativa manual.</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="padron-confirm-actions">
              <button type="button" className="button-secondary" onClick={() => setConfirmingPadronBatch(null)}>
                Cancelar
              </button>
              <button type="button" className="padron-confirm-button" onClick={confirmActivatePadronBatch}>
                <Icon name="refresh" /> Activar lote
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <form className="lookup-card padron-master-console" onSubmit={handleUploadPadron}>
          <div className="padron-console-hero">
            <div className="padron-console-copy">
              <p className="sheet-kicker">Padron maestro</p>
              <h2><Icon name="refresh" className="title-icon" />Aguas de Choluteca</h2>
              <p>Activa un lote FoxPro como fuente principal, limpia consultas anteriores y conserva Excel como alternativa manual.</p>
            </div>
            <div className="padron-console-meter">
              <strong>{padronSyncState.verification?.verified_percent ?? (padronMeta?.total_records ? 100 : 0)}%</strong>
              <span>consistencia del padrón</span>
              <small>{padronMeta?.total_records ?? 0} claves activas</small>
            </div>
          </div>

          <div className="padron-console-grid padron-source-grid">
            <section className="padron-file-panel padron-active-source">
              <div className="padron-active-head">
                <div>
                  <span>Fuente activa</span>
                  <strong>{padronMeta?.file_name || "Sin registro"}</strong>
                  <small>{padronMeta?.last_import_summary?.source === "FOXPRO_MANUAL" ? `Lote ${padronMeta?.last_import_summary?.codigo_lote || "FoxPro"} conectado al sistema` : "Excel conectado al sistema"}</small>
                </div>
                <button type="button" className="button-secondary padron-active-download" onClick={handleDownloadPadron} disabled={downloadingPadron || !padronMeta?.total_records} title={`Descarga en Excel el padrón que consulta el sistema ahora (${Number(padronMeta?.total_records || 0).toLocaleString("es-HN")} registros)`}>
                  <Icon name="download" />{downloadingPadron ? "Preparando Excel..." : "Descargar padrón activo"}
                </button>
              </div>
              <div className="padron-file-meta">
                <span>Hoja <b>{padronMeta?.sheet_name || "--"}</b></span>
                <span>Actualización <b>{formatDateTime(padronMeta?.updated_at)}</b></span>
                <span>Estado <b>{loadingPadronMeta ? "Consultando" : "Sincronizado"}</b></span>
              </div>
            </section>

            <section className="padron-lot-panel">
              <div className="padron-source-heading">
                <span className="padron-source-badge">Fuente principal</span>
                <div><strong>Lote recibido desde FoxPro</strong><small>Selecciona una lectura revisada para convertirla en el padrón activo.</small></div>
              </div>
              <BatchPicker batches={padronBatches} selectedCode={selectedPadronBatchCode} loading={loadingPadronBatches} title="Lotes disponibles" onSelect={(batch) => setSelectedPadronBatchCode(batch.codigo_lote)} />
              {selectedPadronBatch ? (
                <div className="padron-lot-summary">
                  <span><b>{Number(selectedPadronBatch.total_registros || 0).toLocaleString("es-HN")}</b> registros</span>
                  <span><b>{Number(selectedPadronBatch.registros_error || 0).toLocaleString("es-HN")}</b> errores excluidos</span>
                  <span className={`is-${String(selectedPadronBatch.estado).toLowerCase()}`}>{String(selectedPadronBatch.estado).replaceAll("_", " ")}</span>
                </div>
              ) : null}
              <button type="button" className="padron-activate-button" onClick={handleActivatePadronBatch} disabled={!selectedPadronBatch || loadingPadronBatches || activatingPadronBatch || !["LISTO", "PARCIALMENTE_APLICADO", "APLICADO"].includes(selectedPadronBatch?.estado)}>
                <Icon name="refresh" />{activatingPadronBatch ? "Activando lote..." : "Activar lote y limpiar cache"}
              </button>
              <button type="button" className="button-secondary" onClick={handleVerifyPadronBatch} disabled={!selectedPadronBatch || verifyingPadronBatch || activatingPadronBatch}>
                <Icon name="search" />{verifyingPadronBatch ? "Verificando contenido..." : "Verificar lote activo"}
              </button>
              {/* Los lotes antiguos pierden su detalle al respaldarse; sin bloques no hay registros que exportar. */}
              <button type="button" className="button-secondary" onClick={handleDownloadPadronBatch} disabled={!selectedPadronBatch || downloadingPadronBatch || !Number(selectedPadronBatch?.registros_recibidos)} title={selectedPadronBatch && !Number(selectedPadronBatch.registros_recibidos) ? "Este lote ya no conserva sus registros: el detalle de los lotes antiguos se limpia después de respaldarlo." : "Descarga el lote como padrón en Excel (sin los registros con error)"}>
                <Icon name="download" />{downloadingPadronBatch ? "Preparando Excel..." : "Descargar lote en Excel"}
              </button>
            </section>

            <section className="padron-upload-panel padron-excel-alternative">
              <span className="padron-source-badge is-secondary">Alternativa manual</span>
              <label className="padron-upload-drop">
                <Icon name="records" />
                <span>Seleccionar Excel alternativo</span>
                <strong>{padronFile ? padronFile.name : "Ningún archivo seleccionado"}</strong>
                <input
                  type="file"
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handlePadronFileChange}
                />
              </label>
              <p className="helper-text">{padronMeta?.source_file_available ? `Excel alternativo guardado: ${padronMeta?.source_file_name || "Disponible"}.` : "Todavía no hay un Excel alternativo guardado."} Al usarlo también se reemplaza la data y se limpian consultas anteriores.</p>
            </section>
          </div>

          <div className="padron-impact-grid">
            {[
              ["Nuevas", padronImportSummary?.added ?? 0],
              ["Removidas", padronImportSummary?.removed ?? 0],
              ["Cambiadas", padronImportSummary?.changed ?? 0],
              ["Verificadas", padronSyncState.verification?.verified_records ?? padronMeta?.total_records ?? 0]
            ].map(([label, value]) => {
              const base = padronImportSummary?.source_rows ?? padronSyncState.verification?.normalized_source_rows ?? padronMeta?.total_records ?? 0;
              return (
                <div key={label} className="padron-impact-tile">
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{formatPercent(value, base)}</small>
                </div>
              );
            })}
          </div>

          <div className="admin-result-grid padron-admin-grid">
            <div className="document-block">
              <h4>Archivo activo</h4>
              <p><strong>Archivo:</strong> {padronMeta?.file_name || "Sin registro"}</p>
              <p><strong>Fuente guardada:</strong> {padronMeta?.source_file_available ? (padronMeta?.source_file_name || "Disponible") : "No disponible"}</p>
              <p><strong>Hoja:</strong> {padronMeta?.sheet_name || "--"}</p>
              <p><strong>Ultima actualizacion:</strong> {formatDateTime(padronMeta?.updated_at)}</p>
              <p><strong>Estado actual:</strong> {loadingPadronMeta ? "Consultando..." : "Sincronizado"}</p>
              <p className="helper-text">`Cambiadas` compara la misma clave contra el padrón anterior y detecta cambios en el nombre asociado.</p>
              <div className="padron-summary-strip">
                <div className="log-summary-card">
                  <span>Nuevas</span>
                  <strong>{padronImportSummary?.added ?? 0}</strong>
                  <small>{formatPercent(padronImportSummary?.added ?? 0, padronImportSummary?.source_rows ?? padronMeta?.total_records ?? 0)}</small>
                </div>
                <div className="log-summary-card">
                  <span>Removidas</span>
                  <strong>{padronImportSummary?.removed ?? 0}</strong>
                  <small>{formatPercent(padronImportSummary?.removed ?? 0, padronImportSummary?.source_rows ?? padronMeta?.total_records ?? 0)}</small>
                </div>
                <div className="log-summary-card">
                  <span>Cambiadas</span>
                  <strong>{padronImportSummary?.changed ?? 0}</strong>
                  <small>{formatPercent(padronImportSummary?.changed ?? 0, padronImportSummary?.source_rows ?? padronMeta?.total_records ?? 0)}</small>
                </div>
              </div>
            </div>
            <div className="document-block">
              <h4>Nuevo archivo</h4>
              <label className="file-input">
                <span>Seleccionar Excel maestro</span>
                <input
                  type="file"
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handlePadronFileChange}
                />
              </label>
              <p className="helper-text">
                Sube el padrón maestro en Excel y el módulo <strong>Buscar clave</strong> usará la nueva versión de inmediato.
              </p>
              {padronFile ? <p><strong>Archivo listo:</strong> {padronFile.name}</p> : null}
            </div>
          </div>

          {padronSyncState.status !== "idle" ? (
            <div className={`padron-sync-panel is-${padronSyncState.status}`}>
              <div className="padron-sync-head">
                <div>
                  <span className="padron-sync-icon">
                    <Icon name={padronSyncState.status === "error" ? "warning" : "refresh"} />
                  </span>
                  <div>
                    <strong>{padronSyncState.message}</strong>
                    <small>
                      {padronSyncState.status === "running"
                        ? "No uses busqueda ni verificacion hasta que llegue a 100%."
                        : padronSyncState.status === "error"
                          ? "Revisa el archivo y vuelve a sincronizar."
                          : "Buscar clave, Verificar deuda, reportes y comparativas ya consultan esta version."}
                    </small>
                  </div>
                </div>
                <b>{padronSyncState.progress}%</b>
              </div>
              <div className="padron-sync-bar" aria-hidden="true">
                <span style={{ width: `${padronSyncState.progress}%` }} />
              </div>
              <div className="padron-sync-steps">
                {PADRON_SYNC_STEPS.map((step) => (
                  <span key={step.label} className={padronSyncState.progress >= step.progress ? "is-done" : ""}>
                    {step.label}
                  </span>
                ))}
              </div>
              {padronSyncState.verification ? (
                <div className="padron-sync-verification">
                  <span>{padronSyncState.verification.verified_records || 0} de {padronSyncState.verification.normalized_source_rows || 0} registros</span>
                  <strong>{padronSyncState.verification.verified_percent || 0}%</strong>
                  <small>
                    Faltantes: {padronSyncState.verification.missing_records || 0} - Extras: {padronSyncState.verification.extra_records || 0}
                  </small>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="search-actions lookup-actions">
            <button type="submit" disabled={uploadingPadron || activatingPadronBatch || !padronFile}>
              <Icon name="refresh" />
              {uploadingPadron ? "Activando Excel..." : "Usar Excel alternativo"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={handleReprocessPadron}
              disabled={reprocessingPadron || uploadingPadron || !padronMeta?.source_file_available}
            >
              <Icon name="refresh" />
              {reprocessingPadron ? "Reprocesando..." : "Reprocesar ultimo Excel"}
            </button>
            <button type="button" className="button-secondary" onClick={handleDownloadPadron}>
              <Icon name="records" />
              Descargar Excel actual
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setPadronFile(null);
                loadPadronMeta();
              }}
              disabled={loadingPadronMeta}
            >
              <Icon name="records" />
              {loadingPadronMeta ? "Consultando..." : "Ver estado actual"}
            </button>
          </div>
        </form>

        <div className="padron-dual-grid">
          <form className="lookup-card padron-master-console padron-alcaldia-console" onSubmit={handleUploadAlcaldia}>
            <div className="padron-console-hero">
              <div className="padron-console-copy">
                <p className="sheet-kicker">Padron de contraste</p>
                <h2><Icon name="records" className="title-icon" />Alcaldia de Choluteca</h2>
                <p>Reemplaza la informacion catastral activa, limpia consultas viejas y actualiza comparativas contra Aguas.</p>
              </div>
              <div className="padron-console-meter">
                <strong>{alcaldiaMeta?.total_records ? 100 : 0}%</strong>
                <span>padron municipal listo</span>
                <small>{alcaldiaMeta?.total_records ?? 0} claves activas</small>
              </div>
            </div>

            <div className="padron-console-grid">
              <section className="padron-file-panel">
                <div>
                  <span>Archivo activo</span>
                  <strong>{alcaldiaMeta?.file_name || "Sin registro"}</strong>
                  <small>{alcaldiaMeta?.source_file_available ? `Fuente guardada: ${alcaldiaMeta?.source_file_name || "Disponible"}` : "Fuente guardada: no disponible"}</small>
                </div>
                <div className="padron-file-meta">
                  <span>Hoja <b>{alcaldiaMeta?.sheet_name || "--"}</b></span>
                  <span>Actualizacion <b>{formatDateTime(alcaldiaMeta?.updated_at)}</b></span>
                  <span>Estado <b>{loadingAlcaldiaMeta ? "Consultando" : "Sincronizado"}</b></span>
                </div>
              </section>

              <section className="padron-upload-panel">
                <label className="padron-upload-drop">
                  <Icon name="records" />
                  <span>Seleccionar Excel Alcaldia</span>
                  <strong>{alcaldiaFile ? alcaldiaFile.name : "Ningun archivo seleccionado"}</strong>
                  <input
                    type="file"
                    accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleAlcaldiaFileChange}
                  />
                </label>
                <p className="helper-text">Al actualizar se limpian caches de busqueda, reportes, comparativas y resultados anteriores.</p>
              </section>
            </div>

            <div className="padron-impact-grid">
              {[
                ["Nuevas", alcaldiaImportSummary?.added ?? 0],
                ["Removidas", alcaldiaImportSummary?.removed ?? 0],
                ["Cambiadas", alcaldiaImportSummary?.changed ?? 0],
                ["Importadas", alcaldiaMeta?.total_records ?? 0]
              ].map(([label, value]) => {
                const base = alcaldiaImportSummary?.source_rows ?? alcaldiaMeta?.total_records ?? 0;
                return (
                  <div key={label} className="padron-impact-tile">
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{formatPercent(value, base)}</small>
                  </div>
                );
              })}
            </div>

            {alcaldiaSyncState.status !== "idle" ? (
              <div className={`padron-sync-panel is-${alcaldiaSyncState.status}`}>
                <div className="padron-sync-head">
                  <div>
                    <span className="padron-sync-icon">
                      <Icon name={alcaldiaSyncState.status === "error" ? "warning" : "refresh"} />
                    </span>
                    <div>
                      <strong>{alcaldiaSyncState.message}</strong>
                      <small>
                        {alcaldiaSyncState.status === "running"
                          ? "No uses busqueda ni comparativas hasta que llegue a 100%."
                          : alcaldiaSyncState.status === "error"
                            ? "Revisa el archivo y vuelve a sincronizar."
                            : "Busqueda municipal, fichas, reportes y comparativas ya consultan esta version."}
                      </small>
                    </div>
                  </div>
                  <b>{alcaldiaSyncState.progress}%</b>
                </div>
                <div className="padron-sync-bar" aria-hidden="true">
                  <span style={{ width: `${alcaldiaSyncState.progress}%` }} />
                </div>
                <div className="padron-sync-steps">
                  {PADRON_SYNC_STEPS.map((step) => (
                    <span key={step.label} className={alcaldiaSyncState.progress >= step.progress ? "is-done" : ""}>
                      {step.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="search-actions lookup-actions">
              <button type="submit" disabled={uploadingAlcaldia}>
                <Icon name="refresh" />
                {uploadingAlcaldia ? "Actualizando..." : "Actualizar padron Alcaldia"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setAlcaldiaFile(null);
                  loadAlcaldiaMeta();
                }}
                disabled={loadingAlcaldiaMeta}
              >
                <Icon name="records" />
                {loadingAlcaldiaMeta ? "Consultando..." : "Ver estado Alcaldia"}
              </button>
            </div>
          </form>

          <article className="lookup-card padron-compare-card">
            <div className="lookup-card-head">
              <div>
                <p className="sheet-kicker">Deteccion de clandestinos</p>
                <h2><Icon name="search" className="title-icon" />Comparar Alcaldia contra Aguas</h2>
                <p className="lookup-card-description">
                  Si una clave del padron de Alcaldia no aparece en Aguas de Choluteca, queda marcada como candidata clandestina.
                </p>
              </div>
              <button type="button" onClick={loadAlcaldiaComparison} disabled={loadingAlcaldiaComparison}>
                <Icon name="search" />
                {loadingAlcaldiaComparison ? "Comparando..." : "Comparar padrones"}
              </button>
            </div>
            <div className="padron-comparison-strip">
              <div className="log-summary-card"><span>Aguas</span><strong>{padronMeta?.total_records ?? 0}</strong></div>
              <div className="log-summary-card"><span>Alcaldia</span><strong>{alcaldiaMeta?.total_records ?? 0}</strong></div>
              <div className="log-summary-card"><span>Coincidencia exacta</span><strong>{alcaldiaComparison?.summary?.exact_matches ?? "--"}</strong></div>
              <div className="log-summary-card"><span>Candidatas</span><strong>{alcaldiaComparison?.summary?.candidate_clandestine ?? "--"}</strong></div>
            </div>
            <div className="padron-candidate-list">
              {alcaldiaComparison?.summary ? (
                (alcaldiaComparison.candidates || []).length ? (
                  (alcaldiaComparison.candidates || []).slice(0, 20).map((item) => (
                    <article key={item.clave_catastral} className="padron-candidate-card">
                      <div>
                        <strong>{item.clave_catastral}</strong>
                        <span>{item.nombre || "Sin nombre registrado"}</span>
                      </div>
                      <p>{item.direccion || item.caserio || "Sin direccion registrada"}</p>
                      <small>No aparece en Aguas de Choluteca</small>
                    </article>
                  ))
                ) : (
                  <p className="helper-text">No hay candidatas clandestinas con los padrones actuales.</p>
                )
              ) : (
                <p className="helper-text">Carga ambos padrones y ejecuta la comparacion para ver las claves de Alcaldia que no aparecen en Aguas.</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
