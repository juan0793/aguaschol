import { useState } from "react";
import { Icon } from "../Icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export function UsersSidebar({
  loadingUsers,
  safeUsers,
  selectedUser,
  session,
  setPendingDeleteUser,
  setSelectedUserId,
  formatDateTime,
  roleLabel
}) {
  return (
    <aside className="sidebar no-print users-sidebar-panel">
      <div className="panel-header users-sidebar-head">
        <div>
          <p className="sheet-kicker">Control de accesos</p>
          <h2>Usuarios</h2>
        </div>
        <span className="panel-pill">{safeUsers.length}</span>
      </div>
      {loadingUsers ? <p className="helper-text">Cargando usuarios...</p> : null}
      <div className="record-list users-list">
        {safeUsers.length ? (
          safeUsers.map((user) => (
            <article
              key={user.id}
              className={`record-card info-card user-list-card ${selectedUser?.id === user.id ? "is-selected" : ""}`}
            >
              <button type="button" className="user-list-main" onClick={() => setSelectedUserId(user.id)}>
                <div className="record-card-top user-card-top">
                  <strong className="user-name">{user.full_name}</strong>
                  <div className="user-badge-stack">
                    <span className={`record-badge ${user.is_online ? "is-online" : ""}`}>
                      {user.is_online ? "En linea" : roleLabel(user.role)}
                    </span>
                    <span className="record-badge">{roleLabel(user.role)}</span>
                  </div>
                </div>
                <span className="user-email">{user.email}</span>
                <small className="user-meta">
                  Usuario: {user.username} - Ultimo acceso: {formatDateTime(user.last_login_at)}
                </small>
              </button>
              <div className="user-card-actions">
                <span className="record-badge">{user.active_sessions || 0} sesiones</span>
                {session?.user?.id !== user.id ? (
                  <button
                    type="button"
                    className="button-danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDeleteUser(user);
                    }}
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>Sin usuarios registrados</h3>
            <p>Crea el primer acceso para habilitar el trabajo del equipo.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function UsersContent({
  creatingUser,
  handleCreateUser,
  handleResetUserPassword,
  handleUpdateUserRole,
  handleUserFormChange,
  latestUserResult,
  savingUserRoleId,
  selectedUser,
  session,
  setUserForm,
  userForm,
  formatDateTime,
  roleLabel
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <section className="users-workspace-shell">
        <div className="users-hero-strip no-print">
          <div>
            <p className="sheet-kicker">Administracion de usuarios</p>
            <h2><Icon name="users" className="title-icon" />Accesos del equipo</h2>
            <p className="workspace-title">
              Alta de usuarios con envio por correo, perfiles de acceso y control de sesiones activas.
            </p>
          </div>
          <div className="users-hero-actions">
            <span className="panel-pill">Correo transaccional</span>
            {selectedUser ? (
              <button type="button" className="button-secondary" onClick={() => setDetailOpen(true)}>
                <Icon name="records" />
                Ver detalle
              </button>
            ) : null}
          </div>
        </div>

        <div className="users-workspace-grid">
          <form className="sheet users-form-card no-print" onSubmit={handleCreateUser}>
            <div className="admin-section-head">
              <div>
                <p className="sheet-kicker">Nuevo acceso</p>
                <h2><Icon name="plus" className="title-icon" />Crear usuario</h2>
              </div>
              <span className="panel-pill">Perfil inicial</span>
            </div>
            <div className="users-create-guide" aria-label="Flujo de creacion de usuario">
              <span><Icon name="users" /> Datos</span>
              <span><Icon name="auth" /> Perfil</span>
              <span><Icon name="success" /> Entrega</span>
            </div>
            <section className="sheet-section users-form-section">
              <div className="users-form-section-head">
                <div>
                  <h3>Datos del usuario</h3>
                  <p>El sistema genera credenciales temporales y prepara el correo de bienvenida.</p>
                </div>
              </div>
              <div className="form-grid users-form-grid">
                <label>
                  <span>Nombre completo</span>
                  <input name="full_name" value={userForm.full_name} onChange={handleUserFormChange} required />
                </label>
                <label>
                  <span>Correo electronico</span>
                  <input name="email" type="email" value={userForm.email} onChange={handleUserFormChange} required />
                </label>
                <label>
                  <span>Perfil</span>
                  <select name="role" value={userForm.role} onChange={handleUserFormChange}>
                    <option value="operator">Operador</option>
                    <option value="validadora_campo">Validacion campo</option>
                    <option value="transport">Transporte</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
              </div>
              <div className="users-role-hint">
                <Icon name="auth" />
                <span>Usa administrador solo para personal que deba gestionar usuarios, padrones y configuraciones.</span>
              </div>
            </section>
            <div className="action-row users-action-row">
              <button type="submit" disabled={creatingUser}>
                <Icon name="plus" />
                {creatingUser ? "Creando..." : "Crear usuario"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  setUserForm({
                    full_name: "",
                    email: "",
                    role: "operator"
                  })
                }
              >
                <Icon name="refresh" />
                Limpiar
              </button>
            </div>
          </form>

          <section className="preview-panel users-detail-card">
            <div className="admin-section-head">
              <div>
                <p className="sheet-kicker">Detalle del usuario</p>
                <h2><Icon name="success" className="title-icon" />Informacion del acceso</h2>
              </div>
              {selectedUser ? <span className="panel-pill">{selectedUser.username}</span> : null}
            </div>
            <article className="document-sheet users-summary-sheet">
              {selectedUser ? (
                <>
                  <div className="users-selected-profile">
                    <div>
                      <span className={`users-status-dot ${selectedUser.is_online ? "is-online" : ""}`} />
                      <strong className="user-name">{selectedUser.full_name}</strong>
                      <p className="user-email">{selectedUser.email}</p>
                    </div>
                    <span className="record-badge">{roleLabel(selectedUser.role)}</span>
                  </div>
                  <div className="users-summary-grid">
                    <p className="user-detail-line"><strong>Usuario:</strong> <span className="user-meta-inline">{selectedUser.username}</span></p>
                    <p><strong>Ultimo acceso:</strong> {formatDateTime(selectedUser.last_login_at)}</p>
                    <p><strong>Estado en linea:</strong> {selectedUser.is_online ? "Conectado" : "Sin conexion activa"}</p>
                    <p><strong>Sesiones activas:</strong> {selectedUser.active_sessions || 0}</p>
                  </div>
                  <div className="users-role-editor no-print">
                    <label>
                      <span>Cambiar perfil</span>
                      <select
                        value={selectedUser.role}
                        onChange={(event) => handleUpdateUserRole(selectedUser, event.target.value)}
                        disabled={session?.user?.id === selectedUser.id || savingUserRoleId === selectedUser.id}
                      >
                        <option value="operator">Operador</option>
                        <option value="validadora_campo">Validacion campo</option>
                        <option value="transport">Transporte</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </label>
                    <small>
                      {session?.user?.id === selectedUser.id
                        ? "Tu propio perfil no se cambia desde esta sesion."
                        : savingUserRoleId === selectedUser.id
                          ? "Guardando perfil..."
                          : "El cambio aplica incluso si el usuario esta en linea."}
                    </small>
                  </div>
                  <div className="users-card-footer">
                    <button type="button" className="button-secondary" onClick={() => setDetailOpen(true)}>
                      <Icon name="records" />
                      Abrir detalle completo
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <h3>Sin usuario seleccionado</h3>
                  <p>Selecciona un usuario del listado para ver su informacion detallada y administrar su acceso.</p>
                </div>
              )}
            </article>
          </section>
        </div>
      </section>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="users-detail-modal">
          <DialogHeader>
            <DialogTitle>Informacion del acceso</DialogTitle>
            <DialogDescription>
              Datos completos, estado de entrega y acciones administrativas del usuario seleccionado.
            </DialogDescription>
          </DialogHeader>
          {selectedUser ? (
            <div className="admin-result-grid users-modal-grid">
              <div className="document-block">
                <h4>Datos generales</h4>
                <p className="user-detail-line"><strong>Nombre:</strong> <span className="user-name">{selectedUser.full_name}</span></p>
                <p className="user-detail-line"><strong>Correo:</strong> <span className="user-email">{selectedUser.email}</span></p>
                <p className="user-detail-line"><strong>Usuario:</strong> <span className="user-meta-inline">{selectedUser.username}</span></p>
                <p><strong>Perfil:</strong> {roleLabel(selectedUser.role)}</p>
                <label className="users-role-editor users-role-editor-compact">
                  <span>Cambiar perfil</span>
                  <select
                    value={selectedUser.role}
                    onChange={(event) => handleUpdateUserRole(selectedUser, event.target.value)}
                    disabled={session?.user?.id === selectedUser.id || savingUserRoleId === selectedUser.id}
                  >
                    <option value="operator">Operador</option>
                    <option value="validadora_campo">Validacion campo</option>
                    <option value="transport">Transporte</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
                <p><strong>Ultimo acceso:</strong> {formatDateTime(selectedUser.last_login_at)}</p>
                <p><strong>Estado en linea:</strong> {selectedUser.is_online ? "Conectado" : "Sin conexion activa"}</p>
                <p><strong>Sesiones activas:</strong> {selectedUser.active_sessions || 0}</p>
              </div>
              <div className="document-block">
                <h4>Estado y entrega</h4>
                <div className="user-card-actions user-detail-actions">
                  {session?.user?.id !== selectedUser.id ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => handleResetUserPassword(selectedUser)}
                    >
                      <Icon name="refresh" />
                      Regenerar contrasena temporal
                    </button>
                  ) : null}
                </div>
                {latestUserResult?.user?.id === selectedUser.id ? (
                  <>
                    <p>
                      <strong>Estado de correo:</strong>{" "}
                      {latestUserResult.delivery?.sent
                        ? latestUserResult.delivery?.sandbox
                          ? "Enviado en sandbox"
                          : "Enviado"
                        : "Pendiente o manual"}
                    </p>
                    <p>
                      <strong>Detalle:</strong>{" "}
                      {latestUserResult.delivery?.reason || "La notificacion fue procesada correctamente."}
                    </p>
                    {latestUserResult.temp_password ? (
                      <p><strong>Contrasena temporal:</strong> {latestUserResult.temp_password}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p><strong>Estado:</strong> Usuario registrado en el sistema.</p>
                    <p><strong>Creado:</strong> {formatDateTime(selectedUser.created_at)}</p>
                    <p><strong>Actualizado:</strong> {formatDateTime(selectedUser.updated_at)}</p>
                    <p><strong>Cambio de contrasena:</strong> {selectedUser.force_password_change ? "Pendiente" : "Completado"}</p>
                  </>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <button type="button" className="button-secondary" onClick={() => setDetailOpen(false)}>
              Cerrar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
