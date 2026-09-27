import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "../../components/Icon";

export default function DashboardAlertsDialog({ model }) {
  const {
    batchPrintCopies,
    batchPrinting,
    dashboardAlertCounts,
    dashboardAlertFilter,
    filteredDashboardAlertRecords,
    handleMarkSelectedAlertsAsPrinted,
    handleSelectRecord,
    manualPrintedSelection,
    openPrintBatchModalForRecords,
    overdueComparisonRecords,
    setDashboardAlertFilter,
    setShowDashboardAlertsModal,
    setShowPrintComparisonModal,
    setWorkspaceView,
    showDashboardAlertsModal,
    togglePendingPrintedSelection
  } = model;

  return (
    <Dialog open={showDashboardAlertsModal} onOpenChange={setShowDashboardAlertsModal}>
      <DialogContent className="dashboard-alert-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="password-modal-head">
          <p className="eyebrow">Alertas vencidas</p>
          <DialogTitle>Lista de fichas en alerta</DialogTitle>
          <DialogDescription className="lead">
            Menu aparte para revisar fichas vencidas, abrir una ficha individual, imprimir o generar la comparacion contra Aguas.
          </DialogDescription>
        </DialogHeader>
        <div className="dashboard-alert-summary">
          <div>
            <span>Total</span>
            <strong>{dashboardAlertCounts.all}</strong>
          </div>
          <div>
            <span>Vencidas</span>
            <strong>{dashboardAlertCounts.critical}</strong>
          </div>
          <div>
            <span>Sin foto</span>
            <strong>{dashboardAlertCounts.noPhoto}</strong>
          </div>
        </div>
        <div className="dashboard-alert-filters" aria-label="Filtros de alertas operativas">
          {[
            { key: "all", label: "Todas", count: dashboardAlertCounts.all },
            { key: "critical", label: "Criticas", count: dashboardAlertCounts.critical },
            { key: "today", label: "Hoy", count: dashboardAlertCounts.today },
            { key: "no-photo", label: "Sin foto", count: dashboardAlertCounts.noPhoto },
            { key: "printable", label: "Para imprimir", count: dashboardAlertCounts.printable }
          ].map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={dashboardAlertFilter === filter.key ? "is-active" : ""}
              onClick={() => setDashboardAlertFilter(filter.key)}
            >
              {filter.label}
              <span>{filter.count}</span>
            </button>
          ))}
        </div>
        <div className="dashboard-alerts-list dashboard-alert-modal-list">
          {filteredDashboardAlertRecords.length ? (
            filteredDashboardAlertRecords.map(({ record, statusKey, detail, status }) => (
              <article
                key={`modal-${record.id}-${statusKey}`}
                className={`dashboard-alert-item ${statusKey || "warning"}`}
              >
                <span className="dashboard-alert-icon">
                  <Icon name={statusKey === "no-photo" ? "records" : "warning"} />
                </span>
                <div>
                  <strong>{record.clave_catastral || "Sin clave"}</strong>
                  <p>{detail}</p>
                  <span>{status}</span>
                </div>
                <div className="dashboard-alert-actions">
                  <label className="print-save-check dashboard-alert-check">
                    <input
                      type="checkbox"
                      checked={Boolean(batchPrintCopies[record.id]?.printed)}
                      onChange={() => togglePendingPrintedSelection(record.id)}
                    />
                    <span>Ya impresa</span>
                  </label>
                  <button
                    type="button"
                    className="dashboard-alert-action"
                    onClick={() => {
                      handleSelectRecord(record);
                      setShowDashboardAlertsModal(false);
                      setWorkspaceView("records");
                    }}
                  >
                    Ver ficha
                  </button>
                  <button
                    type="button"
                    className="dashboard-alert-action is-print"
                    onClick={() => {
                      setShowDashboardAlertsModal(false);
                      openPrintBatchModalForRecords([record], "ficha");
                    }}
                  >
                    Imprimir
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <h3>Sin alertas pendientes</h3>
              <p>Todas las fichas estan al dia.</p>
            </div>
          )}
        </div>
        <DialogFooter className="password-form-actions print-batch-footer">
          <Button type="button" variant="outline" onClick={() => setShowDashboardAlertsModal(false)}>
            Cerrar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleMarkSelectedAlertsAsPrinted}
            disabled={batchPrinting || !manualPrintedSelection.total}
          >
            {batchPrinting ? "Marcando..." : `Marcar impresas${manualPrintedSelection.total ? ` (${manualPrintedSelection.total})` : ""}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowDashboardAlertsModal(false);
              setShowPrintComparisonModal(true);
            }}
          >
            Comparar vencidas
          </Button>
          <Button
            type="button"
            onClick={() => {
              setShowDashboardAlertsModal(false);
              openPrintBatchModalForRecords(overdueComparisonRecords, "ficha");
            }}
            disabled={!overdueComparisonRecords.length}
          >
            <Icon name="records" />
            Imprimir vencidas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
