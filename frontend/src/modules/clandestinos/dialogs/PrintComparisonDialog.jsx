import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "../../../components/Icon";
import { Input } from "@/components/ui/input";
import { getRecordAguasPresenceLabel, getRecordDisplayName, getRecordFichaDateLabel } from "../../../utils/recordLabels";

export default function PrintComparisonDialog({ model }) {
  const {
    alcaldiaComparisonByClave,
    getRecordBarrioName,
    handlePrintAguasComparisonList,
    overdueComparisonRecords,
    printComparisonHeader,
    printingComparison,
    setPrintComparisonHeader,
    setShowPrintComparisonModal,
    showPrintComparisonModal
  } = model;

  return (
    <Dialog open={showPrintComparisonModal} onOpenChange={setShowPrintComparisonModal}>
      <DialogContent className="print-comparison-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="password-modal-head">
          <p className="eyebrow">Menu aparte</p>
          <DialogTitle>Comparar fichas vencidas contra Aguas</DialogTitle>
          <DialogDescription className="lead">
            Imprime una lista simple: clave catastral, nombre, barrio, fecha de ficha, estado y si aparece en Aguas.
          </DialogDescription>
        </DialogHeader>
        <div className="comparison-modal-summary">
          <div>
            <span>Fichas vencidas</span>
            <strong>{overdueComparisonRecords.length}</strong>
          </div>
          <div>
            <span>No aparecen en Aguas</span>
            <strong>{overdueComparisonRecords.filter((record) => getRecordAguasPresenceLabel(record) === "No aparece en Aguas").length}</strong>
          </div>
          <div>
            <span>Aparecen en Aguas</span>
            <strong>{overdueComparisonRecords.filter((record) => getRecordAguasPresenceLabel(record) === "Si aparece en Aguas").length}</strong>
          </div>
        </div>
        <section className="comparison-header-editor">
          <div className="comparison-header-editor-head">
            <strong>Encabezado de impresion</strong>
            <span>Edita solo el titulo del reporte, no cambia datos ni padrones.</span>
          </div>
          <label>
            <span>Etiqueta superior</span>
            <Input
              value={printComparisonHeader.kicker}
              onChange={(event) =>
                setPrintComparisonHeader((current) => ({ ...current, kicker: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Titulo principal</span>
            <Input
              value={printComparisonHeader.title}
              onChange={(event) =>
                setPrintComparisonHeader((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>
          <label className="is-wide">
            <span>Nota del encabezado</span>
            <Input
              value={printComparisonHeader.note}
              onChange={(event) =>
                setPrintComparisonHeader((current) => ({ ...current, note: event.target.value }))
              }
            />
          </label>
        </section>
        <div className="comparison-modal-scroll">
          {overdueComparisonRecords.length ? (
            <table className="comparison-modal-table">
              <thead>
                <tr>
                  <th>Clave catastral</th>
                  <th>Nombre</th>
                  <th>Barrio</th>
                  <th>Fecha ficha</th>
                  <th>Estado</th>
                  <th>Aguas</th>
                </tr>
              </thead>
              <tbody>
                {overdueComparisonRecords.map((record) => (
                  (() => {
                    const alcaldiaMatch = alcaldiaComparisonByClave.get(String(record.clave_catastral || "").trim()) || null;
                    return (
                      <tr key={`comparison-${record.id}`}>
                        <td>{record.clave_catastral || "--"}</td>
                        <td>{getRecordDisplayName(record, alcaldiaMatch)}</td>
                        <td>{getRecordBarrioName(record, "") || record.barrio_alcaldia || alcaldiaMatch?.caserio || alcaldiaMatch?.direccion || "--"}</td>
                        <td>{getRecordFichaDateLabel(record)}</td>
                        <td>
                          <span className="comparison-status-badge">Vencida</span>
                        </td>
                        <td>
                          <Badge variant={getRecordAguasPresenceLabel(record) === "Si aparece en Aguas" ? "secondary" : "destructive"}>
                            {getRecordAguasPresenceLabel(record)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <h3>Sin fichas vencidas</h3>
              <p>No hay registros vencidos para comparar en este momento.</p>
            </div>
          )}
        </div>
        <DialogFooter className="password-form-actions print-batch-footer">
          <Button type="button" variant="outline" onClick={() => setShowPrintComparisonModal(false)}>
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => handlePrintAguasComparisonList(overdueComparisonRecords)}
            disabled={printingComparison || !overdueComparisonRecords.length}
          >
            <Icon name="records" />
            {printingComparison ? "Preparando..." : "Imprimir lista comparativa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
