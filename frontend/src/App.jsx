import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@blossom-carousel/core/style.css";
import { toast, Toaster } from "sonner";
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
  defaultMapReportStaff,
  defaultPadronRequestForm,
  emptyForm,
  emptyMapDraft,
  emptyMapReportDraft,
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
  hasDraftContent
} from "./utils/records";
import { loadStoredLookupHistory, loadStoredRecordNotifications } from "./utils/localStorage";
import {
  resolveBarrioFromPayload,
} from "./utils/barrioCodes";
import {
  FieldValidationWorkspace,
  MyProfileWorkspace,
  RailwayUsageWorkspace,
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
  groupAuditLogsByDay,
  EMPTY_AUDIT_FILTERS,
  AUDIT_FILTER_KEYS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_ENTITY_OPTIONS,
} from "./utils/audit";
import {
  MAP_POINT_LIST_INITIAL_LIMIT,
  MAP_DIARY_PRIMARY_LIMIT,
} from "./constants/workspace";
import { getTodayMapDiaryKey } from "./utils/mapDiary";
import {
  normalizeMapReportStaff,
  normalizeMapReportSettings,
  loadMapReportSettingsByDate
} from "./utils/mapReport";
import {
  formatDashboardSyncRelativeTime,
} from "./utils/timeFormat";
import {
  getAlertDetails,
  getDefaultWorkspaceView,
  getWorkspaceViewByRole
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

function App() {
  const sheetRef = useRef(null);
  const reportMapCaptureRef = useRef(null);
  const mapPointsRequestRef = useRef({ id: 0, controller: null });
  const intentionalLogoutRef = useRef(false);
  const sessionInvalidatingRef = useRef(false);
  const [session, setSession] = useState(() => {
    const saved = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });
  // Valida la sesión guardada antes de montar los módulos protegidos; una sesión
  // vencida no debe disparar todas las consultas del tablero en paralelo.
  const [sessionVerified, setSessionVerified] = useState(
    () => !window.localStorage.getItem(AUTH_STORAGE_KEY)
  );
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  const [authFx, setAuthFx] = useState(null);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [draftForm, setDraftForm] = useState(() => {
    const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) return null;

    try {
      const parsed = JSON.parse(saved);
      return hasDraftContent(parsed) ? { ...emptyForm, ...parsed, id: null } : null;
    } catch {
      return null;
    }
  });
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [recordView, setRecordView] = useState("active");
  const [recordQuickFilter, setRecordQuickFilter] = useState("all");
  const [recordPage, setRecordPage] = useState(1);
  const [recordFilters, setRecordFilters] = useState({
    clave: "",
    barrio: "",
    responsible: "",
    date_from: "",
    date_to: "",
    status: "all"
  });
  const [processingRecordId, setProcessingRecordId] = useState(null);
  const [showPrintBatchModal, setShowPrintBatchModal] = useState(false);
  const [showDashboardAlertsModal, setShowDashboardAlertsModal] = useState(false);
  const [showPrintComparisonModal, setShowPrintComparisonModal] = useState(false);
  const {
    showLookupClassicModal,
    setShowLookupClassicModal,
    lookupSearchMode,
    setLookupSearchMode,
    lookupQuery,
    setLookupQuery,
    lookupPrefixMode,
    setLookupPrefixMode,
    lookupLoading,
    setLookupLoading,
    lookupResult,
    setLookupResult,
    lookupFeedback,
    setLookupFeedback,
    lookupHistory,
    setLookupHistory,
    lookupModeConfig,
    lookupInputLabel,
    lookupInputPlaceholder
  } = useLookupState();
  const [printingComparison, setPrintingComparison] = useState(false);
  const [printComparisonHeader, setPrintComparisonHeader] = useState({
    kicker: "Lista de fichas vencidas",
    title: "Comparacion contra Aguas",
    note: "Claves vencidas comparadas con el padron de Aguas de Choluteca"
  });
  const [batchPrintCopies, setBatchPrintCopies] = useState({});
  const [printBatchSearch, setPrintBatchSearch] = useState("");
  const [printBatchQuickFilter, setPrintBatchQuickFilter] = useState("all");
  const [printBatchStatusView, setPrintBatchStatusView] = useState("pending");
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [notifiedRecordAlerts, setNotifiedRecordAlerts] = useState(() => loadStoredRecordNotifications());
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [notificationUserId, setNotificationUserId] = useState(null);
  const [workspaceView, setWorkspaceView] = useState(() => getWorkspaceViewByRole(session?.user?.role));
  const [crossModuleFocus, setCrossModuleFocus] = useState(null);
  // Barra superior del módulo Clandestinos: búsqueda por clave y estado de carga.
  const [clandestinosCommand, setClandestinosCommand] = useState(null);
  const [clandestinosStatus, setClandestinosStatus] = useState(null);
  const [clandestinosUpdatedAt, setClandestinosUpdatedAt] = useState(null);
  const clandestinosBusy = Boolean(clandestinosStatus?.busy);
  useEffect(() => {
    if (clandestinosStatus && !clandestinosBusy) setClandestinosUpdatedAt(new Date());
  }, [clandestinosBusy, clandestinosStatus]);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const peticionesEnCursoRef = useRef(0);
  const actividadTimerRef = useRef(0);
  const navigateWithFocus = (view, focus) => { setCrossModuleFocus(focus ? { view, requestId: Date.now(), ...focus } : null); setWorkspaceView(view); };
  const [dashboardNow, setDashboardNow] = useState(() => Date.now());
  const [dashboardLastUpdatedAt, setDashboardLastUpdatedAt] = useState(() => Date.now());
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  // Solo la recarga pedida con el botón: la automática de cada 10 s no debe
  // deshabilitar ni hacer girar el botón Actualizar.
  const [dashboardManualRefreshing, setDashboardManualRefreshing] = useState(false);
  const [dashboardConnectionStatus, setDashboardConnectionStatus] = useState("synced");
  const [dashboardAlertFilter, setDashboardAlertFilter] = useState("all");
  const [showMobileModuleMenu, setShowMobileModuleMenu] = useState(false);
  const closeMobileModuleMenu = useCallback(() => setShowMobileModuleMenu(false), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
      ?? window.localStorage.getItem("aguaschol-sidebar-collapsed");
    return saved === null ? window.matchMedia?.("(max-width: 1100px)").matches : saved === "true";
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [padronRequestTemplates, setPadronRequestTemplates] = useState([]);
  // Sin esto, un 500 del backend se veia igual que "no hay datos": los contadores
  // quedaban en 0 y la insignia seguia diciendo "Listo" en cuanto pasaba el aviso.
  const [padronRequestLoadError, setPadronRequestLoadError] = useState("");
  const [padronRequestForm, setPadronRequestForm] = useState(defaultPadronRequestForm);
  const [padronRequestResult, setPadronRequestResult] = useState(null);
  const [loadingPadronRequest, setLoadingPadronRequest] = useState(false);
  const [loadingPadronRequestMeta, setLoadingPadronRequestMeta] = useState(false);
  const [padronServiceReport, setPadronServiceReport] = useState(null);
  const [loadingPadronServiceReport, setLoadingPadronServiceReport] = useState(false);
  const [selectedAguasServiceField, setSelectedAguasServiceField] = useState("agua");
  const [selectedAguasServiceBarrios, setSelectedAguasServiceBarrios] = useState([]);
  const [barrioCodes, setBarrioCodes] = useState([]);
  const [barrioCodeForm, setBarrioCodeForm] = useState(emptyBarrioForm);
  const [loadingBarrioCodes, setLoadingBarrioCodes] = useState(false);
  const [savingBarrioCode, setSavingBarrioCode] = useState(false);
  const [mapPoints, setMapPoints] = useState([]);
  const [showMapPrintDialog, setShowMapPrintDialog] = useState(false);
  const [mapDiaryGroupsSummary, setMapDiaryGroupsSummary] = useState([]);
  const [mapPointListLimit, setMapPointListLimit] = useState(MAP_POINT_LIST_INITIAL_LIMIT);
  const [isCompactMapView, setIsCompactMapView] = useState(false);
  const [loadingMapPoints, setLoadingMapPoints] = useState(false);
  const [loadingMapContexts, setLoadingMapContexts] = useState(false);
  const [mapPointContexts, setMapPointContexts] = useState({});
  const [mapReportPage, setMapReportPage] = useState(1);
  const [showFieldDebtModal, setShowFieldDebtModal] = useState(false);
  const [loadingFieldDebtReport, setLoadingFieldDebtReport] = useState(false);
  const [fieldDebtReport, setFieldDebtReport] = useState(null);
  const [showMapDiaryArchiveModal, setShowMapDiaryArchiveModal] = useState(false);
  const [selectedArchiveMapDiaryKey, setSelectedArchiveMapDiaryKey] = useState("");
  const [archiveMapDiaryPoints, setArchiveMapDiaryPoints] = useState([]);
  const [loadingArchiveMapDiaryPoints, setLoadingArchiveMapDiaryPoints] = useState(false);
  const [savingReportMapPoint, setSavingReportMapPoint] = useState(false);
  const [editingReportMapPointId, setEditingReportMapPointId] = useState(null);
  const [reportMapDraft, setReportMapDraft] = useState(emptyMapReportDraft);
  const [mapReportStaff, setMapReportStaff] = useState(() => normalizeMapReportStaff(defaultMapReportStaff));
  const [mapReportSettingsByDate, setMapReportSettingsByDate] = useState(() => loadMapReportSettingsByDate());
  const [regulatorReportDiaryKeys, setRegulatorReportDiaryKeys] = useState([]);
  const [generatingRegulatorReport, setGeneratingRegulatorReport] = useState(false);
  const [savingMapPoint, setSavingMapPoint] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [selectedMapPointId, setSelectedMapPointId] = useState(null);
  const [editingMapPointId, setEditingMapPointId] = useState(null);
  const [mapStatus, setMapStatus] = useState("Sincronizado");
  const [mapDraft, setMapDraft] = useState(emptyMapDraft);
  const [mapDescriptionLookupStatus, setMapDescriptionLookupStatus] = useState("");
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [mapLocationHelp, setMapLocationHelp] = useState("");
  const mapDescriptionLookupCacheRef = useRef(new Map());
  const [mapDiaryDateKey, setMapDiaryDateKey] = useState(() => getMapDiaryDateKey(new Date()));
  const [padronMeta, setPadronMeta] = useState(null);
  const [padronImportSummary, setPadronImportSummary] = useState(null);
  const [padronFile, setPadronFile] = useState(null);
  const [uploadingPadron, setUploadingPadron] = useState(false);
  const [padronBatches, setPadronBatches] = useState([]);
  const [selectedPadronBatchCode, setSelectedPadronBatchCode] = useState("");
  const [confirmingPadronBatch, setConfirmingPadronBatch] = useState(null);
  const [loadingPadronBatches, setLoadingPadronBatches] = useState(false);
  const [activatingPadronBatch, setActivatingPadronBatch] = useState(false);
  const [verifyingPadronBatch, setVerifyingPadronBatch] = useState(false);
  const [downloadingPadronBatch, setDownloadingPadronBatch] = useState(false);
  const [downloadingPadron, setDownloadingPadron] = useState(false);
  const [reprocessingPadron, setReprocessingPadron] = useState(false);
  const [loadingPadronMeta, setLoadingPadronMeta] = useState(false);
  const [padronSyncState, setPadronSyncState] = useState({
    status: "idle",
    progress: 0,
    message: "Padron listo",
    verification: null
  });
  const selectedPadronBatch = padronBatches.find((batch) => batch.codigo_lote === selectedPadronBatchCode) ?? null;
  const [alcaldiaMeta, setAlcaldiaMeta] = useState(null);
  const [alcaldiaImportSummary, setAlcaldiaImportSummary] = useState(null);
  const [alcaldiaFile, setAlcaldiaFile] = useState(null);
  const [uploadingAlcaldia, setUploadingAlcaldia] = useState(false);
  const [loadingAlcaldiaMeta, setLoadingAlcaldiaMeta] = useState(false);
  const [alcaldiaSyncState, setAlcaldiaSyncState] = useState({
    status: "idle",
    progress: 0,
    message: "Padron de alcaldia listo"
  });
  const [loadingAlcaldiaComparison, setLoadingAlcaldiaComparison] = useState(false);
  const [alcaldiaComparison, setAlcaldiaComparison] = useState(null);
  const [padronChartMode, setPadronChartMode] = useState("brecha");
  const [padronChartType, setPadronChartType] = useState("barras");
  const [downloadingPadronStatsPdf, setDownloadingPadronStatsPdf] = useState(false);
  const [downloadingAguasServicePdf, setDownloadingAguasServicePdf] = useState(false);
  const [selectedPadronStatBarrio, setSelectedPadronStatBarrio] = useState("");
  const [selectedPadronServiceField, setSelectedPadronServiceField] = useState("");
  const [padronStatsBarrioFilter, setPadronStatsBarrioFilter] = useState("");
  const [padronStatsSortMetric, setPadronStatsSortMetric] = useState("brecha_registros");
  const [padronStatsSortDirection, setPadronStatsSortDirection] = useState("desc");
  const [padronStatsLimit, setPadronStatsLimit] = useState(10);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserRoleId, setSavingUserRoleId] = useState(null);
  const [userForm, setUserForm] = useState({
    full_name: "",
    email: "",
    role: "operator"
  });
  const [latestUserResult, setLatestUserResult] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedAuditReport, setSelectedAuditReport] = useState(null);
  const [loadingAuditReportId, setLoadingAuditReportId] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditFilters, setAuditFilters] = useState(EMPTY_AUDIT_FILTERS);
  // Los campos de texto escriben en `auditFilters` al instante (la UI responde) pero
  // la consulta al backend viaja sobre la copia retrasada: antes cada tecla disparaba
  // un fetch del historial completo.
  const [auditFiltersQuery, setAuditFiltersQuery] = useState(EMPTY_AUDIT_FILTERS);
  const [auditFiltersOpen, setAuditFiltersOpen] = useState(false);
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
  const auditDayGroups = useMemo(() => groupAuditLogsByDay(safeAuditLogs), [safeAuditLogs]);
  const auditFilterChips = useMemo(() => {
    const labelFor = (options, value) => options.find((option) => option.value === value)?.label || value;
    const chips = [];
    if (auditFilters.search) chips.push({ key: "search", label: "Búsqueda", value: auditFilters.search });
    if (auditFilters.action) chips.push({ key: "action", label: "Acción", value: labelFor(AUDIT_ACTION_OPTIONS, auditFilters.action) });
    if (auditFilters.entity_type) chips.push({ key: "entity_type", label: "Entidad", value: labelFor(AUDIT_ENTITY_OPTIONS, auditFilters.entity_type) });
    if (auditFilters.actor) chips.push({ key: "actor", label: "Actor", value: auditFilters.actor });
    if (auditFilters.date_from) chips.push({ key: "date_from", label: "Desde", value: auditFilters.date_from });
    if (auditFilters.date_to) chips.push({ key: "date_to", label: "Hasta", value: auditFilters.date_to });
    return chips;
  }, [auditFilters]);
  const auditRangeLabel = auditFilters.date_from || auditFilters.date_to
    ? `${auditFilters.date_from || "inicio"} → ${auditFilters.date_to || "hoy"}`
    : "Historial completo";
  const auditSyncing = loadingLogs
    || AUDIT_FILTER_KEYS.some((key) => auditFilters[key] !== auditFiltersQuery[key]);
  const safeBarrioCodes = Array.isArray(barrioCodes) ? barrioCodes : [];
  const getRecordBarrioName = useCallback(
    (record = {}, fallback = "Sin barrio") =>
      String(resolveBarrioFromPayload(record, safeBarrioCodes, fallback)).trim() || fallback,
    [safeBarrioCodes]
  );
  const mapDiaryGroups = useMemo(() => {
    const todayKey = getTodayMapDiaryKey();
    if (safeMapDiaryGroupsSummary.length) {
      const groups = safeMapDiaryGroupsSummary
        .filter((group) => group?.key)
        .map((group) => ({
          key: group.key,
          total: Number(group.total || 0)
        }))
        .sort((left, right) => right.key.localeCompare(left.key));
      return groups.some((group) => group.key === todayKey)
        ? groups
        : [{ key: todayKey, total: 0 }, ...groups].sort((left, right) => right.key.localeCompare(left.key));
    }

    const groups = safeMapPoints.reduce((accumulator, point) => {
      const key = getMapDiaryDateKey(point);
      if (!key) return accumulator;
      const current = accumulator.get(key) ?? { key, total: 0 };
      current.total += 1;
      accumulator.set(key, current);
      return accumulator;
    }, new Map());

    if (!groups.has(todayKey)) {
      groups.set(todayKey, { key: todayKey, total: 0 });
    }

    return Array.from(groups.values()).sort((left, right) => right.key.localeCompare(left.key));
  }, [safeMapDiaryGroupsSummary, safeMapPoints]);
  const mapPointsTotal = useMemo(
    () => mapDiaryGroups.reduce((total, group) => total + Number(group.total || 0), 0),
    [mapDiaryGroups]
  );
  const activeMapDiaryDateKey = useMemo(
    () => {
      return mapDiaryGroups.some((group) => group.key === mapDiaryDateKey)
        ? mapDiaryDateKey
        : mapDiaryGroups[0]?.key ?? getTodayMapDiaryKey();
    },
    [mapDiaryDateKey, mapDiaryGroups]
  );
  const primaryMapDiaryGroups = useMemo(() => {
    const recentGroups = mapDiaryGroups.slice(0, MAP_DIARY_PRIMARY_LIMIT);
    if (recentGroups.some((group) => group.key === activeMapDiaryDateKey)) {
      return recentGroups;
    }

    const activeGroup = mapDiaryGroups.find((group) => group.key === activeMapDiaryDateKey);
    return activeGroup ? [activeGroup, ...recentGroups.slice(0, MAP_DIARY_PRIMARY_LIMIT - 1)] : recentGroups;
  }, [activeMapDiaryDateKey, mapDiaryGroups]);
  const archivedMapDiaryGroups = useMemo(() => {
    const visibleKeys = new Set(primaryMapDiaryGroups.map((group) => group.key));
    return mapDiaryGroups.filter((group) => !visibleKeys.has(group.key));
  }, [mapDiaryGroups, primaryMapDiaryGroups]);
  const regulatorReportDiaryOptions = useMemo(
    () => mapDiaryGroups.filter((group) => Number(group.total || 0) > 0).slice(0, 8),
    [mapDiaryGroups]
  );
  const selectedRegulatorDiaryKeys = useMemo(() => {
    const availableKeys = new Set(regulatorReportDiaryOptions.map((group) => group.key));
    const selected = regulatorReportDiaryKeys.filter((key) => availableKeys.has(key)).slice(0, 5);
    return selected.length ? selected : regulatorReportDiaryOptions.slice(0, 3).map((group) => group.key);
  }, [regulatorReportDiaryKeys, regulatorReportDiaryOptions]);
  const selectedArchiveMapDiaryGroup = useMemo(
    () => archivedMapDiaryGroups.find((group) => group.key === selectedArchiveMapDiaryKey) ?? archivedMapDiaryGroups[0] ?? null,
    [archivedMapDiaryGroups, selectedArchiveMapDiaryKey]
  );
  const mapReportSettings = useMemo(
    () => normalizeMapReportSettings(mapReportSettingsByDate[activeMapDiaryDateKey]),
    [activeMapDiaryDateKey, mapReportSettingsByDate]
  );
  const setMapReportSettings = (updater) => {
    setMapReportSettingsByDate((current) => {
      const currentSettings = normalizeMapReportSettings(current[activeMapDiaryDateKey]);
      const nextSettings = typeof updater === "function" ? updater(currentSettings) : updater;

      return {
        ...current,
        [activeMapDiaryDateKey]: normalizeMapReportSettings(nextSettings)
      };
    });
  };
  const selectedUser =
    safeUsers.find((user) => user.id === selectedUserId) ?? latestUserResult?.user ?? safeUsers[0] ?? null;
  const onlineUsers = useMemo(
    () => safeUsers.filter((user) => user.is_online),
    [safeUsers]
  );
  const {
    visibleMapPoints,
    puntosJornadaLabel,
    mapPointsForCanvas,
    listedMapPoints,
    hiddenMapPointCount,
    hiddenCanvasPointCount,
    selectedMapPoint
  } = useFieldMapPoints({ activeMapDiaryDateKey, isCompactMapView, mapPointListLimit, safeMapPoints, selectedMapPointId });
  const {
    mapReportData,
    mapReportPrintData,
    getSelectedMapReportData,
    getSelectedCajaTotal,
    fieldDebtSummary,
    fieldDebtChartData,
    mapReportPagination,
    mapAnalyticsData
  } = useMapReportData({
    fieldDebtReport,
    mapDiaryGroups,
    mapPointContexts,
    mapReportPage,
    mapReportSettings,
    safeBarrioCodes,
    visibleMapPoints
  });
  const isDirty = useMemo(() => {
    const baseline = form.id
      ? comparableFormShape(safeRecords.find((record) => record.id === form.id) ?? emptyForm)
      : comparableFormShape(draftForm ?? emptyForm);

    return (
      JSON.stringify(comparableFormShape(form)) !== JSON.stringify(baseline) || Boolean(selectedFile)
    );
  }, [draftForm, form, safeRecords, selectedFile]);
  const todayDateKey = getMapDiaryDateKey(new Date());
  const {
    padronStatisticsData,
    aguasServiceReportData,
    getAguasServiceBarrioName,
    selectedAguasServiceBarrioRows,
    toggleAguasServiceBarrioSelection
  } = usePadronReportData({
    alcaldiaComparison,
    padronChartMode,
    padronRequestResult,
    padronServiceReport,
    padronStatsBarrioFilter,
    padronStatsLimit,
    padronStatsSortDirection,
    padronStatsSortMetric,
    selectedAguasServiceBarrios,
    selectedAguasServiceField,
    selectedPadronServiceField,
    selectedPadronStatBarrio,
    setSelectedAguasServiceBarrios
  });
  useEffect(() => {
    setSelectedAguasServiceBarrios((current) => {
      if (!current.length) return current;
      const validNames = new Set(aguasServiceReportData.barrios.map((barrio) => getAguasServiceBarrioName(barrio)));
      const next = current.filter((name) => validNames.has(name));
      return next.length === current.length ? current : next;
    });
  }, [aguasServiceReportData.barrios, getAguasServiceBarrioName]);

  const { recordDeadlineMetaById, alertRecords, filteredRecords, recordPagination } = useRecordFilters({
    getRecordBarrioName,
    recordFilters,
    recordPage,
    recordQuickFilter,
    recordView,
    safeRecords,
    todayDateKey
  });












  const showAlert = useCallback((text) => {
    if (!text || (intentionalLogoutRef.current && /la sesi[oó]n venci[oó]/i.test(text))) return;
    const details = getAlertDetails(text);
    toast[details.tone](details.label, {
      description: text,
      duration: 5000,
      closeButton: true
    });
  }, []);

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

  // La barra de actividad cuenta peticiones en curso, no renderiza por cada una:
  // el contador vive en una ref y el estado solo cambia al empezar y al terminar
  // una tanda. Espera 180 ms antes de mostrarse para que una consulta rápida no
  // dispare un parpadeo.
  const marcarPeticionInicio = useCallback(() => {
    peticionesEnCursoRef.current += 1;
    if (peticionesEnCursoRef.current === 1) {
      window.clearTimeout(actividadTimerRef.current);
      actividadTimerRef.current = window.setTimeout(() => setCargandoDatos(true), 180);
    }
  }, []);

  const marcarPeticionFin = useCallback(() => {
    peticionesEnCursoRef.current = Math.max(0, peticionesEnCursoRef.current - 1);
    if (peticionesEnCursoRef.current === 0) {
      window.clearTimeout(actividadTimerRef.current);
      setCargandoDatos(false);
    }
  }, []);

  // Revalidacion por ETag hecha a mano. Express ya envia ETag en cada GET, pero
  // Chrome no guarda respuestas cross-origin que llevan Authorization, asi que
  // nunca mandaba If-None-Match: cada sondeo del tablero rebajaba la respuesta
  // entera. Aqui se guarda el ETag y el ultimo cuerpo por ruta y se revalida a
  // mano: el servidor sigue consultandose siempre (los datos nunca se sirven sin
  // preguntar), pero cuando nada cambio responde 304 sin cuerpo y se reutiliza
  // lo ya recibido. Solo para las rutas que se sondean, via `revalidate: true`.
  const apiRevalidateCacheRef = useRef(new Map());

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers ?? {});

    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }

    const { revalidate, ...fetchOptions } = options;
    const cacheKey = revalidate ? `${fetchOptions.method ?? "GET"} ${path}` : "";
    const cached = cacheKey ? apiRevalidateCacheRef.current.get(cacheKey) : null;

    if (cached?.etag) {
      headers.set("If-None-Match", cached.etag);
    }

    marcarPeticionInicio();
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...fetchOptions,
        cache: fetchOptions.cache ?? "no-store",
        credentials: fetchOptions.credentials ?? "include",
        headers
      });

      if (cacheKey) {
        if (response.status === 304 && cached) {
          // Se devuelve una respuesta equivalente para que quien llama siga
          // haciendo `await response.json()` sin enterarse del 304.
          return new Response(cached.body, {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (response.ok) {
          const etag = response.headers.get("ETag");
          if (etag) {
            const body = await response.clone().text();
            apiRevalidateCacheRef.current.set(cacheKey, { etag, body });
          } else {
            apiRevalidateCacheRef.current.delete(cacheKey);
          }
        }
      }
      if (response.status === 401 && session?.token && !sessionInvalidatingRef.current) {
        sessionInvalidatingRef.current = true;
        clearSession();
        if (!intentionalLogoutRef.current) showAlert("Tu sesión venció. Ingresa de nuevo para continuar.");
      }
      return response;
    } finally {
      marcarPeticionFin();
    }
  }, [session?.token, marcarPeticionInicio, marcarPeticionFin]);
  const {
    persistLookupHistory,
    handleRemoveLookupHistoryItem,
    handleLookupInputChange,
    handleLookupPrefixModeChange,
    handleLookupSearchModeChange,
    handleLookupSearch
  } = useLookupActions({
    apiFetch,
    clearSession,
    isAuthenticated,
    lookupHistory,
    lookupPrefixMode,
    lookupQuery,
    lookupSearchMode,
    padronMeta,
    setLookupFeedback,
    setLookupHistory,
    setLookupLoading,
    setLookupPrefixMode,
    setLookupQuery,
    setLookupResult,
    setLookupSearchMode,
    showAlert,
    workspaceView
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


































  const refreshDashboard = useCallback(
    async ({ force = false } = {}) => {
      if (!isAuthenticated || !isAdmin || workspaceView !== "dashboard") return;
      if (!force && document.visibilityState !== "visible") return;

      setDashboardRefreshing(true);
      setDashboardConnectionStatus("updating");
      try {
        // `loadUsers` no va aqui: el efecto de usuarios en linea ya es su dueño
        // unico y lo refresca cada 20 s, ademas de al enfocar la ventana y al
        // volver a la pestaña. Teniendolo tambien en este ciclo de 10 s, /users
        // salia dos veces al abrir el tablero y nueve veces por minuto.
        await Promise.all([
          loadRecordSummary({ silent: true }),
          loadMapDiaryGroups({ silent: true }),
          loadAuditLogs({ silent: true })
        ]);
        setDashboardLastUpdatedAt(Date.now());
        setDashboardConnectionStatus("synced");
      } catch {
        setDashboardConnectionStatus("retrying");
      } finally {
        setDashboardRefreshing(false);
      }
    },
    [isAuthenticated, isAdmin, workspaceView]
  );






































  const {
    buildMapReportPadronData,
    handleVerifyFieldDebt,
    handlePrintFieldDebtReport,
    handlePrintFieldDebtChart,
    handleDownloadFieldDebtPdf
  } = createFieldDebtReports({
    activeMapDiaryDateKey,
    apiFetch,
    fieldDebtChartData,
    fieldDebtReport,
    fieldDebtSummary,
    padronMeta,
    setFieldDebtReport,
    setLoadingFieldDebtReport,
    setShowFieldDebtModal,
    showAlert,
    visibleMapPoints
  });
  const {
    adminInsight,
    dashboardLiveMetrics,
    dashboardLiveFeed,
    dashboardPriorityItems,
    dashboardAlertCounts,
    overdueComparisonRecords,
    alcaldiaComparisonByClave,
    filteredDashboardAlertRecords,
    dashboardTechnicianSummary
  } = useDashboardData({
    alcaldiaComparison,
    alertRecords,
    dashboardAlertFilter,
    dashboardNow,
    getRecordBarrioName,
    isAdmin,
    mapDiaryGroups,
    mapPointContexts,
    mapPointsTotal,
    onlineUsers,
    padronMeta,
    recordDeadlineMetaById,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapDiaryGroupsSummary,
    safeMapPoints,
    safeRecords,
    safeUsers,
    todayDateKey
  });
  const { executiveReportData } = useExecutiveReportData({
    alcaldiaMeta,
    dashboardTechnicianSummary,
    getRecordBarrioName,
    mapDiaryGroups,
    mapPointContexts,
    mapReportData,
    onlineUsers,
    padronMeta,
    padronRequestResult,
    recordDeadlineMetaById,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeRecords,
    safeUsers
  });
  const { handleDownloadExecutiveReportPdf } = createExecutiveReportPdf({
    alertRecords,
    executiveReportData,
    mapDiaryGroups,
    safeAuditLogs,
    safeMapPoints,
    safeRecords,
    safeUsers,
    showAlert
  });
  const {
    resetReportMapDraft,
    handleReportMapDraftChange,
    handleMapReportStaffChange,
    handleMapReportTechnicianChange,
    addMapReportTechnician,
    removeMapReportTechnician,
    handleMapReportSettingsChange,
    handleMapReportImageChange,
    clearMapReportImage,
    captureReportMapImage,
    handleEditReportMapPoint,
    handleSaveReportMapPoint
  } = useReportMapActions({
    apiFetch,
    clearSession,
    editingReportMapPointId,
    reportMapCaptureRef,
    reportMapDraft,
    safeBarrioCodes,
    safeMapPoints,
    setEditingReportMapPointId,
    setMapDiaryDateKey,
    setMapDiaryGroupsSummary,
    setMapPoints,
    setMapReportSettings,
    setMapReportStaff,
    setReportMapDraft,
    setSavingReportMapPoint,
    showAlert,
    visibleMapPoints
  });
  const { handleDownloadRegulatorEvidencePdf } = createRegulatorEvidencePdf({
    activeMapDiaryDateKey,
    apiFetch,
    captureReportMapImage,
    generatingRegulatorReport,
    isAdmin,
    mapPointContexts,
    mapReportSettings,
    mapReportStaff,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeUsers,
    selectedRegulatorDiaryKeys,
    session,
    setGeneratingRegulatorReport,
    showAlert,
    visibleMapPoints
  });
  const {
    handleDownloadMapReport,
    handlePrintMapFieldReport,
    handleDownloadMapFieldPdf,
    handlePrintMapCensusReport,
    handleDownloadMapCensusPdf,
    handlePrintMapBriefReport,
    handleDownloadMapBriefPdf
  } = createMapReportPrinters({
    activeMapDiaryDateKey,
    apiFetch,
    buildMapReportPadronData,
    captureReportMapImage,
    getSelectedCajaTotal,
    getSelectedMapReportData,
    mapReportSettings,
    mapReportStaff,
    showAlert
  });
  const {
    batchPrintSelection,
    printedSaveSelection,
    manualPrintedSelection,
    printBatchStatusCounts,
    filteredPrintBatchRecords
  } = usePrintBatchSelection({
    batchPrintCopies,
    filteredRecords,
    getRecordBarrioName,
    printBatchQuickFilter,
    printBatchSearch,
    printBatchStatusView,
    recordView,
    safeRecords
  });
  const { loadRecords, loadRecordSummary } = createRecordLoaders({
    apiFetch,
    clearSession,
    isAdmin,
    isAuthenticated,
    recordView,
    setRecordView,
    setRecords,
    showAlert
  });
  const {
    openPrintBatchModalForRecords,
    updateBatchPrintCopies,
    adjustBatchPrintCopies,
    clearBatchPrintCopies,
    selectVisibleBatchPrintCopies,
    togglePrintedSaveSelection,
    togglePendingPrintedSelection,
    selectVisiblePrintedForSave,
    selectVisiblePendingAsPrinted,
    markBatchFichaRecordsAsPrinted,
    handleMoveSelectedFichasToPrinted,
    handleMarkSelectedAlertsAsPrinted,
    handleSaveSelectedPrintedRecords,
    handlePrintBatch,
    handlePrintFicha,
    handlePrintAviso
  } = createFichaPrinting({
    apiFetch,
    batchPrintSelection,
    filteredPrintBatchRecords,
    form,
    getRecordBarrioName,
    loadRecords,
    manualPrintedSelection,
    printedSaveSelection,
    recordView,
    search,
    selectedFile,
    selectedPhotoUrl,
    setBatchPrintCopies,
    setBatchPrinting,
    setForm,
    setPrintBatchQuickFilter,
    setPrintBatchSearch,
    setPrintBatchStatusView,
    setRecords,
    setShowDashboardAlertsModal,
    setShowPrintBatchModal,
    showAlert
  });
  const {
    clearPadronDerivedState,
    clearClientPadronCaches,
    updatePadronSyncState,
    updateAlcaldiaSyncState,
    applyAlcaldiaSyncResult,
    runPadronSyncSteps,
    loadPadronMeta,
    loadPadronBatches,
    loadAlcaldiaMeta,
    loadAlcaldiaComparison,
    loadPadronRequestMeta,
    loadPadronServiceReport,
    handlePadronRequestFormChange,
    handlePadronRequestPresetChange,
    handleRunPadronRequest
  } = createPadronDataActions({
    apiFetch,
    clearSession,
    isAdmin,
    isAuthenticated,
    padronRequestForm,
    padronRequestTemplates,
    persistLookupHistory,
    setAlcaldiaComparison,
    setAlcaldiaImportSummary,
    setAlcaldiaMeta,
    setAlcaldiaSyncState,
    setDashboardLastUpdatedAt,
    setFieldDebtReport,
    setLoadingAlcaldiaComparison,
    setLoadingAlcaldiaMeta,
    setLoadingPadronBatches,
    setLoadingPadronMeta,
    setLoadingPadronRequest,
    setLoadingPadronRequestMeta,
    setLoadingPadronServiceReport,
    setLookupFeedback,
    setLookupQuery,
    setLookupResult,
    setPadronBatches,
    setPadronChartMode,
    setPadronChartType,
    setPadronImportSummary,
    setPadronMeta,
    setPadronRequestForm,
    setPadronRequestLoadError,
    setPadronRequestResult,
    setPadronRequestTemplates,
    setPadronServiceReport,
    setPadronStatsBarrioFilter,
    setPadronStatsSortDirection,
    setPadronStatsSortMetric,
    setPadronSyncState,
    setSelectedAguasServiceField,
    setSelectedPadronBatchCode,
    setSelectedPadronServiceField,
    setSelectedPadronStatBarrio,
    setShowFieldDebtModal,
    showAlert,
    workspaceView
  });
  const {
    handlePrintPadronRequest,
    handleDownloadPadronRequestPdf,
    handlePrintAguasServiceReport,
    handleDownloadAguasServicePdf,
    handleDownloadPadronStatsPdf,
    handlePrintAguasComparisonList
  } = createPadronReportPrinters({
    aguasServiceReportData,
    alcaldiaComparison,
    alcaldiaComparisonByClave,
    alcaldiaMeta,
    getRecordBarrioName,
    loadAlcaldiaComparison,
    markBatchFichaRecordsAsPrinted,
    overdueComparisonRecords,
    padronChartMode,
    padronMeta,
    padronRequestResult,
    padronServiceReport,
    padronStatisticsData,
    padronStatsSortMetric,
    printComparisonHeader,
    safeBarrioCodes,
    selectedAguasServiceBarrioRows,
    selectedPadronServiceField,
    setDownloadingAguasServicePdf,
    setDownloadingPadronStatsPdf,
    setPrintingComparison,
    setShowPrintComparisonModal,
    showAlert
  });

  const { loadUsers } = createUserLoaders({
    apiFetch,
    clearSession,
    isAdmin,
    isAuthenticated,
    setLoadingUsers,
    setSelectedUserId,
    setUsers,
    showAlert
  });
  const { loadAuditLogs, handleOpenAuditReport, handleReprintAuditReport } = createAuditLoaders({
    apiFetch,
    auditFiltersQuery,
    clearSession,
    isAdmin,
    isAuthenticated,
    selectedAuditReport,
    setAuditLogs,
    setLoadingAuditReportId,
    setLoadingLogs,
    setSelectedAuditReport,
    showAlert
  });
  const {
    handleUserFormChange,
    handleCreateUser,
    handleDeleteUser,
    handleResetUserPassword,
    handleUpdateUserRole
  } = createUserAdminActions({
    apiFetch,
    clearSession,
    latestUserResult,
    loadAuditLogs,
    loadUsers,
    setCreatingUser,
    setLatestUserResult,
    setPendingDeleteUser,
    setSavingUserRoleId,
    setSelectedUserId,
    setUserForm,
    setUsers,
    showAlert,
    userForm
  });
  const {
    handlePadronFileChange,
    handleAlcaldiaFileChange,
    handleUploadPadron,
    handleActivatePadronBatch,
    confirmActivatePadronBatch,
    handleVerifyPadronBatch,
    handleUploadAlcaldia,
    handleReprocessPadron,
    handleDownloadPadron,
    handleDownloadPadronBatch
  } = createPadronAdminActions({
    alcaldiaFile,
    apiFetch,
    applyAlcaldiaSyncResult,
    clearClientPadronCaches,
    clearPadronDerivedState,
    clearSession,
    confirmingPadronBatch,
    loadPadronBatches,
    padronFile,
    runPadronSyncSteps,
    selectedPadronBatch,
    setActivatingPadronBatch,
    setAlcaldiaFile,
    setAlcaldiaSyncState,
    setConfirmingPadronBatch,
    setDashboardLastUpdatedAt,
    setDownloadingPadron,
    setDownloadingPadronBatch,
    setPadronFile,
    setReprocessingPadron,
    setUploadingAlcaldia,
    setUploadingPadron,
    setVerifyingPadronBatch,
    showAlert,
    updateAlcaldiaSyncState,
    updatePadronSyncState
  });
  const {
    handleAuditFilterChange,
    handleAuditFilterClear,
    handleAuditFiltersReset,
    handleAuditReportArchiveShortcut,
    handleExportAuditLogs
  } = createAuditActions({ apiFetch, auditFilters, setAuditFilters, setAuditFiltersOpen, showAlert });
  const { handleLoginChange, handlePasswordFormChange, handleLogin, handleLogout, handleChangePassword } = createAuthActions({
    apiFetch,
    clearSession,
    intentionalLogoutRef,
    loadAuditLogs,
    loginForm,
    passwordForm,
    session,
    sessionInvalidatingRef,
    setAuthFx,
    setChangingPassword,
    setLoginForm,
    setLoginLoading,
    setPasswordFeedback,
    setPasswordForm,
    setSession,
    setSessionVerified,
    setShowPasswordModal,
    setWorkspaceView,
    showAlert
  });
  const {
    handleMapDraftChange,
    adjustMapDraftHousingUnits,
    handleMapDraftFromMap,
    handleLocateUser,
    resetMapDraft,
    handleSaveMapPoint,
    handleDeleteMapPoint,
    handleSelectMapPoint,
    handleEditMapPoint,
    handleOpenPointInMaps,
    handleCopyCoordinates
  } = createFieldMapActions({
    apiFetch,
    clearSession,
    editingMapPointId,
    isAdmin,
    mapDraft,
    safeBarrioCodes,
    safeMapPoints,
    setEditingMapPointId,
    setLocatingUser,
    setMapDiaryDateKey,
    setMapDiaryGroupsSummary,
    setMapDraft,
    setMapFocusRequest,
    setMapLocationHelp,
    setMapPoints,
    setMapStatus,
    setSavingMapPoint,
    setSelectedMapPointId,
    showAlert,
    visibleMapPoints
  });
  const { headerStats } = useHeaderStats({
    draftForm,
    form,
    isAdmin,
    isTransport,
    loadingMapPoints,
    loadingPadronRequest,
    locatingUser,
    lookupResult,
    mapDiaryGroups,
    mapPointContexts,
    mapPointsTotal,
    mapReportData,
    mapStatus,
    onlineUsers,
    padronMeta,
    padronRequestResult,
    safeAuditLogs,
    safeBarrioCodes,
    safeRecords,
    selectedMapPoint,
    uploadingPadron,
    visibleMapPoints,
    workspaceView
  });
  const {
    headerMeta,
    adminWorkspaceSections,
    moduleNavigationItems,
    primaryModuleNavigationItems,
    secondaryModuleNavigationItems,
    currentModuleNavigation,
    sidebarNavigationSections
  } = useAppNavigation({
    isAdmin,
    isFieldValidator,
    mapPointsTotal,
    mapReportData,
    padronMeta,
    padronRequestResult,
    puntosJornadaLabel,
    safeAuditLogs,
    safeBarrioCodes,
    safeRecords,
    safeUsers,
    visibleMapPoints,
    workspaceView
  });
  const {
    loadBarrioCodes,
    handleBarrioCodeFormChange,
    handleResetBarrioCodeForm,
    handlePrepareAddBarrioCode,
    handleEditBarrioCode,
    handleSaveBarrioCode,
    handleDeleteBarrioCode
  } = createBarrioCodeActions({
    apiFetch,
    barrioCodeForm,
    clearSession,
    isAuthenticated,
    setBarrioCodeForm,
    setBarrioCodes,
    setLoadingBarrioCodes,
    setSavingBarrioCode,
    showAlert
  });
  const {
    loadMapDiaryGroups,
    loadMapPoints,
    loadArchivedMapDiaryPoints,
    openMapDiaryArchiveModal,
    handleUseArchivedMapDiary,
    loadMapPointContexts,
    handleToggleRegulatorDiaryKey
  } = createMapDataLoaders({
    apiFetch,
    archivedMapDiaryGroups,
    clearSession,
    isAdmin,
    isAuthenticated,
    mapPointsRequestRef,
    safeMapPoints,
    selectedArchiveMapDiaryGroup,
    selectedArchiveMapDiaryKey,
    selectedRegulatorDiaryKeys,
    setArchiveMapDiaryPoints,
    setLoadingArchiveMapDiaryPoints,
    setLoadingMapContexts,
    setLoadingMapPoints,
    setMapDiaryDateKey,
    setMapDiaryGroupsSummary,
    setMapPointContexts,
    setMapPoints,
    setMapReportPage,
    setMapStatus,
    setRegulatorReportDiaryKeys,
    setSelectedArchiveMapDiaryKey,
    setSelectedMapPointId,
    setShowMapDiaryArchiveModal,
    showAlert
  });
  const {
    applyRecord,
    handleValidatePrintRecord,
    focusSheet,
    handleSelectRecord,
    resetForm,
    handleDeleteArchivedRecord
  } = createRecordFormActions({
    apiFetch,
    form,
    getRecordBarrioName,
    loadRecords,
    safeBarrioCodes,
    search,
    setDraftForm,
    setForm,
    setPendingDeleteRecord,
    setProcessingRecordId,
    setRecordFilters,
    setRecordQuickFilter,
    setRecords,
    setSelectedFile,
    sheetRef,
    showAlert
  });
  const {
    startNewRecordFromLookup,
    buildRecordPatchFromAguasMatch,
    openLookupMatchInRecord,
    handlePrintLookupMatchReport
  } = createLookupRecordBridge({
    apiFetch,
    applyRecord,
    clearSession,
    focusSheet,
    safeBarrioCodes,
    setForm,
    setRecordFilters,
    setRecordQuickFilter,
    setSelectedFile,
    setWorkspaceView,
    showAlert
  });
  useRecordEffects({
    alertRecords,
    form,
    getRecordBarrioName,
    isAdmin,
    isAuthenticated,
    loadBarrioCodes,
    loadRecords,
    localSelectedPhotoUrl,
    notifiedRecordAlerts,
    recordDeadlineMetaById,
    recordFilters,
    recordPagination,
    recordQuickFilter,
    recordView,
    safeBarrioCodes,
    search,
    setDashboardNow,
    setDraftForm,
    setForm,
    setNotifiedRecordAlerts,
    setRecordPage,
    setRecordView,
    workspaceView
  });
  useFieldMapEffects({
    activeMapDiaryDateKey,
    apiFetch,
    isAdmin,
    isAuthenticated,
    isCompactMapView,
    loadMapDiaryGroups,
    loadMapPointContexts,
    loadMapPoints,
    mapDescriptionLookupCacheRef,
    mapDiaryDateKey,
    mapDraft,
    mapPointsRequestRef,
    mapReportPrintData,
    mapReportSettingsByDate,
    padronMeta,
    regulatorReportDiaryKeys,
    regulatorReportDiaryOptions,
    safeBarrioCodes,
    setMapDescriptionLookupStatus,
    setMapDiaryDateKey,
    setMapDraft,
    setMapPointListLimit,
    setMapReportPage,
    setRegulatorReportDiaryKeys,
    setSelectedMapPointId,
    visibleMapPoints,
    workspaceView
  });
  useAdminDataEffects({
    alcaldiaComparison,
    apiFetch,
    auditFilters,
    auditFiltersQuery,
    isAdmin,
    isAuthenticated,
    loadAlcaldiaComparison,
    loadAlcaldiaMeta,
    loadAuditLogs,
    loadBarrioCodes,
    loadMapDiaryGroups,
    loadMapPoints,
    loadPadronBatches,
    loadPadronMeta,
    loadPadronRequestMeta,
    loadPadronServiceReport,
    loadRecords,
    loadUsers,
    refreshDashboard,
    setAuditFiltersQuery,
    workspaceView
  });
  useAppShellEffects({
    apiFetch,
    clearSession,
    intentionalLogoutRef,
    isAdmin,
    isAuthenticated,
    isFieldValidator,
    mustChangePassword,
    session,
    sessionInvalidatingRef,
    setIsCompactMapView,
    setSession,
    setSessionVerified,
    setShowMobileModuleMenu,
    setShowPasswordModal,
    setShowUserMenu,
    setUnreadMessagesCount,
    setWorkspaceView,
    showAlert,
    sidebarCollapsed,
    workspaceView
  });
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
        model={{
          authFx,
          handleLogin,
          handleLoginChange,
          loginForm,
          loginLoading,
          setShowLoginPassword,
          showLoginPassword
        }}
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
          model={{
            changingPassword,
            handleChangePassword,
            handlePasswordFormChange,
            mustChangePassword,
            passwordFeedback,
            passwordForm,
            setShowPasswordModal
          }}
        />
      ) : null}
      {pendingDeleteUser ? (
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
      ) : null}
      {pendingDeleteRecord ? (
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
      ) : null}
      <FieldDebtDialog
        model={{
          activeMapDiaryDateKey,
          fieldDebtReport,
          fieldDebtSummary,
          handleDownloadFieldDebtPdf,
          handlePrintFieldDebtReport,
          loadingFieldDebtReport,
          setShowFieldDebtModal,
          showFieldDebtModal
        }}
      />
      <MapDiaryArchiveDialog
        model={{
          archiveMapDiaryPoints,
          archivedMapDiaryGroups,
          handleUseArchivedMapDiary,
          loadArchivedMapDiaryPoints,
          loadingArchiveMapDiaryPoints,
          selectedArchiveMapDiaryGroup,
          setShowMapDiaryArchiveModal,
          setSidebarCollapsed,
          showMapDiaryArchiveModal,
          sidebarCollapsed
        }}
      />
      <PrintBatchDialog
        model={{
          adjustBatchPrintCopies,
          batchPrintCopies,
          batchPrintSelection,
          batchPrinting,
          clearBatchPrintCopies,
          filteredPrintBatchRecords,
          getRecordBarrioName,
          handleMoveSelectedFichasToPrinted,
          handlePrintBatch,
          handleSaveSelectedPrintedRecords,
          handleValidatePrintRecord,
          manualPrintedSelection,
          printBatchQuickFilter,
          printBatchSearch,
          printBatchStatusCounts,
          printBatchStatusView,
          printedSaveSelection,
          processingRecordId,
          selectVisibleBatchPrintCopies,
          selectVisiblePendingAsPrinted,
          selectVisiblePrintedForSave,
          setPrintBatchQuickFilter,
          setPrintBatchSearch,
          setPrintBatchStatusView,
          setShowPrintBatchModal,
          setShowPrintComparisonModal,
          showPrintBatchModal,
          togglePendingPrintedSelection,
          togglePrintedSaveSelection,
          updateBatchPrintCopies
        }}
      />
      <PrintComparisonDialog
        model={{
          alcaldiaComparisonByClave,
          getRecordBarrioName,
          handlePrintAguasComparisonList,
          overdueComparisonRecords,
          printComparisonHeader,
          printingComparison,
          setPrintComparisonHeader,
          setShowPrintComparisonModal,
          showPrintComparisonModal
        }}
      />
      <DashboardAlertsDialog
        model={{
          batchPrintCopies,
          batchPrinting,
          dashboardAlertCounts,
          dashboardAlertFilter,
          filteredDashboardAlertRecords,
          handleMarkSelectedAlertsAsPrinted,
          handleSelectRecord,
          manualPrintedSelection,
          openPrintBatchModalForRecords,
          overdueComparisonRecords,
          setDashboardAlertFilter,
          setShowDashboardAlertsModal,
          setShowPrintComparisonModal,
          setWorkspaceView,
          showDashboardAlertsModal,
          togglePendingPrintedSelection
        }}
      />
      <AuditReportViewerDialog
        model={{ handleReprintAuditReport, selectedAuditReport, setSelectedAuditReport }}
      />
      <AppHeader
        model={{
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
          executiveReportData,
          handleDownloadExecutiveReportPdf,
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
          safeMapPoints,
          safeRecords,
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
          workspaceView
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
      ) : workspaceView === "railwayUsage" ? (
        <main className="railway-usage-layout">
          <Suspense fallback={<ModuleSkeleton title="uso en Railway" toolbar={false} rows={4} />}>
            <RailwayUsageWorkspace apiFetch={apiFetch} />
          </Suspense>
        </main>
      ) : workspaceView === "executiveReport" ? (
      <ExecutiveReportView
        model={{
          alcaldiaMeta,
          alertRecords,
          executiveReportData,
          handleDownloadExecutiveReportPdf,
          mapDiaryGroups,
          padronMeta,
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
            apiFetch,
            buildRecordPatchFromAguasMatch,
            downloadingPadron,
            handleDownloadPadron,
            handleLookupInputChange,
            handleLookupPrefixModeChange,
            handleLookupSearch,
            handleLookupSearchModeChange,
            handlePrintLookupMatchReport,
            handleRemoveLookupHistoryItem,
            lookupFeedback,
            lookupHistory,
            lookupInputLabel,
            lookupInputPlaceholder,
            lookupLoading,
            lookupModeConfig,
            lookupPrefixMode,
            lookupQuery,
            lookupResult,
            lookupSearchMode,
            openLookupMatchInRecord,
            padronMeta,
            setLookupFeedback,
            setLookupPrefixMode,
            setLookupQuery,
            setLookupResult,
            setLookupSearchMode,
            setShowLookupClassicModal,
            showLookupClassicModal,
            startNewRecordFromLookup
          }}
        />
      ) : workspaceView === "importacion" ? (
        <Suspense fallback={<main className="import-workspace"><ModuleSkeleton title="la importación" /></main>}>
          <ImportacionWorkspace apiFetch={apiFetch} showAlert={showAlert} />
        </Suspense>
      ) : workspaceView === "padron" ? (
        <PadronWorkspace
          model={{
            activatingPadronBatch,
            alcaldiaComparison,
            alcaldiaFile,
            alcaldiaImportSummary,
            alcaldiaMeta,
            alcaldiaSyncState,
            confirmActivatePadronBatch,
            confirmingPadronBatch,
            downloadingPadron,
            downloadingPadronBatch,
            handleActivatePadronBatch,
            handleAlcaldiaFileChange,
            handleDownloadPadron,
            handleDownloadPadronBatch,
            handlePadronFileChange,
            handleReprocessPadron,
            handleUploadAlcaldia,
            handleUploadPadron,
            handleVerifyPadronBatch,
            loadAlcaldiaComparison,
            loadAlcaldiaMeta,
            loadPadronMeta,
            loadingAlcaldiaComparison,
            loadingAlcaldiaMeta,
            loadingPadronBatches,
            loadingPadronMeta,
            padronBatches,
            padronFile,
            padronImportSummary,
            padronMeta,
            padronSyncState,
            reprocessingPadron,
            selectedPadronBatch,
            selectedPadronBatchCode,
            setAlcaldiaFile,
            setConfirmingPadronBatch,
            setPadronFile,
            setSelectedPadronBatchCode,
            uploadingAlcaldia,
            uploadingPadron,
            verifyingPadronBatch
          }}
        />
      ) : workspaceView === "map" ? (
        <FieldMapWorkspace
          model={{
            activeMapDiaryDateKey,
            adjustMapDraftHousingUnits,
            archivedMapDiaryGroups,
            editingMapPointId,
            handleCopyCoordinates,
            handleDeleteMapPoint,
            handleDownloadMapReport,
            handleEditMapPoint,
            handleLocateUser,
            handleMapDraftChange,
            handleMapDraftFromMap,
            handleOpenPointInMaps,
            handleSaveMapPoint,
            handleSelectMapPoint,
            hiddenCanvasPointCount,
            hiddenMapPointCount,
            isAdmin,
            listedMapPoints,
            loadingMapPoints,
            locatingUser,
            mapDescriptionLookupStatus,
            mapDiaryGroups,
            mapDraft,
            mapFocusRequest,
            mapLocationHelp,
            mapPointsForCanvas,
            mapStatus,
            openMapDiaryArchiveModal,
            primaryMapDiaryGroups,
            resetMapDraft,
            savingMapPoint,
            selectedMapPoint,
            selectedMapPointId,
            setMapDiaryDateKey,
            setMapPointListLimit,
            setMapStatus,
            setShowMapPrintDialog,
            showMapPrintDialog,
            visibleMapPoints,
            workspaceView
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
          }}
        />
      )}
    </div>
  );
}

export default App;
