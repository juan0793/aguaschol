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

const AVATAR_TONES = ["blue", "teal", "gold", "indigo", "cyan"];

function avatarTone(user) {
  const key = String(user.id ?? user.username ?? user.full_name ?? "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const USER_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "online", label: "En línea" },
  { key: "admin", label: "Administradores" },
  { key: "operator", label: "Operadores" }
];

export function UsersSidebar({
  loadingUsers,
  safeUsers,
  selectedUser,
  setSelectedUserId,
  roleLabel
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const visibleUsers = safeUsers
    .filter((user) => {
      if (activeFilter === "online") return user.is_online;
      if (activeFilter === "admin") return user.role === "admin";
      if (activeFilter === "operator") return user.role === "operator";
      return true;
    })
    .filter((user) =>
      [user.full_name, user.email, user.username].some((value) =>
        String(value || "").toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))
      )
    );

  return (
    <aside className="sidebar no-print users-sidebar-panel">
      <div className="panel-header users-sidebar-head">
        <div>
          <p className="sheet-kicker">Control de accesos</p>
          <h2>Usuarios</h2>
        </div>
        <span className="panel-pill">{safeUsers.length}</span>
      </div>
      <label className="users-search">
        <span className="sr-only">Buscar usuarios</span>
        <Icon name="search" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nombre, correo o usuario"
        />
        <button
          type="button"
          className="users-search-reset"
          onClick={() => {
            setQuery("");
            setActiveFilter("all");
          }}
          aria-label="Limpiar busqueda y filtros"
          title="Limpiar busqueda y filtros"
        >
          <Icon name="filter" />
        </button>
      </label>
      <div className="users-filter-row" role="tablist" aria-label="Filtrar usuarios">
        {USER_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.key}
            className={`users-filter-chip ${activeFilter === filter.key ? "is-active" : ""}`}
            onClick={() => setActiveFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {loadingUsers ? <p className="helper-text">Cargando usuarios...</p> : null}
      <div className="record-list users-list">
        {visibleUsers.length ? (
          visibleUsers.map((user) => (
            <article
              key={user.id}
              className={`record-card info-card user-list-card ${selectedUser?.id === user.id ? "is-selected" : ""}`}
            >
              <button type="button" className="user-list-main" onClick={() => setSelectedUserId(user.id)}>
                <span className={`user-list-avatar users-avatar-tone-${avatarTone(user)}`} aria-hidden="true">
                  {String(user.full_name || user.username || "U").trim().charAt(0).toUpperCase()}
                </span>
                <div className="record-card-top user-card-top">
                  <strong className="user-name">{user.full_name}</strong>
                  <span className="record-badge user-role-badge">{roleLabel(user.role)}</span>
                </div>
                <span className="user-email"><Icon name="mail" /><span>{user.email}</span></span>
                <span className={`user-status-line ${user.is_online ? "is-online" : ""}`}>
                  <i className="user-status-dot" aria-hidden="true" />
                  {user.is_online ? "En línea" : "Desconectado"}
                </span>
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>{query ? "Sin coincidencias" : "Sin usuarios registrados"}</h3>
            <p>{query ? "Prueba con otro nombre, correo o usuario." : "Crea el primer acceso para habilitar el trabajo del equipo."}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

const ROLE_DESCRIPTIONS = {
  admin: "Control total: gestiona usuarios, padrones y configuraciones del sistema.",
  operator: "Puede gestionar operaciones diarias del sistema.",
  validadora_campo: "Valida y confirma la informacion levantada en campo.",
  transport: "Registra rutas y recolecciones de transporte."
};

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
  setPendingDeleteUser,
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
          <span className="users-hero-icon" aria-hidden="true"><Icon name="users" /></span>
          <div>
            <p className="sheet-kicker">Administracion de usuarios</p>
            <h2>Accesos del equipo</h2>
            <p className="workspace-title">
              Administra cuentas, perfiles, sesiones activas y accesos al sistema desde un solo lugar.
            </p>
          </div>
          <div className="users-hero-actions">
            {selectedUser ? (
              <button type="button" className="button-secondary" onClick={() => setDetailOpen(true)}>
                <Icon name="records" />
                Ver detalle
              </button>
            ) : null}
          </div>
          <div className="users-hero-motif" aria-hidden="true">
            <p className="users-hero-tagline">
              Agua que nos une
              <small>Personas que la hacen posible</small>
            </p>
            <svg viewBox="0 0 220 100" className="users-hero-illustration">
              <path d="M0 78 20 60 38 74 58 48 82 70 104 40 128 66 152 46 176 68 200 52 220 66V100H0Z" className="users-hero-mountain" />
              <path d="M0 88q20-8 40 0t40 0 40 0 40 0 40 0 40 0V100H0Z" className="users-hero-water" />
            </svg>
          </div>
        </div>

        <div className="users-metric-grid no-print">
          <article>
            <span className="users-metric-icon"><Icon name="users" /></span>
            <div className="users-metric-copy">
              <p className="users-metric-value"><strong>{safeUsers.length}</strong> usuarios</p>
              <small>Cuentas registradas</small>
            </div>
          </article>
          <article className="is-live">
            <span className="users-metric-icon"><Icon name="activity" /></span>
            <div className="users-metric-copy">
              <p className="users-metric-value"><strong>{safeUsers.filter((user) => user.is_online).length}</strong> en línea</p>
              <small>Sesiones activas ahora</small>
            </div>
          </article>
          <article className="is-admin">
            <span className="users-metric-icon"><Icon name="auth" /></span>
            <div className="users-metric-copy">
              <p className="users-metric-value"><strong>{safeUsers.filter((user) => user.role === "admin").length}</strong> administradores</p>
              <small>Con control total</small>
            </div>
          </article>
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
              <span className="is-active"><i>1</i> Datos</span>
              <span><i>2</i> Perfil</span>
              <span><i>3</i> Entrega</span>
            </div>
            <section className="sheet-section users-form-section">
              <div className="users-form-section-head">
                <div>
                  <h3>Datos del usuario</h3>
                  <p>El sistema genera usuario y contrasena temporal y prepara el correo de bienvenida.</p>
                </div>
              </div>
              <div className="form-grid users-form-grid">
                <label className="users-input-icon">
                  <span>Nombre completo</span>
                  <span className="users-input-wrap">
                    <Icon name="users" />
                    <input name="full_name" value={userForm.full_name} onChange={handleUserFormChange} required />
                  </span>
                </label>
                <label className="users-input-icon">
                  <span>Correo electronico</span>
                  <span className="users-input-wrap">
                    <Icon name="mail" />
                    <input name="email" type="email" value={userForm.email} onChange={handleUserFormChange} required />
                  </span>
                </label>
                <label className="users-input-icon">
                  <span>Perfil</span>
                  <span className="users-input-wrap">
                    <Icon name="auth" />
                    <select name="role" value={userForm.role} onChange={handleUserFormChange}>
                      <option value="operator">Operador</option>
                      <option value="validadora_campo">Validacion campo</option>
                      <option value="transport">Transporte</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </span>
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
                <h2>Informacion del acceso</h2>
              </div>
              {selectedUser ? (
                <button
                  type="button"
                  className="users-detail-more"
                  onClick={() => setDetailOpen(true)}
                  aria-label="Ver detalle completo"
                  title="Ver detalle completo"
                >
                  <Icon name="more" />
                </button>
              ) : null}
            </div>
            <article className="document-sheet users-summary-sheet">
              {selectedUser ? (
                <>
                  <div className="users-selected-profile">
                    <span className={`user-list-avatar users-avatar-tone-${avatarTone(selectedUser)}`} aria-hidden="true">
                      {String(selectedUser.full_name || selectedUser.username || "U").trim().charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong className="user-name">{selectedUser.full_name}</strong>
                      <p className="user-email">{selectedUser.email}</p>
                    </div>
                    <span className="record-badge user-role-badge">{roleLabel(selectedUser.role)}</span>
                  </div>
                  <div className="users-info-tiles">
                    <div className="users-info-tile">
                      <Icon name="users" />
                      <div>
                        <span>Usuario</span>
                        <strong>{selectedUser.username}</strong>
                      </div>
                    </div>
                    <div className="users-info-tile">
                      <Icon name="history" />
                      <div>
                        <span>Ultimo acceso</span>
                        <strong>{formatDateTime(selectedUser.last_login_at)}</strong>
                      </div>
                    </div>
                    <div className="users-info-tile">
                      <Icon name="wifi" />
                      <div>
                        <span>Estado en linea</span>
                        <strong className={`user-status-line ${selectedUser.is_online ? "is-online" : ""}`}>
                          <i className="user-status-dot" aria-hidden="true" />
                          {selectedUser.is_online ? "Conectado" : "Sin conexion"}
                        </strong>
                      </div>
                    </div>
                    <div className="users-info-tile">
                      <Icon name="activity" />
                      <div>
                        <span>Sesiones activas</span>
                        <strong>{selectedUser.active_sessions || 0}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="users-permissions-block">
                    <Icon name="auth" />
                    <div>
                      <p className="users-permissions-title">Permisos y rol</p>
                      <span className="record-badge user-role-badge">{roleLabel(selectedUser.role)}</span>
                      <p className="users-permissions-copy">
                        {ROLE_DESCRIPTIONS[selectedUser.role] || "Permisos asignados para este perfil."}
                      </p>
                    </div>
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
                  <div className="users-detail-actions-row no-print">
                    <button type="button" className="button-secondary" onClick={() => setDetailOpen(true)}>
                      <Icon name="edit" />
                      Editar usuario
                    </button>
                    {session?.user?.id !== selectedUser.id ? (
                      <button type="button" className="button-secondary" onClick={() => handleResetUserPassword(selectedUser)}>
                        <Icon name="refresh" />
                        Restablecer contrasena
                      </button>
                    ) : null}
                    {session?.user?.id !== selectedUser.id ? (
                      <button type="button" className="button-danger" onClick={() => setPendingDeleteUser(selectedUser)}>
                        <Icon name="trash" />
                        Eliminar
                      </button>
                    ) : null}
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
