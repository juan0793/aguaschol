import { Icon } from "./Icon";

export default function PasswordChangeModal({ model }) {
  const {
    changingPassword,
    handleChangePassword,
    handlePasswordFormChange,
    mustChangePassword,
    passwordFeedback,
    passwordForm,
    setShowPasswordModal
  } = model;

  return (
    <div className={`password-modal-backdrop ${mustChangePassword ? "is-forced" : ""}`}>
      <div className="password-modal-card">
        <div className="password-modal-head">
          <p className="eyebrow">{mustChangePassword ? "Acción requerida" : "Seguridad de acceso"}</p>
          <h2>{mustChangePassword ? "Cambia tu contraseña temporal" : "Cambiar contraseña"}</h2>
          <p className="lead">
            {mustChangePassword
              ? "Antes de continuar, define una nueva contraseña personal para proteger tu cuenta."
              : "Actualiza tu contraseña cuando lo necesites."}
          </p>
        </div>
        <form className="password-form" onSubmit={handleChangePassword}>
          {passwordFeedback ? <p className="password-feedback">{passwordFeedback}</p> : null}
          <label>
            <span>Contraseña actual</span>
            <input
              name="current_password"
              type="password"
              value={passwordForm.current_password}
              onChange={handlePasswordFormChange}
              required
            />
          </label>
          <label>
            <span>Nueva contraseña</span>
            <input
              name="new_password"
              type="password"
              value={passwordForm.new_password}
              onChange={handlePasswordFormChange}
              minLength={8}
              required
            />
          </label>
          <label>
            <span>Confirmar nueva contraseña</span>
            <input
              name="confirm_password"
              type="password"
              value={passwordForm.confirm_password}
              onChange={handlePasswordFormChange}
              required
            />
          </label>
          <div className="password-form-actions">
            <button type="submit" disabled={changingPassword}>
              <Icon name="auth" />
              {changingPassword ? "Actualizando..." : "Guardar nueva contraseña"}
            </button>
            {!mustChangePassword ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowPasswordModal(false)}
              >
                Cerrar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
