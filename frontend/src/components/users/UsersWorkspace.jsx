import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

function TelegramAccessPanel({ apiFetch, formatDateTime, showAlert }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [form, setForm] = useState({ chat_id: "", display_name: "" });

  const loadChats = async () => {
    try {
      const response = await apiFetch("/users/telegram-chats");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron cargar los accesos de Telegram.");
      setChats(Array.isArray(data) ? data : []);
    } catch (error) {
      showAlert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  const addChat = async (event) => {
    event.preventDefault();
    setSavingId("new");
    try {
      const response = await apiFetch("/users/telegram-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo autorizar el chat.");
      setForm({ chat_id: "", display_name: "" });
      showAlert("Chat de Telegram autorizado.");
      await loadChats();
    } catch (error) {
      showAlert(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const changeStatus = async (chat, status) => {
    setSavingId(chat.id);
    try {
      const response = await apiFetch(`/users/telegram-chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo actualizar el acceso.");
      setChats((current) => current.map((item) => (item.id === data.id ? data : item)));
      showAlert(status === "allowed" ? "Acceso de Telegram autorizado." : "Acceso de Telegram revocado.");
    } catch (error) {
      showAlert(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const removeChat = async (chat) => {
    if (!window.confirm(`¿Eliminar el chat ${chat.display_name || chat.chat_id}?`)) return;
    setSavingId(chat.id);
    try {
      const response = await apiFetch(`/users/telegram-chats/${chat.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo eliminar el chat.");
      setChats((current) => current.filter((item) => item.id !== chat.id));
      showAlert("Chat eliminado. Si vuelve a escribir, aparecerá como solicitud pendiente.");
    } catch (error) {
      showAlert(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const counts = chats.reduce(
    (result, chat) => ({ ...result, [chat.status]: (result[chat.status] || 0) + 1 }),
    { pending: 0, allowed: 0, revoked: 0 }
  );

  return (
    <section className="telegram-access-panel no-print">
      <div className="telegram-access-head">
        <div>
          <p className="sheet-kicker">Bot conectado</p>
          <h2><Icon name="telegram" className="title-icon" />Accesos de Telegram</h2>
          <p>Autoriza chats al instante. Los cambios se guardan en MySQL y no requieren un nuevo despliegue.</p>
        </div>
        <div className="telegram-access-stats">
          <span><strong>{counts.pending}</strong> Pendientes</span>
          <span className="is-allowed"><strong>{counts.allowed}</strong> Autorizados</span>
          <button type="button" className="button-secondary" onClick={loadChats} disabled={loading}>
            <Icon name="refresh" />Actualizar
          </button>
        </div>
      </div>

      <form className="telegram-add-form" onSubmit={addChat}>
        <label>
          <span>ID del chat</span>
          <input
            inputMode="numeric"
            placeholder="Ej. 123456789"
            value={form.chat_id}
            onChange={(event) => setForm((current) => ({ ...current, chat_id: event.target.value }))}
            required
          />
        </label>
        <label>
          <span>Nombre para identificarlo</span>
          <input
            placeholder="Ej. Supervisor de campo"
            value={form.display_name}
            onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
          />
        </label>
        <button type="submit" disabled={savingId === "new"}>
          <Icon name="plus" />{savingId === "new" ? "Agregando..." : "Autorizar chat"}
        </button>
      </form>

      <div className="telegram-chat-grid">
        {loading ? <p className="helper-text">Cargando accesos...</p> : null}
        {!loading && !chats.length ? (
          <div className="empty-state telegram-empty-state">
            <Icon name="telegram" />
            <h3>Sin chats registrados</h3>
            <p>Cuando alguien escriba al bot, su solicitud aparecerá aquí automáticamente.</p>
          </div>
        ) : null}
        {chats.map((chat) => (
          <article key={chat.id} className={`telegram-chat-card is-${chat.status}`}>
            <div className="telegram-chat-icon"><Icon name="telegram" /></div>
            <div className="telegram-chat-copy">
              <div>
                <strong>{chat.display_name || "Chat de Telegram"}</strong>
                <span className={`telegram-status is-${chat.status}`}>
                  {chat.status === "allowed" ? "Autorizado" : chat.status === "revoked" ? "Revocado" : "Pendiente"}
                </span>
              </div>
              <code>{chat.chat_id}</code>
              <small>
                {chat.username ? `@${chat.username} · ` : ""}{chat.chat_type === "private" ? "Chat privado" : chat.chat_type}
                {chat.last_seen_at ? ` · Visto ${formatDateTime(chat.last_seen_at)}` : ""}
              </small>
            </div>
            <div className="telegram-chat-actions">
              {chat.status !== "allowed" ? (
                <button type="button" onClick={() => changeStatus(chat, "allowed")} disabled={savingId === chat.id}>
                  <Icon name="success" />Autorizar
                </button>
              ) : (
                <button type="button" className="button-secondary" onClick={() => changeStatus(chat, "revoked")} disabled={savingId === chat.id}>
                  <Icon name="auth" />Revocar
                </button>
              )}
              <button type="button" className="button-danger" onClick={() => removeChat(chat)} disabled={savingId === chat.id}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

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
  apiFetch,
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
  roleLabel,
  safeUsers,
  showAlert
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
              Administra cuentas, perfiles, sesiones activas y accesos al bot desde un solo lugar.
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

        <div className="users-metric-grid no-print">
          <article><span>Usuarios</span><strong>{safeUsers.length}</strong><small>Cuentas registradas</small></article>
          <article><span>En línea</span><strong>{safeUsers.filter((user) => user.is_online).length}</strong><small>Sesiones activas ahora</small></article>
          <article><span>Administradores</span><strong>{safeUsers.filter((user) => user.role === "admin").length}</strong><small>Con control total</small></article>
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

        <TelegramAccessPanel apiFetch={apiFetch} formatDateTime={formatDateTime} showAlert={showAlert} />
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
