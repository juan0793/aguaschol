import { AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_OPTIONS, auditActionTone, auditRelativeDayLabel, formatAuditTime } from "../utils/audit";
import BarrioCodesWorkspace from "../components/BarrioCodesWorkspace";
import FieldAnalyticsPanel from "../components/FieldAnalyticsPanel";
import { Icon, actionIconName } from "../components/Icon";
import { ModuleSkeleton } from "../components/ds/Skeleton";
import { PadronRequestsWorkspace, ReportsWorkspace } from "./lazyModules";
import { Suspense } from "react";
import { UsersContent, UsersSidebar } from "../components/users/UsersWorkspace";
import { actionLabel, roleLabel } from "../utils/formatting";
import { ensureClaveHasPrefix } from "../utils/barrioCodes";
import { formatDateTime, formatMapDiaryLabel } from "../utils/datesAndBusiness";
import { getMapReportTechnicians } from "../utils/mapReport";

export default function AdminWorkspace({ model }) {
  const {
    activeMapDiaryDateKey,
    addMapReportTechnician,
    aguasServiceReportData,
    alcaldiaComparison,
    alcaldiaMeta,
    apiFetch,
    auditDayGroups,
    auditFilterChips,
    auditFilters,
    auditFiltersOpen,
    auditRangeLabel,
    auditSyncing,
    barrioCodeForm,
    clearMapReportImage,
    creatingUser,
    downloadingAguasServicePdf,
    downloadingPadronStatsPdf,
    fieldDebtChartData,
    fieldDebtReport,
    fieldDebtSummary,
    generatingRegulatorReport,
    handleAuditFilterChange,
    handleAuditFilterClear,
    handleAuditFiltersReset,
    handleAuditReportArchiveShortcut,
    handleBarrioCodeFormChange,
    handleCreateUser,
    handleDeleteBarrioCode,
    handleDownloadAguasServicePdf,
    handleDownloadFieldDebtPdf,
    handleDownloadMapBriefPdf,
    handleDownloadMapCensusPdf,
    handleDownloadMapFieldPdf,
    handleDownloadPadronRequestPdf,
    handleDownloadPadronStatsPdf,
    handleDownloadRegulatorEvidencePdf,
    handleEditBarrioCode,
    handleEditReportMapPoint,
    handleExportAuditLogs,
    handleMapReportImageChange,
    handleMapReportSettingsChange,
    handleMapReportStaffChange,
    handleMapReportTechnicianChange,
    handleOpenAuditReport,
    handlePadronRequestFormChange,
    handlePadronRequestPresetChange,
    handlePrepareAddBarrioCode,
    handlePrintAguasServiceReport,
    handlePrintFieldDebtChart,
    handlePrintMapBriefReport,
    handlePrintMapCensusReport,
    handlePrintMapFieldReport,
    handlePrintPadronRequest,
    handleReportMapDraftChange,
    handleResetBarrioCodeForm,
    handleResetUserPassword,
    handleRunPadronRequest,
    handleSaveBarrioCode,
    handleSaveReportMapPoint,
    handleSelectMapPoint,
    handleToggleRegulatorDiaryKey,
    handleUpdateUserRole,
    handleUpdateUserName,
    handleUserFormChange,
    handleVerifyFieldDebt,
    latestUserResult,
    loadAlcaldiaComparison,
    loadMapDiaryGroups,
    loadMapPointContexts,
    loadMapPoints,
    loadPadronRequestMeta,
    loadPadronServiceReport,
    loadingAlcaldiaComparison,
    loadingAuditReportId,
    loadingBarrioCodes,
    loadingFieldDebtReport,
    loadingMapContexts,
    loadingMapPoints,
    loadingPadronRequest,
    loadingPadronRequestMeta,
    loadingPadronServiceReport,
    loadingUsers,
    mapAnalyticsData,
    mapDiaryGroups,
    mapReportData,
    mapReportPrintData,
    mapReportSettings,
    mapReportStaff,
    padronChartMode,
    padronChartType,
    padronMeta,
    padronRequestForm,
    padronRequestLoadError,
    padronRequestResult,
    padronRequestTemplates,
    padronServiceReport,
    padronStatisticsData,
    padronStatsBarrioFilter,
    padronStatsLimit,
    padronStatsSortDirection,
    padronStatsSortMetric,
    regulatorReportDiaryOptions,
    removeMapReportTechnician,
    reportMapDraft,
    resetReportMapDraft,
    safeAuditLogs,
    safeBarrioCodes,
    safeUsers,
    savingBarrioCode,
    savingReportMapPoint,
    savingUserRoleId,
    selectedAguasServiceBarrios,
    selectedAguasServiceField,
    selectedPadronServiceField,
    selectedRegulatorDiaryKeys,
    selectedUser,
    session,
    setAuditFiltersOpen,
    setMapDiaryDateKey,
    setMapReportPage,
    setPadronChartMode,
    setPadronChartType,
    setPadronStatsBarrioFilter,
    setPadronStatsLimit,
    setPadronStatsSortDirection,
    setPadronStatsSortMetric,
    setPendingDeleteUser,
    setSelectedAguasServiceBarrios,
    setSelectedAguasServiceField,
    setSelectedPadronServiceField,
    setSelectedPadronStatBarrio,
    setSelectedUserId,
    setShowFieldDebtModal,
    setUserForm,
    setWorkspaceView,
    showAlert,
    toggleAguasServiceBarrioSelection,
    userForm,
    visibleMapPoints,
    workspaceView
  } = model;

  return (
    <main className={`admin-layout ${["logs", "mapReports", "mapAnalytics", "requests", "barrioCodes"].includes(workspaceView) ? "admin-layout-logs" : ""}`}>
      {workspaceView === "users" ? (
        <UsersSidebar
          loadingUsers={loadingUsers}
          safeUsers={safeUsers}
          selectedUser={selectedUser}
          setSelectedUserId={setSelectedUserId}
          roleLabel={roleLabel}
        />
      ) : null}

      <section className={`admin-content ${["logs", "mapReports", "mapAnalytics", "requests", "barrioCodes"].includes(workspaceView) ? "admin-content-logs" : ""}`}>
        {workspaceView === "mapReports" ? (
          <Suspense fallback={<ModuleSkeleton title="reportes" />}>
            <ReportsWorkspace
              model={{
                apiFetch,
                notify: showAlert,
                onOpenBanco: () => {
                  window.location.hash = "clandestinos/banco";
                  setWorkspaceView("records");
                },
                activeDateKey: activeMapDiaryDateKey,
                days: mapDiaryGroups,
                data: mapReportPrintData,
                settings: mapReportSettings,
                staff: mapReportStaff,
                technicians: getMapReportTechnicians(mapReportStaff),
                debtReport: fieldDebtReport,
                debtSummary: fieldDebtSummary,
                debtChart: fieldDebtChartData,
                regulatorDays: regulatorReportDiaryOptions,
                selectedRegulatorDays: selectedRegulatorDiaryKeys,
                loadingPoints: loadingMapPoints,
                loadingContexts: loadingMapContexts,
                loadingDebt: loadingFieldDebtReport,
                generatingRegulator: generatingRegulatorReport,
                reportDraft: reportMapDraft,
                savingPoint: savingReportMapPoint,
                onSelectDay: (dateKey) => {
                  setMapDiaryDateKey(dateKey);
                  setMapReportPage(1);
                },
                onRefresh: () => {
                  loadMapDiaryGroups({ silent: true });
                  loadMapPoints();
                },
                onOpenMap: (point) => {
                  handleSelectMapPoint(point.id);
                  setWorkspaceView("map");
                },
                onEditPoint: handleEditReportMapPoint,
                onDraftChange: handleReportMapDraftChange,
                onSavePoint: handleSaveReportMapPoint,
                onResetPoint: resetReportMapDraft,
                onVerifyDebt: handleVerifyFieldDebt,
                onDebtDetail: () => setShowFieldDebtModal(true),
                onPrintDebt: handlePrintFieldDebtChart,
                onDownloadDebt: handleDownloadFieldDebtPdf,
                onDownloadTechnical: handleDownloadMapFieldPdf,
                onPrintTechnical: handlePrintMapFieldReport,
                onDownloadBrief: handleDownloadMapBriefPdf,
                onPrintBrief: handlePrintMapBriefReport,
                onDownloadCensus: handleDownloadMapCensusPdf,
                onPrintCensus: handlePrintMapCensusReport,
                onDownloadRegulator: handleDownloadRegulatorEvidencePdf,
                onToggleRegulatorDay: handleToggleRegulatorDiaryKey,
                onSettingsChange: handleMapReportSettingsChange,
                onImage: handleMapReportImageChange,
                onClearImage: clearMapReportImage,
                onStaffChange: handleMapReportStaffChange,
                onTechnicianChange: handleMapReportTechnicianChange,
                onAddTechnician: addMapReportTechnician,
                onRemoveTechnician: removeMapReportTechnician
              }}
            />
          </Suspense>
        ) : workspaceView === "mapAnalytics" ? (
          <FieldAnalyticsPanel
            activeDateLabel={formatMapDiaryLabel(activeMapDiaryDateKey)}
            loadingMapContexts={loadingMapContexts}
            loadingMapPoints={loadingMapPoints}
            mapAnalyticsData={mapAnalyticsData}
            mapReportData={mapReportData}
            onBackToReport={() => setWorkspaceView("mapReports")}
            onRefreshPoints={() => loadMapPoints()}
            onRefreshZones={() => loadMapPointContexts(visibleMapPoints)}
          />
        ) : workspaceView === "requests" ? (
          <Suspense fallback={<ModuleSkeleton title="consultas del padrón" />}>
            <PadronRequestsWorkspace
              model={{
                serviceReport: padronServiceReport,
                serviceData: aguasServiceReportData,
                loadingServices: loadingPadronServiceReport || loadingPadronRequestMeta,
                loadError: padronRequestLoadError,
                onRefresh: () => {
                  loadPadronRequestMeta({ silent: true });
                  loadPadronServiceReport();
                },
                selectedServiceField: selectedAguasServiceField,
                onSelectService: setSelectedAguasServiceField,
                selectedBarrios: selectedAguasServiceBarrios,
                onToggleBarrio: toggleAguasServiceBarrioSelection,
                onSetSelectedBarrios: setSelectedAguasServiceBarrios,
                onPrintServices: handlePrintAguasServiceReport,
                onDownloadServicesPdf: handleDownloadAguasServicePdf,
                downloadingServicesPdf: downloadingAguasServicePdf,
                templates: padronRequestTemplates,
                form: padronRequestForm,
                onFormChange: handlePadronRequestFormChange,
                onPresetChange: handlePadronRequestPresetChange,
                onRunRequest: handleRunPadronRequest,
                loadingRequest: loadingPadronRequest,
                requestResult: padronRequestResult,
                onPrintRequest: handlePrintPadronRequest,
                onDownloadRequestPdf: handleDownloadPadronRequestPdf,
                formatClave: (row) => ensureClaveHasPrefix(row.clave_catastral || row.clave_aguas_formato || row.clave_alcaldia, row.barrio_colonia, safeBarrioCodes),
                comparison: alcaldiaComparison,
                loadingComparison: loadingAlcaldiaComparison,
                onCompare: () => loadAlcaldiaComparison(),
                apiFetch,
                notify: showAlert,
                onOpenBanco: () => {
                  window.location.hash = "clandestinos/banco";
                  setWorkspaceView("records");
                },
                stats: padronStatisticsData,
                padronMeta,
                alcaldiaMeta,
                chartMode: padronChartMode,
                setChartMode: setPadronChartMode,
                chartType: padronChartType,
                setChartType: setPadronChartType,
                sortMetric: padronStatsSortMetric,
                setSortMetric: setPadronStatsSortMetric,
                sortDirection: padronStatsSortDirection,
                setSortDirection: setPadronStatsSortDirection,
                limit: padronStatsLimit,
                setLimit: setPadronStatsLimit,
                barrioFilter: padronStatsBarrioFilter,
                setBarrioFilter: setPadronStatsBarrioFilter,
                statsServiceField: selectedPadronServiceField,
                setStatsServiceField: setSelectedPadronServiceField,
                onSelectStatBarrio: setSelectedPadronStatBarrio,
                onDownloadStatsPdf: handleDownloadPadronStatsPdf,
                downloadingStatsPdf: downloadingPadronStatsPdf
              }}
            />
          </Suspense>
        ) : workspaceView === "barrioCodes" ? (
          <BarrioCodesWorkspace
            barrios={safeBarrioCodes}
            form={barrioCodeForm}
            loading={loadingBarrioCodes}
            saving={savingBarrioCode}
            onFormChange={handleBarrioCodeFormChange}
            onSubmit={handleSaveBarrioCode}
            onEdit={handleEditBarrioCode}
            onDelete={handleDeleteBarrioCode}
            onReset={handleResetBarrioCodeForm}
            onPrepareAdd={handlePrepareAddBarrioCode}
          />
        ) : workspaceView === "users" ? (
          <UsersContent
            apiFetch={apiFetch}
            creatingUser={creatingUser}
            handleCreateUser={handleCreateUser}
            handleResetUserPassword={handleResetUserPassword}
            handleUpdateUserRole={handleUpdateUserRole}
            handleUpdateUserName={handleUpdateUserName}
            handleUserFormChange={handleUserFormChange}
            latestUserResult={latestUserResult}
            savingUserRoleId={savingUserRoleId}
            selectedUser={selectedUser}
            session={session}
            setPendingDeleteUser={setPendingDeleteUser}
            setUserForm={setUserForm}
            userForm={userForm}
            formatDateTime={formatDateTime}
            roleLabel={roleLabel}
            safeUsers={safeUsers}
            showAlert={showAlert}
          />
        ) : (
          <section className="preview-panel log-panel-full log-terminal-view audit-console">
            <div className="log-shell audit-shell">
              <header className="audit-masthead">
                <div className="audit-masthead-copy">
                  <span className="audit-kicker">
                    <span className={`audit-kicker-dot ${auditSyncing ? "is-syncing" : ""}`.trim()} />
                    Terminal de auditoría
                  </span>
                  <h2>Historial de actividad</h2>
                  <p>Consola viva para seguir accesos, fichas, padrones y movimientos del trabajo operativo.</p>
                </div>
                <div className="audit-masthead-side">
                  <div className="audit-counter">
                    <strong>{safeAuditLogs.length}</strong>
                    <small>eventos<br />indexados</small>
                  </div>
                  <div className="audit-masthead-actions">
                    <button type="button" className="audit-action" onClick={() => setWorkspaceView("executiveReport")}>
                      <Icon name="records" />
                      Informe de operaciones
                    </button>
                    <button type="button" className="audit-action" onClick={handleAuditReportArchiveShortcut}>
                      <Icon name="print" />
                      Archivo de reportes
                    </button>
                  </div>
                </div>
              </header>

              <form className="audit-searchbar" onSubmit={(event) => event.preventDefault()}>
                <div className="audit-search-row">
                  <div className="audit-search-field">
                    <Icon name="search" />
                    <input
                      name="search"
                      value={auditFilters.search}
                      onChange={handleAuditFilterChange}
                      placeholder="Buscar por ID de reporte, actor o detalle del evento"
                      aria-label="Buscar en el historial"
                    />
                    {auditFilters.search ? (
                      <button
                        type="button"
                        className="audit-search-clear"
                        onClick={() => handleAuditFilterClear("search")}
                        aria-label="Limpiar búsqueda"
                      >
                        <Icon name="close" />
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`audit-filter-toggle ${auditFiltersOpen ? "is-open" : ""}`.trim()}
                    onClick={() => setAuditFiltersOpen((current) => !current)}
                    aria-expanded={auditFiltersOpen}
                  >
                    <Icon name="filter" />
                    Filtros
                    {auditFilterChips.length ? <em>{auditFilterChips.length}</em> : null}
                    <Icon name="chevronDown" className="audit-filter-caret" />
                  </button>
                  <button type="button" className="audit-action is-ghost" onClick={handleExportAuditLogs}>
                    <Icon name="download" />
                    Exportar CSV
                  </button>
                </div>

                {auditFiltersOpen ? (
                  <div className="audit-filter-grid">
                    <label>
                      <span>Acción</span>
                      <select name="action" value={auditFilters.action} onChange={handleAuditFilterChange}>
                        <option value="">Todas las acciones</option>
                        {AUDIT_ACTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Entidad</span>
                      <select name="entity_type" value={auditFilters.entity_type} onChange={handleAuditFilterChange}>
                        <option value="">Todas las entidades</option>
                        {AUDIT_ENTITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Actor</span>
                      <input name="actor" value={auditFilters.actor} onChange={handleAuditFilterChange} placeholder="Nombre o correo" />
                    </label>
                    <div className="audit-filter-range">
                      <span>Rango de fechas</span>
                      <div>
                        <input type="date" name="date_from" value={auditFilters.date_from} onChange={handleAuditFilterChange} aria-label="Desde" />
                        <em>→</em>
                        <input type="date" name="date_to" value={auditFilters.date_to} onChange={handleAuditFilterChange} aria-label="Hasta" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {auditFilterChips.length ? (
                  <div className="audit-chip-row">
                    {auditFilterChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        className="audit-active-chip"
                        onClick={() => handleAuditFilterClear(chip.key)}
                        title={`Quitar filtro ${chip.label}`}
                      >
                        <span>{chip.label}</span>
                        <strong>{chip.value}</strong>
                        <Icon name="close" />
                      </button>
                    ))}
                    <button type="button" className="audit-chip-reset" onClick={handleAuditFiltersReset}>
                      <Icon name="refresh" />
                      Limpiar todo
                    </button>
                  </div>
                ) : null}
              </form>

              <div className="audit-stat-row">
                <div className={`audit-stat ${auditSyncing ? "is-syncing" : "is-live"}`}>
                  <span>Stream</span>
                  <strong>{auditSyncing ? "Sincronizando" : "En línea"}</strong>
                  <small>{formatDateTime(new Date().toISOString())}</small>
                </div>
                <div className="audit-stat">
                  <span>Eventos visibles</span>
                  <strong>{safeAuditLogs.length}</strong>
                  <small>{auditFilterChips.length ? "Con filtros aplicados" : "Sin filtros"}</small>
                </div>
                <div className="audit-stat">
                  <span>Rango</span>
                  <strong>{auditRangeLabel}</strong>
                  <small>{auditDayGroups.length} {auditDayGroups.length === 1 ? "jornada" : "jornadas"}</small>
                </div>
                <div className="audit-stat">
                  <span>Integridad</span>
                  <strong>Trazabilidad activa</strong>
                  <small>Registro inmutable</small>
                </div>
              </div>

              <article className="audit-stream-panel">
                {safeAuditLogs.length ? (
                  <div className="audit-stream">
                    {auditDayGroups.map((group) => {
                      const relative = auditRelativeDayLabel(group.key);
                      return (
                        <section className="audit-day" key={group.key}>
                          <header className="audit-day-heading">
                            <Icon name="calendar" />
                            {relative ? <strong>{relative}</strong> : null}
                            <span>{group.label}</span>
                            <small>{group.logs.length} {group.logs.length === 1 ? "evento" : "eventos"}</small>
                          </header>
                          <div className="audit-day-events">
                            {group.logs.map((log, index) => {
                              const isReport = log.action === "report.generated";
                              const archiveAvailable = Boolean(log.details_json?.archive_available);
                              return (
                                <div
                                  key={`${group.key}-${log.id}`}
                                  className={`audit-event ${isReport ? "is-report" : ""}`.trim()}
                                  data-tone={auditActionTone(log.action)}
                                  style={{ "--log-delay": `${Math.min(index, 10) * 35}ms` }}
                                >
                                  <div className="audit-event-rail">
                                    <time dateTime={log.created_at} title={formatDateTime(log.created_at)}>
                                      {formatAuditTime(log.created_at)}
                                    </time>
                                    <span className="audit-event-icon">
                                      <Icon name={actionIconName(log.action)} />
                                    </span>
                                  </div>
                                  <div className="audit-event-body">
                                    <div className="audit-event-head">
                                      <span className="audit-event-badge">{actionLabel(log.action)}</span>
                                      {isReport && log.entity_id ? <span className="audit-event-id">{log.entity_id}</span> : null}
                                    </div>
                                    <p className="audit-event-summary">{log.summary || "Movimiento registrado"}</p>
                                    <div className="audit-event-chips">
                                      <span className="audit-meta-chip">
                                        <i>Actor</i>{log.actor_name || log.actor_email || "Sistema"}
                                      </span>
                                      <span className="audit-meta-chip">
                                        <i>Entidad</i>{log.entity_type || "--"}{log.entity_id ? ` #${log.entity_id}` : ""}
                                      </span>
                                      <span className="audit-meta-chip">
                                        <i>Evento</i>{log.action || "audit.event"}
                                      </span>
                                    </div>
                                    {isReport ? (
                                      <div className="audit-event-actions">
                                        <span className={archiveAvailable ? "audit-archive-status is-ready" : "audit-archive-status"}>
                                          <Icon name={archiveAvailable ? "success" : "records"} />
                                          {archiveAvailable ? "Copia visual archivada" : "Solo metadata disponible"}
                                        </span>
                                        {archiveAvailable ? (
                                          <button
                                            type="button"
                                            className="audit-open-report"
                                            onClick={() => handleOpenAuditReport(log)}
                                            disabled={loadingAuditReportId === log.entity_id}
                                          >
                                            <Icon name="eye" />
                                            {loadingAuditReportId === log.entity_id ? "Abriendo…" : "Ver e imprimir"}
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : log.details_json ? (
                                      <details className="audit-json">
                                        <summary>
                                          <Icon name="chevronRight" />
                                          Ver detalle técnico
                                        </summary>
                                        <pre>{JSON.stringify(log.details_json, null, 2)}</pre>
                                      </details>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="audit-empty">
                    <span className="audit-empty-icon"><Icon name="history" /></span>
                    <h3>{auditFilterChips.length ? "Sin coincidencias" : "Sin eventos registrados"}</h3>
                    <p>
                      {auditFilterChips.length
                        ? "Ningún evento coincide con los filtros activos. Ajusta la búsqueda o límpialos para ver todo el historial."
                        : "Las altas de usuarios, accesos y cambios de fichas apareceran aqui automaticamente."}
                    </p>
                    {auditFilterChips.length ? (
                      <button type="button" className="audit-action" onClick={handleAuditFiltersReset}>
                        <Icon name="refresh" />
                        Limpiar filtros
                      </button>
                    ) : null}
                  </div>
                )}
              </article>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
