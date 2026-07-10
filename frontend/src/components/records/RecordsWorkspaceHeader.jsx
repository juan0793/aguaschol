import { Icon } from "../Icon";
import { Button } from "@/components/ui/button";

const RecordsWorkspaceHeader = ({
  selectedFlow,
  pendingBuckets,
  loadingAviso,
  processingRecordId,
  showPreview,
  onNew,
  onPrint,
  onTogglePreview,
  onSelectBucket
}) => (
  <section className="records-workspace-header no-print">
    <div className="records-title-row">
      <div>
        <p className="sheet-kicker">Gestion de fichas</p>
        <h2><Icon name="records" className="title-icon" />Fichas registradas</h2>
        <p className="workspace-title">
          Valida la clave, completa la ficha, adjunta evidencia y genera el aviso.
        </p>
      </div>
      <div className="records-main-actions">
        <Button type="button" onClick={onNew}>
          <Icon name="plus" />
          Nueva ficha
        </Button>
        <Button type="button" variant="outline" onClick={onPrint}>
          <Icon name="records" />
          Imprimir
        </Button>
        <Button type="button" variant="outline" onClick={onTogglePreview}>
          <Icon name="records" />
          {showPreview ? "Ocultar vista" : "Vista previa"}
        </Button>
      </div>
    </div>

    <div className={`record-flow-panel ${selectedFlow.tone}`}>
      <div>
        <span className="record-flow-label">{selectedFlow.label}</span>
        <strong>{selectedFlow.title}</strong>
        <p>{selectedFlow.detail}</p>
      </div>
      <div className="record-flow-actions">
        <Button type="button" onClick={selectedFlow.action} disabled={loadingAviso}>
          {selectedFlow.primary}
        </Button>
        {selectedFlow.secondary ? (
          <Button
            type="button"
            variant="outline"
            onClick={selectedFlow.secondaryAction}
            disabled={loadingAviso || Boolean(processingRecordId)}
          >
            {selectedFlow.secondary}
          </Button>
        ) : null}
      </div>
    </div>

    <div className="pending-tray" aria-label="Bandeja de pendientes">
      {pendingBuckets.map((bucket) => (
        <button
          key={bucket.key}
          type="button"
          className="pending-card"
          onClick={() => onSelectBucket(bucket)}
        >
          <span>{bucket.title}</span>
          <strong>{bucket.count}</strong>
          <small>{bucket.helper}</small>
        </button>
      ))}
    </div>
  </section>
);

export default RecordsWorkspaceHeader;
