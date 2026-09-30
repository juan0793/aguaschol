import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@blossom-carousel/core/style.css";
import { Toaster } from "sonner";
import { emptyBarrioForm } from "./components/BarrioCodesWorkspace";
import AppSidebar from "./components/sidebar/AppSidebar";
import { ModuleSkeleton } from "./components/ds/Skeleton";
import "./components/ds/design-system.css";
import "./styles/request-workspace.css";
import logoAguasCholuteca from "./assets/logo-aguas-choluteca.png";
import { API_URL } from "./config/api";
import {
  AUTH_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  DRAFT_SAVED_AT_STORAGE_KEY,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from "./constants/storageKeys";
import {
  defaultPadronRequestForm,
  emptyForm,
  emptyMapDraft,
} from "./constants/formsAndUi";
import {
  buildPhotoUrl,
  roleLabel
} from "./utils/formatting";
import {
  getMapDiaryDateKey,
} from "./utils/datesAndBusiness";
import {
  comparableFormShape,
} from "./utils/records";
import { loadStoredLookupHistory, loadStoredRecordNotifications } from "./utils/localStorage";
import {
  resolveBarrioFromPayload,
} from "./utils/barrioCodes";
import {
  FieldValidationWorkspace,
  MyProfileWorkspace,
  RailwayUsageWorkspace,
  TeamActivityWorkspace,
  PlanosWorkspace,
  DashboardWorkspace,
  TransportWorkspace,
  ImportacionWorkspace,
  SigTerritorialWorkspace,
  ClandestinosPage,
  InspeccionesPage,
  EntregasPage,
  NotesPage,
  prefetchModule
} from "./app/lazyModules";
import {
  formatDashboardSyncRelativeTime,
} from "./utils/timeFormat";
import {
  getDefaultWorkspaceView,
} from "./utils/appShell";
import FieldMapWorkspace from "./modules/campo/FieldMapWorkspace";
import PadronWorkspace from "./modules/padron/PadronWorkspace";
import LookupWorkspace from "./modules/lookup/LookupWorkspace";
import ExecutiveReportView from "./modules/reports/ExecutiveReportView";
import AdminWorkspace from "./app/AdminWorkspace";
import AppHeader from "./app/AppHeader";
import AuditReportViewerDialog from "./modules/audit/AuditReportViewerDialog";
import DashboardAlertsDialog from "./modules/dashboard/DashboardAlertsDialog";
import PrintComparisonDialog from "./modules/clandestinos/dialogs/PrintComparisonDialog";
import PrintBatchDialog from "./modules/clandestinos/dialogs/PrintBatchDialog";
import MapDiaryArchiveDialog from "./modules/campo/MapDiaryArchiveDialog";
import FieldDebtDialog from "./modules/campo/FieldDebtDialog";
import PasswordChangeModal from "./components/PasswordChangeModal";
import LoginScreen from "./app/LoginScreen";
import { useLookupState } from "./modules/lookup/useLookupState";
import { useLookupActions } from "./modules/lookup/useLookupActions";
import { createExecutiveReportPdf } from "./modules/reports/createExecutiveReportPdf";
import { createRegulatorEvidencePdf } from "./modules/reports/createRegulatorEvidencePdf";
import { createMapReportPrinters } from "./modules/reports/createMapReportPrinters";
import { createFieldDebtReports } from "./modules/campo/createFieldDebtReports";
import { createPadronReportPrinters } from "./modules/requests/createPadronReportPrinters";
import { createFichaPrinting } from "./modules/clandestinos/printing/createFichaPrinting";
import { createUserAdminActions } from "./modules/users/createUserAdminActions";
import { createPadronAdminActions } from "./modules/padron/createPadronAdminActions";
import { createAuditActions } from "./modules/audit/createAuditActions";
import { createAuthActions } from "./app/createAuthActions";
import { useReportMapActions } from "./modules/reports/useReportMapActions";
import { createFieldMapActions } from "./modules/campo/createFieldMapActions";
import { useFieldMapPoints } from "./modules/campo/useFieldMapPoints";
import { useRecordFilters } from "./modules/clandestinos/useRecordFilters";
import { useMapReportData } from "./modules/reports/useMapReportData";
import { usePadronReportData } from "./modules/requests/usePadronReportData";
import { useExecutiveReportData } from "./modules/reports/useExecutiveReportData";
import { useDashboardData } from "./modules/dashboard/useDashboardData";
import { useHeaderStats } from "./app/useHeaderStats";
import { useAppNavigation } from "./app/useAppNavigation";
import { usePrintBatchSelection } from "./modules/clandestinos/usePrintBatchSelection";
import { createRecordLoaders } from "./modules/clandestinos/createRecordLoaders";
import { createUserLoaders } from "./modules/users/createUserLoaders";
import { createAuditLoaders } from "./modules/audit/createAuditLoaders";
import { createBarrioCodeActions } from "./modules/barrios/createBarrioCodeActions";
import { createMapDataLoaders } from "./modules/campo/createMapDataLoaders";
import { createPadronDataActions } from "./modules/padron/createPadronDataActions";
import { createRecordFormActions } from "./modules/clandestinos/createRecordFormActions";
import { createLookupRecordBridge } from "./modules/lookup/createLookupRecordBridge";
import { useRecordEffects } from "./modules/clandestinos/useRecordEffects";
import { useFieldMapEffects } from "./modules/campo/useFieldMapEffects";
import { useAdminDataEffects } from "./app/useAdminDataEffects";
import { useAppShellEffects } from "./app/useAppShellEffects";
import { useAuditState } from "./modules/audit/useAuditState";
import { useUsersState } from "./modules/users/useUsersState";
import { usePadronState } from "./modules/padron/usePadronState";
import { useFieldMapState } from "./modules/campo/useFieldMapState";
import { useBarrioCodesState } from "./modules/barrios/useBarrioCodesState";
import { usePadronRequestState } from "./modules/requests/usePadronRequestState";
import { useDashboardState } from "./modules/dashboard/useDashboardState";
import { useAppShellState } from "./app/useAppShellState";
import { useRecordsState } from "./modules/clandestinos/useRecordsState";
import { useSessionState } from "./app/useSessionState";
import { useMapDiaryData } from "./modules/campo/useMapDiaryData";
import { useAuditView } from "./modules/audit/useAuditView";
import { useDashboardRefresh } from "./modules/dashboard/useDashboardRefresh";
import { useApiSession } from "./app/useApiSession";
import ConfirmDeleteRecordModal from "./modules/clandestinos/dialogs/ConfirmDeleteRecordModal";
import ConfirmDeleteUserModal from "./modules/users/ConfirmDeleteUserModal";

function App() {
  const sheetRef = useRef(null);
  const reportMapCaptureRef = useRef(null);
  const mapPointsRequestRef = useRef({ id: 0, controller: null });
  const intentionalLogoutRef = useRef(false);
  const sessionInvalidatingRef = useRef(false);
  const sessionState = useSessionState();
  const {
    session,
    setSession,
    sessionVerified,
    setSessionVerified,
    setLoginForm,
    setShowLoginPassword,
    showPasswordModal,
    setShowPasswordModal,
    setPasswordFeedback,
    setPasswordForm,
    authFx
  } = sessionState;
  const recordsState = useRecordsState();
  const { records, setRecords, form, draftForm, setDraftForm, selectedFile, setNotifiedRecordAlerts } = recordsState;
  const lookupState = useLookupState();
  const { setLookupSearchMode, setLookupQuery, setLookupResult, setLookupFeedback, setLookupHistory } = lookupState;
  const appShellState = useAppShellState({ ...sessionState });
  const {
    notificationUserId,
    setNotificationUserId,
    workspaceView,
    setWorkspaceView,
    crossModuleFocus,
    setCrossModuleFocus,
    clandestinosCommand,
    setClandestinosStatus,
    setCargandoDatos,
    showMobileModuleMenu,
    closeMobileModuleMenu
  } = appShellState;
  const navigateWithFocus = (view, focus) => { setCrossModuleFocus(focus ? { view, requestId: Date.now(), ...focus } : null); setWorkspaceView(view); };
  // Abre el registro de un evento de la actividad del equipo (campana o pantalla).
  const abrirActividadEquipo = (activity) => {
    const enlace = activity?.enlace;
    if (enlace?.view === "records" && enlace.fichaId) navigateWithFocus("records", { fichaId: enlace.fichaId });
    else if (enlace?.view === "entregas" && enlace.loteId) { window.location.hash = `entregas/lotes?lote=${Number(enlace.loteId)}`; setWorkspaceView("entregas"); }
    else if (enlace?.view === "banco") { window.location.hash = "clandestinos/banco"; setWorkspaceView("records"); }
    else if (enlace?.view === "inspecciones") setWorkspaceView("inspecciones");
    else setWorkspaceView("teamActivity");
  };
  const dashboardState = useDashboardState();
  const {
    dashboardNow,
    dashboardLastUpdatedAt,
    setDashboardLastUpdatedAt,
    dashboardRefreshing,
    setDashboardRefreshing,
    dashboardManualRefreshing,
    setDashboardManualRefreshing,
    dashboardConnectionStatus,
    setDashboardConnectionStatus
  } = dashboardState;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
      ?? window.localStorage.getItem("aguaschol-sidebar-collapsed");
    return saved === null ? window.matchMedia?.("(max-width: 1100px)").matches : saved === "true";
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const padronRequestState = usePadronRequestState();
  const {
    setPadronRequestTemplates,
    setPadronRequestForm,
    setPadronRequestResult,
    padronServiceReport,
    setSelectedAguasServiceBarrios
  } = padronRequestState;
  const barrioCodesState = useBarrioCodesState();
  const { barrioCodes, setBarrioCodes, setBarrioCodeForm } = barrioCodesState;
  const fieldMapState = useFieldMapState();
  const {
    mapPoints,
    setMapPoints,
    mapDiaryGroupsSummary,
    setMapDiaryGroupsSummary,
    selectedArchiveMapDiaryKey,
    mapReportSettingsByDate,
    setMapReportSettingsByDate,
    regulatorReportDiaryKeys,
    setSelectedMapPointId,
    setMapStatus,
    setMapDraft,
    setMapFocusRequest,
    mapDiaryDateKey
  } = fieldMapState;
  const padronState = usePadronState();
  const { padronMeta, setPadronMeta, setPadronImportSummary, setPadronFile } = padronState;
  const usersState = useUsersState();
  const {
    users,
    setUsers,
    selectedUserId,
    pendingDeleteUser,
    setPendingDeleteUser,
    pendingDeleteRecord,
    setPendingDeleteRecord,
    latestUserResult,
    setLatestUserResult
  } = usersState;
  const auditState = useAuditState();
  const { auditLogs, setAuditLogs, loadingLogs, auditFilters, auditFiltersQuery } = auditState;
  const isAuthenticated = Boolean(session?.token) && sessionVerified;
  const isAdmin = session?.user?.role === "admin";
  const isTransport = session?.user?.role === "transport";
  const isFieldValidator = session?.user?.role === "validadora_campo";
  const mustChangePassword = Boolean(session?.user?.force_password_change);
  const passwordModalVisible = isAuthenticated && (mustChangePassword || showPasswordModal);
  const safeRecords = Array.isArray(records) ? records : [];
  const safeMapPoints = Array.isArray(mapPoints) ? mapPoints : [];
  const safeMapDiaryGroupsSummary = Array.isArray(mapDiaryGroupsSummary) ? mapDiaryGroupsSummary : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeBarrioCodes = Array.isArray(barrioCodes) ? barrioCodes : [];
  const getRecordBarrioName = useCallback(
    (record = {}, fallback = "Sin barrio") =>
      String(resolveBarrioFromPayload(record, safeBarrioCodes, fallback)).trim() || fallback,
    [safeBarrioCodes]
  );
  const selectedUser =
    safeUsers.find((user) => user.id === selectedUserId) ?? latestUserResult?.user ?? safeUsers[0] ?? null;
  const onlineUsers = useMemo(
    () => safeUsers.filter((user) => user.is_online),
    [safeUsers]
  );
  const mapDiaryData = useMapDiaryData({
    mapDiaryDateKey,
    mapReportSettingsByDate,
    regulatorReportDiaryKeys,
    safeMapDiaryGroupsSummary,
    safeMapPoints,
    selectedArchiveMapDiaryKey,
    setMapReportSettingsByDate
  });
  const fieldMapPoints = useFieldMapPoints({ ...mapDiaryData, ...fieldMapState, safeMapPoints });
  const mapReportModel = useMapReportData({ ...mapDiaryData, ...fieldMapState, ...fieldMapPoints, safeBarrioCodes });
  const isDirty = useMemo(() => {
    const baseline = form.id
      ? comparableFormShape(safeRecords.find((record) => record.id === form.id) ?? emptyForm)
      : comparableFormShape(draftForm ?? emptyForm);

    return (
      JSON.stringify(comparableFormShape(form)) !== JSON.stringify(baseline) || Boolean(selectedFile)
    );
  }, [draftForm, form, safeRecords, selectedFile]);
  const todayDateKey = getMapDiaryDateKey(new Date());
  const padronReportData = usePadronReportData({ ...padronState, ...padronRequestState });
  const { aguasServiceReportData, getAguasServiceBarrioName } = padronReportData;
  useEffect(() => {
    setSelectedAguasServiceBarrios((current) => {
      if (!current.length) return current;
      const validNames = new Set(aguasServiceReportData.barrios.map((barrio) => getAguasServiceBarrioName(barrio)));
      const next = current.filter((name) => validNames.has(name));
      return next.length === current.length ? current : next;
    });
  }, [aguasServiceReportData.barrios, getAguasServiceBarrioName]);

  const recordFilterModel = useRecordFilters({ ...recordsState, getRecordBarrioName, safeRecords, todayDateKey });

  const clearSession = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_SAVED_AT_STORAGE_KEY);
    setSession(null);
    setSessionVerified(true);
    setLoginForm({ username: "", password: "" });
    setShowLoginPassword(false);
    setShowPasswordModal(false);
    setPasswordFeedback("");
    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: ""
    });
    setRecords([]);
    setUsers([]);
    setAuditLogs([]);
    setLatestUserResult(null);
    setLookupSearchMode("clave");
    setLookupQuery("");
    setLookupResult(null);
    setLookupFeedback("");
    setPadronRequestResult(null);
    setPadronRequestForm(defaultPadronRequestForm);
    setPadronRequestTemplates([]);
    setMapPoints([]);
    setMapDiaryGroupsSummary([]);
    setSelectedMapPointId(null);
    setMapStatus("Sincronizado");
    setMapDraft(emptyMapDraft);
    setMapFocusRequest(null);
    setLookupHistory(loadStoredLookupHistory());
    setDraftForm(null);
    setNotifiedRecordAlerts(loadStoredRecordNotifications());
    setPadronMeta(null);
    setPadronImportSummary(null);
    setPadronFile(null);
    setBarrioCodes([]);
    setBarrioCodeForm(emptyBarrioForm);
    setWorkspaceView("records");
    resetForm();
  };
  const apiSession = useApiSession({ clearSession, intentionalLogoutRef, session, sessionInvalidatingRef, setCargandoDatos });
  const { showAlert, apiFetch } = apiSession;

  const lookupActions = useLookupActions({
    ...apiSession,
    ...lookupState,
    ...padronState,
    ...appShellState,
    clearSession,
    isAuthenticated
  });

  const selectedPhotoUrl = useMemo(() => {
    if (!form.foto_path) return "";
    const version = form.updated_at || Date.now();
    return buildPhotoUrl(form.foto_path, version);
  }, [form.foto_path, form.updated_at]);

  const localSelectedPhotoUrl = useMemo(() => {
    if (!selectedFile) return "";
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  const fieldDebtReports = createFieldDebtReports({
    ...mapDiaryData,
    ...apiSession,
    ...mapReportModel,
    ...fieldMapState,
    ...padronState,
    ...fieldMapPoints
  });
  const dashboardData = useDashboardData({
    ...mapDiaryData,
    ...padronState,
    ...recordFilterModel,
    ...dashboardState,
    ...fieldMapState,
    getRecordBarrioName,
    isAdmin,
    onlineUsers,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapDiaryGroupsSummary,
    safeMapPoints,
    safeRecords,
    safeUsers,
    todayDateKey
  });
  const { dashboardLiveMetrics, dashboardLiveFeed, dashboardPriorityItems } = dashboardData;
  const { executiveReportData } = useExecutiveReportData({
    ...mapDiaryData,
    ...padronState,
    ...dashboardData,
    ...fieldMapState,
    ...mapReportModel,
    ...padronRequestState,
    ...recordFilterModel,
    getRecordBarrioName,
    onlineUsers,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeRecords,
    safeUsers
  });
  const { handleDownloadExecutiveReportPdf } = createExecutiveReportPdf({
    ...mapDiaryData,
    ...apiSession,
    ...recordFilterModel,
    executiveReportData,
    safeAuditLogs,
    safeMapPoints,
    safeRecords,
    safeUsers
  });
  const reportMapActions = useReportMapActions({
    ...apiSession,
    ...mapDiaryData,
    ...fieldMapState,
    ...fieldMapPoints,
    clearSession,
    reportMapCaptureRef,
    safeBarrioCodes,
    safeMapPoints
  });
  const { handleDownloadRegulatorEvidencePdf } = createRegulatorEvidencePdf({
    ...mapDiaryData,
    ...apiSession,
    ...reportMapActions,
    ...fieldMapState,
    ...sessionState,
    ...fieldMapPoints,
    isAdmin,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeUsers
  });
  const mapReportPrinters = createMapReportPrinters({
    ...mapDiaryData,
    ...apiSession,
    ...fieldDebtReports,
    ...reportMapActions,
    ...mapReportModel,
    ...fieldMapState
  });
  const printBatchSelection = usePrintBatchSelection({ ...recordsState, ...recordFilterModel, getRecordBarrioName, safeRecords });
  const recordLoaders = createRecordLoaders({ ...apiSession, ...recordsState, clearSession, isAdmin, isAuthenticated });
  const { loadRecordSummary } = recordLoaders;
  const fichaPrinting = createFichaPrinting({
    ...apiSession,
    ...printBatchSelection,
    ...recordsState,
    ...recordLoaders,
    getRecordBarrioName,
    selectedPhotoUrl
  });
  const { handlePrintFicha, handlePrintAviso } = fichaPrinting;
  const padronDataActions = createPadronDataActions({
    ...apiSession,
    ...padronRequestState,
    ...lookupActions,
    ...padronState,
    ...dashboardState,
    ...fieldMapState,
    ...lookupState,
    ...appShellState,
    clearSession,
    isAdmin,
    isAuthenticated
  });
  const padronReportPrinters = createPadronReportPrinters({
    ...apiSession,
    ...padronReportData,
    ...padronState,
    ...dashboardData,
    ...padronDataActions,
    ...fichaPrinting,
    ...padronRequestState,
    ...recordsState,
    getRecordBarrioName,
    safeBarrioCodes
  });

  const { loadUsers } = createUserLoaders({ ...apiSession, ...usersState, clearSession, isAdmin, isAuthenticated });
  const auditLoaders = createAuditLoaders({ ...apiSession, ...auditState, clearSession, isAdmin, isAuthenticated });
  const { loadAuditLogs } = auditLoaders;
  const userAdminActions = createUserAdminActions({ ...apiSession, ...usersState, ...auditLoaders, clearSession, loadUsers });
  const { handleDeleteUser } = userAdminActions;
  const padronAdminActions = createPadronAdminActions({ ...apiSession, ...padronState, ...padronDataActions, ...dashboardState, clearSession });
  const auditActions = createAuditActions({ ...apiSession, ...auditState });
  const authActions = createAuthActions({
    ...apiSession,
    ...auditLoaders,
    ...sessionState,
    ...appShellState,
    clearSession,
    intentionalLogoutRef,
    sessionInvalidatingRef
  });
  const { handleLogout } = authActions;
  const fieldMapActions = createFieldMapActions({
    ...apiSession,
    ...fieldMapState,
    ...fieldMapPoints,
    clearSession,
    isAdmin,
    safeBarrioCodes,
    safeMapPoints
  });
  const { headerStats } = useHeaderStats({
    ...mapDiaryData,
    ...recordsState,
    ...fieldMapState,
    ...padronRequestState,
    ...lookupState,
    ...mapReportModel,
    ...padronState,
    ...fieldMapPoints,
    ...appShellState,
    isAdmin,
    isTransport,
    onlineUsers,
    safeAuditLogs,
    safeBarrioCodes,
    safeRecords
  });
  const appNavigation = useAppNavigation({
    ...mapDiaryData,
    ...mapReportModel,
    ...padronState,
    ...padronRequestState,
    ...fieldMapPoints,
    ...appShellState,
    isAdmin,
    isFieldValidator,
    safeAuditLogs,
    safeBarrioCodes,
    safeRecords,
    safeUsers
  });
  const { sidebarNavigationSections } = appNavigation;
  const barrioCodeActions = createBarrioCodeActions({ ...apiSession, ...barrioCodesState, clearSession, isAuthenticated });
  const mapDataLoaders = createMapDataLoaders({
    ...apiSession,
    ...mapDiaryData,
    ...fieldMapState,
    clearSession,
    isAdmin,
    isAuthenticated,
    mapPointsRequestRef,
    safeMapPoints
  });
  const { loadMapDiaryGroups } = mapDataLoaders;
  const recordFormActions = createRecordFormActions({
    ...apiSession,
    ...recordsState,
    ...recordLoaders,
    ...usersState,
    getRecordBarrioName,
    safeBarrioCodes,
    sheetRef
  });
  const { resetForm, handleDeleteArchivedRecord } = recordFormActions;
  const lookupRecordBridge = createLookupRecordBridge({
    ...apiSession,
    clearSession,
    navigateWithFocus,
    safeBarrioCodes,
    showAlert
  });
  useRecordEffects({
    ...recordFilterModel,
    ...recordsState,
    ...barrioCodeActions,
    ...recordLoaders,
    ...dashboardState,
    ...appShellState,
    getRecordBarrioName,
    isAdmin,
    isAuthenticated,
    localSelectedPhotoUrl,
    safeBarrioCodes
  });
  useFieldMapEffects({
    ...mapDiaryData,
    ...apiSession,
    ...fieldMapState,
    ...mapDataLoaders,
    ...mapReportModel,
    ...padronState,
    ...fieldMapPoints,
    ...appShellState,
    isAdmin,
    isAuthenticated,
    mapPointsRequestRef,
    safeBarrioCodes
  });
  const { refreshDashboard } = useDashboardRefresh({
    isAdmin,
    isAuthenticated,
    loadAuditLogs,
    loadMapDiaryGroups,
    loadRecordSummary,
    setDashboardConnectionStatus,
    setDashboardLastUpdatedAt,
    setDashboardRefreshing,
    workspaceView
  });
  useAdminDataEffects({
    ...apiSession,
    ...padronState,
    ...auditState,
    ...padronDataActions,
    ...auditLoaders,
    ...barrioCodeActions,
    ...mapDataLoaders,
    ...recordLoaders,
    ...appShellState,
    isAdmin,
    isAuthenticated,
    loadUsers,
    refreshDashboard
  });
  useAppShellEffects({
    ...apiSession,
    ...sessionState,
    ...fieldMapState,
    ...appShellState,
    clearSession,
    intentionalLogoutRef,
    isAdmin,
    isAuthenticated,
    isFieldValidator,
    mustChangePassword,
    sessionInvalidatingRef,
    setShowUserMenu,
    sidebarCollapsed
  });
  const auditView = useAuditView({ auditFilters, auditFiltersQuery, loadingLogs, safeAuditLogs });
  if (session?.token && !sessionVerified) {
    return (
      <div className="login-shell login-scene" role="status" aria-live="polite">
        <div className="auth-fx auth-fx-login">
          <div className="auth-fx-card"><span className="auth-fx-dot" /><strong>Validando sesión…</strong></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        model={{ ...sessionState, ...authActions }}
      />
    );
  }

  return (
    <div
      className={[
        "page-shell",
        sidebarCollapsed ? "sidebar-collapsed" : "",
        ["requests", "mapReports", "mapAnalytics"].includes(workspaceView) ? "reports-layout-mode" : "",
        workspaceView === "mapReports" ? "map-reports-mode" : "",
        workspaceView === "dashboard" ? "dashboard-refactor-mode" : ""
      ].filter(Boolean).join(" ")}
    >
      {authFx ? (
        <div className={`auth-fx auth-fx-${authFx.mode}`}>
          <div className="auth-fx-card">
            <span className="auth-fx-dot" />
            <strong>{authFx.text}</strong>
          </div>
        </div>
      ) : null}
      <Toaster position="top-right" richColors closeButton duration={5000} visibleToasts={3} />
      {passwordModalVisible ? (
        <PasswordChangeModal
          model={{ ...sessionState, ...authActions, mustChangePassword }}
        />
      ) : null}
      {pendingDeleteUser ? (
        <ConfirmDeleteUserModal
          model={{ handleDeleteUser, pendingDeleteUser, setPendingDeleteUser }}
        />
      ) : null}
      {pendingDeleteRecord ? (
        <ConfirmDeleteRecordModal
          model={{ handleDeleteArchivedRecord, pendingDeleteRecord, setPendingDeleteRecord }}
        />
      ) : null}
      <FieldDebtDialog
        model={{ ...mapDiaryData, ...fieldMapState, ...mapReportModel, ...fieldDebtReports }}
      />
      <MapDiaryArchiveDialog
        model={{
          ...mapDiaryData,
          ...fieldMapState,
          ...mapDataLoaders,
          setSidebarCollapsed,
          sidebarCollapsed
        }}
      />
      <PrintBatchDialog
        model={{
          ...fichaPrinting,
          ...recordsState,
          ...printBatchSelection,
          ...recordFormActions,
          getRecordBarrioName
        }}
      />
      <PrintComparisonDialog
        model={{ ...dashboardData, ...padronReportPrinters, ...recordsState, getRecordBarrioName }}
      />
      <DashboardAlertsDialog
        model={{
          ...recordsState,
          ...dashboardData,
          ...dashboardState,
          ...fichaPrinting,
          ...recordFormActions,
          ...printBatchSelection,
          ...appShellState
        }}
      />
      <AuditReportViewerDialog
        model={{ ...auditLoaders, ...auditState }}
      />
      <AppHeader
        model={{
          ...mapDiaryData,
          ...apiSession,
          ...dashboardData,
          ...appNavigation,
          ...appShellState,
          ...mapReportPrinters,
          ...fieldMapActions,
          ...authActions,
          ...fieldDebtReports,
          ...auditLoaders,
          ...mapDataLoaders,
          ...padronDataActions,
          ...fieldMapState,
          ...auditState,
          ...lookupState,
          ...mapReportModel,
          ...reportMapActions,
          ...recordsState,
          ...sessionState,
          ...padronState,
          ...fieldMapPoints,
          executiveReportData,
          handleDownloadExecutiveReportPdf,
          headerStats,
          isAdmin,
          isDirty,
          loadUsers,
          onlineUsers,
          safeAuditLogs,
          safeMapPoints,
          safeRecords,
          setShowUserMenu,
          showUserMenu,
          abrirActividadEquipo
        }}
      />
      <AppSidebar
        sections={sidebarNavigationSections}
        activeKey={workspaceView}
        collapsed={sidebarCollapsed}
        mobileOpen={showMobileModuleMenu}
        logo={logoAguasCholuteca}
        userName={session?.user?.full_name || session?.user?.username || "Usuario"}
        userRole={roleLabel(session?.user?.role)}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onNavigate={setWorkspaceView}
        onPrefetch={prefetchModule}
        homeKey={getDefaultWorkspaceView(session?.user?.role)}
        onCloseMobile={closeMobileModuleMenu}
        onLogout={handleLogout}
      />
      {workspaceView === "dashboard" ? (
        <Suspense fallback={<ModuleSkeleton title="el tablero" />}>
          <DashboardWorkspace model={{
            userName: session?.user?.full_name || session?.user?.username || "admin",
            connectionStatus: dashboardConnectionStatus,
            refreshing: dashboardRefreshing,
            manualRefreshing: dashboardManualRefreshing,
            refresh: async () => {
              setDashboardManualRefreshing(true);
              try {
                await refreshDashboard({ force: true });
              } finally {
                setDashboardManualRefreshing(false);
              }
            },
            syncLabel: dashboardConnectionStatus === "retrying" ? "Reintentando conexión…" : dashboardRefreshing ? "Actualizando…" : `Sincronizado ${formatDashboardSyncRelativeTime(dashboardLastUpdatedAt, dashboardNow)}`,
            metrics: dashboardLiveMetrics,
            debtBarrios: Array.isArray(padronServiceReport?.barrios) ? padronServiceReport.barrios : [],
            // El informe de servicios llega agregado por barrio; las cuentas de
            // un servicio se piden aparte, solo cuando alguien abre el desglose.
            fetchServiceAccounts: async (field, limit = 25) => {
              const response = await apiFetch(`/claves/services/accounts?field=${encodeURIComponent(field)}&limit=${encodeURIComponent(limit)}`);
              const data = await response.json();
              if (!response.ok) throw new Error(data.message || "No fue posible cargar las cuentas del servicio.");
              return data;
            },
            debtSummary: padronServiceReport?.summary?.deuda || {},
            padronTotals: {
              records: Number(padronServiceReport?.summary?.total_records || 0),
              barrios: Number(padronServiceReport?.summary?.total_barrios || 0),
              // Fecha de la ultima carga del padron: de ese corte salen las cifras.
              updatedAt: padronMeta?.updated_at || null
            },
            onlineUsers: onlineUsers.map((user) => ({ ...user, roleLabel: roleLabel(user.role) })),
            attention: dashboardPriorityItems,
            feed: dashboardLiveFeed,
            navigate: setWorkspaceView
          }} />
        </Suspense>
      ) : workspaceView === "profile" ? (
        <main className="profile-layout">
          <Suspense fallback={<ModuleSkeleton title="mi perfil" toolbar={false} rows={5} />}>
            <MyProfileWorkspace
              apiFetch={apiFetch}
              isAdmin={isAdmin}
              safeUsers={safeUsers}
              session={session}
              showAlert={showAlert}
              initialTargetUserId={notificationUserId}
              onTargetUserSelected={() => setNotificationUserId(null)}
            />
          </Suspense>
        </main>
      ) : workspaceView === "teamActivity" && isAdmin ? (
        <main className="team-activity-layout">
          <Suspense fallback={<ModuleSkeleton title="la actividad del equipo" toolbar={false} rows={6} />}>
            <TeamActivityWorkspace apiFetch={apiFetch} session={session} onOpen={abrirActividadEquipo} />
          </Suspense>
        </main>
      ) : workspaceView === "railwayUsage" ? (
        <main className="railway-usage-layout">
          <Suspense fallback={<ModuleSkeleton title="uso en Railway" toolbar={false} rows={4} />}>
            <RailwayUsageWorkspace apiFetch={apiFetch} />
          </Suspense>
        </main>
      ) : workspaceView === "executiveReport" ? (
      <ExecutiveReportView
        model={{
          ...mapDiaryData,
          ...padronState,
          ...recordFilterModel,
          executiveReportData,
          handleDownloadExecutiveReportPdf,
          safeAuditLogs,
          safeMapPoints,
          safeRecords,
          safeUsers
        }}
      />
      ) : workspaceView === "transport" ? (
      <main className="layout transport-layout-page">
        <section className="preview-panel transport-preview-panel">
          <Suspense fallback={<ModuleSkeleton title="transporte" />}>
            <TransportWorkspace
              apiFetch={apiFetch}
              clearSession={clearSession}
              isActive={workspaceView === "transport" && isAuthenticated}
              isAdmin={isAdmin}
              session={session}
              showAlert={showAlert}
            />
          </Suspense>
        </section>
      </main>
      ) : workspaceView === "inspecciones" ? (
      <Suspense fallback={<ModuleSkeleton title="Inspecciones" />}>
        <InspeccionesPage
          apiFetch={apiFetch}
          session={session}
          showAlert={showAlert}
          focusRequest={crossModuleFocus?.view === "inspecciones" ? crossModuleFocus : null}
          onFocusConsumed={() => setCrossModuleFocus(null)}
        />
      </Suspense>
      ) : workspaceView === "entregas" ? (
      <Suspense fallback={<ModuleSkeleton title="Control de entregas" />}>
        <EntregasPage apiFetch={apiFetch} session={session} showAlert={showAlert} />
      </Suspense>
      ) : workspaceView === "notes" && isAdmin ? (
      <Suspense fallback={<ModuleSkeleton title="Apuntes" />}>
        <NotesPage
          apiFetch={apiFetch}
          onSendToInspeccion={(note) => navigateWithFocus("inspecciones", {
            from_note_id: note.id,
            trabajo_solicitado: [note.title, note.content].map((part) => String(part || "").trim()).filter(Boolean).join("\n")
          })}
        />
      </Suspense>
      ) : workspaceView === "sigTerritorial" ? (
        <Suspense fallback={<ModuleSkeleton title="SIG Territorial" toolbar={false} rows={4} />}>
          <SigTerritorialWorkspace
            apiFetch={apiFetch}
            session={session}
            showAlert={showAlert}
            focusRequest={crossModuleFocus?.view === "sigTerritorial" ? crossModuleFocus : null}
            onFocusConsumed={() => setCrossModuleFocus(null)}
            onOpenFieldValidation={(payload) => navigateWithFocus("fieldValidation", payload)}
            onCreateInspection={(payload) => navigateWithFocus("inspecciones", {
              clave_catastral: payload?.clave_catastral || payload?.catastro_clave || "",
              abonado: payload?.abonado_actual?.abonado || payload?.abonado || "",
              abonado_nombre: payload?.abonado_actual?.nombre || payload?.inquilino || "",
              barrio: payload?.barrio || "",
              referencia: `SIG Territorial · lote ${payload?.numero_lote || payload?.id || ""}`.trim()
            })}
            onOpenFicha={(payload) => navigateWithFocus("records", { fichaId: payload?.id, clave_catastral: payload?.clave_catastral })}
          />
        </Suspense>
      ) : workspaceView === "records" ? (
      <Suspense fallback={<ModuleSkeleton title="Clandestinos" />}>
        <ClandestinosPage
          apiFetch={apiFetch}
          session={session}
          showAlert={showAlert}
          navigate={setWorkspaceView}
          focusRequest={crossModuleFocus?.view === "records" ? crossModuleFocus : null}
          onFocusConsumed={() => setCrossModuleFocus(null)}
          onPrintFicha={handlePrintFicha}
          onPrintAviso={handlePrintAviso}
          command={clandestinosCommand}
          onStatusChange={setClandestinosStatus}
        />
      </Suspense>
      ) : workspaceView === "lookup" ? (
        <LookupWorkspace
          model={{
            ...apiSession,
            ...lookupRecordBridge,
            ...padronState,
            ...padronAdminActions,
            ...lookupActions,
            ...lookupState
          }}
        />
      ) : workspaceView === "importacion" ? (
        <Suspense fallback={<main className="import-workspace"><ModuleSkeleton title="la importación" /></main>}>
          <ImportacionWorkspace apiFetch={apiFetch} showAlert={showAlert} />
        </Suspense>
      ) : workspaceView === "padron" ? (
        <PadronWorkspace
          model={{ ...padronState, ...padronAdminActions, ...padronDataActions }}
        />
      ) : workspaceView === "map" ? (
        <FieldMapWorkspace
          model={{
            ...mapDiaryData,
            ...fieldMapActions,
            ...fieldMapState,
            ...mapReportPrinters,
            ...fieldMapPoints,
            ...mapDataLoaders,
            ...appShellState,
            isAdmin
          }}
        />
      ) : workspaceView === "planos" ? (
        <Suspense fallback={<ModuleSkeleton title="planos y croquis" toolbar={false} rows={4} />}>
          <PlanosWorkspace apiFetch={apiFetch} isAdmin={isAdmin} users={safeUsers} />
        </Suspense>
      ) : workspaceView === "fieldValidation" ? (
        <Suspense fallback={<ModuleSkeleton title="la validación de campo" />}>
          <FieldValidationWorkspace
            apiFetch={apiFetch}
            apiUrl={API_URL}
            barrioCodes={safeBarrioCodes}
            isActive={workspaceView === "fieldValidation" && isAuthenticated}
            focusRequest={crossModuleFocus?.view === "fieldValidation" ? crossModuleFocus : null}
            onFocusConsumed={() => setCrossModuleFocus(null)}
            onOpenSig={(payload) => navigateWithFocus("sigTerritorial", payload)}
          />
        </Suspense>
      ) : (
        <AdminWorkspace
          model={{
            ...mapDiaryData,
            ...apiSession,
            ...auditView,
            ...reportMapActions,
            ...padronReportData,
            ...padronState,
            ...auditState,
            ...barrioCodesState,
            ...usersState,
            ...mapReportModel,
            ...fieldMapState,
            ...auditActions,
            ...barrioCodeActions,
            ...userAdminActions,
            ...padronReportPrinters,
            ...fieldDebtReports,
            ...mapReportPrinters,
            ...auditLoaders,
            ...padronDataActions,
            ...fieldMapActions,
            ...mapDataLoaders,
            ...padronRequestState,
            ...sessionState,
            ...appShellState,
            ...fieldMapPoints,
            handleDownloadRegulatorEvidencePdf,
            safeAuditLogs,
            safeBarrioCodes,
            safeUsers,
            selectedUser
          }}
        />
      )}
    </div>
  );
}

export default App;
