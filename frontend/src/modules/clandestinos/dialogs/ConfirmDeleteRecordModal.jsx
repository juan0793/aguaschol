export default function ConfirmDeleteRecordModal({ model }) {
  const { handleDeleteArchivedRecord, pendingDeleteRecord, setPendingDeleteRecord } = model;

  return (
    <div className="password-modal-backdrop">
      <div className="password-modal-card">
        <div className="password-modal-head">
          <p className="eyebrow">Registro archivado</p>
          <h2>Eliminar ficha archivada</h2>
          <p className="lead">
            Se eliminara definitivamente la ficha <strong>{pendingDeleteRecord.clave_catastral}</strong>.
            Esta accion solo aplica al registro archivado y no se puede deshacer.
          </p>
        </div>
        <div className="password-form-actions">
          <button type="button" className="button-secondary" onClick={() => setPendingDeleteRecord(null)}>
            Cancelar
          </button>
          <button type="button" className="button-danger" onClick={() => handleDeleteArchivedRecord(pendingDeleteRecord)}>
            Eliminar ficha
          </button>
        </div>
      </div>
    </div>
  );
}
