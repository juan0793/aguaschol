import { Icon } from "../components/Icon";
import { NotificationCenter } from "../components/NotificationCenter.jsx";
import { abrirMisAsignaciones } from "../modules/clandestinos/hooks/useBanco";
import { formatMapDiaryLabel } from "../utils/datesAndBusiness";
import { getDefaultWorkspaceView } from "../utils/appShell";
import logoAguasCholuteca from "../assets/logo-aguas-choluteca.png";

// Pantallas cuya franja bajo la barra tiene contenido propio. En las demás la tarjeta
// quedaba vacía: la navegación del módulo vive en el menú lateral, y cuenta y
// contraseña en el menú del usuario. Entregas, Importación y Mi perfil solo
// repetían lo que ya dice la página.
const VISTAS_CON_FRANJA = ["dashboard", "logs", "records", "lookup", "map", "padron", "mapReports", "mapAnalytics", "users"];
// Franjas de solo texto: en el celular ese párrafo se oculta y la tarjeta quedaría vacía.
const VISTAS_SOLO_TEXTO = ["lookup"];

export default function AppHeader({ model }) {
  const {
    activeMapDiaryDateKey,
    adminInsight,
    adminWorkspaceSections,
    apiFetch,
    cargandoDatos,
    clandestinosBusy,
    clandestinosStatus,
    clandestinosUpdatedAt,
    currentModuleNavigation,
    dashboardPriorityItems,
    handleDownloadMapBriefPdf,
    handleDownloadMapCensusPdf,
    handleDownloadMapFieldPdf,
    handleDownloadMapReport,
    handleLocateUser,
    handleLogout,
    handlePrintMapBriefReport,
    handlePrintMapCensusReport,
    handlePrintMapFieldReport,
    handleVerifyFieldDebt,
    headerMeta,
    headerStats,
    isAdmin,
    isDirty,
    loadAuditLogs,
    loadMapPointContexts,
    loadMapPoints,
    loadPadronMeta,
    loadUsers,
    loadingFieldDebtReport,
    loadingLogs,
    loadingMapContexts,
    loadingMapPoints,
    locatingUser,
    lookupResult,
    mapDiaryGroups,
    mapReportData,
    mapReportPagination,
    mapReportPrintData,
    moduleNavigationItems,
    onlineUsers,
    primaryModuleNavigationItems,
    resetReportMapDraft,
    safeAuditLogs,
    search,
    secondaryModuleNavigationItems,
    session,
    setClandestinosCommand,
    setMapReportPage,
    setNotificationUserId,
    setSearch,
    setShowMobileModuleMenu,
    setShowPasswordModal,
    setShowUserMenu,
    setUnreadMessagesCount,
    setWorkspaceView,
    showAlert,
    showMobileModuleMenu,
    showUserMenu,
    unreadMessagesCount,
    uploadingPadron,
    visibleMapPoints,
    workspaceView,
    abrirActividadEquipo
  } = model;

  return (
    <header className={`hero app-chrome no-print ${isAdmin ? "hero-admin" : ""} ${workspaceView !== "dashboard" ? "hero-module" : ""} ${workspaceView === "logs" ? "hero-logs-terminal" : ""}`}>
      <div className="app-topbar">
        <button
          type="button"
          className="app-menu-button"
          onClick={() => setShowMobileModuleMenu((current) => !current)}
          aria-label={showMobileModuleMenu ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={showMobileModuleMenu}
          aria-controls="control-sidebar"
        >
          <Icon name="menu" />
        </button>
        {/* En el tablero la barra lleva el título de la página. En los demás módulos
            el nombre ya está en el menú lateral y el título en la página: aquí solo va
            el logo circular, al centro, como atajo al inicio. El hueco guarda su celda
            en la rejilla para que la sesión no se mueva. */}
        {workspaceView === "dashboard" ? (
          <h1 className="app-topbar-title">{headerMeta.title}</h1>
        ) : (<>
          <span className="app-topbar-slot" aria-hidden="true" />
          <button
            type="button"
            className="app-topbar-brand is-logo-only"
            onClick={() => setWorkspaceView(getDefaultWorkspaceView(session?.user?.role))}
            aria-label="Aguas de Choluteca: ir al inicio"
            title="Ir al inicio"
          >
            <span className="app-brand-mark" aria-hidden="true">
              <img src={logoAguasCholuteca} alt="" className="app-topbar-logo" />
            </span>
          </button>
        </>)}
        <div className="app-topbar-kpis">
          {headerStats.map((stat) => (
            <span className="app-topbar-kpi" key={stat.label}>
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
            </span>
          ))}
        </div>
        <div className="app-topbar-session">
          {workspaceView !== "dashboard" ? <span className={`app-save-state ${isDirty ? "is-live" : ""}`}>
            {["lookup", "padron"].includes(workspaceView)
              ? workspaceView === "padron"
                ? uploadingPadron
                  ? "Actualizando padron"
                  : "Padron disponible"
                : lookupResult
                  ? lookupResult.exists
                    ? "Coincidencia encontrada"
                    : "Sin coincidencias"
                  : "Listo para consultar"
              : isDirty
                ? "Cambios sin guardar"
                : "Todo guardado"}
          </span> : null}
          <NotificationCenter
            apiFetch={apiFetch}
            session={session}
            unreadCount={unreadMessagesCount}
            onUnreadCountChange={setUnreadMessagesCount}
            showAlert={showAlert}
            onNotificationClick={() => setWorkspaceView("profile")}
            onEntregaNotification={(loteId) => {
              window.location.hash = `entregas/lotes?lote=${Number(loteId)}`;
              setWorkspaceView("entregas");
            }}
            onBancoNotification={() => {
              abrirMisAsignaciones();
              window.location.hash = "clandestinos/banco";
              setWorkspaceView("records");
            }}
            onTeamActivityClick={() => setWorkspaceView("teamActivity")}
            onTeamActivitySelect={abrirActividadEquipo}
            onNotificationSelect={(userId) => {
              setWorkspaceView("profile");
              setNotificationUserId(userId);
            }}
          />
          <button type="button" className="app-user-chip" aria-haspopup="menu" aria-expanded={showUserMenu} onClick={() => setShowUserMenu((current) => !current)}>
            <Icon name="users" />
            {session?.user?.full_name || session?.user?.username || "Sesion activa"}
          </button>
          {showUserMenu ? (
            <div className="app-user-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setWorkspaceView("profile"); setShowUserMenu(false); }}><Icon name="users" />Mi perfil</button>
              <button type="button" role="menuitem" onClick={() => { setShowPasswordModal(true); setShowUserMenu(false); }}><Icon name="auth" />Cambiar contraseña</button>
              <button type="button" role="menuitem" onClick={handleLogout}><Icon name="logout" />Cerrar sesión</button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`search-card ${headerMeta.cardClass} ${VISTAS_CON_FRANJA.includes(workspaceView) ? "" : "is-hidden"} ${VISTAS_SOLO_TEXTO.includes(workspaceView) ? "is-text-only" : ""}`}>
        <div className="search-card-head">
          <span>{workspaceView === "dashboard" ? "Espacios de trabajo" : "Navegacion del modulo"}</span>
          <span className="search-card-kicker">{workspaceView === "dashboard" ? headerMeta.kicker : currentModuleNavigation?.label || headerMeta.kicker}</span>
        </div>
        {workspaceView === "logs" ? (
          <div className="log-module-command">
            <div className="log-module-command-art" aria-hidden="true">
              <span />
            </div>
            <div>
              <span className="sheet-kicker">audit@aguaschol</span>
              <strong>~/historial --watch --workstream</strong>
              <p>Encabezado aislado para monitorear informacion de trabajo, eventos y trazabilidad sin mezclarlo visualmente con las fichas.</p>
            </div>
            <div className="log-module-command-stats">
              <span>{safeAuditLogs.length} logs</span>
              <span>{loadingLogs ? "sync" : "online"}</span>
            </div>
          </div>
        ) : workspaceView === "dashboard" ? (
          isAdmin ? (
            <div className="admin-console">
              <div className="admin-console-head">
                <div className="admin-identity-card">
                  <div className="session-chip admin-session-chip">
                    <Icon name="auth" />
                    <span>Administrador: {session?.user?.full_name || session?.user?.username || "--"}</span>
                  </div>
                  <div className="admin-identity-copy">
                    <strong>Centro de control operativo</strong>
                    <p>Accesos directos, prioridades del dia y lectura ejecutiva del sistema.</p>
                  </div>
                </div>
                <div className="admin-online-cluster">
                  <span className="admin-online-count">
                    <Icon name="success" />
                    {onlineUsers.length} en linea
                  </span>
                  <div className="admin-online-list">
                    {onlineUsers.length ? (
                      onlineUsers.slice(0, 5).map((user) => (
                        <span key={user.id} className="admin-online-user">
                          <i />
                          {user.full_name || user.username}
                        </span>
                      ))
                    ) : (
                      <span className="admin-online-user is-empty">Sin usuarios conectados</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="admin-console-shell">
                <div className="admin-console-menu">
                  {adminWorkspaceSections.map((section) => (
                    <section key={section.key} className="admin-workspace-section">
                      <div className="admin-workspace-section-head">
                        <div>
                          <strong>{section.title}</strong>
                          <small>{section.detail}</small>
                        </div>
                        <span className="admin-section-count">{section.items.length}</span>
                      </div>
                      <div className="admin-workspace-grid">
                        {section.items.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className={`admin-workspace-card ${item.tone} ${workspaceView === item.key ? "is-active" : ""}`}
                            onClick={() => setWorkspaceView(item.key)}
                          >
                            <span className="admin-workspace-icon"><Icon name={item.icon} /></span>
                            <div className="admin-workspace-copy">
                              <strong>{item.label}</strong>
                              <small>{item.meta}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                {adminInsight ? (
                  <aside className="admin-insight-card">
                    <span className="admin-insight-icon"><Icon name={adminInsight.icon} /></span>
                    <div>
                      <strong>{adminInsight.title}</strong>
                      <p>{adminInsight.detail}</p>
                    </div>
                  </aside>
                ) : null}
              </div>
              <div className="admin-priority-strip">
                {dashboardPriorityItems.map((item) => (
                  <article key={item.title} className={`admin-priority-card ${item.tone}`}>
                    <span className="admin-priority-icon"><Icon name={item.icon} /></span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <button type="button" className="button-secondary" onClick={() => setWorkspaceView(item.actionView)}>
                      {item.actionLabel}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="session-chip">
                <Icon name="auth" />
                <span>Usuario actual: {session?.user?.full_name || session?.user?.username || "--"}</span>
              </div>
              <div className="workspace-nav">
                {moduleNavigationItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={workspaceView === item.key ? "button-secondary active-filter" : "button-secondary"}
                    onClick={() => setWorkspaceView(item.key)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )
        ) : workspaceView === "entregas" ? null : (
          <div className="module-nav-wrap">
            <div className="module-topbar">
              <div className="module-topbar-copy">
                <div className="module-topbar-badges">
                  <span className="module-badge">
                    <Icon name={currentModuleNavigation?.icon || "records"} />
                    {currentModuleNavigation?.group === "operacion"
                      ? "Operación"
                      : currentModuleNavigation?.group === "control"
                        ? "Control"
                        : "Administracion"}
                  </span>
                  <span className="module-badge subtle">
                    <Icon name="users" />
                    {session?.user?.full_name || session?.user?.username || "Sesion activa"}
                  </span>
                </div>
                <p className="module-topbar-note">{currentModuleNavigation?.helper || headerMeta.kicker}</p>
              </div>
              <div className="module-topbar-actions">
                {isAdmin ? (
                  <span className="module-side-chip">
                    <Icon name="success" />
                    {onlineUsers.length} en linea
                  </span>
                ) : null}
                {isAdmin ? (
                  <button type="button" className="button-secondary desktop-home-button" onClick={() => setWorkspaceView("dashboard")}>
                    <Icon name="home" />
                    Tablero
                  </button>
                ) : null}
              </div>
            </div>

            <div className="module-nav desktop-only">
              {moduleNavigationItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`module-nav-tab ${workspaceView === item.key ? "is-active" : ""}`}
                  onClick={() => setWorkspaceView(item.key)}
                >
                  <span className="module-nav-icon"><Icon name={item.icon} /></span>
                  <span className="module-nav-copy">
                    <strong>{item.label}</strong>
                    <small>{item.helper}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="module-nav-mobile mobile-only">
              <div className="module-nav-mobile-primary">
                {primaryModuleNavigationItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`module-nav-pill ${workspaceView === item.key ? "is-active" : ""}`}
                    onClick={() => setWorkspaceView(item.key)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </button>
                ))}
                {secondaryModuleNavigationItems.length ? (
                  <button
                    type="button"
                    className={`module-nav-pill module-more-trigger ${showMobileModuleMenu ? "is-active" : ""}`}
                    onClick={() => setShowMobileModuleMenu((current) => !current)}
                  >
                    <Icon name="more" />
                    Mas
                  </button>
                ) : null}
              </div>
              {showMobileModuleMenu ? (
                <div className="module-nav-mobile-more">
                  {isAdmin ? (
                    <button type="button" className="module-nav-more-item" onClick={() => setWorkspaceView("dashboard")}>
                      <Icon name="home" />
                      <span>
                        <strong>Tablero</strong>
                        <small>Accesos rapidos</small>
                      </span>
                    </button>
                  ) : null}
                  {secondaryModuleNavigationItems.map((item) => (
                    <button key={item.key} type="button" className="module-nav-more-item" onClick={() => setWorkspaceView(item.key)}>
                      <Icon name={item.icon} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.helper}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
        {workspaceView === "dashboard" ? (
          <div className="workspace-summary dashboard-summary">
            <p className="workspace-title">
              Centro ejecutivo para arrancar el día con una lectura clara de fichas, campo, usuarios y actividad reciente.
            </p>
            <div className="dashboard-summary-chips">
              <span className="panel-pill">Admin en línea: {onlineUsers.length}</span>
              <span className="panel-pill">Jornada activa: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
              <span className="panel-pill">Bitácora: {mapDiaryGroups.length} días</span>
            </div>
            <div className="search-actions">
              <button type="button" className="button-secondary" onClick={() => setWorkspaceView("records")}>
                <Icon name="records" />
                Abrir fichas
              </button>
              <button type="button" className="button-secondary" onClick={() => setWorkspaceView("map")}>
                <Icon name="map" />
                Ir a campo
              </button>
              <button type="button" className="button-secondary" onClick={() => setWorkspaceView("logs")}>
                <Icon name="logs" />
                Revisar actividad
              </button>
              <button type="button" onClick={() => setWorkspaceView("executiveReport")}>
                <Icon name="activity" />
                Mapa de operaciones
              </button>
            </div>
          </div>
        ) : workspaceView === "records" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setClandestinosCommand({ type: "search", q: search.trim(), id: Date.now() });
            }}
          >
            <div className="search-row search-row-inline">
              <input
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ficha por clave, ej. 10-22-23"
                aria-label="Buscar ficha por clave catastral"
              />
              <button type="submit"><Icon name="search" />Buscar</button>
            </div>
            {/* Cuenta y contraseña viven en el menú del usuario; aquí va lo que
                sirve mientras se trabaja: si el módulo está cargando y qué tiene. */}
            <div className={`cl-activity ${clandestinosBusy || !clandestinosStatus ? "is-busy" : "is-idle"}`} role="status" aria-live="polite">
              <span className="cl-activity-track" aria-hidden="true"><span /></span>
              <span className="cl-activity-dot" aria-hidden="true" />
              <strong>{!clandestinosStatus ? "Cargando módulo…" : clandestinosBusy ? `${clandestinosStatus.label}…` : "Al día"}</strong>
              {clandestinosStatus?.summary ? <span className="cl-activity-summary">{clandestinosStatus.summary}</span> : null}
              {/* La hora se queda visible también mientras carga: así la barra
                  no cambia de largo (ni de alto) con cada consulta. */}
              {clandestinosUpdatedAt ? (
                <time dateTime={clandestinosUpdatedAt.toISOString()}>
                  Actualizado {clandestinosUpdatedAt.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}
                </time>
              ) : null}
              <button
                type="button"
                className="button-secondary cl-activity-refresh"
                disabled={clandestinosBusy}
                onClick={() => setClandestinosCommand({ type: "refresh", id: Date.now() })}
                title="Volver a cargar las fichas"
              >
                <Icon name="refresh" />
                Actualizar
              </button>
            </div>
          </form>
        ) : workspaceView === "lookup" ? (
          <div className="workspace-summary">
            <p className="workspace-title">
              Consulta el padrón maestro sin entrar al módulo de fichas. Acepta clave base `00-00-00` o `000-00-00`,
              y clave completa `00-00-00-00` o `000-00-00-00`.
            </p>
          </div>
        ) : workspaceView === "map" ? (
          <div className="workspace-summary fm-summary">
            <div className="fm-summary-copy">
              <p className="workspace-title">
                Módulo independiente para geolocalizar puntos técnicos en campo y dejar registro de cajas de aguas negras.
              </p>
              <p className="fm-summary-meta">
                <strong>Bitácora: {formatMapDiaryLabel(activeMapDiaryDateKey)}</strong>
                <span>{visibleMapPoints.length} {visibleMapPoints.length === 1 ? "punto" : "puntos"} de {mapDiaryGroups.length} jornadas registradas</span>
              </p>
            </div>
            <div className="fm-summary-actions">
              <div className="search-actions" role="group" aria-label="Acciones del mapa">
                <button type="button" className="button-secondary" onClick={handleLocateUser} disabled={locatingUser}>
                  <Icon name="map" />
                  {locatingUser ? "Ubicando..." : "Mi ubicación"}
                </button>
                <button type="button" className="button-secondary" onClick={() => loadMapPoints()} disabled={loadingMapPoints}>
                  <Icon name="refresh" />
                  {loadingMapPoints ? "Actualizando..." : "Refrescar puntos"}
                </button>
                <button type="button" className="button-secondary" onClick={handleDownloadMapReport}>
                  <Icon name="download" />
                  Descargar reporte<span className="fm-label-extra"> detallado</span>
                </button>
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("executiveReport")}>
                  <Icon name="records" />
                  Mapa de operaciones
                </button>
              </div>
            </div>
          </div>
        ) : workspaceView === "padron" ? (
          <div className="workspace-summary">
            <p className="workspace-title">
              Sube un nuevo Excel maestro para reemplazar el padrón usado por <strong>Buscar clave</strong>.
            </p>
            <div className="search-actions">
              <button type="button" className="button-secondary" onClick={loadPadronMeta}>
                <Icon name="refresh" />
                Ver estado actual
              </button>
            </div>
          </div>
        ) : workspaceView === "mapReports" ? (
          <div className="workspace-summary map-report-toolbar">
            <div className="map-report-toolbar-head">
              <div>
            <p className="workspace-title">
              Reporte administrativo compacto de puntos levantados en campo, agrupados por zona y listo para impresión institucional.
            </p>
            <div className="map-diary-summary">
              <span className="panel-pill">Bitácora: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
              <span className="helper-text">{visibleMapPoints.length} puntos y {mapReportPrintData.totalZones} barrios en el reporte.</span>
            </div>
            </div>
              <button type="button" onClick={handleVerifyFieldDebt} disabled={loadingFieldDebtReport}>
                <Icon name="search" />
                {loadingFieldDebtReport ? "Verificando..." : "Verificar deuda"}
              </button>
            </div>
            <div className="map-report-action-groups">
              <div className="map-report-action-group">
                <span>Preparar reporte</span>
                <div className="search-actions">
              <button type="button" className="button-secondary" onClick={() => loadMapPoints()} disabled={loadingMapPoints}>
                <Icon name="refresh" />
                {loadingMapPoints ? "Actualizando..." : "Refrescar puntos"}
              </button>
              <button type="button" className="button-secondary" onClick={() => loadMapPointContexts(visibleMapPoints)} disabled={loadingMapContexts}>
                <Icon name="map" />
                {loadingMapContexts ? "Ubicando zonas..." : "Actualizar zonas"}
              </button>
              <button type="button" className="button-secondary" onClick={resetReportMapDraft}>
                <Icon name="plus" />
                Nuevo punto visual
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setMapReportPage(1)}
                disabled={mapReportPagination.currentPage === 1}
              >
                <Icon name="records" />
                Ir a página 1
              </button>
                </div>
              </div>
              <div className="map-report-action-group">
                <span>Salida institucional</span>
                <div className="search-actions">
              <button type="button" className="button-secondary" onClick={handleDownloadMapFieldPdf}>
                <Icon name="records" />
                PDF con coordenadas
              </button>
              <button type="button" className="button-secondary" onClick={handleDownloadMapBriefPdf}>
                <Icon name="records" />
                PDF resumen ligero
              </button>
              <button type="button" className="button-secondary" onClick={handlePrintMapFieldReport}>
                <Icon name="records" />
                Imprimir con coordenadas
              </button>
              <button type="button" className="button-secondary" onClick={handlePrintMapBriefReport}>
                <Icon name="records" />
                Imprimir resumen
              </button>
              <button type="button" className="button-secondary" onClick={handleDownloadMapCensusPdf}>
                <Icon name="records" />
                PDF censo sin coordenadas
              </button>
              <button type="button" className="button-secondary" onClick={handlePrintMapCensusReport}>
                <Icon name="records" />
                Imprimir censo
              </button>
                </div>
              </div>
            </div>
          </div>
        ) : workspaceView === "mapAnalytics" ? (
          <div className="workspace-summary">
            <p className="workspace-title">
              Panel separado para revisar tendencias, zonas y precisión del levantamiento sin interferir con el reporte institucional.
            </p>
            <div className="map-diary-summary">
              <span className="panel-pill">Bitácora: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
              <span className="helper-text">{mapReportData.totalPoints} puntos en la jornada y {mapReportData.totalZones} zonas consolidadas.</span>
            </div>
            <div className="search-actions">
              <button type="button" className="button-secondary" onClick={() => loadMapPoints()} disabled={loadingMapPoints}>
                <Icon name="refresh" />
                {loadingMapPoints ? "Actualizando..." : "Refrescar puntos"}
              </button>
              <button type="button" className="button-secondary" onClick={() => loadMapPointContexts(visibleMapPoints)} disabled={loadingMapContexts}>
                <Icon name="map" />
                {loadingMapContexts ? "Ubicando zonas..." : "Actualizar zonas"}
              </button>
              <button type="button" className="button-secondary" onClick={() => setWorkspaceView("mapReports")}>
                <Icon name="records" />
                Ir al reporte
              </button>
            </div>
          </div>
        ) : ["users", "logs"].includes(workspaceView) ? (
          /* Esta barra pertenece a Usuarios y Auditoría. Antes era el tramo
             comodín del encadenado, así que asomaba en cualquier pantalla que
             no estuviera contemplada arriba. */
          <div className="workspace-summary">
            <p className="workspace-title">
              {workspaceView === "users"
                ? "Alta de usuarios con envío por correo y perfiles de acceso."
                : "Bitácora operativa con eventos de acceso, cambios y archivado."}
            </p>
            <div className={`search-actions ${workspaceView === "users" ? "users-toolbar-actions" : ""}`}>
              {workspaceView === "users" ? (
                <button type="button" className="button-secondary" onClick={loadUsers}>
                  <Icon name="refresh" />
                  Refrescar usuarios
                </button>
              ) : (
                <button type="button" className="button-secondary" onClick={loadAuditLogs}>
                  <Icon name="refresh" />
                  Refrescar historial
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {/* El hueco que dejó esa barra ahora avisa cuando la app está pidiendo
          datos: una línea fina en vez de tres botones repetidos. */}
      <div className="app-activity" data-activa={cargandoDatos ? "" : undefined} role="presentation">
        <span />
      </div>
    </header>
  );
}
