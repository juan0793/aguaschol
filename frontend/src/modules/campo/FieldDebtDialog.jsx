import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FIELD_DEBT_SERVICE_DEFINITIONS, getFieldDebtResultLabel, getFieldDebtServiceStatus } from "../../utils/fieldDebt";
import { Icon } from "../../components/Icon";
import { formatCurrency } from "../../utils/formatting";
import { formatMapDiaryLabel } from "../../utils/datesAndBusiness";

export default function FieldDebtDialog({ model }) {
  const {
    activeMapDiaryDateKey,
    fieldDebtReport,
    fieldDebtSummary,
    handleDownloadFieldDebtPdf,
    handlePrintFieldDebtReport,
    loadingFieldDebtReport,
    setShowFieldDebtModal,
    showFieldDebtModal
  } = model;

  return (
    <Dialog open={showFieldDebtModal} onOpenChange={setShowFieldDebtModal}>
      <DialogContent className="field-debt-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-6xl">
        <DialogHeader className="password-modal-head">
          <p className="eyebrow">Verificación administrativa</p>
          <DialogTitle>Verificación</DialogTitle>
          <DialogDescription className="lead">
            Claves o abonados detectados en las referencias de la jornada {formatMapDiaryLabel(fieldDebtReport?.dateKey || activeMapDiaryDateKey)}, cruzados contra el padron maestro.
          </DialogDescription>
        </DialogHeader>
        <div className="field-debt-modal-body">
          {loadingFieldDebtReport ? (
            <div className="empty-state field-debt-loading-state">
              <Icon name="refresh" className="empty-state-icon field-debt-loading-icon" />
              <h3>Verificación en proceso</h3>
              <p>Estoy extrayendo claves y abonados de las referencias, y consultando el padron cargado.</p>
              <span className="field-debt-loading-bar" aria-hidden="true" />
            </div>
          ) : fieldDebtReport ? (
            <>
              <div className="field-debt-summary-grid">
                <div className="log-summary-card">
                  <span>Referencias unicas</span>
                  <strong>{fieldDebtSummary.totalKeys}</strong>
                </div>
                <div className="log-summary-card">
                  <span>Encontradas</span>
                  <strong>{fieldDebtSummary.foundKeys}</strong>
                </div>
                <div className="log-summary-card">
                  <span>Sin coincidencia</span>
                  <strong>{fieldDebtSummary.missingKeys}</strong>
                </div>
                <div className="log-summary-card">
                  <span>Deuda total</span>
                  <strong>{formatCurrency(fieldDebtSummary.totalDebt)} lempiras</strong>
                </div>
              </div>

              <div className="field-debt-service-grid">
                {FIELD_DEBT_SERVICE_DEFINITIONS.map((service) => (
                  <div key={service.field} className="field-debt-service-card">
                    <span>{service.label}</span>
                    <strong>{fieldDebtSummary.services[service.field] || 0}</strong>
                  </div>
                ))}
              </div>

              <div className="field-debt-table-wrap">
                <table className="field-debt-table">
                  <thead>
                    <tr>
                      <th>Referencia detectada</th>
                      <th>Reportes</th>
                      <th>Abonado</th>
                      <th>Nombre</th>
                      <th>Barrio</th>
                      <th>Servicios</th>
                      <th>Total sin interés</th>
                      <th>Intereses</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldDebtReport.results.length ? (
                      fieldDebtReport.results.flatMap((result) => {
                        if (!result.matches?.length) {
                          return (
                            <tr key={`${result.key}-missing`} className="is-missing">
                              <td>{getFieldDebtResultLabel(result)}</td>
                              <td>{fieldDebtReport?.keyCounts?.[result.key] || 0}</td>
                              <td>--</td>
                              <td>{result.error || "No aparece en el padrón"}</td>
                              <td>--</td>
                              <td>--</td>
                              <td>--</td>
                              <td>--</td>
                              <td>--</td>
                            </tr>
                          );
                        }

                        return result.matches.map((match, matchIndex) => (
                          <tr key={`${result.key}-${match.abonado || match.clave_catastral || matchIndex}`}>
                            <td>{matchIndex === 0 ? getFieldDebtResultLabel(result) : ""}</td>
                            <td>{matchIndex === 0 ? fieldDebtReport?.keyCounts?.[result.key] || 0 : ""}</td>
                            <td>{match.abonado || "--"}</td>
                            <td>{match.inquilino || match.nombre || "--"}</td>
                            <td>{match.barrio_colonia || "--"}</td>
                            <td>
                              {FIELD_DEBT_SERVICE_DEFINITIONS.map((service) => (
                                <span
                                  key={service.field}
                                  className={`field-debt-service-pill ${getFieldDebtServiceStatus(match, service.field) === "Sí" ? "is-on" : "is-off"}`}
                                >
                                  <b>{getFieldDebtServiceStatus(match, service.field) === "Sí" ? "✓" : "×"}</b>
                                  {service.shortLabel}
                                </span>
                              ))}
                            </td>
                            <td className="field-debt-table-money">{formatCurrency(Number(match.valor || 0))}</td>
                            <td className="field-debt-table-money">{formatCurrency(Number(match.intereses || 0))}</td>
                            <td className="field-debt-table-money is-total">{formatCurrency(Number(match.total || 0))}</td>
                          </tr>
                        ));
                      })
                    ) : (
                      <tr>
                        <td colSpan="9">No se detectaron claves ni abonados en esta jornada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="helper-text">
                Se revisaron {fieldDebtSummary.totalPoints} puntos con referencia manual. El detalle final se resume arriba para evitar duplicar la referencia de campo.
              </p>
            </>
          ) : (
            <div className="empty-state">
              <h3>Sin verificación</h3>
              <p>Ejecuta la verificacion desde Reportes GPS para revisar las claves o abonados de la jornada.</p>
            </div>
          )}
        </div>
        <DialogFooter className="password-form-actions print-batch-footer">
          <button type="button" className="button-secondary" onClick={() => setShowFieldDebtModal(false)}>
            Cerrar
          </button>
          <button type="button" className="button-secondary" onClick={handlePrintFieldDebtReport} disabled={!fieldDebtReport || loadingFieldDebtReport}>
            <Icon name="records" />
            Imprimir
          </button>
          <button type="button" onClick={handleDownloadFieldDebtPdf} disabled={!fieldDebtReport || loadingFieldDebtReport}>
            <Icon name="records" />
            Generar PDF
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
