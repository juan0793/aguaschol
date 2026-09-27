import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "../../components/Icon";
import { buildPrintHtml } from "../../utils/printDocument";
import { formatDateTime } from "../../utils/datesAndBusiness";

export default function AuditReportViewerDialog({ model }) {
  const { handleReprintAuditReport, selectedAuditReport, setSelectedAuditReport } = model;

  return (
    <Dialog open={Boolean(selectedAuditReport)} onOpenChange={(open) => !open && setSelectedAuditReport(null)}>
      <DialogContent className="audit-report-viewer-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-6xl">
        <DialogHeader className="password-modal-head audit-report-viewer-head">
          <DialogTitle><Icon name="print" className="title-icon" />{selectedAuditReport?.title || "Reporte archivado"}</DialogTitle>
          <DialogDescription className="lead">
            ID {selectedAuditReport?.report_id || "--"} · Archivado {selectedAuditReport?.created_at ? formatDateTime(selectedAuditReport.created_at) : "sin fecha"}
          </DialogDescription>
        </DialogHeader>
        {selectedAuditReport ? (
          <div className="audit-report-viewer-frame">
            <iframe
              title={`Vista archivada ${selectedAuditReport.report_id}`}
              sandbox=""
              srcDoc={buildPrintHtml(selectedAuditReport.title, selectedAuditReport.body_markup, {
                reportId: selectedAuditReport.report_id,
                pageSize: selectedAuditReport.page_size || "Letter portrait",
                pageMargin: selectedAuditReport.page_margin || "10mm",
                bodyClassName: selectedAuditReport.body_class_name || ""
              })}
            />
          </div>
        ) : null}
        <DialogFooter className="password-form-actions print-batch-footer">
          <button type="button" className="button-secondary" onClick={() => setSelectedAuditReport(null)}>Cerrar</button>
          <button type="button" className="button-primary" onClick={handleReprintAuditReport} disabled={!selectedAuditReport?.body_markup}>
            <Icon name="print" /> Imprimir nuevamente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
