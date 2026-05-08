import { Icon } from "../Icon";

const getReviewLabel = (record) => {
  if (record?.estado_padron === "reportada") return "Reportada";
  if (record?.estado_padron === "varios_padrones") return "Varios padrones";
  return "Pendiente";
};

const RecordActionBar = ({
  form,
  saving,
  loadingAviso,
  isDirty,
  onSave,
  onNew,
  onGenerateAviso,
  onPrintFicha,
  onPrintAviso,
  onSendReview
}) => (
  <div className="record-action-bar">
    <div className="record-action-bar-copy">
      <span className="sheet-kicker">Modo Fichas</span>
      <strong>{form.clave_catastral || "Ficha nueva"}</strong>
      <div>
        <span className={`record-status-chip ${isDirty ? "is-warning" : "is-success"}`}>
          {saving ? "Guardando" : isDirty ? "Cambios sin guardar" : "Sincronizada"}
        </span>
        <span className={`record-status-chip is-${form.estado_padron || "clandestino"}`}>{getReviewLabel(form)}</span>
      </div>
    </div>
    <div className="record-action-bar-buttons">
      <button type="button" onClick={onSave} disabled={saving}>
        <Icon name="success" />
        {saving ? "Guardando..." : "Guardar"}
      </button>
      <button type="button" className="button-secondary" onClick={onNew}>
        <Icon name="plus" />
        Nueva ficha
      </button>
      <button type="button" className="button-secondary" onClick={onGenerateAviso} disabled={loadingAviso}>
        <Icon name="records" />
        Preparar aviso
      </button>
      <button type="button" className="button-secondary" onClick={onPrintFicha}>
        <Icon name="records" />
        Imprimir ficha
      </button>
      <button type="button" className="button-secondary" onClick={onPrintAviso}>
        <Icon name="records" />
        Imprimir aviso
      </button>
      <button type="button" className="button-secondary" onClick={onSendReview}>
        <Icon name="activity" />
        Enviar para revision
      </button>
    </div>
  </div>
);

export default RecordActionBar;
