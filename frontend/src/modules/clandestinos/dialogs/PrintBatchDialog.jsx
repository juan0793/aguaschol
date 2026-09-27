import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "../../../components/Icon";
import { Input } from "@/components/ui/input";
import { clampPrintCopies, getPadronStatusLabel, getRecordFichaDateLabel, getRecordPrintedDateLabel } from "../../../utils/recordLabels";

export default function PrintBatchDialog({ model }) {
  const {
    adjustBatchPrintCopies,
    batchPrintCopies,
    batchPrintSelection,
    batchPrinting,
    clearBatchPrintCopies,
    filteredPrintBatchRecords,
    getRecordBarrioName,
    handleMoveSelectedFichasToPrinted,
    handlePrintBatch,
    handleSaveSelectedPrintedRecords,
    handleValidatePrintRecord,
    manualPrintedSelection,
    printBatchQuickFilter,
    printBatchSearch,
    printBatchStatusCounts,
    printBatchStatusView,
    printedSaveSelection,
    processingRecordId,
    selectVisibleBatchPrintCopies,
    selectVisiblePendingAsPrinted,
    selectVisiblePrintedForSave,
    setPrintBatchQuickFilter,
    setPrintBatchSearch,
    setPrintBatchStatusView,
    setShowPrintBatchModal,
    setShowPrintComparisonModal,
    showPrintBatchModal,
    togglePendingPrintedSelection,
    togglePrintedSaveSelection,
    updateBatchPrintCopies
  } = model;

  return (
    <Dialog open={showPrintBatchModal} onOpenChange={(open) => !batchPrinting && setShowPrintBatchModal(open)}>
      <DialogContent className="print-batch-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="password-modal-head">
          <p className="eyebrow">Impresion rapida</p>
          <DialogTitle>Seleccionar fichas, avisos y copias</DialogTitle>
          <DialogDescription className="lead">
            Selecciona el lote, revisa pendientes o impresas y evita repetir impresiones.
          </DialogDescription>
          <p className="helper-text">
            Al imprimir, las fichas pasan a impresas y salen de alertas. Desde impresas puedes marcarlas y enviarlas a guardadas.
          </p>
        </DialogHeader>
        <div className="print-batch-toolbar">
          <div className="print-batch-filters" aria-label="Apartados de impresion">
            {[
              { key: "pending", label: `Pendientes (${printBatchStatusCounts.pending})` },
              { key: "printed", label: `Impresas (${printBatchStatusCounts.printed})` }
            ].map((filter) => (
              <Button
                key={filter.key}
                type="button"
                variant={printBatchStatusView === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPrintBatchStatusView(filter.key);
                  if (filter.key === "printed" && printBatchQuickFilter === "clandestina") {
                    setPrintBatchQuickFilter("all");
                  }
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <label className="print-batch-search">
            <span>Buscar ficha</span>
            <Input
              type="search"
              value={printBatchSearch}
              onChange={(event) => setPrintBatchSearch(event.target.value)}
              placeholder="Buscar por clave..."
            />
          </label>
          <div className="print-batch-filters" aria-label="Filtros rapidos de impresion">
            {[
              { key: "all", label: "Todas" },
              { key: "clandestina", label: "Clandestinas" },
              { key: "ficha_selected", label: "Con ficha seleccionada" },
              { key: "aviso_selected", label: "Con aviso seleccionado" }
            ].map((filter) => (
              <Button
                key={filter.key}
                type="button"
                variant={printBatchQuickFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPrintBatchQuickFilter(filter.key)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div className="print-batch-summary" aria-label="Resumen de seleccion">
            <Badge variant="secondary">{batchPrintSelection.fichas} fichas</Badge>
            <Badge variant="secondary">{batchPrintSelection.avisos} avisos</Badge>
            <Badge variant="outline">{filteredPrintBatchRecords.length} visibles</Badge>
            <Badge variant="outline">
              {filteredPrintBatchRecords.filter((record) => (record.estado_padron || "clandestino") === "clandestino").length} clandestinas
            </Badge>
            {printBatchStatusView === "printed" ? (
              <Badge variant="outline">{printedSaveSelection.total} para guardar</Badge>
            ) : manualPrintedSelection.total ? (
              <Badge variant="outline">{manualPrintedSelection.total} ya impresas</Badge>
            ) : null}
          </div>
          <div className="print-batch-actions">
            {printBatchStatusView === "printed" ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={selectVisiblePrintedForSave}>
                  Marcar visibles
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSelectedPrintedRecords}
                  disabled={batchPrinting || !printedSaveSelection.total}
                >
                  Enviar a guardadas
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => selectVisibleBatchPrintCopies("ficha")}>
                  Seleccionar fichas visibles
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => selectVisibleBatchPrintCopies("aviso")}>
                  Seleccionar avisos visibles
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={selectVisiblePendingAsPrinted}>
                  Marcar visibles ya impresas
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearBatchPrintCopies}>
              Limpiar seleccion
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPrintComparisonModal(true)}
            >
              Comparar todas las fichas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMoveSelectedFichasToPrinted}
              disabled={batchPrinting || printBatchStatusView === "printed" || (!batchPrintSelection.fichas && !manualPrintedSelection.total)}
            >
              Marcar como impresas
            </Button>
          </div>
        </div>
        <div className="print-batch-scroll">
          <div className="print-batch-grid">
            {filteredPrintBatchRecords.length ? (
              filteredPrintBatchRecords.map((record) => {
                const copies = batchPrintCopies[record.id] || {};
                const fichaCopies = clampPrintCopies(copies.ficha ?? 0);
                const avisoCopies = clampPrintCopies(copies.aviso ?? 0);
                const padronStatus = record.estado_padron || "clandestino";
                const isClandestina = padronStatus === "clandestino";
                const isPrinted = padronStatus === "reportada";
                const isSelected = Boolean(fichaCopies || avisoCopies);
                const isMarkedForSave = Boolean(copies.save);
                const isMarkedPrinted = Boolean(copies.printed);

                return (
                  <article
                    key={`print-${record.id}`}
                    className={`print-batch-card ${isSelected ? "is-selected" : ""}`}
                  >
                    <div className="print-batch-card-main">
                      <div className="print-batch-card-title">
                        <strong>{record.clave_catastral}</strong>
                        {isSelected ? <Badge variant="outline" className="print-selected-badge">Seleccionada</Badge> : null}
                      </div>
                      <span>{getRecordBarrioName(record, "Sin ubicacion")}</span>
                      <div className="print-batch-card-meta">
                        <Badge
                          variant={isClandestina ? "destructive" : padronStatus === "reportada" ? "secondary" : "outline"}
                          className={`print-status-badge is-${padronStatus}`}
                        >
                          {getPadronStatusLabel(padronStatus)}
                        </Badge>
                        <small>Creada: {getRecordFichaDateLabel(record)}</small>
                        {isPrinted ? <small>Impresa: {getRecordPrintedDateLabel(record)}</small> : null}
                      </div>
                    </div>
                    <div className="print-batch-status">
                      {isPrinted ? (
                        <label className="print-save-check">
                          <input
                            type="checkbox"
                            checked={isMarkedForSave}
                            onChange={() => togglePrintedSaveSelection(record.id)}
                          />
                          <span>Enviar a guardadas</span>
                        </label>
                      ) : (
                        <>
                          <label className="print-save-check">
                            <input
                              type="checkbox"
                              checked={isMarkedPrinted}
                              onChange={() => togglePendingPrintedSelection(record.id)}
                            />
                            <span>Ya fue impresa</span>
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="print-validate-button"
                            onClick={() => handleValidatePrintRecord(record)}
                            disabled={processingRecordId === record.id}
                          >
                            <Icon name="search" />
                            {processingRecordId === record.id ? "Validando..." : "Validar padrones"}
                          </Button>
                        </>
                      )}
                    </div>
                    {!isPrinted ? (
                      <>
                        <div className="print-copy-group">
                          <span>Ficha</span>
                          <div className="print-copy-stepper">
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "ficha", -1)}>-</Button>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-5]"
                              aria-label={`Copias de ficha para ${record.clave_catastral}`}
                              min="0"
                              max="5"
                              value={String(fichaCopies)}
                              onChange={(event) => updateBatchPrintCopies(record.id, "ficha", event.target.value)}
                            />
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "ficha", 1)}>+</Button>
                          </div>
                        </div>
                        <div className="print-copy-group">
                          <span>Aviso</span>
                          <div className="print-copy-stepper">
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "aviso", -1)}>-</Button>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-5]"
                              aria-label={`Copias de aviso para ${record.clave_catastral}`}
                              min="0"
                              max="5"
                              value={String(avisoCopies)}
                              onChange={(event) => updateBatchPrintCopies(record.id, "aviso", event.target.value)}
                            />
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "aviso", 1)}>+</Button>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <h3>No hay fichas visibles</h3>
                <p>Ajusta el filtro por clave, barrio o estado para preparar impresiones.</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="password-form-actions print-batch-footer">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPrintBatchModal(false)}
            disabled={batchPrinting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handlePrintBatch}
            disabled={batchPrinting || (!batchPrintSelection.fichas && !batchPrintSelection.avisos)}
            className={batchPrintSelection.fichas || batchPrintSelection.avisos ? "print-preview-button is-ready" : "print-preview-button"}
          >
            <Icon name="records" />
            {batchPrinting
              ? "Preparando..."
              : `Vista previa: ${batchPrintSelection.fichas} fichas / ${batchPrintSelection.avisos} avisos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
