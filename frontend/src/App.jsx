import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@blossom-carousel/core/style.css";
import { toast, Toaster } from "sonner";
import { actionIconName } from "./components/Icon";
import { emptyBarrioForm } from "./components/BarrioCodesWorkspace";
import AppSidebar from "./components/sidebar/AppSidebar";
import { buildSidebarSections, getPathForWorkspaceView } from "./components/sidebar/sidebarConfig";
import { ModuleSkeleton } from "./components/ds/Skeleton";
import "./components/ds/design-system.css";
import "./styles/request-workspace.css";
import logoAguasCholuteca from "./assets/logo-aguas-choluteca.png";
import { API_URL } from "./config/api";
import {
  AUTH_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  DRAFT_SAVED_AT_STORAGE_KEY,
  LOOKUP_HISTORY_STORAGE_KEY,
  MAP_REPORT_SETTINGS_STORAGE_KEY,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  RECORD_ALERT_NOTIFICATION_STORAGE_KEY,
  NOTIFICATION_REQUEST_STORAGE_KEY
} from "./constants/storageKeys";
import {
  defaultMapReportStaff,
  defaultPadronRequestForm,
  emptyForm,
  emptyMapDraft,
  emptyMapReportDraft,
} from "./constants/formsAndUi";
import {
  actionLabel,
  buildPhotoUrl,
  formatCurrency,
  formatLookupAmount,
  getLookupTotalMeta,
  roleLabel
} from "./utils/formatting";
import {
  getLookupServiceMeta,
} from "./utils/claveAndLookup";
import {
  formatMapDiaryLabel,
  formatMonthGroup,
  getMapDiaryDateKey,
  normalizeRecord,
} from "./utils/datesAndBusiness";
import {
  getMapPointContextKey,
  getMapPointTypeLabel
} from "./utils/mapField";
import { selectReportZones } from "./modules/reports/utils/reportSelectors";
import {
  comparableFormShape,
  getRecordDeadlineMeta,
  getRecordGroupDate,
  hasDraftContent
} from "./utils/records";
import { loadStoredLookupHistory, loadStoredRecordNotifications } from "./utils/localStorage";
import { escapeHtml } from "./utils/html";
import { printDocument } from "./utils/printDocument";
import {
  getBarrioNameFromClave,
  normalizeBarrioCode,
  resolveBarrioFromPayload,
  withBarrioFromPrefix,
} from "./utils/barrioCodes";
import { lastDaysSeries } from "./modules/dashboard/dashboardSelectors.js";
import { installSearchScrollGuard } from "./utils/searchScrollGuard";
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
  DASHBOARD_REFRESH_INTERVAL_MS,
  MAP_POINT_LIST_INITIAL_LIMIT,
  MOBILE_MAP_POINT_LIMIT,
  MAP_AUTO_REFRESH_MS,
  MOBILE_MAP_AUTO_REFRESH_MS,
  RECORDS_PAGE_SIZE,
  MAP_DIARY_PRIMARY_LIMIT,
} from "./constants/workspace";
import { getTodayMapDiaryKey } from "./utils/mapDiary";
import {
  getMapReportZoneOverrideKey,
  normalizeMapReportStaff,
  getMapReportBarrioZone,
  getMapReportPointClave,
  getMapZoneClavesLabel,
  MAP_DESCRIPTION_PADRON_BLOCK_PATTERN,
  stripMapDescriptionPadronBlock,
  normalizeMapReportSettings,
  stripTransientMapReportSettings,
  loadMapReportSettingsByDate
} from "./utils/mapReport";
import {
  FIELD_DEBT_SERVICE_DEFINITIONS,
  extractFieldDebtLookupReferences,
  buildMapDescriptionPadronBlock,
  getFieldDebtResultLabel
} from "./utils/fieldDebt";
import {
  formatRelativeTime,
  formatDashboardSyncRelativeTime,
} from "./utils/timeFormat";
import {
  clampPrintCopies,
  getRecordPhotoPath,
} from "./utils/recordLabels";
import { humanizeDashboardActivity } from "./utils/dashboardActivity";
import {
  readJsonResponse,
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
  const visibleMapPoints = useMemo(
    () => safeMapPoints.filter((point) => getMapDiaryDateKey(point) === activeMapDiaryDateKey),
    [activeMapDiaryDateKey, safeMapPoints]
  );
  // El menú mostraba "N puntos hoy" aunque la jornada visible fuera de otro día.
  const puntosJornadaLabel = activeMapDiaryDateKey === getTodayMapDiaryKey()
    ? `${visibleMapPoints.length} puntos hoy`
    : `${visibleMapPoints.length} puntos · ${new Date(`${activeMapDiaryDateKey}T12:00:00`).toLocaleDateString("es-HN", { day: "numeric", month: "short" })}`;
  const mapPointsForCanvas = useMemo(
    () => (isCompactMapView ? visibleMapPoints.slice(0, MOBILE_MAP_POINT_LIMIT) : visibleMapPoints),
    [isCompactMapView, visibleMapPoints]
  );
  const listedMapPoints = useMemo(
    () => visibleMapPoints.slice(0, mapPointListLimit),
    [mapPointListLimit, visibleMapPoints]
  );
  const hiddenMapPointCount = Math.max(0, visibleMapPoints.length - listedMapPoints.length);
  const hiddenCanvasPointCount = Math.max(0, visibleMapPoints.length - mapPointsForCanvas.length);
  const selectedMapPoint = visibleMapPoints.find((point) => point.id === selectedMapPointId) ?? null;
  const selectedUser =
    safeUsers.find((user) => user.id === selectedUserId) ?? latestUserResult?.user ?? safeUsers[0] ?? null;
  const onlineUsers = useMemo(
    () => safeUsers.filter((user) => user.is_online),
    [safeUsers]
  );
  const headerMeta = useMemo(
    () =>
      (
        {
          records: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Panel operativo",
            title: "Registro de inmuebles clandestinos",
            lead: "Gestión centralizada de fichas, avisos y seguimiento operativo del sistema.",
            kicker: "Operación segura"
          },
          users: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Administración de accesos",
            title: "Gestión de usuarios",
            lead: "Creación de cuentas, control de perfiles y entrega de credenciales con un flujo claro.",
            kicker: "Control de acceso"
          },
          entregas: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Operación de reparto",
            title: "Control de entregas",
            lead: "Seguimiento de lotes, cierres diarios y documentos pendientes.",
            kicker: "Cierre diario"
          },
          dashboard: {
            panelClass: "hero-panel-dashboard",
            cardClass: "search-card-dashboard",
            toplineLabel: "Centro administrativo",
            // Mismo nombre que en el menú lateral: la pantalla se llama Tablero.
            title: "Tablero",
            lead: "Resumen operativo con actividad reciente y accesos rápidos para gestionar toda la plataforma.",
            kicker: "Visión general"
          },
          executiveReport: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-users",
            toplineLabel: "Operaciones realizadas",
            title: "Resumen de Operaciones realizadas",
            lead: "Informe consolidado desde el primer día de trabajo: fichas, geolocalización, mapeo, reportes, padrones, avisos, funciones desarrolladas, ahorro de tiempo y trazabilidad.",
            kicker: "Memoria operativa"
          },
          padron: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Administración de padrón",
            title: "Padrón maestro",
            lead: "Carga y reemplazo del archivo maestro usado por la consulta rápida de claves.",
            kicker: "Actualización central"
          },
          importacion: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Integracion FoxPro",
            title: "Importacion",
            lead: "Revision y aplicacion manual de lotes recibidos desde el servidor FoxPro.",
            kicker: "Zona temporal"
          },
          barrioCodes: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Catalogo territorial",
            title: "Codigos de barrios",
            lead: "Gestiona el prefijo inicial de las claves catastrales para completar barrios en fichas y reportes.",
            kicker: "Barrios"
          },
          lookup: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Consulta rápida",
            title: "Buscar clave catastral",
            lead: "Consulta apartada del módulo de fichas para validar si una clave ya existe en el padrón maestro.",
            kicker: "Uso en campo"
          },
          map: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Geolocalización operativa",
            title: "Mapa de campo",
            lead: "Módulo independiente para ubicar y registrar puntos técnicos de cajas y descargas en terreno.",
            kicker: "Trabajo en sitio"
          },
          fieldValidation: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Inteligencia territorial GPS",
            title: "Control territorial GPS",
            lead: "Consulta el historico, selecciona barrios y cruza claves, abonados y cartera para preparar nuevas jornadas.",
            kicker: "Historico y zonas"
          },
          mapReports: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-users",
            toplineLabel: "Administración de campo",
            title: "Reportes de levantamiento",
            lead: "Centro de reportes compacto para imprimir coordenadas, totales y zonas del trabajo levantado en campo.",
            kicker: "Reporte institucional"
          },
          mapAnalytics: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-users",
            toplineLabel: "Analítica de campo",
            title: "Estadísticas del levantamiento",
            lead: "Gráficos y lectura estadística del trabajo de campo, separados del reporte institucional para no interferir con impresión.",
            kicker: "Lectura ejecutiva"
          },
          transport: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Monitoreo de transporte",
            title: "Seguimiento del vehículo recolector",
            lead: "Traza la calle autorizada, ve el recorrido en verde y detecta a tiempo si el vehículo se sale de la ruta.",
            kicker: "Ruta supervisada"
          },
          planos: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Planos y croquis",
            title: "Planos y Croquis",
            lead: "Actualiza croquis de barrios usando el PDF como fondo y una capa editable para revision.",
            kicker: "Croquis editable"
          },
          requests: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Peticiones institucionales",
            title: "Consultas del padrón",
            lead: "Servicios, deuda y abonados por barrio desde el padrón maestro, listos para imprimir y PDF.",
            kicker: "Análisis ejecutivo"
          },
          logs: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-logs",
            toplineLabel: "Bitácora profesional",
            title: "Historial de actividad",
            lead: "Seguimiento continuo de movimientos relevantes con una lectura más limpia y trazable.",
            kicker: "Trazabilidad"
          },
          notes: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Uso administrativo",
            title: "Apuntes",
            lead: "Tablero personal para anotar cualquier cosa en segundos y organizarla después.",
            kicker: "Privado del administrador"
          }
        }[workspaceView] ?? {
          panelClass: "hero-panel-records",
          cardClass: "search-card-records",
          toplineLabel: "Panel operativo",
          title: "Registro de inmuebles clandestinos",
          lead: "Gestión centralizada de fichas, avisos y seguimiento operativo del sistema.",
          kicker: "Operación segura"
        }
      ),
    [workspaceView]
  );
  const recordDeadlineMetaById = useMemo(
    () =>
      Object.fromEntries(
        safeRecords.map((record) => [record.id, getRecordDeadlineMeta(record)]).filter(([, meta]) => Boolean(meta))
      ),
    [safeRecords]
  );
  const alertRecords = useMemo(
    () =>
      safeRecords.filter((record) => {
        const meta = recordDeadlineMetaById[record.id];
        return meta && ["warning", "due", "overdue"].includes(meta.statusKey);
      }),
    [recordDeadlineMetaById, safeRecords]
  );
  const headerStats = useMemo(() => {
    // El tablero ya muestra estas cifras en su propio cuerpo; repetirlas en la
    // barra superior solo duplicaba lectura.
    if (workspaceView === "dashboard") {
      return [];
    }

    if (workspaceView === "executiveReport") {
      return [
        {
          icon: "records",
          label: "Fichas",
          value: String(safeRecords.length)
        },
        {
          icon: "map",
          label: "Puntos GPS",
          value: String(mapPointsTotal)
        },
        {
          icon: "logs",
          label: "Eventos",
          value: String(safeAuditLogs.length)
        },
        {
          icon: "refresh",
          label: "Padrón",
          value: String(padronMeta?.total_records ?? 0)
        }
      ];
    }

    if (workspaceView === "lookup") {
      return [
        {
          icon: "search",
          label: "Modo",
          value: "Consulta"
        },
        {
          icon: "records",
          label: "Coincidencias",
          value: String(lookupResult?.total_matches ?? 0)
        },
        {
          icon: lookupResult?.exists ? "success" : "activity",
          label: "Resultado",
          value: lookupResult
            ? lookupResult.exists
              ? "Registrada"
              : "Posible clandestino"
            : "Sin consulta"
        }
      ];
    }

    if (workspaceView === "padron") {
      return [
        {
          icon: "refresh",
          label: "Estado",
          value: uploadingPadron ? "Actualizando" : "Listo"
        },
        {
          icon: "records",
          label: "Claves activas",
          value: String(padronMeta?.total_records ?? 0)
        },
        {
          icon: "activity",
          label: "Archivo",
          value: padronMeta?.file_name || "Sin padrón"
        }
      ];
    }

    if (workspaceView === "importacion") {
      return [
        { icon: "refresh", label: "Origen", value: "FoxPro" },
        { icon: "success", label: "Flujo", value: "Manual" },
        { icon: "records", label: "Destino", value: "Revision" }
      ];
    }

    if (workspaceView === "barrioCodes") {
      return [
        {
          icon: "map",
          label: "Codigos",
          value: String(safeBarrioCodes.length)
        },
        {
          icon: "success",
          label: "Activos",
          value: String(safeBarrioCodes.filter((item) => item.activo !== false).length)
        },
        {
          icon: "records",
          label: "Uso",
          value: "Fichas"
        }
      ];
    }

    if (workspaceView === "map") {
      return [
        {
          icon: "map",
          label: "Puntos guardados",
          value: String(visibleMapPoints.length)
        },
        {
          icon: locatingUser ? "refresh" : "activity",
          label: "Geolocalización",
          value: locatingUser ? "Buscando" : mapStatus
        },
        {
          icon: selectedMapPoint ? "success" : "map",
          label: "Selección",
          value: selectedMapPoint ? getMapPointTypeLabel(selectedMapPoint.point_type) : "Sin punto"
        }
      ];
    }

    if (workspaceView === "mapReports") {
      const zones = new Set(
        visibleMapPoints.map((point) =>
          getMapReportBarrioZone(point, mapPointContexts[getMapPointContextKey(point)] ?? null, safeBarrioCodes)
        )
      );
      return [
        {
          icon: "map",
          label: "Puntos incluidos",
          value: String(visibleMapPoints.length)
        },
        {
          icon: "records",
          label: "Zonas",
          value: String(zones.size)
        },
        {
          icon: "activity",
          label: "Estado",
          value: loadingMapPoints ? "Actualizando" : "Listo para imprimir"
        }
      ];
    }

    if (workspaceView === "fieldValidation") {
      return [
        {
          icon: "map",
          label: "Cobertura",
          value: "Historico GPS"
        },
        {
          icon: "records",
          label: "Seleccion",
          value: "Por barrios"
        },
        {
          icon: "activity",
          label: "Analisis",
          value: "Claves y cartera"
        }
      ];
    }

    if (workspaceView === "mapAnalytics") {
      return [
        {
          icon: "map",
          label: "Puntos en jornada",
          value: String(mapReportData.totalPoints)
        },
        {
          icon: "records",
          label: "Zonas",
          value: String(mapReportData.totalZones)
        },
        {
          icon: "activity",
          label: "Analítica",
          value: loadingMapPoints ? "Actualizando" : "Lista"
        }
      ];
    }

    if (workspaceView === "transport") {
      return [
        {
          icon: "transport",
          label: "Módulo",
          value: isAdmin ? "Control" : "Conductor"
        },
        {
          icon: "map",
          label: "Ruta",
          value: isTransport ? "Asignada" : "Monitoreo"
        },
        {
          icon: "activity",
          label: "Estado",
          value: "Tiempo real"
        }
      ];
    }

    // Consultas del padrón muestra sus propias cifras (usuarios, barrios, deuda).
    if (workspaceView === "requests") {
      return [];
    }

    return [
      {
        icon: "records",
        label: "Registros visibles",
        value: String(safeRecords.length)
      },
      {
        icon: form.id ? "activity" : "plus",
        label: "Modo",
        value: form.id ? "Edición" : "Nueva ficha"
      },
      {
        icon: draftForm ? "success" : "refresh",
        label: "Borrador",
        value: draftForm ? "Disponible" : "Sin cambios"
      }
    ];
  }, [
    draftForm,
    form.id,
    locatingUser,
    lookupResult,
    mapDiaryGroups.length,
    mapStatus,
    mapPointContexts,
    onlineUsers.length,
    padronMeta,
    loadingMapPoints,
    visibleMapPoints.length,
    safeRecords.length,
    mapPointsTotal,
    safeBarrioCodes,
    safeAuditLogs.length,
    selectedMapPoint,
    padronRequestResult,
    loadingPadronRequest,
    uploadingPadron,
    isAdmin,
    isTransport,
    workspaceView
  ]);
  const isDirty = useMemo(() => {
    const baseline = form.id
      ? comparableFormShape(safeRecords.find((record) => record.id === form.id) ?? emptyForm)
      : comparableFormShape(draftForm ?? emptyForm);

    return (
      JSON.stringify(comparableFormShape(form)) !== JSON.stringify(baseline) || Boolean(selectedFile)
    );
  }, [draftForm, form, safeRecords, selectedFile]);
  const todayDateKey = getMapDiaryDateKey(new Date());
  const advancedFilteredRecords = useMemo(() => {
    return safeRecords.filter((record) => {
      const claveFilter = String(recordFilters.clave || "").trim().toLowerCase();
      if (claveFilter) {
        const normalizedClave = String(record.clave_catastral || "").toLowerCase();
        const compactClave = normalizedClave.replace(/[^a-z0-9]/g, "");
        const compactFilter = claveFilter.replace(/[^a-z0-9]/g, "");
        if (!normalizedClave.includes(claveFilter) && (!compactFilter || !compactClave.includes(compactFilter))) {
          return false;
        }
      }

      if (recordFilters.barrio) {
        const barrio = getRecordBarrioName(record, "");
        if (barrio !== recordFilters.barrio) {
          return false;
        }
      }

      if (recordFilters.responsible) {
        const responsiblePool = [record.levantamiento_datos, record.analista_datos]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        if (!responsiblePool.includes(recordFilters.responsible)) {
          return false;
        }
      }

      const recordDateKey = getMapDiaryDateKey(getRecordGroupDate(record, recordView));
      if (recordFilters.date_from && (!recordDateKey || recordDateKey < recordFilters.date_from)) {
        return false;
      }

      if (recordFilters.date_to && (!recordDateKey || recordDateKey > recordFilters.date_to)) {
        return false;
      }

      if (recordFilters.status === "no_photo") {
        return Boolean(String(record.foto_path || "").trim()) === false;
      }

      if (recordFilters.status !== "all") {
        const meta = recordDeadlineMetaById[record.id];
        if (!meta || meta.statusKey !== recordFilters.status) {
          return false;
        }
      }

      return true;
    });
  }, [recordDeadlineMetaById, recordFilters, recordView, safeRecords]);
  const filteredRecords = useMemo(() => {
    if (recordQuickFilter === "clandestino") {
      return advancedFilteredRecords.filter((record) => (record.estado_padron || "clandestino") === "clandestino");
    }

    if (recordQuickFilter === "reportada") {
      return advancedFilteredRecords.filter((record) => record.estado_padron === "reportada");
    }

    if (recordQuickFilter === "varios_padrones") {
      return advancedFilteredRecords.filter((record) => record.estado_padron === "varios_padrones");
    }

    if (recordQuickFilter === "today") {
      return advancedFilteredRecords.filter(
        (record) => getMapDiaryDateKey(record.updated_at || record.created_at) === todayDateKey
      );
    }

    if (recordQuickFilter === "no_photo") {
      return advancedFilteredRecords.filter((record) => !String(record.foto_path || "").trim());
    }

    if (recordQuickFilter === "alert") {
      return advancedFilteredRecords.filter((record) => {
        const meta = recordDeadlineMetaById[record.id];
        return meta && ["warning", "due", "overdue"].includes(meta.statusKey);
      });
    }

    return advancedFilteredRecords;
  }, [advancedFilteredRecords, recordDeadlineMetaById, recordQuickFilter, todayDateKey]);
  const recordPagination = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RECORDS_PAGE_SIZE));
    const currentPage = Math.min(recordPage, totalPages);
    const start = (currentPage - 1) * RECORDS_PAGE_SIZE;

    return {
      currentPage,
      totalPages,
      start,
      end: Math.min(start + RECORDS_PAGE_SIZE, filteredRecords.length),
      records: filteredRecords.slice(start, start + RECORDS_PAGE_SIZE)
    };
  }, [filteredRecords, recordPage]);
  const mapReportData = useMemo(() => {
    try {
      const points = [...visibleMapPoints].sort((left, right) => {
        const leftContext = mapPointContexts[getMapPointContextKey(left)] ?? null;
        const rightContext = mapPointContexts[getMapPointContextKey(right)] ?? null;
        const leftZone = getMapReportBarrioZone(left, leftContext, safeBarrioCodes);
        const rightZone = getMapReportBarrioZone(right, rightContext, safeBarrioCodes);
        const zoneDiff = leftZone.localeCompare(rightZone, "es");
        if (zoneDiff !== 0) return zoneDiff;
        return new Date(right.created_at) - new Date(left.created_at);
      });

      const zoneMap = new Map();
      const totalsByType = points.reduce((totals, point) => {
        const typeLabel = getMapPointTypeLabel(point.point_type);
        totals[typeLabel] = (totals[typeLabel] ?? 0) + 1;
        return totals;
      }, {});

      points.forEach((point) => {
        const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
        const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
        const pointClave = getMapReportPointClave(point, context);
        const current = zoneMap.get(zone) ?? {
          zone,
          total: 0,
          items: [],
          accuracyValues: [],
          pointTypes: new Set(),
          claves: new Set(),
          nearbyReferences: new Set(),
          locationHints: new Set()
        };

        current.total += 1;
        if (pointClave) {
          current.claves.add(pointClave);
        }
        current.items.push({
          ...point,
          report_key: pointClave,
          report_zone_label: pointClave ? `${zone} | Clave ${pointClave}` : zone,
          suggested_zone: zone,
          suggested_reference: context?.reference || "",
          suggested_display_name: context?.display_name || ""
        });
        current.pointTypes.add(getMapPointTypeLabel(point.point_type));
        if (context?.reference) {
          current.nearbyReferences.add(context.reference);
        }
        if (context?.display_name) {
          current.locationHints.add(context.display_name);
        }
        if (Number.isFinite(Number(point.accuracy_meters))) {
          current.accuracyValues.push(Number(point.accuracy_meters));
        }
        zoneMap.set(zone, current);
      });

      const zones = Array.from(zoneMap.values()).map((zone) => ({
        ...zone,
        averageAccuracy: zone.accuracyValues.length
          ? Number((zone.accuracyValues.reduce((sum, value) => sum + value, 0) / zone.accuracyValues.length).toFixed(1))
          : null,
        pointTypesLabel: Array.from(zone.pointTypes).join(", "),
        clavesLabel: getMapZoneClavesLabel(zone),
        clavesTotal: zone.claves.size,
        nearbyReferencesLabel: Array.from(zone.nearbyReferences).slice(0, 3).join(" | "),
        primaryLocationLabel: Array.from(zone.locationHints)[0] || ""
      }));

      return {
        totalPoints: points.length,
        totalZones: zones.length,
        totalsByType,
        zones
      };
    } catch (error) {
      console.error("mapReportData failed", error);
      return {
        totalPoints: Array.isArray(visibleMapPoints) ? visibleMapPoints.length : 0,
        totalZones: 0,
        totalsByType: {},
        zones: []
      };
    }
  }, [mapPointContexts, safeBarrioCodes, visibleMapPoints]);
  const mapReportPrintData = useMemo(() => {
    const manualBarrio = mapReportSettings.manual_barrio.trim();
    const applyZoneOverrides = (data) => ({
      ...data,
      zones: data.zones.map((zone, index) => {
        const overrideKey = getMapReportZoneOverrideKey(zone.zone);
        const override = mapReportSettings.zone_overrides?.[overrideKey] ?? {};
        const displayName = String(override.name || manualBarrio || zone.zone || "").trim() || zone.zone;
        const displayKicker = String(override.kicker || `Zona ${index + 1}`).trim() || `Zona ${index + 1}`;
        const displayReference =
          String(override.reference || zone.nearbyReferencesLabel || "").trim() || zone.nearbyReferencesLabel;
        const displayLocation =
          String(override.location || mapReportSettings.manual_location || zone.primaryLocationLabel || "").trim() ||
          zone.primaryLocationLabel;

        return {
          ...zone,
          overrideKey,
          displayKicker,
          displayName,
          displayReference,
          displayLocation,
          items: zone.items.map((point) => ({
            ...point,
            report_zone_label: displayName
          }))
        };
      })
    });

    return applyZoneOverrides(mapReportData);
  }, [mapReportData, mapReportSettings.manual_barrio, mapReportSettings.manual_location, mapReportSettings.zone_overrides]);
  const getSelectedMapReportData = (includedZoneKeys) =>
    selectReportZones(mapReportPrintData, includedZoneKeys, getMapPointTypeLabel);
  const getSelectedCajaTotal = (reportData) => reportData.zones.reduce(
    (total, zone) => total + zone.items.filter((point) => point.point_type === "caja_registro").length,
    0
  );
  const adminWorkspaceItems = useMemo(
    () =>
      isAdmin
        ? [
            { key: "dashboard", section: "vision", label: "Tablero", icon: "dashboard", meta: "Vista ejecutiva", tone: "is-vision" },
            { key: "profile", section: "vision", label: "Mi perfil", icon: "users", meta: "Rendimiento personal", tone: "is-users" },
            { key: "inspecciones", section: "operacion", label: "Inspecciones", icon: "activity", meta: "Asignación y seguimiento", tone: "is-records" },
            { key: "entregas", section: "operacion", label: "Control de entregas", icon: "archive", meta: "Facturas y notas de cobro", tone: "is-report" },
            { key: "records", section: "operacion", label: "Clandestinos", icon: "records", meta: `${safeRecords.length} visibles`, tone: "is-records" },
            { key: "lookup", section: "operacion", label: "Buscar clave", icon: "search", meta: "Consulta rápida", tone: "is-lookup" },
            { key: "sigTerritorial", section: "operacion", label: "SIG Territorial", icon: "map", meta: "Cartografía operativa", tone: "is-map" },
            { key: "map", section: "operacion", label: "Puntos GPS", icon: "map", meta: `${mapPointsTotal} puntos`, tone: "is-map" },
            { key: "fieldValidation", section: "control", label: "Control territorial GPS", icon: "success", meta: "Historico y zonas", tone: "is-map" },
            { key: "mapReports", section: "control", label: "Reportes GPS", icon: "records", meta: `${mapReportData.totalZones} zonas`, tone: "is-report" },
            { key: "requests", section: "control", label: "Informes", icon: "dashboard", meta: `${padronRequestResult?.summary?.total_registros ?? 0} filas`, tone: "is-report" },
            { key: "users", section: "control", label: "Usuarios", icon: "users", meta: `${safeUsers.length} registrados`, tone: "is-users" },
            { key: "barrioCodes", section: "control", label: "Barrios", icon: "map", meta: `${safeBarrioCodes.length} codigos`, tone: "is-map" },
            { key: "padron", section: "control", label: "Padrón", icon: "refresh", meta: `${padronMeta?.total_records ?? 0} claves`, tone: "is-padron" },
            { key: "importacion", section: "control", label: "Importación", icon: "refresh", meta: "FoxPro manual", tone: "is-padron" },
            { key: "logs", section: "control", label: "Historial", icon: "logs", meta: `${safeAuditLogs.length} eventos`, tone: "is-logs" }
          ]
        : [],
    [
      isAdmin,
      isFieldValidator,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalPoints,
      mapReportData.totalZones,
      padronMeta?.total_records,
      safeAuditLogs.length,
      safeBarrioCodes.length,
      mapPointsTotal,
      safeRecords.length,
      safeUsers.length
    ]
  );
  const adminWorkspaceSections = useMemo(() => {
    const sectionMeta = {
      vision: {
        title: "Visión",
        detail: "Lectura rápida del sistema y acceso al tablero."
      },
      operacion: {
        title: "Operación",
        detail: "Trabajo diario de fichas, consulta y levantamiento."
      },
      control: {
        title: "Control",
        detail: "Supervisión, reportes, usuarios y padrón maestro."
      }
    };

    return Object.entries(sectionMeta)
      .map(([key, meta]) => ({
        key,
        ...meta,
        items: adminWorkspaceItems.filter((item) => item.section === key)
      }))
      .filter((section) => section.items.length);
  }, [adminWorkspaceItems]);
  const moduleNavigationItems = useMemo(
    () =>
      (isAdmin
        ? [
            { key: "profile", label: "Mi perfil", icon: "users", group: "principal", helper: "Estadisticas y mensajes" },
            { key: "railwayUsage", label: "Uso en Railway", icon: "barChart", group: "principal", helper: "Consumo y horas pico" },
            { key: "inspecciones", label: "Inspecciones", icon: "activity", group: "operacion", helper: "Asignación y seguimiento" },
            { key: "entregas", label: "Control de entregas", icon: "archive", group: "operacion", helper: "Facturas y notas de cobro" },
            { key: "records", label: "Clandestinos", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rápida" },
            { key: "sigTerritorial", label: "SIG Territorial", icon: "map", group: "operacion", helper: "Cartografía operativa" },
            { key: "map", label: "Puntos GPS", icon: "map", group: "gps", helper: puntosJornadaLabel },
            { key: "fieldValidation", label: "Control territorial GPS", icon: "success", group: "gps", helper: "Historico y zonas" },
            { key: "mapReports", label: "Reportes GPS", icon: "records", group: "gps", helper: `${mapReportData.totalZones} zonas` },
            { key: "planos", label: "Planos y Croquis", icon: "map", group: "gps", helper: "Croquis PDF" },
            { key: "requests", label: "Informes", icon: "dashboard", group: "control", helper: "Peticiones y estadisticas" },
            { key: "barrioCodes", label: "Barrios", icon: "map", group: "control", helper: `${safeBarrioCodes.length} codigos` },
            { key: "padron", label: "Padrón", icon: "refresh", group: "control", helper: `${padronMeta?.total_records ?? 0} claves` },
            { key: "importacion", label: "Importación", icon: "refresh", group: "control", helper: "Lotes FoxPro" },
            { key: "logs", label: "Historial", icon: "logs", group: "control", helper: `${safeAuditLogs.length} eventos` },
            { key: "users", label: "Usuarios", icon: "users", group: "administracion", helper: `${safeUsers.length} registrados` },
            { key: "notes", label: "Apuntes", icon: "notes", group: "administracion", helper: "Notas internas" }
          ]
        : [
            { key: "profile", label: "Mi perfil", icon: "users", group: "principal", helper: "Estadisticas y mensajes" },
            { key: "inspecciones", label: "Inspecciones", icon: "activity", group: "operacion", helper: "Asignación y seguimiento" },
            { key: "entregas", label: "Control de entregas", icon: "archive", group: "operacion", helper: "Facturas y notas de cobro" },
            { key: "records", label: "Clandestinos", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rápida" },
            { key: "sigTerritorial", label: "SIG Territorial", icon: "map", group: "operacion", helper: "Cartografía operativa" },
            { key: "map", label: "Puntos GPS", icon: "map", group: "gps", helper: puntosJornadaLabel },
            ...(isFieldValidator
              ? [{ key: "fieldValidation", label: "Control territorial GPS", icon: "success", group: "gps", helper: "Historico y zonas" }]
              : []),
            { key: "planos", label: "Planos y Croquis", icon: "map", group: "gps", helper: "Croquis PDF" }
          ]),
    [
      isAdmin,
      isFieldValidator,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalPoints,
      mapReportData.totalZones,
      padronMeta?.total_records,
      safeAuditLogs.length,
      safeBarrioCodes.length,
      safeRecords.length,
      safeUsers.length,
      visibleMapPoints.length,
    ]
  );
  const mobilePrimaryModuleKeys = useMemo(
    () => ["profile", "inspecciones", "records", "lookup", "map"],
    []
  );
  const primaryModuleNavigationItems = useMemo(
    () => moduleNavigationItems.filter((item) => mobilePrimaryModuleKeys.includes(item.key)),
    [mobilePrimaryModuleKeys, moduleNavigationItems]
  );
  const secondaryModuleNavigationItems = useMemo(
    () => moduleNavigationItems.filter((item) => !mobilePrimaryModuleKeys.includes(item.key)),
    [mobilePrimaryModuleKeys, moduleNavigationItems]
  );
  const currentModuleNavigation = useMemo(
    () => moduleNavigationItems.find((item) => item.key === workspaceView) ?? null,
    [moduleNavigationItems, workspaceView]
  );
  const sidebarNavigationSections = useMemo(() => {
    const badgeByKey = {
      records: safeRecords.length,
      padron: padronMeta?.total_records ?? 0,
      logs: safeAuditLogs.length,
      barrioCodes: safeBarrioCodes.length,
      users: safeUsers.length,
      map: visibleMapPoints.length,
      planos: null,
      mapReports: mapReportData.totalZones,
      requests: padronRequestResult?.summary?.total_registros ?? 0
    };
    const normalizeItem = (item) => ({
      ...item,
      badge: badgeByKey[item.key] ?? null
    });
    const items = moduleNavigationItems.map(normalizeItem);
    const dashboardItem = isAdmin
      ? { key: "dashboard", label: "Tablero", icon: "dashboard", helper: "Control", badge: null }
      : null;

    return buildSidebarSections(items, dashboardItem);
  }, [
    isAdmin,
    mapReportData.totalPoints,
    mapReportData.totalZones,
    moduleNavigationItems,
    padronMeta?.total_records,
    padronRequestResult?.summary?.total_registros,
    safeAuditLogs.length,
    safeBarrioCodes.length,
    safeRecords.length,
    safeUsers.length,
    visibleMapPoints.length
  ]);
  const adminInsight = useMemo(() => {
    if (!isAdmin) {
      return null;
    }

    if (!padronMeta?.total_records) {
      return {
        icon: "refresh",
        title: "Padrón pendiente",
        detail: "Conviene validar o actualizar el padrón maestro antes de abrir consultas masivas."
      };
    }

    if (onlineUsers.length >= 4) {
      return {
        icon: "users",
        title: "Equipo conectado",
        detail: `Hay ${onlineUsers.length} usuarios en línea; el tablero te ayuda a monitorear campo, fichas y actividad sin cambiar de módulo.`
      };
    }

    if (mapDiaryGroups.length > 1) {
      return {
        icon: "map",
        title: "Bitácora activa",
        detail: `Ya hay ${mapDiaryGroups.length} jornadas registradas; puedes entrar a Reportes campo para revisar la del día con mejor contexto.`
      };
    }

    if (safeAuditLogs.length > 0) {
      return {
        icon: "logs",
        title: "Actividad reciente",
        detail: "Revisa el historial si necesitas rastrear cambios, ediciones o movimientos del equipo."
      };
    }

    return {
      icon: "dashboard",
      title: "Centro de control listo",
      detail: "Empieza por Tablero para una vista ejecutiva o entra directo al módulo que necesites."
    };
  }, [isAdmin, mapDiaryGroups.length, onlineUsers.length, padronMeta?.total_records, safeAuditLogs.length]);
  const fieldDebtSummary = useMemo(() => {
    const matches = Array.isArray(fieldDebtReport?.results)
      ? fieldDebtReport.results.flatMap((item) => item.matches || [])
      : [];
    const uniqueAccounts = new Set(matches.map((match) => match.clave_catastral || match.abonado).filter(Boolean));
    const services = FIELD_DEBT_SERVICE_DEFINITIONS.reduce((accumulator, service) => {
      accumulator[service.field] = matches.filter((match) => String(match[service.field] || "").toUpperCase() === "S").length;
      return accumulator;
    }, {});

    return {
      totalKeys: fieldDebtReport?.keys?.length ?? 0,
      totalPoints: fieldDebtReport?.pointRows?.length ?? 0,
      foundKeys: fieldDebtReport?.results?.filter((item) => item.exists)?.length ?? 0,
      missingKeys: fieldDebtReport?.results?.filter((item) => !item.exists)?.length ?? 0,
      accounts: uniqueAccounts.size,
      totalDebt: Number(matches.reduce((sum, match) => sum + Number(match.total ?? 0), 0).toFixed(2)),
      services
    };
  }, [fieldDebtReport]);
  const fieldDebtChartData = useMemo(() => {
    const rows = Array.isArray(fieldDebtReport?.results)
      ? fieldDebtReport.results.flatMap((result) => {
          if (!result.matches?.length) {
            return [
              {
                key: getFieldDebtResultLabel(result),
                abonado: "--",
                nombre: result.error || "Sin coincidencia en padron",
                barrio: "--",
                valor: 0,
                intereses: 0,
                total: 0,
                reportes: Number(fieldDebtReport?.keyCounts?.[result.key] || 0),
                exists: false
              }
            ];
          }

          return result.matches.map((match) => ({
            key: match.clave_catastral || match.clave_aguas_formato || result.key,
            abonado: match.abonado || "--",
            nombre: match.inquilino || match.nombre || "--",
            barrio: match.barrio_colonia || "--",
            valor: Number(match.valor || 0),
            intereses: Number(match.intereses || 0),
            total: Number(match.total || 0),
            reportes: Number(fieldDebtReport?.keyCounts?.[result.key] || 0),
            exists: true
          }));
        })
      : [];
    const debtRows = rows
      .filter((row) => row.exists)
      .sort((left, right) => Number(right.total || 0) - Number(left.total || 0));
    const topRows = debtRows.slice(0, 8);
    const maxDebt = Math.max(1, ...topRows.map((row) => Number(row.total || 0)));
    const totalDebt = debtRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const criticalRows = debtRows.filter((row) => Number(row.total || 0) >= 1000);

    return {
      rows,
      debtRows,
      topRows,
      maxDebt,
      totalDebt,
      criticalRows,
      missingRows: rows.filter((row) => !row.exists)
    };
  }, [fieldDebtReport]);
  const recordsUpdatedToday = useMemo(
    () =>
      safeRecords.filter((record) => getMapDiaryDateKey(record.updated_at || record.created_at) === todayDateKey)
        .length,
    [safeRecords, todayDateKey]
  );
  const mapPointsToday = useMemo(
    () => safeMapDiaryGroupsSummary.length
      ? Number(mapDiaryGroups.find((group) => group.key === todayDateKey)?.total || 0)
      : safeMapPoints.filter((point) => getMapDiaryDateKey(point) === todayDateKey).length,
    [mapDiaryGroups, safeMapDiaryGroupsSummary.length, safeMapPoints, todayDateKey]
  );
  const pendingPhotoRecords = useMemo(
    () => safeRecords.filter((record) => !String(record.foto_path || "").trim()).length,
    [safeRecords]
  );
  const mapReportPagination = useMemo(() => {
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(mapReportPrintData.zones.length / pageSize));
    const currentPage = Math.min(mapReportPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      pageSize,
      totalPages,
      currentPage,
      zones: mapReportPrintData.zones.slice(start, start + pageSize)
    };
  }, [mapReportPrintData.zones, mapReportPage]);
  const mapAnalyticsData = useMemo(() => {
    const journeySeries = [...mapDiaryGroups]
      .slice(0, 10)
      .reverse()
      .map((group) => ({
        ...group,
        label: formatMapDiaryLabel(group.key)
      }));
    const typeSeries = Object.entries(mapReportData.totalsByType)
      .map(([label, total]) => ({ label, total }))
      .sort((left, right) => right.total - left.total);
    const zoneSeries = [...mapReportData.zones]
      .sort((left, right) => right.total - left.total)
      .slice(0, 8)
      .map((zone) => ({
        label: zone.zone,
        total: zone.total,
        accuracy: zone.averageAccuracy
      }));
    const accuracyBuckets = visibleMapPoints.reduce(
      (accumulator, point) => {
        const accuracy = Number(point.accuracy_meters);
        if (!Number.isFinite(accuracy)) {
          accumulator[3].total += 1;
          return accumulator;
        }
        if (accuracy <= 5) {
          accumulator[0].total += 1;
          return accumulator;
        }
        if (accuracy <= 15) {
          accumulator[1].total += 1;
          return accumulator;
        }
        accumulator[2].total += 1;
        return accumulator;
      },
      [
        { label: "0 a 5 m", total: 0, tone: "is-good" },
        { label: "6 a 15 m", total: 0, tone: "is-mid" },
        { label: "Más de 15 m", total: 0, tone: "is-warn" },
        { label: "Sin dato", total: 0, tone: "is-empty" }
      ]
    );

    return {
      journeySeries,
      typeSeries,
      zoneSeries,
      accuracyBuckets,
      maxJourneyTotal: Math.max(1, ...journeySeries.map((item) => item.total)),
      maxTypeTotal: Math.max(1, ...typeSeries.map((item) => item.total)),
      maxZoneTotal: Math.max(1, ...zoneSeries.map((item) => item.total))
    };
  }, [mapDiaryGroups, mapReportData.totalsByType, mapReportData.zones, visibleMapPoints]);
  const padronStatisticsData = useMemo(() => {
    const barrioStats = Array.isArray(alcaldiaComparison?.barrio_stats) ? alcaldiaComparison.barrio_stats : [];
    const requestBarrios = Array.isArray(padronRequestResult?.summary?.barrios) ? padronRequestResult.summary.barrios : [];
    const serviceLabels = {
      agua: "Agua potable",
      alcantarillado: "Alcantarillado",
      barrido: "Barrido",
      recoleccion: "Desechos / tren de aseo",
      desechos_peligrosos: "Desechos peligrosos"
    };
    const normalizedBarrioFilter = padronStatsBarrioFilter.trim().toLowerCase();
    const matchesBarrioFilter = (item = {}) =>
      !normalizedBarrioFilter || String(item.barrio_colonia || "").toLowerCase().includes(normalizedBarrioFilter);
    const limit = Number(padronStatsLimit || 10);
    const metricLabels = {
      brecha_registros: "Brecha",
      cobertura_aguas_pct: "Cobertura",
      candidatas_clandestinas: "Candidatas",
      alcaldia_total: "Claves Alcaldia",
      aguas_registradas: "Usuarios Aguas",
      servicio_dominante_total: "Servicio dominante"
    };
    const sortBySelectedMetric = (items = []) =>
      [...items].sort((left, right) => {
        const direction = padronStatsSortDirection === "asc" ? 1 : -1;
        const leftValue = Number(left?.[padronStatsSortMetric] || 0);
        const rightValue = Number(right?.[padronStatsSortMetric] || 0);
        return (
          (leftValue - rightValue) * direction ||
          String(left?.barrio_colonia || "").localeCompare(String(right?.barrio_colonia || ""), "es")
        );
      });
    const clandestineByBarrio = barrioStats
      .filter((item) => Number(item.candidatas_clandestinas || 0) > 0)
      .filter(matchesBarrioFilter)
      .slice(0, limit);
    const coverageHighByBarrio = [...barrioStats]
      .filter((item) => Number(item.alcaldia_total || 0) >= 2 && Number(item.aguas_registradas || 0) > 0)
      .filter(matchesBarrioFilter)
      .sort((left, right) =>
        Number(right.cobertura_aguas_pct || 0) - Number(left.cobertura_aguas_pct || 0) ||
        Number(right.aguas_registradas || 0) - Number(left.aguas_registradas || 0)
      )
      .slice(0, limit);
    const lowCoverageByBarrio = [...barrioStats]
      .filter((item) => Number(item.alcaldia_total || 0) >= 2 && Number(item.brecha_registros || 0) > 0)
      .filter(matchesBarrioFilter)
      .sort((left, right) =>
        Number(left.cobertura_aguas_pct || 0) - Number(right.cobertura_aguas_pct || 0) ||
        Number(right.brecha_registros || 0) - Number(left.brecha_registros || 0)
      )
      .slice(0, limit);
    const serviceMajorityByBarrio = [...barrioStats]
      .filter((item) => Number(item.servicio_dominante_total || 0) > 0)
      .filter(matchesBarrioFilter)
      .sort((left, right) =>
        Number(right.servicio_dominante_total || 0) - Number(left.servicio_dominante_total || 0) ||
        Number(right.aguas_registradas || 0) - Number(left.aguas_registradas || 0)
      )
      .slice(0, limit);
    const comparativeByBarrio = sortBySelectedMetric(
      barrioStats.filter(matchesBarrioFilter).filter((item) => Number(item.alcaldia_total || 0) > 0)
    ).slice(0, limit);
    const serviceSplitTotals = Object.entries(
      barrioStats.reduce((accumulator, item) => {
        Object.keys(serviceLabels).forEach((field) => {
          accumulator[field] = (accumulator[field] || 0) + Number(item.servicios?.[field] || 0);
        });
        return accumulator;
      }, {})
    )
      .map(([field, total]) => ({ field, label: serviceLabels[field] || field, total }))
      .sort((left, right) => Number(right.total || 0) - Number(left.total || 0));
    const serviceBarrioRows = Object.fromEntries(
      Object.entries(serviceLabels).map(([field, label]) => [
        field,
        [...barrioStats]
          .filter(matchesBarrioFilter)
          .map((item) => {
            const total = Number(item.servicios?.[field] || 0);
            const aguasRegistradas = Number(item.aguas_registradas || 0);
            const pct = aguasRegistradas ? Number(((total / aguasRegistradas) * 100).toFixed(1)) : 0;
            return {
              ...item,
              field,
              service_label: label,
              service_total: total,
              value: pct,
              detail: `${total} de ${aguasRegistradas} usuarios con ${label} - ${pct}% del barrio`
            };
          })
          .filter((item) => Number(item.service_total || 0) > 0)
          .sort((left, right) =>
            Number(right.value || 0) - Number(left.value || 0) ||
            Number(right.service_total || 0) - Number(left.service_total || 0) ||
            left.barrio_colonia.localeCompare(right.barrio_colonia, "es")
          )
          .slice(0, limit)
      ])
    );
    const requestBarriosTop = [...requestBarrios]
      .sort((left, right) => Number(right.total_registros || 0) - Number(left.total_registros || 0))
      .slice(0, 10);
    const selectedBarrio =
      barrioStats.find((item) => item.barrio_colonia === selectedPadronStatBarrio) ||
      clandestineByBarrio[0] ||
      lowCoverageByBarrio[0] ||
      coverageHighByBarrio[0] ||
      null;
    const dynamicRowsByMode = {
      brecha: clandestineByBarrio.map((item) => ({
        ...item,
        value: Number(item.candidatas_clandestinas || 0),
        detail: `${item.candidatas_clandestinas} sin coincidencia de ${item.alcaldia_total} claves Alcaldia`
      })),
      cobertura_alta: coverageHighByBarrio.map((item) => ({
        ...item,
        value: Number(item.cobertura_aguas_pct || 0),
        detail: `${item.cobertura_aguas_pct}% cobertura - ${item.aguas_registradas}/${item.alcaldia_total} registradas`
      })),
      cobertura_baja: lowCoverageByBarrio.map((item) => ({
        ...item,
        value: Number(item.brecha_registros || 0),
        detail: `${item.cobertura_aguas_pct}% cobertura - brecha ${item.brecha_registros}`
      })),
      servicio_dominante: serviceMajorityByBarrio.map((item) => ({
        ...item,
        value: Number(item.servicio_dominante_total || 0),
        detail: `${item.servicio_dominante}: ${item.servicio_dominante_total} usuarios`
      })),
      comparativa: comparativeByBarrio.map((item) => ({
        ...item,
        value: Number(item[padronStatsSortMetric] || 0),
        detail: `Cobertura ${item.cobertura_aguas_pct}% - brecha ${item.brecha_registros} - Aguas ${item.aguas_registradas}/${item.alcaldia_total} - candidatas ${item.candidatas_clandestinas}`
      })),
      servicios: selectedPadronServiceField
        ? (serviceBarrioRows[selectedPadronServiceField] || [])
        : serviceSplitTotals.map((item) => ({
            ...item,
            barrio_colonia: item.label,
            value: Number(item.total || 0),
            detail: `${item.total} usuarios registrados con este servicio`
          }))
    };
    const dynamicRows = dynamicRowsByMode[padronChartMode] || dynamicRowsByMode.brecha;

    return {
      barrioStats,
      metricLabels,
      comparativeByBarrio,
      serviceLabels,
      clandestineByBarrio,
      coverageHighByBarrio,
      lowCoverageByBarrio,
      serviceMajorityByBarrio,
      serviceSplitTotals,
      serviceBarrioRows,
      selectedServiceLabel: selectedPadronServiceField ? serviceLabels[selectedPadronServiceField] : "",
      requestBarriosTop,
      selectedBarrio,
      dynamicRows,
      maxDynamicRows:
        padronChartMode.includes("cobertura") || (padronChartMode === "servicios" && selectedPadronServiceField)
          ? 100
          : Math.max(1, ...dynamicRows.map((item) => Number(item.value || 0))),
      maxClandestine: Math.max(1, ...clandestineByBarrio.map((item) => Number(item.candidatas_clandestinas || 0))),
      maxLowCoverageGap: Math.max(1, ...lowCoverageByBarrio.map((item) => Number(item.brecha_registros || 0))),
      maxRequestRows: Math.max(1, ...requestBarriosTop.map((item) => Number(item.total_registros || 0)))
    };
  }, [
    alcaldiaComparison,
    padronChartMode,
    padronRequestResult,
    padronStatsBarrioFilter,
    padronStatsLimit,
    padronStatsSortDirection,
    padronStatsSortMetric,
    selectedPadronServiceField,
    selectedPadronStatBarrio
  ]);
  const aguasServiceReportData = useMemo(() => {
    const services = Array.isArray(padronServiceReport?.summary?.services) ? padronServiceReport.summary.services : [];
    const barrios = Array.isArray(padronServiceReport?.barrios) ? padronServiceReport.barrios : [];
    const totalRecords = Number(padronServiceReport?.summary?.total_records || 0);
    const selectedService = services.find((service) => service.field === selectedAguasServiceField) || services[0] || null;
    const maxServiceTotal = Math.max(1, ...services.map((service) => Number(service.active || 0)));
    const serviceRows = services.map((service) => ({
      ...service,
      detail: `${Number(service.active || 0)} con servicio activo, deuda asociada ${formatCurrency(service.deuda?.total || 0)}`
    }));
    const barrioRows = barrios
      .map((barrio) => {
        const service = (barrio.servicios || []).find((item) => item.field === selectedService?.field) || null;
        return {
          barrio_colonia: barrio.barrio_colonia,
          total_registros: Number(barrio.total_registros || 0),
          active: Number(service?.active || 0),
          inactive: Number(service?.inactive || 0),
          percentage: Number(service?.percentage || 0),
          deuda: barrio.deuda || {},
          deuda_servicio: service?.deuda || {}
        };
      })
      .filter((item) => item.total_registros > 0)
      .sort((left, right) =>
        right.active - left.active ||
        right.total_registros - left.total_registros ||
        left.barrio_colonia.localeCompare(right.barrio_colonia, "es")
      );
    const maxBarrioServiceTotal = Math.max(1, ...barrioRows.map((item) => item.active));
    const profiles = padronServiceReport?.summary?.profiles || {};

    return {
      services,
      serviceRows,
      barrios,
      barrioRows,
      selectedService,
      deuda: padronServiceReport?.summary?.deuda || {},
      totalRecords,
      maxServiceTotal,
      maxBarrioServiceTotal,
      profiles,
      hasData: totalRecords > 0
    };
  }, [padronServiceReport, selectedAguasServiceField]);
  const getAguasServiceBarrioName = useCallback((barrio = {}) => {
    const name = String(barrio.barrio_colonia || "").trim();
    return name || "Sin barrio";
  }, []);
  const selectedAguasServiceBarrioSet = useMemo(
    () => new Set(selectedAguasServiceBarrios.map((name) => String(name || "").trim()).filter(Boolean)),
    [selectedAguasServiceBarrios]
  );
  const selectedAguasServiceBarrioRows = useMemo(
    () =>
      aguasServiceReportData.barrios.filter((barrio) =>
        selectedAguasServiceBarrioSet.has(getAguasServiceBarrioName(barrio))
      ),
    [aguasServiceReportData.barrios, getAguasServiceBarrioName, selectedAguasServiceBarrioSet]
  );
  useEffect(() => {
    setSelectedAguasServiceBarrios((current) => {
      if (!current.length) return current;
      const validNames = new Set(aguasServiceReportData.barrios.map((barrio) => getAguasServiceBarrioName(barrio)));
      const next = current.filter((name) => validNames.has(name));
      return next.length === current.length ? current : next;
    });
  }, [aguasServiceReportData.barrios, getAguasServiceBarrioName]);

  const toggleAguasServiceBarrioSelection = useCallback((barrioName) => {
    const normalizedName = String(barrioName || "").trim() || "Sin barrio";
    setSelectedAguasServiceBarrios((current) =>
      current.includes(normalizedName)
        ? current.filter((name) => name !== normalizedName)
        : [...current, normalizedName]
    );
  }, []);

  // Historial real de los ultimos 7 dias: fichas tocadas por dia y puntos GPS
  // por jornada. La mora no tiene serie porque el padron es una sola foto.
  const dashboardDailySeries = useMemo(() => {
    const recordsByDay = new Map();
    safeRecords.forEach((record) => {
      const key = getMapDiaryDateKey(record.updated_at || record.created_at);
      if (key) recordsByDay.set(key, (recordsByDay.get(key) || 0) + 1);
    });
    const pointsByDay = new Map();
    if (safeMapDiaryGroupsSummary.length) {
      mapDiaryGroups.forEach((group) => pointsByDay.set(group.key, Number(group.total || 0)));
    } else {
      safeMapPoints.forEach((point) => {
        const key = getMapDiaryDateKey(point);
        if (key) pointsByDay.set(key, (pointsByDay.get(key) || 0) + 1);
      });
    }
    return {
      records: lastDaysSeries(recordsByDay, todayDateKey),
      gps: lastDaysSeries(pointsByDay, todayDateKey)
    };
  }, [mapDiaryGroups, safeMapDiaryGroupsSummary.length, safeMapPoints, safeRecords, todayDateKey]);
  const dashboardLiveMetrics = useMemo(
    () => [
      {
        key: "records",
        label: "Fichas activas",
        value: safeRecords.length,
        helper: `${recordsUpdatedToday} movimientos hoy · ${dashboardDailySeries.records.at(-2)?.total || 0} ayer`,
        series: dashboardDailySeries.records,
        icon: "records",
        badge: "En vivo",
        detail: `Registros actualmente en operacion`,
        trend: recordsUpdatedToday ? `+${recordsUpdatedToday} hoy` : "Sin cambios hoy",
        micro: `${recordsUpdatedToday} creadas o actualizadas hoy`,
        progressLabel: `${safeRecords.length} visibles`,
        progress: safeRecords.length ? Math.min(100, Math.max(12, Math.round((safeRecords.length / Math.max(safeRecords.length, padronMeta?.total_records || safeRecords.length)) * 100))) : 0,
        tone: "is-info",
        sparkline: [36, 44, 42, 52, 48, 58, 64]
      },
      {
        key: "gps",
        label: "Puntos GPS",
        value: mapPointsTotal,
        helper: `${mapPointsToday} hoy · promedio ${Math.round(dashboardDailySeries.gps.reduce((sum, day) => sum + day.total, 0) / Math.max(1, dashboardDailySeries.gps.length))} por día`,
        series: dashboardDailySeries.gps,
        icon: "map",
        badge: "Hoy",
        detail: "Levantamiento de campo acumulado",
        trend: mapPointsToday
          ? `Ultimo movimiento ${safeMapPoints[0] ? formatRelativeTime(safeMapPoints[0].created_at || safeMapPoints[0].updated_at, dashboardNow) : formatMapDiaryLabel(mapDiaryGroups[0]?.key)}`
          : "Sin puntos hoy",
        micro: `${mapPointsToday} puntos registrados hoy`,
        progressLabel: `${mapPointsToday} puntos de la jornada`,
        progress: Math.min(100, Math.max(mapPointsToday ? 14 : 0, Math.round((mapPointsToday / Math.max(1, mapPointsToday, 50)) * 100))),
        tone: "is-map",
        sparkline: [18, 28, 34, 36, 48, 55, 62]
      },
      {
        key: "online",
        label: "Usuarios en línea",
        value: onlineUsers.length,
        helper: `${safeUsers.length} usuarios registrados`,
        icon: "users",
        badge: onlineUsers.length ? "En vivo" : "Normal",
        detail: "Actividad simultanea del equipo",
        trend: onlineUsers.length ? "Jornada activa" : "Sin sesiones activas",
        micro: `${onlineUsers.length} conectados ahora`,
        progressLabel: `${onlineUsers.length}/${Math.max(safeUsers.length, 1)} usuarios`,
        progress: Math.min(100, Math.round((onlineUsers.length / Math.max(safeUsers.length, 1)) * 100)),
        tone: "is-live",
        sparkline: [20, 24, 30, 28, 35, 38, 42]
      },
      {
        key: "alerts",
        label: "Alertas",
        value: alertRecords.length,
        helper: alertRecords.length ? "Pendientes con plazo critico" : "Sin alertas pendientes",
        icon: alertRecords.length ? "warning" : "success",
        badge: alertRecords.length ? "Critico" : "Normal",
        detail: "Fichas vencidas o proximas",
        // Desglose por estado del plazo: la tarjeta del tablero lo dibuja por tramos.
        breakdown: {
          overdue: alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length,
          due: alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "due").length,
          upcoming: alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "warning").length
        },
        trend: `${alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length} vencidas / ${alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "due").length} vencen hoy`,
        micro: `${alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length} vencidas o criticas`,
        progressLabel: "Vencidas y por vencer",
        progress: alertRecords.length
          ? Math.round((alertRecords.filter((record) => recordDeadlineMetaById[record.id]?.statusKey === "overdue").length / alertRecords.length) * 100)
          : 0,
        tone: alertRecords.length ? "is-critical" : "is-calm",
        sparkline: alertRecords.length ? [70, 68, 64, 66, 62, 59, 54] : [10, 10, 8, 8, 7, 7, 6]
      }
    ],
    [
      alertRecords.length,
      dashboardDailySeries,
      dashboardNow,
      mapDiaryGroups,
      mapPointsTotal,
      mapPointsToday,
      onlineUsers.length,
      padronMeta?.total_records,
      recordDeadlineMetaById,
      recordsUpdatedToday,
      safeMapPoints.length,
      safeMapPoints,
      safeRecords.length,
      safeUsers.length
    ]
  );

  const dashboardLiveFeed = useMemo(() => {
    const feed = [];
    const pushFeedItem = (item) => {
      const createdAt = item.createdAt || item.updatedAt;
      if (!createdAt) return;
      feed.push({
        ...item,
        createdAt,
        timestamp: new Date(createdAt).getTime() || 0
      });
    };

    safeAuditLogs.slice(0, 12).forEach((log) => {
      const actionTitle = {
        "auth.login": "Usuario inicio sesion",
        "map_point.created": "Nuevo punto GPS registrado",
        "inmueble.created": "Ficha creada",
        "inmueble.updated": "Ficha actualizada",
        "inmueble.photo_attached": "Ficha lista para imprimir",
        "transport.route_alert": "Alerta generada"
      }[log.action] || actionLabel(log.action);

      pushFeedItem({
        key: `audit-${log.id}`,
        title: actionTitle,
        detail: humanizeDashboardActivity(log),
        user: log.actor_name || log.actor_email || "Sistema",
        icon: actionIconName(log.action),
        tone: log.action?.includes("alert") ? "is-warning" : "is-info",
        createdAt: log.created_at,
        targetView: log.action === "map_point.created" ? "mapReports" : log.action?.startsWith("inmueble.") ? "records" : "logs",
        targetPointId: log.action === "map_point.created" ? log.entity_id : null,
        targetRecordId: log.action?.startsWith("inmueble.") ? log.entity_id : null
      });
    });

    safeMapPoints.slice(0, 6).forEach((point) => {
      pushFeedItem({
        key: `point-${point.id}`,
        title: "GPS registrado",
        detail: `Se agrego ${getMapPointTypeLabel(point.point_type).toLowerCase()} en ${getMapReportBarrioZone(point, mapPointContexts[getMapPointContextKey(point)] ?? null, safeBarrioCodes) || "zona pendiente"}`,
        user: point.created_by_name || point.created_by || "Equipo de campo",
        icon: "map",
        tone: "is-map",
        createdAt: point.created_at || point.updated_at,
        targetView: "mapReports",
        targetPointId: point.id
      });
    });

    safeRecords.slice(0, 8).forEach((record) => {
      pushFeedItem({
        key: `record-${record.id}`,
        title: "Ficha creada",
        detail: `${record.clave_catastral || "Sin clave"} en ${getRecordBarrioName(record, "ubicacion pendiente")}`,
        user: record.levantamiento_datos || "Equipo operativo",
        icon: "records",
        tone: "is-record",
        createdAt: record.created_at,
        targetView: "records",
        targetRecordId: record.id
      });
    });

    alertRecords.slice(0, 6).forEach((record) => {
      const meta = recordDeadlineMetaById[record.id];
      pushFeedItem({
        key: `alert-${record.id}-${meta?.statusKey || "warning"}`,
        title: meta?.statusKey === "overdue" ? "Alerta generada" : "Ficha lista para imprimir",
        detail: `La ficha ${record.clave_catastral || "sin clave"} ${meta?.statusKey === "overdue" ? "vencio su plazo" : "requiere seguimiento"}`,
        user: record.analista_datos || "Sistema",
        icon: meta?.statusKey === "overdue" ? "warning" : "records",
        tone: meta?.statusKey === "overdue" ? "is-warning" : "is-ready",
        createdAt: record.updated_at || record.created_at,
        targetView: "records",
        targetRecordId: record.id
      });
    });

    return feed
      .filter((item) => Number.isFinite(item.timestamp))
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 8);
  }, [alertRecords, mapPointContexts, recordDeadlineMetaById, safeAuditLogs, safeBarrioCodes, safeMapPoints, safeRecords]);
  const dashboardJourneys = useMemo(() => mapDiaryGroups.slice(0, 4), [mapDiaryGroups]);
  const dashboardPriorityItems = useMemo(() => {
    const items = [];

    if (!padronMeta?.total_records) {
      items.push({
        tone: "is-warning",
        title: "Padrón pendiente",
        detail: "Actualiza o valida el padrón maestro para consultas y peticiones confiables.",
        icon: "refresh",
        actionView: "padron",
        actionLabel: "Revisar padrón",
        level: "Atención",
        badge: "Pendiente"
      });
    }

    if (alertRecords.length) {
      items.push({
        tone: "is-warning",
        title: "Fichas con plazo crítico",
        detail: "En alerta o vencidas por la regla de 7 días hábiles.",
        count: alertRecords.length,
        icon: "warning",
        actionView: "records",
        filter: "alerts",
        actionLabel: "Ver alertas",
        level: "Crítico",
        badge: "Crítico"
      });
    }

    if (pendingPhotoRecords >= 3) {
      items.push({
        tone: "is-warning",
        title: "Fichas sin foto",
        detail: "Fichas visibles que aún no tienen evidencia fotográfica.",
        count: pendingPhotoRecords,
        icon: "records",
        actionView: "records",
        actionLabel: "Completar fichas",
        level: "Atención",
        badge: "Pendiente"
      });
    }

    // Cuántos usuarios hay conectados ya se ve en la banda de estado del
    // tablero: no es un asunto pendiente y no compite con las alertas reales.
    if (dashboardJourneys[0]) {
      items.push({
        tone: "is-info",
        title: "Jornada activa",
        detail: `${formatMapDiaryLabel(dashboardJourneys[0].key)}: puntos listos para revisar.`,
        count: dashboardJourneys[0].total,
        icon: "map",
        actionView: "mapReports",
        actionLabel: "Abrir reportes",
        level: "Informativo",
        badge: "En vivo"
      });
    }

    if (!items.length) {
      items.push({
        tone: "is-calm",
        title: "Sistema estable",
        detail: "El tablero está listo para arrancar captura, consulta o control administrativo.",
        icon: "success",
        actionView: "records",
        actionLabel: "Ir a fichas",
        level: "Informativo",
        badge: "Normal"
      });
    }

    return items.slice(0, 3);
  }, [alertRecords.length, dashboardJourneys, padronMeta?.total_records, pendingPhotoRecords]);
  const dashboardAlertRecords = useMemo(() => {
    const recordsWithoutPhoto = safeRecords
      .filter((record) => !getRecordPhotoPath(record))
      .map((record) => ({
        record,
        statusKey: "no-photo",
        status: "Sin foto",
        detail: "Pendiente de evidencia fotografica para cerrar la ficha.",
        actionLabel: "Ver ficha"
      }));
    const deadlineAlerts = alertRecords.map((record) => {
      const meta = recordDeadlineMetaById[record.id];
      const isOverdue = meta?.statusKey === "overdue";
      const isDue = meta?.statusKey === "due";
      return {
        record,
        statusKey: meta?.statusKey || "warning",
        status: isOverdue ? "Vencida" : isDue ? "Vence hoy" : "Atencion",
        detail: isOverdue
          ? "Plazo operativo de 7 dias habiles superado."
          : isDue
            ? "Requiere revision durante la jornada de hoy."
            : "Requiere seguimiento por plazo operativo."
      };
    });

    return [...deadlineAlerts, ...recordsWithoutPhoto]
      .filter((item, index, list) => list.findIndex((other) => other.record.id === item.record.id && other.statusKey === item.statusKey) === index)
      .slice(0, 24);
  }, [alertRecords, recordDeadlineMetaById, safeRecords]);
  const dashboardAlertCounts = useMemo(() => {
    const overdue = dashboardAlertRecords.filter((item) => item.statusKey === "overdue").length;
    const due = dashboardAlertRecords.filter((item) => item.statusKey === "due").length;
    const noPhoto = dashboardAlertRecords.filter((item) => item.statusKey === "no-photo").length;
    const printable = dashboardAlertRecords.filter((item) => ["overdue", "due", "warning"].includes(item.statusKey)).length;

    return {
      all: dashboardAlertRecords.length,
      critical: overdue,
      today: due,
      noPhoto,
      printable
    };
  }, [dashboardAlertRecords]);
  const overdueComparisonRecords = useMemo(
    () =>
      dashboardAlertRecords
        .filter((item) => item.statusKey === "overdue")
        .map((item) => item.record),
    [dashboardAlertRecords]
  );
  const alcaldiaComparisonByClave = useMemo(() => {
    const rows = [
      ...(alcaldiaComparison?.candidates || []),
      ...(alcaldiaComparison?.matched_by_base || []),
      ...(alcaldiaComparison?.matched_exact || [])
    ];
    return rows.reduce((map, row) => {
      [row.clave_catastral, row.clave_aguas_formato].forEach((key) => {
        const cleanKey = String(key || "").trim();
        if (cleanKey && !map.has(cleanKey)) {
          map.set(cleanKey, row);
        }
      });
      return map;
    }, new Map());
  }, [alcaldiaComparison]);
  const filteredDashboardAlertRecords = useMemo(
    () =>
      dashboardAlertRecords.filter((item) => {
        if (dashboardAlertFilter === "critical") return item.statusKey === "overdue";
        if (dashboardAlertFilter === "today") return item.statusKey === "due";
        if (dashboardAlertFilter === "no-photo") return item.statusKey === "no-photo";
        if (dashboardAlertFilter === "printable") return ["overdue", "due", "warning"].includes(item.statusKey);
        return true;
      }),
    [dashboardAlertFilter, dashboardAlertRecords]
  );
  const dashboardTechnicianSummary = useMemo(() => {
    const grouped = safeRecords.reduce((acc, record) => {
      const owner = String(record.levantamiento_datos || record.analista_datos || "Sin asignar").trim() || "Sin asignar";
      if (!acc[owner]) {
        acc[owner] = {
          name: owner,
          total: 0,
          withPhoto: 0,
          alert: 0
        };
      }
      acc[owner].total += 1;
      if (record.foto_path) {
        acc[owner].withPhoto += 1;
      }
      if (recordDeadlineMetaById[record.id]?.status && recordDeadlineMetaById[record.id].status !== "on_track") {
        acc[owner].alert += 1;
      }
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((left, right) => right.total - left.total || right.alert - left.alert || left.name.localeCompare(right.name))
      .slice(0, 5);
  }, [recordDeadlineMetaById, safeRecords]);
  const executiveReportData = useMemo(() => {
    const allDates = [
      ...safeRecords.flatMap((record) => [record.created_at, record.updated_at, record.fecha_aviso]),
      ...safeMapPoints.flatMap((point) => [point.created_at, point.updated_at]),
      ...safeAuditLogs.map((log) => log.created_at)
    ]
      .map((value) => {
        const stamp = Date.parse(value || "");
        return Number.isFinite(stamp) ? stamp : null;
      })
      .filter(Boolean);
    const firstDate = allDates.length ? new Date(Math.min(...allDates)) : null;
    const lastDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();
    const statusTotals = safeRecords.reduce(
      (acc, record) => {
        const status = record.estado_padron || "clandestino";
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      { clandestino: 0, reportada: 0, varios_padrones: 0 }
    );
    const mapTypeTotals = safeMapPoints.reduce((acc, point) => {
      const label = getMapPointTypeLabel(point.point_type);
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    const mapZoneTotals = safeMapPoints.reduce((acc, point) => {
      const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
      const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
      acc[zone] = (acc[zone] ?? 0) + 1;
      return acc;
    }, {});
    const gpsZoneDetails = safeMapPoints.reduce((acc, point) => {
      const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
      const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
      const typeLabel = getMapPointTypeLabel(point.point_type);
      if (!acc[zone]) {
        acc[zone] = {
          label: zone,
          total: 0,
          types: {},
          accuracyValues: [],
          firstDate: "",
          lastDate: ""
        };
      }
      acc[zone].total += 1;
      acc[zone].types[typeLabel] = (acc[zone].types[typeLabel] ?? 0) + 1;
      if (Number.isFinite(Number(point.accuracy_meters))) {
        acc[zone].accuracyValues.push(Number(point.accuracy_meters));
      }
      const dateKey = getMapDiaryDateKey(point);
      if (dateKey) {
        acc[zone].firstDate = !acc[zone].firstDate || dateKey < acc[zone].firstDate ? dateKey : acc[zone].firstDate;
        acc[zone].lastDate = !acc[zone].lastDate || dateKey > acc[zone].lastDate ? dateKey : acc[zone].lastDate;
      }
      return acc;
    }, {});
    const recordZoneTotals = safeRecords.reduce((acc, record) => {
      const zone = getRecordBarrioName(record, "Sin barrio");
      if (!acc[zone]) {
        acc[zone] = {
          label: zone,
          total: 0,
          clandestino: 0,
          reportada: 0,
          varios_padrones: 0,
          withPhoto: 0,
          alert: 0
        };
      }
      const status = record.estado_padron || "clandestino";
      acc[zone].total += 1;
      acc[zone][status] = (acc[zone][status] ?? 0) + 1;
      if (String(record.foto_path || "").trim()) {
        acc[zone].withPhoto += 1;
      }
      if (recordDeadlineMetaById[record.id]) {
        acc[zone].alert += 1;
      }
      return acc;
    }, {});
    const monthlyTotals = [...safeRecords, ...safeMapPoints].reduce((acc, item) => {
      const dateKey = getMapDiaryDateKey(item.updated_at || item.created_at || item.fecha_aviso);
      if (!dateKey) return acc;
      const monthKey = dateKey.slice(0, 7);
      if (!acc[monthKey]) {
        acc[monthKey] = {
          label: formatMonthGroup(`${monthKey}-01`),
          records: 0,
          points: 0
        };
      }
      if ("clave_catastral" in item) {
        acc[monthKey].records += 1;
      } else {
        acc[monthKey].points += 1;
      }
      return acc;
    }, {});
    const auditTotals = safeAuditLogs.reduce((acc, log) => {
      const key = actionLabel(log.action);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const photoCount = safeRecords.filter((record) => String(record.foto_path || "").trim()).length;
    const archivedEvents = safeAuditLogs.filter((log) => log.action === "inmueble.archived").length;
    const printedReadyRecords = safeRecords.filter((record) => record.fecha_aviso && record.levantamiento_datos && record.analista_datos).length;
    const fieldJourneyRows = mapDiaryGroups.map((journey) => {
      const dayPoints = safeMapPoints.filter((point) => getMapDiaryDateKey(point) === journey.key);
      const dayRecords = safeRecords.filter((record) => getMapDiaryDateKey(record.updated_at || record.created_at) === journey.key);
      const dayZones = new Set(
        dayPoints.map((point) => {
          const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
          return getMapReportBarrioZone(point, context, safeBarrioCodes);
        })
      );

      return {
        key: journey.key,
        label: formatMapDiaryLabel(journey.key),
        points: dayPoints.length,
        records: dayRecords.length,
        photos: dayRecords.filter((record) => String(record.foto_path || "").trim()).length,
        zones: dayZones.size
      };
    });
    const fieldResponsibleRows = dashboardTechnicianSummary.map((item) => ({
      name: item.name,
      records: item.total,
      withPhoto: item.withPhoto,
      alert: item.alert
    }));

    return {
      generatedAt: new Date(),
      firstDate,
      lastDate,
      statusTotals,
      photoCount,
      pendingPhotoCount: Math.max(0, safeRecords.length - photoCount),
      printedReadyRecords,
      archivedEvents,
      fieldJourneyRows,
      fieldResponsibleRows,
      statusRows: [
        { label: "Clandestinas", total: statusTotals.clandestino || 0 },
        { label: "Reportadas", total: statusTotals.reportada || 0 },
        { label: "Varios padrones", total: statusTotals.varios_padrones || 0 }
      ],
      recordZoneRows: Object.values(recordZoneTotals)
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
      monthlyRows: Object.entries(monthlyTotals)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value),
      gpsZoneDetailRows: Object.values(gpsZoneDetails)
        .map((zone) => ({
          ...zone,
          averageAccuracy: zone.accuracyValues.length
            ? Number((zone.accuracyValues.reduce((sum, value) => sum + value, 0) / zone.accuracyValues.length).toFixed(1))
            : null,
          typeLabel: Object.entries(zone.types)
            .sort((left, right) => right[1] - left[1])
            .map(([label, total]) => `${label}: ${total}`)
            .join(", ")
        }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
      mapTypeRows: Object.entries(mapTypeTotals)
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
      mapZoneRows: Object.entries(mapZoneTotals)
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
        .slice(0, 8),
      auditRows: Object.entries(auditTotals)
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
        .slice(0, 10),
      applicationFunctions: [
        ["Registro de fichas", "Crear, editar, buscar y clasificar inmuebles por clave catastral, barrio, abonado y estado operativo."],
        ["Validación de padrones", "Comparar información entre padrón maestro, Alcaldía y registros de Aguas para detectar coincidencias o posibles clandestinos."],
        ["Evidencia fotográfica", "Adjuntar fotografía por ficha y dejar respaldo visual del levantamiento realizado en campo."],
        ["Geolocalización GPS", "Capturar puntos técnicos, zonas, precisión, jornadas y referencias para sustentar el recorrido territorial."],
        ["Mapa de campo", "Visualizar puntos levantados, agruparlos por zona y generar reportes de coordenadas para supervisión."],
        ["Avisos y fichas imprimibles", "Generar ficha técnica, aviso formal e impresión rápida por lote con selección de copias."],
        ["Reportes PDF", "Descargar reportes de campo, solicitudes de padrón y resumen consolidado para presentación institucional."],
        ["Bitácora y usuarios", "Registrar sesiones, cambios, operaciones, restauraciones y actividad por usuario para trazabilidad."]
      ],
      timeSavingsRows: [
        ["Búsqueda de clave y validación", "10 a 15 minutos manuales", "1 a 2 minutos en la aplicación", "Reduce revisión en Excel, cruces manuales y errores de digitación."],
        ["Elaboración de ficha", "15 a 20 minutos manuales", "4 a 6 minutos en la aplicación", "Centraliza datos, estado, fotografía y formato imprimible."],
        ["Generación de aviso", "8 a 12 minutos manuales", "1 a 2 minutos en la aplicación", "El aviso se genera desde la ficha sin volver a redactar la información."],
        ["Reporte de campo por zona", "1 a 2 horas manuales", "5 a 10 minutos en la aplicación", "Agrupa GPS, zonas, totales y jornadas automáticamente."],
        ["Consolidado para supervisión", "Medio día de revisión manual", "10 a 20 minutos en la aplicación", "Resume fichas, barrios, GPS, usuarios, bitácora y estadísticas."],
        ["Impresión de varias fichas/avisos", "30 a 60 minutos manuales", "5 a 10 minutos con impresión rápida", "Permite seleccionar copias por ficha y aviso en un solo flujo."]
      ],
      modules: [
        {
          title: "Fichas catastrales",
          detail: "Registro, edición, búsqueda por clave catastral, clasificación por padrón, fotografía, ficha visual, aviso y procesamiento a reportadas.",
          evidence: `${safeRecords.length} fichas activas visibles, ${statusTotals.reportada || 0} reportadas y ${photoCount} con evidencia fotográfica.`
        },
        {
          title: "Trabajo realizado en campo",
          detail: "Captura GPS en sitio, levantamiento de fichas, evidencia fotográfica, jornadas por fecha, zonas cubiertas y puntos técnicos ubicados en mapa.",
          evidence: `${safeMapPoints.length} puntos geolocalizados, ${mapDiaryGroups.length} jornadas y ${photoCount} fichas con fotografía.`
        },
        {
          title: "Reportes institucionales",
          detail: "Reporte de levantamiento por zonas, estadísticas de campo, descarga PDF, impresión, reporte de solicitudes al padrón y consulta por clave.",
          evidence: `${mapReportData.totalZones} zonas en la jornada activa y ${padronRequestResult?.summary?.total_registros ?? 0} registros en la última petición.`
        },
        {
          title: "Padrones y validación",
          detail: "Carga de padrón maestro, carga de padrón de Alcaldía, comparación contra Aguas y detección de inmuebles clandestinos o repetidos en varios padrones.",
          evidence: `${padronMeta?.total_records ?? 0} claves en padrón maestro y ${alcaldiaMeta?.total_records ?? 0} registros de Alcaldía.`
        },
        {
          title: "Operación y trazabilidad",
          detail: "Usuarios, roles, sesiones, bitácora de eventos, auditoría de cambios, restauración y archivo administrativo.",
          evidence: `${safeUsers.length} usuarios registrados, ${onlineUsers.length} en línea y ${safeAuditLogs.length} eventos auditados.`
        },
        {
          title: "Impresión y avisos",
          detail: "Ficha imprimible con formato institucional, aviso editable, impresión individual y lote rápido con selección de copias por ficha o aviso.",
          evidence: `${printedReadyRecords} fichas cuentan con datos base para generar aviso.`
        }
      ]
    };
  }, [
    alcaldiaMeta?.total_records,
    mapDiaryGroups.length,
    mapPointContexts,
    mapReportData.totalZones,
    onlineUsers.length,
    padronMeta?.total_records,
    padronRequestResult?.summary?.total_registros,
    recordDeadlineMetaById,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeRecords,
    dashboardTechnicianSummary,
    safeUsers.length
  ]);

  useEffect(() => {
    if (mapDiaryDateKey !== activeMapDiaryDateKey) {
      setMapDiaryDateKey(activeMapDiaryDateKey);
    }
  }, [activeMapDiaryDateKey, mapDiaryDateKey]);

  useEffect(() => {
    if (regulatorReportDiaryKeys.length || !regulatorReportDiaryOptions.length) return;
    setRegulatorReportDiaryKeys(regulatorReportDiaryOptions.slice(0, 3).map((group) => group.key));
  }, [regulatorReportDiaryKeys.length, regulatorReportDiaryOptions]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(max-width: 768px), (pointer: coarse)");
    if (!mediaQuery) return undefined;

    const handleChange = () => setIsCompactMapView(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const byDate = Object.fromEntries(
      Object.entries(mapReportSettingsByDate).map(([dateKey, settings]) => [
        dateKey,
        stripTransientMapReportSettings(settings)
      ])
    );
    window.localStorage.setItem(MAP_REPORT_SETTINGS_STORAGE_KEY, JSON.stringify({ by_date: byDate }));
  }, [mapReportSettingsByDate]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setShowMobileModuleMenu(false);
      setShowUserMenu(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => () => {
    mapPointsRequestRef.current.controller?.abort();
  }, []);

  useEffect(() => {
    setRecordPage(1);
  }, [search, recordView, recordQuickFilter, recordFilters]);

  useEffect(() => {
    setRecordPage((current) => Math.min(current, recordPagination.totalPages));
  }, [recordPagination.totalPages]);

  useEffect(() => {
    setSelectedMapPointId((current) => (visibleMapPoints.some((point) => point.id === current) ? current : null));
  }, [visibleMapPoints]);

  useEffect(() => {
    setMapReportPage(1);
    setMapPointListLimit(MAP_POINT_LIST_INITIAL_LIMIT);
  }, [activeMapDiaryDateKey]);

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

  useEffect(() => {
    if (!session?.token) return undefined;

    let cancelled = false;
    const refreshStoredSession = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          cache: "no-store",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.token}`
          }
        });

        if (cancelled) return;
        if (response.status === 401) {
          sessionInvalidatingRef.current = true;
          clearSession();
          if (!intentionalLogoutRef.current) showAlert("Tu sesión venció. Ingresa de nuevo para continuar.");
          return;
        }
        if (!response.ok) {
          setSessionVerified(true);
          return;
        }

        const data = await response.json();
        if (!data?.user) return;

        setSession((current) => {
          if (current?.token !== session.token) return current;
          const nextSession = { ...current, user: data.user };
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
          return nextSession;
        });
        sessionInvalidatingRef.current = false;
        setSessionVerified(true);
      } catch {
        // Keep the stored session if the API is temporarily unreachable.
        setSessionVerified(true);
      }
    };

    refreshStoredSession();
    return () => {
      cancelled = true;
    };
  }, [session?.token, showAlert]);

  const clearPadronDerivedState = () => {
    setLookupResult(null);
    setLookupFeedback("");
    setPadronRequestResult(null);
    setPadronServiceReport(null);
    setAlcaldiaComparison(null);
    setFieldDebtReport(null);
    setShowFieldDebtModal(false);
    setSelectedAguasServiceField("agua");
    setSelectedPadronStatBarrio("");
    setSelectedPadronServiceField("");
    setPadronStatsBarrioFilter("");
    setPadronStatsSortMetric("brecha_registros");
    setPadronStatsSortDirection("desc");
    setPadronChartMode("brecha");
    setPadronChartType("barras");
  };

  const clearClientPadronCaches = () => {
    persistLookupHistory([]);
    window.sessionStorage?.removeItem?.(LOOKUP_HISTORY_STORAGE_KEY);
    setLookupQuery("");
    clearPadronDerivedState();
  };

  const updatePadronSyncState = (patch) => {
    setPadronSyncState((current) => ({ ...current, ...patch }));
  };

  const updateAlcaldiaSyncState = (patch) => {
    setAlcaldiaSyncState((current) => ({ ...current, ...patch }));
  };

  const applyPadronSyncResult = (data = {}) => {
    setPadronMeta(data.meta ?? null);
    setPadronImportSummary(data.import_summary ?? data.meta?.last_import_summary ?? null);
    updatePadronSyncState({
      status: "complete",
      progress: 100,
      message: "Padron verificado y listo para consultas",
      verification: data.verification ?? null
    });
    if (workspaceView === "requests") {
      loadPadronServiceReport({ silent: true });
    }
  };

  const applyAlcaldiaSyncResult = (data = {}) => {
    setAlcaldiaMeta(data.meta ?? null);
    setAlcaldiaImportSummary(data.import_summary ?? data.meta?.last_import_summary ?? null);
    updateAlcaldiaSyncState({
      status: "complete",
      progress: 100,
      message: "Padron de alcaldia sincronizado"
    });
  };

  const runPadronSyncSteps = async (request, successMessage, sourceLabel = "Excel") => {
    let progressTimer = null;
    updatePadronSyncState({
      status: "running",
      progress: 8,
      message: "Iniciando reemplazo del padron maestro",
      verification: null
    });
    clearClientPadronCaches();
    updatePadronSyncState({ progress: 24, message: "Cache local y resultados anteriores borrados" });
    progressTimer = window.setInterval(() => {
      setPadronSyncState((current) => {
        if (current.status !== "running" || current.progress >= 68) return current;
        return {
          ...current,
          progress: Math.min(68, current.progress + 4),
          message: current.progress >= 48 ? `Verificando ${sourceLabel} completo contra el sistema` : "Reemplazando data de padron en todos los modulos"
        };
      });
    }, 420);

    try {
      const response = await request();
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        if (response.status >= 500 && !data.message) {
          throw new Error("No se pudo conectar correctamente con la API. Revisa que el backend este disponible.");
        }
        if (response.status === 401) {
          clearSession();
        }
        throw new Error(data.message || "No se pudo sincronizar el padron maestro.");
      }

      updatePadronSyncState({ progress: 72, message: "Data del padron reemplazada en el sistema" });
      applyPadronSyncResult(data);
      setDashboardLastUpdatedAt(Date.now());
      showAlert(successMessage(data));
      return data;
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
    }
  };

  const selectedPhotoUrl = useMemo(() => {
    if (!form.foto_path) return "";
    const version = form.updated_at || Date.now();
    return buildPhotoUrl(form.foto_path, version);
  }, [form.foto_path, form.updated_at]);

  const localSelectedPhotoUrl = useMemo(() => {
    if (!selectedFile) return "";
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);
  const batchPrintSelection = useMemo(() => {
    const entries = Object.entries(batchPrintCopies)
      .map(([recordId, copies]) => {
        const ficha = clampPrintCopies(copies?.ficha ?? 0);
        const aviso = clampPrintCopies(copies?.aviso ?? 0);
        const record = safeRecords.find((item) => String(item.id) === String(recordId));
        return record && (ficha || aviso) ? { record, ficha, aviso } : null;
      })
      .filter(Boolean);

    return {
      entries,
      fichas: entries.reduce((total, item) => total + item.ficha, 0),
      avisos: entries.reduce((total, item) => total + item.aviso, 0)
    };
  }, [batchPrintCopies, safeRecords]);
  const printedSaveSelection = useMemo(() => {
    const entries = Object.entries(batchPrintCopies)
      .map(([recordId, copies]) => {
        if (!copies?.save) return null;
        const record = safeRecords.find((item) => String(item.id) === String(recordId));
        return record?.estado_padron === "reportada" ? record : null;
      })
      .filter(Boolean);

    return {
      entries,
      total: entries.length
    };
  }, [batchPrintCopies, safeRecords]);
  const manualPrintedSelection = useMemo(() => {
    const entries = Object.entries(batchPrintCopies)
      .map(([recordId, copies]) => {
        if (!copies?.printed) return null;
        const record = safeRecords.find((item) => String(item.id) === String(recordId));
        return record?.estado_padron !== "reportada" ? record : null;
      })
      .filter(Boolean);

    return {
      entries,
      total: entries.length
    };
  }, [batchPrintCopies, safeRecords]);
  const printBatchStatusCounts = useMemo(
    () => ({
      pending: filteredRecords.filter((record) => record.estado_padron !== "reportada").length,
      printed: filteredRecords.filter((record) => record.estado_padron === "reportada").length
    }),
    [filteredRecords]
  );
  const printBatchRecords = useMemo(() => {
    if (recordView === "archived") return filteredRecords;
    if (printBatchStatusView === "printed") {
      return filteredRecords.filter((record) => record.estado_padron === "reportada");
    }
    return filteredRecords.filter((record) => record.estado_padron !== "reportada");
  }, [filteredRecords, printBatchStatusView, recordView]);
  const filteredPrintBatchRecords = useMemo(() => {
    const query = printBatchSearch.trim().toLowerCase();

    return printBatchRecords.filter((record) => {
      const copies = batchPrintCopies[record.id] || {};
      const fichaCopies = clampPrintCopies(copies.ficha ?? 0);
      const avisoCopies = clampPrintCopies(copies.aviso ?? 0);
      const matchesSearch =
        !query ||
        String(record.clave_catastral || "").toLowerCase().includes(query) ||
        getRecordBarrioName(record, "").toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (printBatchQuickFilter === "clandestina") {
        return (record.estado_padron || "clandestino") === "clandestino";
      }
      if (printBatchQuickFilter === "ficha_selected") {
        return fichaCopies > 0;
      }
      if (printBatchQuickFilter === "aviso_selected") {
        return avisoCopies > 0;
      }

      return true;
    });
  }, [batchPrintCopies, printBatchQuickFilter, printBatchRecords, printBatchSearch]);

  useEffect(() => {
    return () => {
      if (localSelectedPhotoUrl) {
        URL.revokeObjectURL(localSelectedPhotoUrl);
      }
    };
  }, [localSelectedPhotoUrl]);

  useEffect(() => {
    if (workspaceView === "records") return undefined;
    const timer = window.setInterval(() => {
      setDashboardNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [workspaceView]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPasswordModal(false);
      return;
    }

    if (mustChangePassword) {
      setShowPasswordModal(true);
    }
  }, [isAuthenticated, mustChangePassword]);

  const loadRecords = async (query = "", view = recordView, options = {}) => {
    const { silent = false } = options;

    if (!isAuthenticated) return;
    if (!isAdmin && view === "archived") {
      setRecordView("active");
      return;
    }
    try {
      const response = await apiFetch(
        `/inmuebles?q=${encodeURIComponent(query)}&archived=${view === "archived"}`,
        { revalidate: true }
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        if (response.status === 403 && view === "archived" && !isAdmin) {
          setRecordView("active");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los registros.");
      }

      const list = Array.isArray(data) ? data.map(normalizeRecord) : [];
      setRecords(list);
    } catch (_error) {
      if (!silent) {
        setRecords([]);
        showAlert("No fue posible cargar los registros.");
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated && workspaceView === "records") {
      loadRecords(search, recordView);
      loadBarrioCodes({ silent: true });
    }
  }, [isAuthenticated, recordView, workspaceView]);

  useEffect(() => {
    if (!String(form.clave_catastral || "").trim() || String(form.barrio_colonia || "").trim()) {
      return;
    }

    const barrio = getBarrioNameFromClave(form.clave_catastral, safeBarrioCodes);
    if (barrio) {
      setForm((current) => (
        String(current.barrio_colonia || "").trim()
          ? current
          : { ...current, barrio_colonia: barrio }
      ));
    }
  }, [form.clave_catastral, form.barrio_colonia, safeBarrioCodes]);

  useEffect(() => {
    if (!isAuthenticated || !alertRecords.length || !["records", "dashboard"].includes(workspaceView)) {
      return;
    }

    if (!("Notification" in window)) {
      return;
    }

    const shouldRequestPermission =
      Notification.permission === "default" &&
      !window.localStorage.getItem(NOTIFICATION_REQUEST_STORAGE_KEY);

    if (shouldRequestPermission) {
      window.localStorage.setItem(NOTIFICATION_REQUEST_STORAGE_KEY, "1");
      Notification.requestPermission().catch(() => {});
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const nextNotified = { ...notifiedRecordAlerts };
    let changed = false;

    alertRecords.slice(0, 4).forEach((record) => {
      const meta = recordDeadlineMetaById[record.id];
      if (!meta) return;

      const key = `${record.id}:${meta.statusKey}`;
      if (nextNotified[key]) return;

      try {
        new Notification(`Ficha ${meta.label.toLowerCase()}`, {
          body: `${record.clave_catastral} · ${getRecordBarrioName(record, "Sin ubicacion")} · ${meta.helper}`,
          tag: `record-alert-${record.id}-${meta.statusKey}`
        });
      } catch {
        return;
      }

      nextNotified[key] = new Date().toISOString();
      changed = true;
    });

    if (changed) {
      window.localStorage.setItem(RECORD_ALERT_NOTIFICATION_STORAGE_KEY, JSON.stringify(nextNotified));
      setNotifiedRecordAlerts(nextNotified);
    }
  }, [alertRecords, isAuthenticated, notifiedRecordAlerts, recordDeadlineMetaById, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || workspaceView !== "records") {
      return undefined;
    }

    const refreshRecords = () => {
      if (document.visibilityState === "visible") {
        loadRecords(search, recordView, { silent: true });
      }
    };

    const handleWindowFocus = () => refreshRecords();
    const intervalId = window.setInterval(refreshRecords, 8000);
    document.addEventListener("visibilitychange", refreshRecords);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshRecords);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isAuthenticated, recordView, search, workspaceView]);

  // Cargar conteo de mensajes sin leer periodicamente
  useEffect(() => {
    if (!isAuthenticated || !session?.user?.id) return;

    const loadUnreadMessagesCount = async () => {
      try {
        const response = await apiFetch("/profile");
        const data = await response.json();
        if (response.ok && data.messages) {
          const unreadCount = (data.messages ?? []).filter(
            (m) => m.recipient_user_id === session.user.id && !m.read_at
          ).length;
          setUnreadMessagesCount(unreadCount);
        }
      } catch (error) {
        console.error("Error cargando conteo de mensajes:", error);
      }
    };

    // Cargar al iniciar
    loadUnreadMessagesCount();

    // Actualizar cada 30 segundos
    const intervalId = window.setInterval(loadUnreadMessagesCount, 30000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, session?.user?.id, apiFetch]);

  const loadUsers = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingUsers(true);
    }

    try {
      const response = await apiFetch("/users", { revalidate: true });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los usuarios.");
      }

      setUsers(Array.isArray(data) ? data : []);
      setSelectedUserId((current) => {
        const nextUsers = Array.isArray(data) ? data : [];
        if (!nextUsers.length) return null;
        return nextUsers.some((user) => user.id === current) ? current : nextUsers[0].id;
      });
    } catch (error) {
      if (!silent) {
        setUsers([]);
        setSelectedUserId(null);
        showAlert(error.message || "No fue posible cargar los usuarios.");
      }
    } finally {
      if (!silent) {
        setLoadingUsers(false);
      }
    }
  };

  const loadPadronMeta = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingPadronMeta(true);
    }

    try {
      const response = await apiFetch("/claves/meta");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar la información del padrón.");
      }

      setPadronMeta(data.meta ?? null);
      setPadronImportSummary(data.meta?.last_import_summary ?? null);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar la información del padrón.");
      }
    } finally {
      if (!silent) {
        setLoadingPadronMeta(false);
      }
    }
  };

  const loadPadronBatches = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) setLoadingPadronBatches(true);
    try {
      const response = await apiFetch("/integracion/foxpro/lotes?limit=500");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible cargar los lotes FoxPro.");
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setPadronBatches(rows);
      setSelectedPadronBatchCode((current) => rows.some((row) => row.codigo_lote === current) ? current : rows[0]?.codigo_lote || "");
    } catch (error) {
      if (!silent) showAlert(error.message || "No fue posible cargar los lotes FoxPro.");
    } finally {
      if (!silent) setLoadingPadronBatches(false);
    }
  };

  const loadAlcaldiaMeta = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingAlcaldiaMeta(true);
    }

    try {
      const response = await apiFetch("/claves/alcaldia/meta");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesión venció. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar el padrón de alcaldía.");
      }

      setAlcaldiaMeta(data.meta ?? null);
      setAlcaldiaImportSummary(data.meta?.last_import_summary ?? null);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar el padrón de alcaldía.");
      }
    } finally {
      if (!silent) {
        setLoadingAlcaldiaMeta(false);
      }
    }
  };

  const loadAlcaldiaComparison = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    setLoadingAlcaldiaComparison(true);

    try {
      const response = await apiFetch("/claves/alcaldia/compare");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesión venció. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible comparar los padrones.");
      }

      setAlcaldiaComparison(data);
      if (!silent) {
        showAlert(`Comparacion lista: ${data.summary?.candidate_clandestine ?? 0} claves de alcaldia no aparecen en Aguas.`);
      }
      return data;
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible comparar los padrones.");
      }
      return null;
    } finally {
      setLoadingAlcaldiaComparison(false);
    }
  };

  const loadPadronRequestMeta = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingPadronRequestMeta(true);
    }

    try {
      const response = await apiFetch("/claves/requests/meta");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar las plantillas de peticiones.");
      }

      const templates = Array.isArray(data.templates) ? data.templates : [];
      setPadronRequestLoadError("");
      setPadronRequestTemplates(templates);
      if (templates.length) {
        const currentTemplate =
          templates.find((template) => template.id === padronRequestForm.preset_id) ?? templates[0];

        setPadronRequestForm((current) => ({
          ...current,
          preset_id: currentTemplate.id,
          title: current.title || currentTemplate.title || "",
          description: current.description || currentTemplate.description || "",
          keywords: current.keywords || (currentTemplate.keywords || []).join(", ")
        }));
      }
    } catch (error) {
      setPadronRequestLoadError(error.message || "No fue posible cargar las plantillas de peticiones.");
      if (!silent) {
        showAlert(error.message || "No fue posible cargar las plantillas de peticiones.");
      }
    } finally {
      if (!silent) {
        setLoadingPadronRequestMeta(false);
      }
    }
  };

  const loadPadronServiceReport = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    setLoadingPadronServiceReport(true);

    try {
      const response = await apiFetch("/claves/services/report");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar el informe de servicios del padron.");
      }

      setPadronServiceReport(data);
      setPadronRequestLoadError("");
      if (!silent) {
        showAlert(`Informe actualizado: ${data.summary?.total_records ?? 0} registros del padron maestro.`);
      }
    } catch (error) {
      setPadronRequestLoadError(error.message || "No fue posible cargar el informe de servicios del padron.");
      if (!silent) {
        showAlert(error.message || "No fue posible cargar el informe de servicios del padron.");
      }
    } finally {
      setLoadingPadronServiceReport(false);
    }
  };

  const loadBarrioCodes = async ({ silent = false } = {}) => {
    if (!isAuthenticated) return;
    if (!silent) {
      setLoadingBarrioCodes(true);
    }

    try {
      const response = await apiFetch("/barrios");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los codigos de barrios.");
      }

      setBarrioCodes(Array.isArray(data.barrios) ? data.barrios : []);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar los codigos de barrios.");
      }
    } finally {
      if (!silent) {
        setLoadingBarrioCodes(false);
      }
    }
  };

  const handleBarrioCodeFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setBarrioCodeForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : name === "codigo" ? normalizeBarrioCode(value) : value
    }));
  };

  const handleResetBarrioCodeForm = () => {
    setBarrioCodeForm(emptyBarrioForm);
  };

  const handlePrepareAddBarrioCode = (codigo = "") => {
    setBarrioCodeForm({
      ...emptyBarrioForm,
      codigo: normalizeBarrioCode(codigo)
    });
  };

  const handleEditBarrioCode = (item) => {
    setBarrioCodeForm({
      codigo: item.codigo || "",
      barrio: item.barrio || "",
      activo: item.activo !== false
    });
  };

  const handleSaveBarrioCode = async (event) => {
    event.preventDefault();
    setSavingBarrioCode(true);

    try {
      const response = await apiFetch("/barrios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(barrioCodeForm)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible guardar el codigo de barrio.");
      }

      setBarrioCodes(Array.isArray(data.barrios) ? data.barrios : []);
      setBarrioCodeForm(emptyBarrioForm);
      showAlert(`Codigo ${data.item?.codigo || ""} guardado.`);
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el codigo de barrio.");
    } finally {
      setSavingBarrioCode(false);
    }
  };

  const handleDeleteBarrioCode = async (codigo) => {
    if (!window.confirm(`Eliminar el codigo ${codigo}?`)) return;
    setSavingBarrioCode(true);

    try {
      const response = await apiFetch(`/barrios/${encodeURIComponent(codigo)}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible eliminar el codigo de barrio.");
      }

      setBarrioCodes(Array.isArray(data.barrios) ? data.barrios : []);
      setBarrioCodeForm((current) => (current.codigo === codigo ? emptyBarrioForm : current));
      showAlert(`Codigo ${codigo} eliminado.`);
    } catch (error) {
      showAlert(error.message || "No fue posible eliminar el codigo de barrio.");
    } finally {
      setSavingBarrioCode(false);
    }
  };

  const loadMapDiaryGroups = async ({ silent = false } = {}) => {
    if (!isAuthenticated) return;

    try {
      const response = await apiFetch("/map-points/diary-groups");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar las jornadas del mapa.");
      }

      setMapDiaryGroupsSummary(Array.isArray(data.groups) ? data.groups : []);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar las jornadas del mapa.");
      }
    }
  };

  const loadMapPoints = async ({ silent = false, date = "" } = {}) => {
    if (!isAuthenticated) return;

    if (!silent) {
      setLoadingMapPoints(true);
    }

    mapPointsRequestRef.current.controller?.abort();
    const controller = new AbortController();
    const requestId = mapPointsRequestRef.current.id + 1;
    mapPointsRequestRef.current = { id: requestId, controller };

    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      const response = await apiFetch(`/map-points${query}`, { signal: controller.signal, revalidate: true });
      const data = await response.json();

      if (mapPointsRequestRef.current.id !== requestId) {
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los puntos del mapa.");
      }

      const nextPoints = Array.isArray(data) ? data : [];
      setMapPoints(nextPoints);
      setSelectedMapPointId((current) => (nextPoints.some((point) => point.id === current) ? current : null));
      setMapStatus("Sincronizado");
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      if (!silent) {
        showAlert(error.message || "No fue posible cargar los puntos del mapa.");
      }
      setMapStatus("Sin conexion");
    } finally {
      if (mapPointsRequestRef.current.id === requestId) {
        mapPointsRequestRef.current.controller = null;
      }
      if (!silent) {
        setLoadingMapPoints(false);
      }
    }
  };

  const loadArchivedMapDiaryPoints = async (dateKey) => {
    if (!isAuthenticated || !dateKey) return;

    setLoadingArchiveMapDiaryPoints(true);
    try {
      const response = await apiFetch(`/map-points?date=${encodeURIComponent(dateKey)}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar la jornada seleccionada.");
      }

      setArchiveMapDiaryPoints(Array.isArray(data) ? data : []);
      setSelectedArchiveMapDiaryKey(dateKey);
    } catch (error) {
      showAlert(error.message || "No fue posible cargar la jornada seleccionada.");
    } finally {
      setLoadingArchiveMapDiaryPoints(false);
    }
  };

  const openMapDiaryArchiveModal = () => {
    if (!archivedMapDiaryGroups.length) return;
    const nextKey = selectedArchiveMapDiaryGroup?.key || archivedMapDiaryGroups[0].key;
    setShowMapDiaryArchiveModal(true);
    loadArchivedMapDiaryPoints(nextKey);
  };

  const handleUseArchivedMapDiary = () => {
    const nextKey = selectedArchiveMapDiaryGroup?.key || selectedArchiveMapDiaryKey;
    if (!nextKey) return;
    setMapDiaryDateKey(nextKey);
    setMapReportPage(1);
    setShowMapDiaryArchiveModal(false);
  };

  const loadMapPointContexts = async (points = safeMapPoints) => {
    if (!isAuthenticated || !isAdmin) return;

    const payloadPoints = Array.isArray(points) ? points : [];
    if (!payloadPoints.length) {
      setMapPointContexts({});
      return;
    }

    setLoadingMapContexts(true);

    try {
      const response = await apiFetch("/map-points/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          points: payloadPoints.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude
          }))
        })
      }).catch(() => {
        throw new Error("No se pudo conectar con la API. Revisa que el backend este disponible.");
      });
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        throw new Error(data.message || "No fue posible consultar las zonas del levantamiento.");
      }

      const nextContexts = Object.fromEntries(
        (Array.isArray(data.contexts) ? data.contexts : []).map((context) => [context.key, context])
      );
      setMapPointContexts(nextContexts);
    } catch (error) {
      showAlert(error.message || "No fue posible consultar las zonas del levantamiento.");
    } finally {
      setLoadingMapContexts(false);
    }
  };

  const loadAuditLogs = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingLogs(true);
    }

    try {
      const params = new URLSearchParams({ limit: "120" });
      Object.entries(auditFiltersQuery).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          params.set(key, String(value).trim());
        }
      });

      const response = await apiFetch(`/users/audit-logs?${params.toString()}`, { revalidate: true });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar el historial.");
      }

      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setAuditLogs([]);
      if (!silent) {
        showAlert(error.message || "No fue posible cargar el historial.");
      }
    } finally {
      if (!silent) {
        setLoadingLogs(false);
      }
    }
  };

  const loadRecordSummary = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;

    try {
      const response = await apiFetch("/inmuebles/summary");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }
        throw new Error(data.message || "No fue posible cargar el resumen de fichas.");
      }

      setRecords(Array.isArray(data) ? data.map(normalizeRecord) : []);
    } catch (error) {
      if (!silent) showAlert(error.message || "No fue posible cargar el resumen de fichas.");
    }
  };

  const handleOpenAuditReport = async (log) => {
    const reportId = String(log?.entity_id || "").trim();
    if (!reportId) return;
    setLoadingAuditReportId(reportId);
    try {
      const response = await apiFetch(`/users/audit-logs/reports/${encodeURIComponent(reportId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No fue posible abrir el reporte archivado.");
      }
      setSelectedAuditReport(data);
    } catch (error) {
      showAlert(error.message || "No fue posible abrir el reporte archivado.");
    } finally {
      setLoadingAuditReportId("");
    }
  };

  const handleReprintAuditReport = async () => {
    if (!selectedAuditReport?.body_markup) return;
    await printDocument(selectedAuditReport.title, selectedAuditReport.body_markup, {
      reportId: selectedAuditReport.report_id,
      pageSize: selectedAuditReport.page_size || "Letter portrait",
      pageMargin: selectedAuditReport.page_margin || "10mm",
      bodyClassName: selectedAuditReport.body_class_name || "",
      skipAudit: true,
      reportType: selectedAuditReport.report_type || "print-report"
    });
  };

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

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      return;
    }

    if (workspaceView === "users") {
      loadUsers();
    }

    if (workspaceView === "padron") {
      loadPadronMeta();
      loadPadronBatches();
      loadAlcaldiaMeta();
      loadBarrioCodes({ silent: true });
    }

    if (workspaceView === "barrioCodes") {
      loadBarrioCodes();
    }

    if (["dashboard", "requests"].includes(workspaceView)) {
      loadPadronServiceReport({ silent: true });
    }

    if (workspaceView === "requests") {
      loadPadronRequestMeta();
      loadPadronMeta();
      loadAlcaldiaMeta();
      loadBarrioCodes({ silent: true });
      if (!alcaldiaComparison?.summary) {
        loadAlcaldiaComparison({ silent: true });
      }
    }

    if (workspaceView === "logs") {
      loadAuditLogs();
    }
  }, [auditFiltersQuery, isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAuditFiltersQuery(auditFilters), 320);
    return () => window.clearTimeout(timeoutId);
  }, [auditFilters]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !["dashboard", "requests"].includes(workspaceView)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadPadronServiceReport({ silent: true });
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return undefined;

    const handleReportGenerated = async (event) => {
      const detail = event.detail || {};
      if (!detail.reportId) return;

      try {
        const response = await apiFetch("/users/audit-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: detail.reportId,
            title: detail.title || detail.reportId,
            report_type: detail.reportType || "print-report",
            page_size: detail.pageSize || "Letter portrait",
            page_margin: detail.pageMargin || "10mm",
            body_class_name: detail.bodyClassName || "",
            body_markup: detail.bodyMarkup || "",
            summary: `Reporte generado: ${detail.title || detail.reportId}`,
            details: {
              title: detail.title || "Reporte",
              report_type: detail.reportType || "print-report",
              generated_at: detail.createdAt || new Date().toISOString(),
              archive_available: Boolean(detail.bodyMarkup)
            }
          })
        });

        if (response.ok && workspaceView === "logs") {
          loadAuditLogs({ silent: true });
        }
      } catch {
        // La auditoria no debe interrumpir la vista previa ni la impresion.
      }
    };

    window.addEventListener("aguaschol:report-generated", handleReportGenerated);
    return () => window.removeEventListener("aguaschol:report-generated", handleReportGenerated);
  }, [apiFetch, isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      return undefined;
    }

    loadUsers({ silent: true });

    const refreshOnlineUsers = () => {
      if (document.visibilityState === "visible") {
        loadUsers({ silent: true });
      }
    };

    const intervalId = window.setInterval(refreshOnlineUsers, 20000);
    document.addEventListener("visibilitychange", refreshOnlineUsers);
    window.addEventListener("focus", refreshOnlineUsers);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshOnlineUsers);
      window.removeEventListener("focus", refreshOnlineUsers);
    };
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || workspaceView !== "dashboard") {
      return undefined;
    }

    refreshDashboard();
    loadPadronMeta({ silent: true });
    loadAlcaldiaMeta({ silent: true });

    const intervalId = window.setInterval(refreshDashboard, DASHBOARD_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshDashboard);
    window.addEventListener("focus", refreshDashboard);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshDashboard);
      window.removeEventListener("focus", refreshDashboard);
    };
  }, [isAuthenticated, isAdmin, refreshDashboard, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || workspaceView !== "executiveReport") {
      return undefined;
    }

    loadRecords("", "active", { silent: true });
    loadMapDiaryGroups({ silent: true });
    loadMapPoints({ silent: true });
    return undefined;
  }, [isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (isAuthenticated && ["map", "mapReports", "mapAnalytics"].includes(workspaceView)) {
        loadMapDiaryGroups({ silent: true });
        loadMapPoints({ date: workspaceView === "map" ? activeMapDiaryDateKey : "" });
      }
  }, [activeMapDiaryDateKey, isAuthenticated, workspaceView]);

  useEffect(() => {
    if (["mapReports", "mapAnalytics"].includes(workspaceView) && isAdmin) {
      loadMapPointContexts(visibleMapPoints);
    }
  }, [isAdmin, visibleMapPoints, workspaceView]);

  useEffect(() => {
    setMapReportPage(1);
  }, [workspaceView]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(mapReportPrintData.zones.length / 5));
    setMapReportPage((current) => Math.min(current, totalPages));
  }, [mapReportPrintData.zones.length]);

  useEffect(() => {
    const allowedViews = isFieldValidator
      ? ["profile", "inspecciones", "entregas", "records", "lookup", "sigTerritorial", "map", "fieldValidation", "planos"]
      : ["profile", "inspecciones", "entregas", "records", "lookup", "sigTerritorial", "map", "planos"];
    if (isAuthenticated && !isAdmin && !allowedViews.includes(workspaceView)) {
      const defaultView = getDefaultWorkspaceView(session?.user?.role);
      setWorkspaceView(allowedViews.includes(defaultView) ? defaultView : "records");
    }
  }, [isAuthenticated, isAdmin, isFieldValidator, session?.user?.role, workspaceView]);

  // Buscadores sin saltos: al filtrar mientras se escribe, la página no se acorta
  // bajo la vista (ver utils/searchScrollGuard.js).
  useEffect(() => installSearchScrollGuard(), []);

  // La direccion refleja la vista abierta: recargar o compartir el enlace lleva al mismo
  // lugar. replaceState porque la app no escucha popstate; el hash de cada modulo se conserva.
  useEffect(() => {
    if (!isAuthenticated) return;
    const path = getPathForWorkspaceView(workspaceView);
    if (window.location.pathname !== path) {
      window.history.replaceState(window.history.state, "", `${path}${window.location.search}${window.location.hash}`);
    }
  }, [isAuthenticated, workspaceView]);

  useEffect(() => {
    setShowMobileModuleMenu(false);
    window.scrollTo(0, 0);
  }, [workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || workspaceView !== "map") {
      return undefined;
    }

    const refreshMapPoints = () => {
      if (document.visibilityState === "visible") {
        loadMapDiaryGroups({ silent: true });
        loadMapPoints({ silent: true, date: activeMapDiaryDateKey });
      }
    };

    const handleWindowFocus = () => refreshMapPoints();
    const refreshInterval = isCompactMapView ? MOBILE_MAP_AUTO_REFRESH_MS : MAP_AUTO_REFRESH_MS;
    const intervalId = window.setInterval(refreshMapPoints, refreshInterval);
    document.addEventListener("visibilitychange", refreshMapPoints);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshMapPoints);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [activeMapDiaryDateKey, isAuthenticated, isCompactMapView, workspaceView]);

  useEffect(() => {
    if (!isAdmin && recordView === "archived") {
      setRecordView("active");
    }
  }, [isAdmin, recordView]);

  useEffect(() => {
    if (form.id || !hasDraftContent(form)) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const nextDraft = { ...emptyForm, ...form, id: null };
      const savedAt = new Date().toISOString();
      setDraftForm(nextDraft);
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
      window.localStorage.setItem(DRAFT_SAVED_AT_STORAGE_KEY, savedAt);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [form]);

  const applyRecord = (record) => {
    setForm(withBarrioFromPrefix({ ...emptyForm, ...normalizeRecord(record) }, safeBarrioCodes));
    setSelectedFile(null);
  };

  const handlePadronRequestFormChange = (event) => {
    const { name, value } = event.target;
    setPadronRequestForm((current) => ({ ...current, [name]: value }));
  };

  const handlePadronRequestPresetChange = (event) => {
    const nextPresetId = event.target.value;
    const selectedTemplate = padronRequestTemplates.find((template) => template.id === nextPresetId);

    setPadronRequestForm((current) => ({
      ...current,
      preset_id: nextPresetId,
      title: selectedTemplate?.title || current.title,
      description: selectedTemplate?.description || current.description,
      keywords: (selectedTemplate?.keywords || []).join(", ") || current.keywords
    }));
  };

  const handleRunPadronRequest = async (event) => {
    if (event) {
      event.preventDefault();
    }

    const keywords = String(padronRequestForm.keywords || "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (!keywords.length) {
      showAlert("Debes indicar al menos una palabra clave para generar la peticion.");
      return;
    }

    setLoadingPadronRequest(true);

    try {
      const response = await apiFetch("/claves/requests/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          preset_id: padronRequestForm.preset_id,
          title: padronRequestForm.title,
          description: padronRequestForm.description,
          keywords
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible generar la peticion.");
      }

      setPadronRequestResult(data);
      showAlert(`Peticion generada con ${data.summary?.total_registros ?? 0} registros.`);
    } catch (error) {
      showAlert(error.message || "No fue posible generar la peticion.");
    } finally {
      setLoadingPadronRequest(false);
    }
  };

  useEffect(() => {
    const description = String(mapDraft.description || "");
    const descriptionWithoutPadron = stripMapDescriptionPadronBlock(description);
    const references = extractFieldDebtLookupReferences(descriptionWithoutPadron);
    const reference = references[references.length - 1] || null;

    if (!reference) {
      setMapDescriptionLookupStatus("");
      return undefined;
    }

    const currentBlock = description.match(MAP_DESCRIPTION_PADRON_BLOCK_PATTERN)?.[0] || "";
    if (currentBlock) {
      setMapDescriptionLookupStatus("Informacion del padron anexada.");
      return undefined;
    }
    setMapDescriptionLookupStatus(`Consultando padron para ${reference.label}...`);

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        let data = mapDescriptionLookupCacheRef.current.get(reference.key);
        if (!data) {
          const response = await apiFetch(
            `/claves/search?clave=${encodeURIComponent(reference.value)}&field=${encodeURIComponent(reference.field)}&_padron=${encodeURIComponent(
              padronMeta?.updated_at || ""
            )}`
          );
          data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "No fue posible consultar el padron.");
          }
          mapDescriptionLookupCacheRef.current.set(reference.key, data);
        }

        if (cancelled) return;
        const match = Array.isArray(data.matches) ? data.matches[0] : null;
        if (!match) {
          setMapDescriptionLookupStatus(`${reference.label} no aparece en el padron.`);
          return;
        }

        setMapDraft((current) => {
          const currentDescription = String(current.description || "");
          const cleanDescription = stripMapDescriptionPadronBlock(currentDescription);
          if (!extractFieldDebtLookupReferences(cleanDescription).some((item) => item.key === reference.key)) {
            return current;
          }
          const nextBlock = buildMapDescriptionPadronBlock(match);
          return {
            ...current,
            description: [cleanDescription, nextBlock].filter(Boolean).join("\n\n")
          };
        });
        setMapDescriptionLookupStatus("Datos del padron anexados automaticamente.");
      } catch (error) {
        if (!cancelled) {
          setMapDescriptionLookupStatus(error.message || "No fue posible consultar el padron.");
        }
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mapDraft.description, padronMeta?.updated_at, safeBarrioCodes]);

  const findAlcaldiaMatchForForm = async (candidateForm = form, options = {}) => {
    const { allowTextFallback = true } = options;
    const keyQuery = String(candidateForm.clave_catastral || "").trim();
    const textQueries = [
      candidateForm.nombre_catastral,
      candidateForm.inquilino,
      candidateForm.identidad,
      candidateForm.barrio_colonia
    ]
      .map((value) => String(value || "").trim())
      .filter((value) => value.length >= 3);

    const tryQuery = async (query, field) => {
      const response = await apiFetch(`/claves/alcaldia/search?field=${field}&clave=${encodeURIComponent(query)}`);
      if (!response.ok) return null;
      const data = await response.json();
      const matches = Array.isArray(data.matches) ? data.matches : [];
      return matches[0] ?? null;
    };

    if (keyQuery) {
      const match = await tryQuery(keyQuery, "clave");
      if (match) return match;
    }

    if (allowTextFallback) {
      for (const query of textQueries) {
        const match = await tryQuery(query, "texto");
        if (match) return match;
      }
    }

    return null;
  };

  const getAlcaldiaValidationComment = (match, record) => {
    if (!match) return "No concuerda con clave de Alcaldia. Clandestino";
    if (match.exists_in_aguas) return "Aparece en varios padrones";
    return record?.comentarios || "Concuerda con Alcaldia y no aparece en Aguas. Clandestino";
  };

  const buildAlcaldiaValidationPayload = (record, match) => {
    const nextState = match?.exists_in_aguas ? "varios_padrones" : "clandestino";
    return {
      ...record,
      estado_padron: nextState,
      clave_alcaldia: match?.clave_catastral || "",
      nombre_alcaldia: match?.nombre || record.nombre_alcaldia || "",
      barrio_alcaldia: match?.caserio || match?.direccion || record.barrio_alcaldia || "",
      nombre_catastral: match?.nombre || record.nombre_catastral,
      barrio_colonia: getRecordBarrioName(record, "") || match?.caserio || match?.direccion || "",
      identidad: record.identidad || match?.identificador || "",
      comentarios: getAlcaldiaValidationComment(match, record)
    };
  };

  const handleValidatePrintRecord = async (record) => {
    if (!record?.id) return;

    setProcessingRecordId(record.id);
    try {
      const match = await findAlcaldiaMatchForForm(record, { allowTextFallback: false });
      const payload = buildAlcaldiaValidationPayload(record, match);

      const response = await apiFetch(`/inmuebles/${record.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible actualizar la validacion.");
      }

      const normalized = normalizeRecord(data);
      setRecords((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
      if (form.id === normalized.id) {
        setForm({ ...emptyForm, ...normalized });
      }
      showAlert(
        !match
          ? `Ficha ${normalized.clave_catastral} no concuerda con Alcaldia. Quedo clandestina.`
          : match.exists_in_aguas
          ? `Ficha ${normalized.clave_catastral} validada: aparece en varios padrones.`
          : `Ficha ${normalized.clave_catastral} validada como clandestina.`
      );
    } catch (error) {
      showAlert(error.message || "No fue posible validar la ficha desde impresion.");
    } finally {
      setProcessingRecordId(null);
    }
  };

  const handleToggleRegulatorDiaryKey = (dateKey) => {
    setRegulatorReportDiaryKeys((current) => {
      const baseline = current.length ? current : selectedRegulatorDiaryKeys;
      if (baseline.includes(dateKey)) {
        const next = baseline.filter((key) => key !== dateKey);
        return next.length ? next : baseline;
      }

      return [...baseline, dateKey].slice(0, 5);
    });
  };

  const focusSheet = () => {
    window.requestAnimationFrame(() => {
      sheetRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  };

  const handleSelectRecord = (record) => {
    applyRecord(record);
    focusSheet();
  };

  const startNewRecordFromLookup = (patch = {}, alertMessage = "Ficha nueva preparada desde la consulta.") => {
    const nextForm = {
      ...emptyForm,
      ...patch,
      id: null,
      foto_path: ""
    };
    const enrichedForm = withBarrioFromPrefix(nextForm, safeBarrioCodes);

    setRecordQuickFilter("all");
    setRecordFilters({
      clave: enrichedForm.clave_catastral || "",
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    setForm(enrichedForm);
    setSelectedFile(null);
    setWorkspaceView("records");
    showAlert(alertMessage);
    focusSheet();
  };

  const padronFlagToRecordValue = (value = "") => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "S") return "Si";
    if (normalized === "N") return "No";
    return "";
  };

  const buildRecordPatchFromAguasMatch = (match = {}) =>
    withBarrioFromPrefix(
      {
        clave_catastral: match.clave_catastral || "",
        abonado: match.abonado || "",
        nombre_catastral: match.nombre || "",
        inquilino: match.inquilino || "",
        barrio_colonia: match.barrio_colonia || "",
        conexion_agua: padronFlagToRecordValue(match.agua),
        conexion_alcantarillado: padronFlagToRecordValue(match.alcantarillado),
        recoleccion_desechos: padronFlagToRecordValue(match.recoleccion),
        estado_padron: "varios_padrones"
      },
      safeBarrioCodes
    );

  const openLookupMatchInRecord = async (match) => {
    try {
      const response = await apiFetch(`/inmuebles/clave/${encodeURIComponent(match.clave_catastral)}`);

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        if (response.status === 404) {
          showAlert("No existe ficha guardada para esa clave. El reporte del padron si puede generarse desde este modulo.");
          return;
        }

        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No fue posible abrir la ficha para esta clave.");
      }

      const nextRecord = normalizeRecord(await response.json());
      const nextForm = {
        ...nextRecord,
        ...buildRecordPatchFromAguasMatch(match),
        id: nextRecord.id,
        foto_path: nextRecord.foto_path || "",
        comentarios: nextRecord.comentarios || "Datos actualizados desde padron Aguas"
      };
      setWorkspaceView("records");
      setRecordQuickFilter("all");
      setRecordFilters({
        clave: nextRecord.clave_catastral || "",
        barrio: "",
        responsible: "",
        date_from: "",
        date_to: "",
        status: "all"
      });
      setSelectedFile(null);
      applyRecord(nextForm);
      showAlert(`Ficha cargada con datos actualizados del padron para ${nextForm.clave_catastral}. Guarda la ficha para conservarlos.`);
    } catch (error) {
      showAlert(error.message || "No fue posible abrir la ficha para esa clave.");
    }
  };

  const handlePrintLookupMatchReport = async (match) => {
    const totalMeta = getLookupTotalMeta(match?.total);
    const valor = Number(match?.valor ?? 0);
    const intereses = Number(match?.intereses ?? 0);
    const total = Number(match?.total ?? 0);
    const services = [
      { label: "Agua", value: match?.agua, icon: "water" },
      { label: "Alcantarillado", value: match?.alcantarillado, icon: "sewer" },
      { label: "Barrido", value: match?.barrido, icon: "broom" },
      { label: "Desechos / tren de aseo", value: match?.recoleccion, icon: "refresh" },
      { label: "Desechos peligrosos", value: match?.desechos_peligrosos, icon: "waste" }
    ];

    const serviceMarkup = services
      .map((service) => {
        const serviceMeta = getLookupServiceMeta(service.value);
        return `
          <div class="lookup-report-service ${serviceMeta.tone}">
            <strong>${escapeHtml(service.label)}</strong>
            <span>${escapeHtml(serviceMeta.label)}</span>
          </div>
        `;
      })
      .join("");

    await printDocument(
      `Reporte ${match?.clave_catastral || "consulta-padron"}`,
      `
        <div class="lookup-report-shell">
          <header class="lookup-report-header">
            <div class="lookup-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h1>Reporte de consulta por clave</h1>
                <p>Resumen financiero y de servicios consultado desde el padron maestro.</p>
              </div>
            </div>
            <div class="lookup-report-key">Clave catastral: ${escapeHtml(match?.clave_catastral || "--")}</div>
          </header>

          <section class="lookup-report-section">
            <div class="lookup-report-grid">
              <div><strong>Nombre</strong><span>${escapeHtml(match?.inquilino || "Sin nombre asociado")}</span></div>
              <div><strong>Abonado</strong><span>${escapeHtml(match?.abonado || "--")}</span></div>
              <div><strong>Zona</strong><span>${escapeHtml(match?.barrio_colonia || "--")}</span></div>
              <div><strong>Estado</strong><span>${escapeHtml(totalMeta.helper)}</span></div>
            </div>
          </section>

          <section class="lookup-report-section">
            <h2>Detalle de saldo</h2>
            <div class="lookup-report-balance-grid">
              <div><strong>Sin interes</strong><span>${formatLookupAmount(valor)}</span></div>
              <div><strong>Interes</strong><span>${formatLookupAmount(intereses)}</span></div>
              <div class="is-total"><strong>Total</strong><span>${escapeHtml(totalMeta.text)}</span></div>
            </div>
            <div class="lookup-report-formula">
              <strong>Sumatoria</strong>
              <span>${formatLookupAmount(valor)} + ${formatLookupAmount(intereses)} = ${formatLookupAmount(total)}</span>
            </div>
          </section>

          <section class="lookup-report-section">
            <h2>Servicios registrados</h2>
            <div class="lookup-report-service-grid">
              ${serviceMarkup}
            </div>
          </section>
        </div>
      `,
      {
        bodyClassName: "lookup-report-body",
        pageSize: "Letter portrait",
        pageMargin: "10mm"
      }
    );

    showAlert(`Reporte de saldo y servicios generado para la clave ${match?.clave_catastral || "--"}.`);
  };

  const resetForm = () => {
    setRecordQuickFilter("all");
    setRecordFilters({
      clave: "",
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    setForm(emptyForm);
    setDraftForm(null);
    setSelectedFile(null);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_SAVED_AT_STORAGE_KEY);
    focusSheet();
  };

  const handleDeleteArchivedRecord = async (record) => {
    if (!record?.id) return;

    try {
      const response = await apiFetch(`/inmuebles/${record.id}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar la ficha archivada.");
      }

      if (form.id === record.id) {
        resetForm();
      }

      setPendingDeleteRecord(null);
      showAlert(`Ficha ${data.inmueble?.clave_catastral || record.clave_catastral} eliminada del registro archivado.`);
      loadRecords(search, "archived");
    } catch (error) {
      showAlert(error.message || "No se pudo eliminar la ficha archivada.");
    }
  };

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
