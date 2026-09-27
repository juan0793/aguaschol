export default function ConfirmDeleteUserModal({ model }) {
  const { handleDeleteUser, pendingDeleteUser, setPendingDeleteUser } = model;

  return (
    <div className="password-modal-backdrop">
      <div className="password-modal-card">
        <div className="password-modal-head">
          <p className="eyebrow">Confirmacion requerida</p>
          <h2>Eliminar usuario</h2>
          <p className="lead">
            Se eliminara el registro de <strong>{pendingDeleteUser.full_name}</strong> y se cerraran sus sesiones activas.
          </p>
        </div>
        <div className="password-form-actions">
          <button type="button" className="button-secondary" onClick={() => setPendingDeleteUser(null)}>
            Cancelar
          </button>
          <button type="button" className="button-danger" onClick={() => handleDeleteUser(pendingDeleteUser)}>
            Eliminar usuario
          </button>
        </div>
      </div>
    </div>
  );
}
