import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@blossom-carousel/core/style.css";
import { CalendarDays, MapPin } from "lucide-react";
import { toast, Toaster } from "sonner";
import FieldAnalyticsPanel from "./components/FieldAnalyticsPanel";
import { Icon, actionIconName } from "./components/Icon";
import BarrioCodesWorkspace, { emptyBarrioForm } from "./components/BarrioCodesWorkspace";
import { UsersContent, UsersSidebar } from "./components/users/UsersWorkspace";
import { NotificationCenter } from "./components/NotificationCenter.jsx";
import AppSidebar from "./components/sidebar/AppSidebar";
import { buildSidebarSections, getPathForWorkspaceView } from "./components/sidebar/sidebarConfig";
import { ModuleSkeleton } from "./components/ds/Skeleton";
import "./components/ds/design-system.css";
import "./styles/request-workspace.css";
import logoAguasCholuteca from "./assets/logo-aguas-choluteca.png";
import loginBridgeBackground from "./assets/login/login-bridge-background.webp";
import loginDroplet from "./assets/login/control-aguas-droplet.png";
import loginSplash from "./assets/login/control-aguas-splash.png";
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
  ALERT_MAP_POINT_TYPE,
  COMMERCIAL_MAP_POINT_TYPE,
  defaultMapReportStaff,
  defaultMapReportSettings,
  defaultPadronRequestForm,
  emptyForm,
  emptyMapDraft,
  emptyMapReportDraft,
  LOOKUP_SEARCH_MODES,
  MAX_LOOKUP_HISTORY_ITEMS,
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
  getLookupValidationMessage,
  isLookupQueryReady,
  sanitizeLookupInput
} from "./utils/claveAndLookup";
import {
  formatDateTime,
  formatMapDiaryLabel,
  formatMonthGroup,
  formatSpanishDate,
  getMapDiaryDateKey,
  normalizeRecord,
  syncMapDiaryGroups
} from "./utils/datesAndBusiness";
import {
  buildExternalMapUrl,
  buildMapReportDraftFromPoint,
  formatCoordinate,
  getMapPointContextKey,
  getMapPointTypeLabel
} from "./utils/mapField";
import { buildPadronNameIndex, buildReportDebtRows, buildSharedCadastralKeys, selectReportZones } from "./modules/reports/utils/reportSelectors";
import {
  comparableFormShape,
  getRecordDeadlineMeta,
  getRecordGroupDate,
  hasDraftContent
} from "./utils/records";
import { loadStoredLookupHistory, loadStoredRecordNotifications } from "./utils/localStorage";
import { escapeHtml } from "./utils/html";
import { fileToDataUrl, optimizeImageForUpload, urlToDataUrl } from "./utils/imageUtils";
import { buildPrintHtml, pause, printDocument, saveReportPdf } from "./utils/printDocument";
import {
  getBarrioNameFromClave,
  normalizeBarrioCode,
  resolveBarrioFromPayload,
  withBarrioFromPrefix,
  withReferenceBarrioPrefix,
  ensureClaveHasPrefix
} from "./utils/barrioCodes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { lastDaysSeries } from "./modules/dashboard/dashboardSelectors.js";
import { abrirMisAsignaciones } from "./modules/clandestinos/hooks/useBanco";
import { installSearchScrollGuard } from "./utils/searchScrollGuard";
import {
  FieldValidationWorkspace,
  MyProfileWorkspace,
  RailwayUsageWorkspace,
  PlanosWorkspace,
  ReportsWorkspace,
  PadronRequestsWorkspace,
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
  auditActionTone,
  formatAuditTime,
  auditRelativeDayLabel
} from "./utils/audit";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  DASHBOARD_REFRESH_INTERVAL_MS,
  MAP_POINT_LIST_INITIAL_LIMIT,
  MOBILE_MAP_POINT_LIMIT,
  MAP_AUTO_REFRESH_MS,
  MOBILE_MAP_AUTO_REFRESH_MS,
  RECORDS_PAGE_SIZE,
  MAP_DIARY_PRIMARY_LIMIT,
  EXECUTIVE_REPORT_CREDIT
} from "./constants/workspace";
import {
  GEOLOCATION_OPTIONS,
  GEOLOCATION_FALLBACK_OPTIONS,
  getCurrentPosition,
  isLocalSecureHost,
  getGeolocationUnavailableMessage,
  getGeolocationErrorMessage
} from "./utils/geolocation";
import { getTodayMapDiaryKey } from "./utils/mapDiary";
import { MapDiaryArchiveCalendar } from "./components/MapDiaryArchiveCalendar";
import {
  REPORT_POINT_DANGER_RGB,
  REPORT_POINT_DANGER_FILL_RGB,
  REPORT_POINT_DANGER_BORDER_RGB,
  REPORT_POINT_ALERT_RGB,
  REPORT_POINT_ALERT_FILL_RGB,
  REPORT_POINT_ALERT_BORDER_RGB,
  isRedReportPoint,
  isAlertReportPoint,
  getDefaultMapPointColor,
  getReportPointRowClassName,
  getMapReportZoneOverrideKey,
  getMapReportTechnicians,
  normalizeMapReportStaff,
  buildMapReportStaffMarkup,
  getMapReportTechniciansLabel,
  getMapReportBarrioZone,
  getMapReportPointClave,
  getMapZoneClavesLabel,
  MAP_REPORT_SERVICE_LEGEND,
  getMapPointPadronNames,
  getMapPointReportReferenceLabel,
  getMapReportTypeChartRows,
  buildMapReportTypeChartMarkup,
  buildMapReportBriefRows,
  normalizeHousingUnitsInput,
  MAP_DESCRIPTION_PADRON_BLOCK_PATTERN,
  stripMapDescriptionPadronBlock,
  getMapPointTechnicalDescription,
  getMapPointReferenceNote,
  normalizeMapReportSettings,
  stripTransientMapReportSettings,
  loadMapReportSettingsByDate
} from "./utils/mapReport";
import {
  FIELD_DEBT_SERVICE_DEFINITIONS,
  extractFieldDebtLookupReferences,
  getFieldDebtServiceStatus,
  buildMapDescriptionPadronBlock,
  getActiveServiceShortLabels,
  buildLookupAssistantDetails,
  buildFieldDebtServicesMarkup,
  buildFieldDebtPointRows,
  getFieldDebtResultLabel
} from "./utils/fieldDebt";
import {
  formatPercent,
  formatRelativeTime,
  formatDashboardSyncRelativeTime,
  formatDashboardSyncDate
} from "./utils/timeFormat";
import {
  getPadronStatusLabel,
  clampPrintCopies,
  getRecordPhotoPath,
  getRecordDisplayName,
  getRecordAguasPresenceLabel,
  getRecordFichaDateLabel,
  getRecordPrintedDateLabel
} from "./utils/recordLabels";
import { humanizeDashboardActivity, normalizeDashboardWidgetPrefs } from "./utils/dashboardActivity";
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
  const [showLookupClassicModal, setShowLookupClassicModal] = useState(false);
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
  const [draftSavedAt, setDraftSavedAt] = useState(
    () => window.localStorage.getItem(DRAFT_SAVED_AT_STORAGE_KEY) || null
  );
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
  const [dashboardWidgetPrefs, setDashboardWidgetPrefs] = useState(() => {
    try {
      const saved = window.localStorage.getItem(DASHBOARD_WIDGET_STORAGE_KEY);
      if (!saved) {
        return normalizeDashboardWidgetPrefs({});
      }

      return normalizeDashboardWidgetPrefs(JSON.parse(saved));
    } catch {
      return normalizeDashboardWidgetPrefs({});
    }
  });
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
  const [lookupSearchMode, setLookupSearchMode] = useState("clave");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPrefixMode, setLookupPrefixMode] = useState("auto");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupFeedback, setLookupFeedback] = useState("");
  const [lookupHistory, setLookupHistory] = useState(() => loadStoredLookupHistory());
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
  const lookupModeConfig =
    LOOKUP_SEARCH_MODES.find((mode) => mode.value === lookupSearchMode) ?? LOOKUP_SEARCH_MODES[0];
  const lookupInputLabel =
    lookupSearchMode === "clave"
      ? "Clave catastral"
      : lookupSearchMode === "nombre"
        ? "Nombre o inquilino"
        : lookupSearchMode === "alcaldia"
          ? "Clave, nombre o barrio de Alcaldía"
          : "Numero de abonado";
  const lookupInputPlaceholder =
    lookupSearchMode === "clave"
      ? lookupPrefixMode === "three"
        ? "000-00-00 o 000-00-00-00"
        : "00-00-00, 000-00-00 o clave completa"
      : lookupSearchMode === "nombre"
        ? "Ej. Juan Aguilera Estrada"
        : lookupSearchMode === "alcaldia"
          ? "Ej. 01-01-01, Suyapa o Sandra"
        : "Ej. 16523";
  const lookupAssistant = useMemo(() => {
    const query = lookupQuery.trim();
    const modeLabel =
      lookupSearchMode === "clave"
        ? "clave catastral"
        : lookupSearchMode === "nombre"
          ? "nombre"
          : lookupSearchMode === "alcaldia"
            ? "registro de Alcaldia"
            : "abonado";

    if (lookupLoading) {
      return {
        tone: "is-thinking",
        title: "Consultando informacion",
        messages: [`Estoy buscando ${query || `por ${modeLabel}`} en el padron disponible.`],
        chips: ["Revisando coincidencias", "Preparando retroalimentacion"]
      };
    }

    if (lookupFeedback) {
      return {
        tone: "is-warning",
        title: "Ajusta la busqueda",
        messages: [lookupFeedback],
        chips: ["Formato pendiente", "No se consulto aun"]
      };
    }

    if (lookupResult) {
      if (!lookupResult.exists) {
        return {
          tone: "is-danger",
          title: "Posible clandestino",
          messages: [
            lookupResult.field === "clave"
              ? "No aparece en Aguas con la clave consultada. Conviene crear ficha nueva si el punto fue verificado en campo."
              : "No encontre coincidencias con esa busqueda. Prueba una clave exacta, nombre alterno o numero de abonado si lo tienes."
          ],
          chips: lookupResult.field === "clave" ? ["No registrado", "Crear ficha"] : ["Sin coincidencias", "Revisar datos"]
        };
      }

      if (lookupResult.field === "texto") {
        const missingInAguas = (lookupResult.matches || []).filter((match) => !match.exists_in_aguas).length;
        return {
          tone: missingInAguas ? "is-warning" : "is-success",
          title: missingInAguas ? "Atencion: revisar candidatas" : "Coincidencia municipal encontrada",
          messages: [
            missingInAguas
              ? `${missingInAguas} coincidencia(s) de Alcaldia no aparecen en Aguas. Revisa la lista y prepara ficha si corresponde.`
              : `Hay ${lookupResult.total_matches} coincidencia(s) en Alcaldia y no se detecta brecha inmediata en la lista visible.`
          ],
          chips: missingInAguas ? ["Alcaldia si", "Aguas pendiente"] : ["Alcaldia encontrada", "Comparar detalle"]
        };
      }

      const firstMatch = lookupResult.matches?.[0] || {};
      const services = getActiveServiceShortLabels(firstMatch);
      return {
        tone: "is-success",
        title: lookupResult.field === "clave" ? "Clave registrada en Aguas" : "Coincidencias encontradas",
        messages: [
          lookupResult.field === "clave" && lookupResult.mode === "base"
            ? `Esta base tiene ${lookupResult.total_matches} coincidencia(s). Abre el detalle para elegir la cuenta exacta.`
            : `Buenos dias. Su clave ${firstMatch.clave_catastral || lookupResult.normalized_query} aparece en el padron de Aguas. Estos son los datos del abonado que encontre:`,
          services.length
            ? `Servicios activos detectados: ${services.join(", ")}.`
            : "No se ven servicios activos en la primera coincidencia."
        ],
        chips: [
          firstMatch.abonado ? `Abonado ${firstMatch.abonado}` : "Registrado",
          services.length ? `${services.length} servicio(s)` : "Sin servicios activos"
        ],
        details: buildLookupAssistantDetails(firstMatch)
      };
    }

    if (!query) {
      return {
        tone: "is-idle",
        title: "Asistente de busqueda",
        messages: [
          lookupSearchMode === "clave"
            ? "Escribe una clave completa para validar si aparece en Aguas, o una base de tres bloques para ver cuentas relacionadas."
            : lookupSearchMode === "alcaldia"
              ? "Busca en Alcaldia para comparar si existe brecha con Aguas."
              : `Escribe un ${modeLabel} para ubicar coincidencias en el padron.`
        ],
        chips: ["Esperando datos", "Te indico el siguiente paso"]
      };
    }

    if (!isLookupQueryReady(query, lookupSearchMode)) {
      return {
        tone: "is-warning",
        title: "Voy leyendo la entrada",
        messages: [
          lookupSearchMode === "clave"
            ? "La clave todavia no tiene formato completo. Usa 00-00-00, 000-00-00 o agrega el cuarto bloque si buscas una cuenta exacta."
            : getLookupValidationMessage(lookupSearchMode)
        ],
        chips: ["Entrada incompleta", "Sigue escribiendo"]
      };
    }

    return {
      tone: "is-ready",
      title: "Lista para consultar",
      messages: [`La busqueda por ${modeLabel} ya tiene formato suficiente. Presiona consultar para revisar estado y recomendacion.`],
      chips: ["Formato correcto", "Consultar ahora"]
    };
  }, [lookupFeedback, lookupLoading, lookupQuery, lookupResult, lookupSearchMode]);
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
  const displayRecords = useMemo(
    () =>
      safeRecords.map((record) => {
        if (String(record.barrio_colonia || "").trim()) {
          return record;
        }

        const barrio = getRecordBarrioName(record, "");
        return barrio ? { ...record, barrio_colonia: barrio } : record;
      }),
    [getRecordBarrioName, safeRecords]
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
  const totalCajaRegistro = useMemo(
    () => visibleMapPoints.filter((point) => point.point_type === "caja_registro").length,
    [visibleMapPoints]
  );
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
  const recentLookupCountToday = useMemo(
    () => lookupHistory.filter((item) => getMapDiaryDateKey(item.searched_at) === todayDateKey).length,
    [lookupHistory, todayDateKey]
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

  const dashboardMetrics = useMemo(
    () => [
      {
        label: "Movimiento de hoy",
        value: recordsUpdatedToday,
        helper: `${safeRecords.length} fichas activas en operación`,
        icon: "records"
      },
      {
        label: "Borrador de campo",
        value: draftForm ? "Listo" : "Vacío",
        helper: draftForm
          ? `Último guardado ${draftSavedAt ? formatDateTime(draftSavedAt) : "hace un momento"}`
          : "Sin captura pendiente en este equipo",
        icon: draftForm ? "success" : "history"
      },
      {
        label: "Campo hoy",
        value: mapPointsToday,
        helper: `${mapDiaryGroups.length} jornadas guardadas en bitácora`,
        icon: "map"
      },
      {
        label: "Consultas rápidas",
        value: recentLookupCountToday,
        helper: lookupHistory.length
          ? `${lookupHistory.length} consultas recientes listas para repetir`
          : "Aún no hay búsquedas guardadas",
        icon: "search"
      }
    ],
    [draftForm, draftSavedAt, lookupHistory.length, mapDiaryGroups.length, mapPointsToday, recentLookupCountToday, recordsUpdatedToday, safeRecords.length]
  );
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
  const dashboardActivity = useMemo(() => safeAuditLogs.slice(0, 5), [safeAuditLogs]);

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
  const dashboardFocusCards = useMemo(
    () => [
      {
        title: "Operación del día",
        value: `${recordsUpdatedToday} movimientos hoy`,
        detail: draftForm
          ? "Tienes un borrador operativo listo para retomarse."
          : pendingPhotoRecords
            ? `${pendingPhotoRecords} fichas siguen sin fotografía asociada.`
            : "El módulo de fichas está listo para captura y seguimiento.",
        icon: "records",
        actionLabel: "Abrir fichas",
        actionView: "records"
      },
      {
        title: "Campo y geolocalización",
        value: `${mapPointsToday} puntos hoy`,
        detail: dashboardJourneys[0]
          ? `Última jornada: ${formatMapDiaryLabel(dashboardJourneys[0].key)} con ${dashboardJourneys[0].total} puntos.`
          : "Todavía no hay jornadas cargadas en mapa de campo.",
        icon: "map",
        actionLabel: "Ir a mapa",
        actionView: "map"
      },
      {
        title: "Consulta y padrón",
        value: `${lookupHistory.length} consultas`,
        detail: padronMeta?.file_name
          ? `Padrón activo: ${padronMeta.file_name}`
          : "Conviene validar el padrón maestro antes de consultas masivas.",
        icon: "search",
        actionLabel: "Buscar clave",
        actionView: "lookup"
      }
    ],
    [dashboardJourneys, draftForm, lookupHistory.length, mapPointsToday, padronMeta?.file_name, pendingPhotoRecords, recordsUpdatedToday]
  );
  const dashboardQuickActions = useMemo(
    () => [
      { key: "records", label: "Nueva ficha", helper: "Crear registro clandestino", icon: "plus" },
      { key: "lookup", label: "Buscar clave", helper: "Consulta rápida de padrón", icon: "search" },
      { key: "map", label: "Mapa de campo", helper: "Levantamiento GPS", icon: "map" },
      { key: "executiveReport", label: "Reportes", helper: "Vista ejecutiva y estadísticas", icon: "dashboard" },
      { key: "printAlerts", label: "Imprimir alertas", helper: "Lote de fichas criticas", icon: "records" },
      { key: "logs", label: "Bitácora", helper: "Actividad del sistema", icon: "logs" }
    ],
    []
  );
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
  const dashboardLookupItems = useMemo(() => lookupHistory.slice(0, 5), [lookupHistory]);
  const dashboardSignalCards = useMemo(
    () => [
      {
        title: "Plazo crítico",
        value: alertRecords.length,
        helper: alertRecords.length ? "Fichas que requieren seguimiento hoy." : "Sin fichas críticas por plazo.",
        tone: alertRecords.length ? "is-warning" : "is-calm",
        icon: alertRecords.length ? "warning" : "success"
      },
      {
        title: "Sin fotografía",
        value: pendingPhotoRecords,
        helper: pendingPhotoRecords ? "Pendientes de evidencia visual." : "Todas las visibles tienen foto.",
        tone: pendingPhotoRecords ? "is-warning" : "is-calm",
        icon: pendingPhotoRecords ? "activity" : "success"
      },
      {
        title: "Consultas de hoy",
        value: recentLookupCountToday,
        helper: lookupHistory.length ? "Búsqueda rápida reutilizable desde el tablero." : "Aún no hay consultas en este equipo.",
        tone: recentLookupCountToday ? "is-info" : "is-calm",
        icon: "search"
      }
    ],
    [alertRecords.length, lookupHistory.length, pendingPhotoRecords, recentLookupCountToday]
  );
  const dashboardExecutiveCards = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const todayRecords = safeRecords.filter((record) => getMapDiaryDateKey(record.updated_at || record.created_at) === todayDateKey).length;
    const weekRecords = safeRecords.filter((record) => {
      const stamp = Date.parse(record.updated_at || record.created_at || "");
      return Number.isFinite(stamp) && stamp >= weekAgo;
    }).length;
    const weekMapPoints = mapDiaryGroups.reduce((total, group) => {
      const stamp = Date.parse(`${group.key}T12:00:00`);
      return Number.isFinite(stamp) && stamp >= weekAgo ? total + Number(group.total || 0) : total;
    }, 0);
    const weekLookups = lookupHistory.filter((item) => {
      const stamp = Date.parse(item.searched_at || "");
      return Number.isFinite(stamp) && stamp >= weekAgo;
    }).length;

    return [
      {
        title: "Fichas",
        today: todayRecords,
        week: weekRecords,
        helper: weekRecords ? `${todayRecords} hoy frente a ${weekRecords} movimientos de la semana.` : "Todavía no hay movimiento semanal.",
        icon: "records",
        tone: todayRecords ? "is-info" : "is-calm"
      },
      {
        title: "Campo",
        today: mapPointsToday,
        week: weekMapPoints,
        helper: weekMapPoints ? `${mapPointsToday} puntos hoy y ${weekMapPoints} en los últimos 7 días.` : "Sin levantamientos en la última semana.",
        icon: "map",
        tone: mapPointsToday ? "is-info" : "is-calm"
      },
      {
        title: "Consultas",
        today: recentLookupCountToday,
        week: weekLookups,
        helper: weekLookups ? `${recentLookupCountToday} consultas hoy y ${weekLookups} en la semana.` : "No hay consultas recientes registradas.",
        icon: "search",
        tone: recentLookupCountToday ? "is-warning" : "is-calm"
      }
    ];
  }, [lookupHistory, mapDiaryGroups, mapPointsToday, recentLookupCountToday, safeRecords, todayDateKey]);
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
  const dashboardZoneSummary = useMemo(() => {
    const grouped = safeRecords.reduce((acc, record) => {
      const zone = getRecordBarrioName(record, "Sin zona");
      if (!acc[zone]) {
        acc[zone] = {
          name: zone,
          total: 0,
          pendingPhoto: 0,
          alert: 0
        };
      }
      acc[zone].total += 1;
      if (!record.foto_path) {
        acc[zone].pendingPhoto += 1;
      }
      if (recordDeadlineMetaById[record.id]?.status && recordDeadlineMetaById[record.id].status !== "on_track") {
        acc[zone].alert += 1;
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
  const moveDashboardWidget = (key, direction) => {
    setDashboardWidgetPrefs((current) => {
      const currentIndex = current.order.indexOf(key);
      const nextIndex = currentIndex + direction;
      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= current.order.length) {
        return current;
      }

      const nextOrder = [...current.order];
      const [item] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(nextIndex, 0, item);
      return { ...current, order: nextOrder };
    });
  };
  const toggleDashboardWidgetVisibility = (key) => {
    setDashboardWidgetPrefs((current) => ({
      ...current,
      hidden: current.hidden.includes(key)
        ? current.hidden.filter((item) => item !== key)
        : [...current.hidden, key]
    }));
  };
  const resetDashboardWidgets = () => {
    setDashboardWidgetPrefs(normalizeDashboardWidgetPrefs({}));
  };

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
    window.localStorage.setItem(DASHBOARD_WIDGET_STORAGE_KEY, JSON.stringify(dashboardWidgetPrefs));
  }, [dashboardWidgetPrefs]);

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
    setDraftSavedAt(null);
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

  const persistLookupHistory = (nextHistory) => {
    window.localStorage.setItem(LOOKUP_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    setLookupHistory(nextHistory);
  };

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

  const handleRemoveLookupHistoryItem = (historyItem) => {
    const nextHistory = lookupHistory.filter(
      (item) =>
        !(
          item.mode === historyItem.mode &&
          String(item.normalized_query || item.query || "") === String(historyItem.normalized_query || historyItem.query || "") &&
          item.searched_at === historyItem.searched_at
        )
    );
    persistLookupHistory(nextHistory);
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
    if (!isAuthenticated || workspaceView !== "lookup") {
      return undefined;
    }

    if (!lookupQuery.trim()) {
      setLookupFeedback("");
      setLookupResult(null);
      return undefined;
    }

    if (!isLookupQueryReady(lookupQuery, lookupSearchMode)) {
      setLookupResult(null);
      setLookupFeedback(getLookupValidationMessage(lookupSearchMode));
      return undefined;
    }

    const timer = window.setTimeout(() => {
      handleLookupSearch();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, lookupQuery, lookupSearchMode, workspaceView]);

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
      setDraftSavedAt(savedAt);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [form]);

  const applyRecord = (record) => {
    setForm(withBarrioFromPrefix({ ...emptyForm, ...normalizeRecord(record) }, safeBarrioCodes));
    setSelectedFile(null);
  };

  const handleLookupInputChange = (event) => {
    const nextValue = sanitizeLookupInput(event.target.value, lookupSearchMode, lookupPrefixMode);
    setLookupQuery(nextValue);
    setLookupFeedback("");

    if (!nextValue.trim()) {
      setLookupResult(null);
    }
  };

  const handleLookupPrefixModeChange = (mode) => {
    setLookupPrefixMode(mode);
    setLookupQuery((current) => sanitizeLookupInput(current, lookupSearchMode, mode));
    setLookupFeedback("");
  };

  const handleLookupSearchModeChange = (mode) => {
    setLookupSearchMode(mode);
    setLookupQuery("");
    setLookupResult(null);
    setLookupFeedback("");
    if (mode !== "clave") {
      setLookupPrefixMode("auto");
    }
  };

  const handleLookupSearch = async (event) => {
    if (event) {
      event.preventDefault();
    }

    const normalizedLookupQuery = lookupQuery.trim();

    if (!normalizedLookupQuery) {
      setLookupResult(null);
      setLookupFeedback(
          lookupSearchMode === "clave"
            ? "Ingresa una clave catastral para consultar."
            : lookupSearchMode === "nombre"
              ? "Ingresa un nombre para consultar."
              : lookupSearchMode === "alcaldia"
                ? "Ingresa una clave, nombre o barrio para consultar en Alcaldia."
                : "Ingresa un numero de abonado para consultar."
      );
      return;
    }

    if (!isLookupQueryReady(normalizedLookupQuery, lookupSearchMode)) {
      setLookupResult(null);
      setLookupFeedback(getLookupValidationMessage(lookupSearchMode));
      return;
    }

    setLookupLoading(true);
    setLookupFeedback("");

    try {
      const padronCacheKey = encodeURIComponent(padronMeta?.updated_at || Date.now());
      const lookupUrl =
        lookupSearchMode === "alcaldia"
          ? `/claves/alcaldia/search?field=texto&clave=${encodeURIComponent(normalizedLookupQuery)}&_padron=${padronCacheKey}`
          : `/claves/search?clave=${encodeURIComponent(normalizedLookupQuery)}&field=${encodeURIComponent(lookupSearchMode)}&_padron=${padronCacheKey}`;
      const response = await apiFetch(lookupUrl);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible consultar la clave.");
      }

      setLookupResult(data);
      const historyEntry = {
        mode: lookupSearchMode,
        query: normalizedLookupQuery,
        normalized_query: data.normalized_query || normalizedLookupQuery,
        total_matches: data.total_matches ?? 0,
        exists: Boolean(data.exists),
        searched_at: new Date().toISOString()
      };
      setLookupHistory((current) => {
        const nextHistory = [
          historyEntry,
          ...current.filter(
            (item) =>
              !(
                item.mode === historyEntry.mode &&
                String(item.normalized_query || item.query) === String(historyEntry.normalized_query)
              )
          )
        ].slice(0, MAX_LOOKUP_HISTORY_ITEMS);
        window.localStorage.setItem(LOOKUP_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
        return nextHistory;
      });
    } catch (error) {
      setLookupResult(null);
      setLookupFeedback(error.message || "No fue posible consultar la clave.");
    } finally {
      setLookupLoading(false);
    }
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

  const handlePrintPadronRequest = async () => {
    if (!padronRequestResult) {
      showAlert("Genera primero la peticion para imprimirla.");
      return;
    }

    const summary = padronRequestResult.summary ?? {};
    const barriosMarkup = (summary.barrios ?? [])
      .map(
        (barrio, index) => `
          <section class="request-report-zone">
            <div class="request-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Barrio ${index + 1}</span>
                <h3>${escapeHtml(barrio.barrio_colonia)}</h3>
              </div>
              <div class="request-report-zone-meta">
                <span>${barrio.total_registros} registros</span>
                <span>Tarifa: ${formatCurrency(barrio.tarifa_total)}</span>
                <span>Total: ${formatCurrency(barrio.total_con_interes)}</span>
              </div>
            </div>
            <table class="request-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Abonado</th>
                  <th>Clave</th>
                  <th>Barrio</th>
                  <th>Tarifa</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${barrio.rows
                  .map(
                    (row, rowIndex) => `
                      <tr>
                        <td>${rowIndex + 1}</td>
                        <td>${escapeHtml(row.nombre || "--")}</td>
                        <td>${escapeHtml(row.abonado || "--")}</td>
                        <td>${escapeHtml(ensureClaveHasPrefix(row.clave_catastral || row.clave_aguas_formato || row.clave_alcaldia, row.barrio_colonia, safeBarrioCodes) || "--")}</td>
                        <td>${escapeHtml(row.barrio_colonia || "--")}</td>
                        <td>${formatCurrency(row.tarifa || 0)}</td>
                        <td>${formatCurrency(row.total || 0)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");

    await printDocument(
      padronRequestResult.request?.title || "Peticion de padron",
      `
        <div class="request-report-shell">
          <header class="request-report-header">
            <div class="request-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h1>${escapeHtml(padronRequestResult.request?.title || "Peticion de padron")}</h1>
                <p>${escapeHtml(padronRequestResult.request?.description || "")}</p>
              </div>
            </div>
            <div class="request-report-summary">
              <div><strong>Total de registros</strong><span>${summary.total_registros ?? 0}</span></div>
              <div><strong>Total de barrios</strong><span>${summary.total_barrios ?? 0}</span></div>
              <div><strong>Tarifa acumulada</strong><span>${formatCurrency(summary.tarifa_total ?? 0)}</span></div>
              <div><strong>Total con interes</strong><span>${formatCurrency(summary.total_con_interes ?? 0)}</span></div>
            </div>
            <p class="request-report-keywords"><strong>Palabras clave:</strong> ${escapeHtml((padronRequestResult.request?.keywords || []).join(", "))}</p>
          </header>
          ${barriosMarkup || '<p class="request-report-empty">No hay registros para mostrar en esta peticion.</p>'}
        </div>
      `,
      {
        pageSize: "Letter landscape",
        pageMargin: "10mm",
        bodyClassName: "request-report-body"
      }
    );
  };

  const handleDownloadPadronRequestPdf = async () => {
    if (!padronRequestResult) {
      showAlert("Genera primero la peticion para descargarla en PDF.");
      return;
    }

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });

      document.setFillColor(237, 246, 255);
      document.rect(0, 0, 279.4, 18, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(18);
      document.setTextColor(18, 59, 93);
      document.text(padronRequestResult.request?.title || "Peticion de padron", 14, 12);
      document.setFontSize(9);
      document.setFont("helvetica", "normal");
      document.setTextColor(82, 114, 141);
      document.text("Aguas de Choluteca, S.A. de C.V.", 14, 17);

      const summary = padronRequestResult.summary ?? {};
      document.setFontSize(10);
      document.setTextColor(23, 52, 78);
      document.text(`Registros: ${summary.total_registros ?? 0}`, 170, 10);
      document.text(`Barrios: ${summary.total_barrios ?? 0}`, 170, 15);
      document.text(`Tarifa acumulada: ${formatCurrency(summary.tarifa_total ?? 0)}`, 214, 10);
      document.text(`Total con interes: ${formatCurrency(summary.total_con_interes ?? 0)}`, 214, 15);

      let currentY = 24;
      autoTable(document, {
        startY: currentY,
        head: [["Descripcion", "Palabras clave"]],
        body: [[padronRequestResult.request?.description || "--", (padronRequestResult.request?.keywords || []).join(", ")]],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2.5, textColor: [23, 52, 78] },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 130 }
        }
      });

      currentY = (document.lastAutoTable?.finalY ?? currentY) + 5;

      (summary.barrios ?? []).forEach((barrio, index) => {
        if (currentY > 180) {
          document.addPage();
          currentY = 16;
        }

        document.setFont("helvetica", "bold");
        document.setFontSize(12);
        document.setTextColor(18, 59, 93);
        document.text(`${index + 1}. ${barrio.barrio_colonia}`, 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(82, 114, 141);
        document.text(
          `Registros: ${barrio.total_registros} | Tarifa: ${formatCurrency(barrio.tarifa_total)} | Total: ${formatCurrency(barrio.total_con_interes)}`,
          14,
          currentY + 5
        );

        autoTable(document, {
          startY: currentY + 8,
          head: [["#", "Nombre", "Abonado", "Clave", "Barrio", "Tarifa", "Total"]],
          body: barrio.rows.map((row, rowIndex) => [
            rowIndex + 1,
            row.nombre || "--",
            row.abonado || "--",
            ensureClaveHasPrefix(row.clave_catastral || row.clave_aguas_formato || row.clave_alcaldia, row.barrio_colonia, safeBarrioCodes) || "--",
            row.barrio_colonia || "--",
            formatCurrency(row.tarifa || 0),
            formatCurrency(row.total || 0)
          ]),
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2, textColor: [23, 52, 78] },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [244, 248, 252] },
          margin: { left: 14, right: 14 }
        });

        currentY = (document.lastAutoTable?.finalY ?? currentY + 30) + 6;
      });

      saveReportPdf(document, `peticion-padron-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Peticion descargada en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar la peticion en PDF.");
    }
  };

  const handlePrintAguasServiceReport = async ({ onlySelected = false } = {}) => {
    if (!aguasServiceReportData.hasData) {
      showAlert("Actualiza primero el informe del padron maestro.");
      return;
    }

    const barriosToPrint = onlySelected ? selectedAguasServiceBarrioRows : aguasServiceReportData.barrios;
    if (onlySelected && !barriosToPrint.length) {
      showAlert("Selecciona al menos un barrio para imprimir.");
      return;
    }

    const generatedAt = formatDateTime(padronServiceReport?.generated_at || new Date().toISOString());
    const reportTitle = onlySelected
      ? "Informe de servicios por barrios seleccionados"
      : "Informe de servicios del padron maestro";
    const printedTotalRecords = onlySelected
      ? barriosToPrint.reduce((total, barrio) => total + Number(barrio.total_registros || 0), 0)
      : aguasServiceReportData.totalRecords;
    const printedDebt = barriosToPrint.reduce(
      (totals, barrio) => ({
        capital: totals.capital + Number(barrio.deuda?.capital || 0),
        intereses: totals.intereses + Number(barrio.deuda?.intereses || 0),
        total: totals.total + Number(barrio.deuda?.total || 0),
        deudores: totals.deudores + Number(barrio.deuda?.deudores || 0)
      }),
      { capital: 0, intereses: 0, total: 0, deudores: 0 }
    );
    const serviceRowsForPrint = aguasServiceReportData.serviceRows.map((service) => {
      if (!onlySelected) return service;
      const scopedTotals = barriosToPrint.reduce(
        (totals, barrio) => {
          const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
          const match = services.find((item) => item.field === service.field) || {};
          return {
            active: totals.active + Number(match.active || 0),
            inactive: totals.inactive + Number(match.inactive || 0),
            unknown: totals.unknown + Number(match.unknown || 0),
            deuda: {
              capital: totals.deuda.capital + Number(match.deuda?.capital || 0),
              intereses: totals.deuda.intereses + Number(match.deuda?.intereses || 0),
              total: totals.deuda.total + Number(match.deuda?.total || 0),
              deudores: totals.deuda.deudores + Number(match.deuda?.deudores || 0)
            }
          };
        },
        { active: 0, inactive: 0, unknown: 0, deuda: { capital: 0, intereses: 0, total: 0, deudores: 0 } }
      );
      return {
        ...service,
        ...scopedTotals,
        percentage: printedTotalRecords ? Number(((scopedTotals.active / printedTotalRecords) * 100).toFixed(1)) : 0
      };
    });
    const serviceRows = serviceRowsForPrint
      .map(
        (service) => `
          <tr>
            <td>${escapeHtml(service.label)}</td>
            <td>${Number(service.active || 0)}</td>
            <td>${Number(service.inactive || 0)}</td>
            <td>${Number(service.unknown || 0)}</td>
            <td>${Number(service.percentage || 0)}%</td>
            <td>${escapeHtml(formatCurrency(service.deuda?.capital || 0))}</td>
            <td>${escapeHtml(formatCurrency(service.deuda?.intereses || 0))}</td>
            <td>${escapeHtml(formatCurrency(service.deuda?.total || 0))}</td>
          </tr>
        `
      )
      .join("");
    const barrioRows = barriosToPrint
      .map((barrio) => {
        const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
        return `
          <tr>
            <td>${escapeHtml(barrio.barrio_colonia || "Sin barrio")}</td>
            <td>${Number(barrio.total_registros || 0)}</td>
            ${["agua", "alcantarillado", "barrido", "recoleccion", "desechos_peligrosos"]
              .map((field) => `<td>${Number(services.find((service) => service.field === field)?.active || 0)}</td>`)
              .join("")}
          </tr>
        `;
      })
      .join("");
    const barrioDebtRows = barriosToPrint
      .map((barrio) => {
        const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
        const serviceDebt = (field) => services.find((service) => service.field === field)?.deuda?.total || 0;
        return `
          <tr>
            <td>${escapeHtml(barrio.barrio_colonia || "Sin barrio")}</td>
            <td>${escapeHtml(formatCurrency(barrio.deuda?.capital || 0))}</td>
            <td>${escapeHtml(formatCurrency(barrio.deuda?.intereses || 0))}</td>
            <td>${escapeHtml(formatCurrency(barrio.deuda?.total || 0))}</td>
            ${["agua", "alcantarillado", "barrido", "recoleccion", "desechos_peligrosos"]
              .map((field) => `<td>${escapeHtml(formatCurrency(serviceDebt(field)))}</td>`)
              .join("")}
          </tr>
        `;
      })
      .join("");

    await printDocument(
      reportTitle,
      `
        <div class="field-report-shell census-report-shell">
          <header class="field-report-header census-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${onlySelected ? "Resumen filtrado con los barrios seleccionados por el operador." : "Resumen actualizado desde el padron maestro activo de Aguas."}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Registros impresos: ${printedTotalRecords}</span>
              <span>Barrios impresos: ${barriosToPrint.length}</span>
              <span>Deuda total: ${escapeHtml(formatCurrency(printedDebt.total))}</span>
              <span>Fuente: ${escapeHtml(padronServiceReport?.source?.file_name || "Padron maestro")}</span>
            </div>
          </header>
          <section class="field-report-summary">
            ${serviceRowsForPrint
              .map(
                (service) => `
                  <div class="field-report-total-chip">
                    <strong>${escapeHtml(service.label)}</strong>
                    <span>${Number(service.active || 0)} (${Number(service.percentage || 0)}%)</span>
                  </div>
                `
              )
              .join("")}
          </section>
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Resumen general</span>
                <h3>Servicios activos e inactivos</h3>
              </div>
            </div>
            <table class="field-report-table census-report-table data-report-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Activos</th>
                  <th>Sin servicio</th>
                  <th>Sin dato</th>
                  <th>% activo</th>
                  <th>Capital asociado</th>
                  <th>Intereses asociados</th>
                  <th>Deuda asociada</th>
                </tr>
              </thead>
              <tbody>${serviceRows}</tbody>
            </table>
          </section>
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Barrios principales</span>
                <h3>${onlySelected ? "Desglose de barrios seleccionados" : "Desglose por barrio"}</h3>
              </div>
            </div>
            <table class="field-report-table census-report-table data-report-table">
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th>Total</th>
                  <th>Agua</th>
                  <th>Alcantarillado</th>
                  <th>Barrido</th>
                  <th>Desechos / tren</th>
                  <th>Desechos peligrosos</th>
                </tr>
              </thead>
              <tbody>${barrioRows}</tbody>
            </table>
          </section>
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Cartera por barrio</span>
                <h3>Capital, intereses y deuda asociada a cada servicio activo</h3>
              </div>
            </div>
            <table class="field-report-table census-report-table data-report-table">
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th>Capital</th>
                  <th>Intereses</th>
                  <th>Total</th>
                  <th>Agua</th>
                  <th>Alcantarillado</th>
                  <th>Barrido</th>
                  <th>Recoleccion</th>
                  <th>Desechos peligrosos</th>
                </tr>
              </thead>
              <tbody>${barrioDebtRows}</tbody>
            </table>
            <p><strong>Nota:</strong> la deuda por servicio corresponde al total de las cuentas que tienen ese servicio activo; una misma cuenta puede aparecer en varios servicios.</p>
          </section>
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        bodyClassName: "field-report-body census-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadAguasServicePdf = async () => {
    if (!aguasServiceReportData.hasData) {
      showAlert("Actualiza primero el informe del padron maestro.");
      return;
    }

    try {
      setDownloadingAguasServicePdf(true);
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const generatedAt = formatDateTime(padronServiceReport?.generated_at || new Date().toISOString());
      const formatPdfInteger = (value) =>
        new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
      const formatPdfPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
      const formatPdfCurrency = (value) =>
        new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(Number(value || 0));
      const totalBarrios = Number(padronServiceReport?.summary?.total_barrios || 0);
      const sourceName = padronServiceReport?.source?.file_name || "Padron maestro";
      const sourceUpdated = padronServiceReport?.source?.updated_at
        ? formatDateTime(padronServiceReport.source.updated_at)
        : "Sin fecha de fuente";
      const profiles = aguasServiceReportData.profiles || {};
      const allCoreServices = Number(profiles.all_core_services || 0);
      const noCoreServices = Number(profiles.no_core_services || 0);
      const waterWithoutSewer = Number(profiles.water_without_sewer || 0);
      const sewerWithoutWater = Number(profiles.sewer_without_water || 0);
      const topService = aguasServiceReportData.serviceRows[0] || null;
      const weakestService = [...aguasServiceReportData.serviceRows].sort(
        (left, right) => Number(left.percentage || 0) - Number(right.percentage || 0)
      )[0] || null;
      const getBarrioServiceActive = (barrio, field) => {
        const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
        return Number(services.find((service) => service.field === field)?.active || 0);
      };
      const serviceCoverageRows = aguasServiceReportData.serviceRows.map((service) => {
        const barriosSinServicio = aguasServiceReportData.barrios.filter(
          (barrio) => Number(barrio.total_registros || 0) > 0 && getBarrioServiceActive(barrio, service.field) === 0
        ).length;
        return {
          ...service,
          barriosSinServicio,
          barriosConServicio: Math.max(0, totalBarrios - barriosSinServicio),
          barrioCoverage: totalBarrios ? ((totalBarrios - barriosSinServicio) / totalBarrios) * 100 : 0
        };
      });
      const totalGeneralBarriosSinServicio = serviceCoverageRows.reduce(
        (total, service) => total + Number(service.barriosSinServicio || 0),
        0
      );
      const coreServiceFields = ["agua", "alcantarillado", "barrido", "recoleccion"];
      const barriosConTodosServicios = aguasServiceReportData.barrios.filter(
        (barrio) =>
          Number(barrio.total_registros || 0) > 0 &&
          coreServiceFields.every((field) => getBarrioServiceActive(barrio, field) > 0)
      ).length;
      const barriosSinServicios = aguasServiceReportData.barrios.filter(
        (barrio) =>
          Number(barrio.total_registros || 0) > 0 &&
          coreServiceFields.every((field) => getBarrioServiceActive(barrio, field) === 0)
      ).length;
      const barriosCoberturaParcial = Math.max(0, totalBarrios - barriosConTodosServicios - barriosSinServicios);
      const totalGeneralBarriosEvaluados = barriosConTodosServicios + barriosCoberturaParcial + barriosSinServicios;
      const addFooter = () => {
        const pageNumber = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(95, 116, 138);
        document.text(`Aguas de Choluteca - informe de servicios - pag. ${pageNumber}`, 14, pageHeight - 8);
      };

      document.setFillColor(10, 65, 112);
      document.rect(0, 0, pageWidth, 24, "F");
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.text("Informe de servicios del padron maestro", 14, 14);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Generado: ${generatedAt}`, pageWidth - 14, 14, { align: "right" });

      document.setTextColor(22, 54, 82);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Fuente: ${sourceName}`, 14, 32);
      document.text(`Actualizacion fuente: ${sourceUpdated}`, 14, 38);
      document.text(`Registros: ${formatPdfInteger(aguasServiceReportData.totalRecords)}`, 150, 32);
      document.text(`Barrios: ${formatPdfInteger(totalBarrios)}`, 150, 38);

      const summaryCards = [
        ["Total barrios Choluteca", formatPdfInteger(totalBarrios), "Barrios o sectores registrados en el padron maestro."],
        ["Total padron", formatPdfInteger(aguasServiceReportData.totalRecords), "Usuarios registrados en el padron activo."],
        ["Sin servicios base", formatPdfInteger(noCoreServices), "Usuarios sin agua, alcantarillado, barrido ni recoleccion activos."],
        ["Deuda total", formatPdfCurrency(aguasServiceReportData.deuda.total), `${formatPdfInteger(aguasServiceReportData.deuda.deudores)} cuentas con deuda.`]
      ];

      summaryCards.forEach((card, index) => {
        const cardWidth = (pageWidth - 34) / 4;
        const x = 14 + index * (cardWidth + 2);
        document.setDrawColor(196, 220, 242);
        document.setFillColor(244, 249, 253);
        document.roundedRect(x, 46, cardWidth, 25, 2.6, 2.6, "FD");
        document.setFont("helvetica", "normal");
        document.setFontSize(7.5);
        document.setTextColor(74, 96, 120);
        document.text(card[0], x + 3, 53);
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(10, 65, 112);
        document.text(card[1], x + 3, 61);
        document.setFont("helvetica", "normal");
        document.setFontSize(6.8);
        document.setTextColor(74, 96, 120);
        document.text(document.splitTextToSize(card[2], cardWidth - 6), x + 3, 67);
      });

      const greenCards = [
        [
          "Barrios con todos los servicios",
          formatPdfInteger(barriosConTodosServicios),
          "Agua, alcantarillado, barrido y recoleccion con actividad en el barrio."
        ],
        [
          "Barrios con cobertura parcial",
          formatPdfInteger(barriosCoberturaParcial),
          "Tienen al menos un servicio base activo, pero no todos."
        ],
        [
          "Barrios sin servicios",
          formatPdfInteger(barriosSinServicios),
          "Sin actividad registrada en agua, alcantarillado, barrido ni recoleccion."
        ]
      ];

      greenCards.forEach((card, index) => {
        const cardWidth = (pageWidth - 34) / 3;
        const x = 14 + index * (cardWidth + 3);
        document.setDrawColor(39, 145, 88);
        document.setFillColor(232, 248, 239);
        document.roundedRect(x, 76, cardWidth, 24, 3, 3, "FD");
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(31, 108, 67);
        document.text(card[0], x + 4, 83);
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.text(card[1], x + 4, 91);
        document.setFont("helvetica", "normal");
        document.setFontSize(7);
        document.text(document.splitTextToSize(card[2], cardWidth - 38), x + 26, 89);
      });

      document.setDrawColor(27, 128, 78);
      document.setFillColor(218, 245, 230);
      document.roundedRect(14, 103, pageWidth - 28, 13, 3, 3, "FD");
      document.setFont("helvetica", "bold");
      document.setFontSize(9);
      document.setTextColor(25, 102, 64);
      document.text("Total general de barrios evaluados", 18, 111);
      document.setFontSize(13);
      document.text(formatPdfInteger(totalGeneralBarriosEvaluados), pageWidth - 18, 111, { align: "right" });
      document.setFont("helvetica", "normal");
      document.setFontSize(7.5);
      document.text(
        `${formatPdfInteger(barriosConTodosServicios)} con todos + ${formatPdfInteger(barriosCoberturaParcial)} parciales + ${formatPdfInteger(barriosSinServicios)} sin servicios = ${formatPdfInteger(totalGeneralBarriosEvaluados)}`,
        82,
        111
      );

      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      document.setTextColor(10, 65, 112);
      document.text("Lectura general", 14, 125);
      document.setFont("helvetica", "normal");
      document.setFontSize(8.5);
      document.setTextColor(22, 54, 82);
      const insights = [
        topService
          ? `Servicio con mayor cobertura: ${topService.label} con ${formatPdfInteger(topService.active)} activos (${formatPdfPercent(topService.percentage)}).`
          : "No hay servicios calculados para el padron.",
        weakestService
          ? `Servicio con menor cobertura: ${weakestService.label} con ${formatPdfInteger(weakestService.active)} activos (${formatPdfPercent(weakestService.percentage)}).`
          : "",
        `Total de barrios de la ciudad de Choluteca en el padron: ${formatPdfInteger(totalBarrios)}.`,
        `Clasificacion territorial: ${formatPdfInteger(barriosConTodosServicios)} con todos los servicios, ${formatPdfInteger(barriosCoberturaParcial)} con cobertura parcial y ${formatPdfInteger(barriosSinServicios)} sin servicios.`,
        `Total general de barrios evaluados: ${formatPdfInteger(totalGeneralBarriosEvaluados)}.`,
        `Total general de incidencias de barrios sin servicio: ${formatPdfInteger(totalGeneralBarriosSinServicio)}.`,
        `Casos con agua sin alcantarillado: ${formatPdfInteger(waterWithoutSewer)}. Casos con alcantarillado sin agua: ${formatPdfInteger(sewerWithoutWater)}.`,
        `El desglose por barrio inicia en la pagina siguiente para mantener esta hoja como resumen de totales.`
      ].filter(Boolean);
      insights.forEach((line, index) => document.text(`- ${line}`, 16, 132 + index * 5));

      autoTable(document, {
        startY: 164,
        head: [["Servicio", "Barrios sin servicio", "Barrios con servicio", "% barrios con servicio", "Usuarios activos", "Deuda asociada"]],
        body: serviceCoverageRows.map((service) => [
          service.label,
          formatPdfInteger(service.barriosSinServicio),
          formatPdfInteger(service.barriosConServicio),
          formatPdfPercent(service.barrioCoverage),
          formatPdfInteger(service.active),
          formatPdfCurrency(service.deuda?.total),
        ]),
        theme: "grid",
        styles: { fontSize: 8.8, cellPadding: 2.6, textColor: [24, 55, 82] },
        headStyles: { fillColor: [18, 93, 160], textColor: 255 },
        margin: { left: 14, right: 14 }
      });

      autoTable(document, {
        startY: (document.lastAutoTable?.finalY ?? 145) + 8,
        head: [["Perfil operativo", "Registros", "% del padron"]],
        body: [
          ["Todos los servicios base", formatPdfInteger(allCoreServices), formatPdfPercent((allCoreServices / aguasServiceReportData.totalRecords) * 100)],
          ["Sin servicios base", formatPdfInteger(noCoreServices), formatPdfPercent((noCoreServices / aguasServiceReportData.totalRecords) * 100)],
          ["Agua sin alcantarillado", formatPdfInteger(waterWithoutSewer), formatPdfPercent((waterWithoutSewer / aguasServiceReportData.totalRecords) * 100)],
          ["Alcantarillado sin agua", formatPdfInteger(sewerWithoutWater), formatPdfPercent((sewerWithoutWater / aguasServiceReportData.totalRecords) * 100)]
        ],
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [10, 65, 112], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 248, 252] },
        margin: { left: 14, right: 14 }
      });

      addFooter();
      document.addPage("letter", "landscape");
      document.setTextColor(10, 65, 112);
      document.setFont("helvetica", "bold");
      document.setFontSize(14);
      document.text("Desglose de servicios por barrio", 14, 16);
      document.setFont("helvetica", "normal");
      document.setFontSize(8.5);
      document.setTextColor(74, 96, 120);
      document.text(
        `Registros: ${formatPdfInteger(aguasServiceReportData.totalRecords)} | Barrios: ${formatPdfInteger(totalBarrios)} | Fuente: ${sourceName}`,
        14,
        23
      );

      autoTable(document, {
        startY: 30,
        head: [["Barrio", "Total", "Agua", "Alcantarillado", "Barrido", "Desechos / tren", "Desechos peligrosos"]],
        body: aguasServiceReportData.barrios.map((barrio) => {
          const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
          const getActive = (field) => Number(services.find((service) => service.field === field)?.active || 0);
          return [
            barrio.barrio_colonia || "Sin barrio",
            formatPdfInteger(barrio.total_registros),
            formatPdfInteger(getActive("agua")),
            formatPdfInteger(getActive("alcantarillado")),
            formatPdfInteger(getActive("barrido")),
            formatPdfInteger(getActive("recoleccion")),
            formatPdfInteger(getActive("desechos_peligrosos"))
          ];
        }),
        theme: "striped",
        styles: { fontSize: 7.2, cellPadding: 1.8, textColor: [23, 52, 78], overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 248, 252] },
        margin: { left: 14, right: 14 },
        didDrawPage: addFooter
      });

      document.addPage("letter", "landscape");
      document.setTextColor(10, 65, 112);
      document.setFont("helvetica", "bold");
      document.setFontSize(14);
      document.text("Totales de deuda por barrio y servicio", 14, 16);
      document.setFont("helvetica", "normal");
      document.setFontSize(8);
      document.setTextColor(74, 96, 120);
      document.text(
        "La deuda por servicio corresponde a cuentas con ese servicio activo; una cuenta puede sumar en varios servicios.",
        14,
        23
      );

      autoTable(document, {
        startY: 30,
        head: [["Barrio", "Capital", "Intereses", "Total", "Agua", "Alcantarillado", "Barrido", "Recoleccion", "Peligrosos"]],
        body: aguasServiceReportData.barrios.map((barrio) => {
          const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
          const serviceDebt = (field) => services.find((service) => service.field === field)?.deuda?.total || 0;
          return [
            barrio.barrio_colonia || "Sin barrio",
            formatPdfCurrency(barrio.deuda?.capital),
            formatPdfCurrency(barrio.deuda?.intereses),
            formatPdfCurrency(barrio.deuda?.total),
            formatPdfCurrency(serviceDebt("agua")),
            formatPdfCurrency(serviceDebt("alcantarillado")),
            formatPdfCurrency(serviceDebt("barrido")),
            formatPdfCurrency(serviceDebt("recoleccion")),
            formatPdfCurrency(serviceDebt("desechos_peligrosos"))
          ];
        }),
        theme: "grid",
        styles: { fontSize: 6.3, cellPadding: 1.5, textColor: [23, 52, 78], overflow: "linebreak" },
        headStyles: { fillColor: [12, 112, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [241, 250, 247] },
        margin: { left: 10, right: 10 },
        didDrawPage: addFooter
      });

      saveReportPdf(document, `informe-servicios-padron-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Informe de servicios descargado en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el informe de servicios.");
    } finally {
      setDownloadingAguasServicePdf(false);
    }
  };

  const handleDownloadPadronStatsPdf = async () => {
    if (!alcaldiaComparison?.summary || !padronStatisticsData.dynamicRows.length) {
      showAlert("Genera primero los graficos para guardar el reporte en PDF.");
      return;
    }

    try {
      setDownloadingPadronStatsPdf(true);
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const generatedAt = formatDateTime(new Date().toISOString());
      const modeLabels = {
        brecha: "Brecha por barrio",
        cobertura_alta: "Barrios con mas cobertura",
        cobertura_baja: "Barrios con menos cobertura",
        servicio_dominante: "Servicio mayoritario por barrio",
        comparativa: `Comparativa por ${padronStatisticsData.metricLabels?.[padronStatsSortMetric] || "metrica"}`,
        servicios: "Division por servicios"
      };
      const summary = alcaldiaComparison.summary;
      const addFooter = () => {
        const pageHeight = document.internal.pageSize.getHeight();
        const pageNumber = document.getCurrentPageInfo().pageNumber;
        document.setFontSize(8);
        document.setTextColor(95, 116, 138);
        document.text(`Aguas de Choluteca - reporte estadistico - pag. ${pageNumber}`, 14, pageHeight - 8);
      };
      const chartRows = padronStatisticsData.dynamicRows.map((item) => ({
        label: String(item.barrio_colonia || ""),
        detail: String(item.detail || ""),
        value: Number(item.value || 0),
        formattedValue:
          padronChartMode.includes("cobertura") || (padronChartMode === "servicios" && selectedPadronServiceField)
            ? `${Number(item.value || 0)}%`
            : String(item.value ?? 0)
      }));
      const chartMaxValue =
        padronChartMode.includes("cobertura") || (padronChartMode === "servicios" && selectedPadronServiceField)
          ? 100
          : Math.max(1, ...chartRows.map((item) => item.value));
      const drawChartRows = (startY) => {
        const left = 14;
        const right = pageWidth - 14;
        const chartWidth = right - left;
        const rowHeight = 16;
        const barHeight = 4.2;
        let y = startY;

        document.setFont("helvetica", "bold");
        document.setFontSize(12);
        document.setTextColor(18, 59, 93);
        document.text("Grafico", left, y);
        y += 7;

        chartRows.forEach((row, index) => {
          if (y + rowHeight > pageHeight - 16) {
            addFooter();
            document.addPage("letter", "landscape");
            y = 18;
            document.setFont("helvetica", "bold");
            document.setFontSize(12);
            document.setTextColor(18, 59, 93);
            document.text("Grafico (continuacion)", left, y);
            y += 7;
          }

          const barWidth = Math.max(2, Math.min(chartWidth, (row.value / chartMaxValue) * chartWidth));
          document.setFillColor(index % 2 === 0 ? 248 : 255, 251, 255);
          document.roundedRect(left - 1, y - 5, chartWidth + 2, rowHeight, 2.6, 2.6, "F");
          document.setFont("helvetica", "bold");
          document.setFontSize(9.2);
          document.setTextColor(18, 59, 93);
          document.text(document.splitTextToSize(row.label, 120)[0], left, y);
          document.setFont("helvetica", "bold");
          document.setFontSize(8.8);
          document.setTextColor(6, 92, 144);
          document.text(row.formattedValue, right, y, { align: "right" });
          document.setFont("helvetica", "normal");
          document.setFontSize(7.5);
          document.setTextColor(82, 112, 140);
          document.text(document.splitTextToSize(row.detail, 190)[0], left, y + 4.3);
          document.setFillColor(226, 240, 253);
          document.roundedRect(left, y + 7.2, chartWidth, barHeight, 1.8, 1.8, "F");
          document.setFillColor(22, 112, 217);
          document.roundedRect(left, y + 7.2, barWidth, barHeight, 1.8, 1.8, "F");
          document.setFillColor(38, 194, 213);
          document.roundedRect(left + Math.max(0, barWidth - 8), y + 7.2, Math.min(8, barWidth), barHeight, 1.8, 1.8, "F");
          y += rowHeight + 2;
        });

        return y;
      };

      document.setFillColor(10, 65, 112);
      document.rect(0, 0, pageWidth, 22, "F");
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.text("Reporte estadistico de padrones", 14, 14);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Generado: ${generatedAt}`, pageWidth - 14, 14, { align: "right" });

      document.setTextColor(22, 54, 82);
      document.setFont("helvetica", "bold");
      document.setFontSize(11);
      document.text(`Grafico activo: ${modeLabels[padronChartMode] || "Analisis por barrio"}`, 14, 32);

      autoTable(document, {
        startY: 38,
        head: [["Aguas", "Alcaldia", "No aparecen en Aguas", "Coincidencias"]],
        body: [[
          summary.aguas_records ?? padronMeta?.total_records ?? 0,
          summary.alcaldia_records ?? alcaldiaMeta?.total_records ?? 0,
          summary.candidate_clandestine ?? 0,
          Number(summary.exact_matches ?? 0) + Number(summary.base_matches ?? 0)
        ]],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3, halign: "center", textColor: [24, 55, 82] },
        headStyles: { fillColor: [18, 93, 160], textColor: 255 },
        margin: { left: 14, right: 14 }
      });

      drawChartRows((document.lastAutoTable?.finalY ?? 58) + 8);

      if (padronStatisticsData.selectedBarrio) {
        document.addPage("letter", "landscape");
        const barrio = padronStatisticsData.selectedBarrio;
        document.setTextColor(22, 54, 82);
        document.setFont("helvetica", "bold");
        document.setFontSize(13);
        document.text(`Detalle del barrio: ${barrio.barrio_colonia}`, 14, 18);

        autoTable(document, {
          startY: 26,
          head: [["Claves Alcaldia", "En Aguas", "Cobertura", "Brecha", "Servicio mayoritario"]],
          body: [[
            barrio.alcaldia_total ?? 0,
            barrio.aguas_registradas ?? 0,
            `${barrio.cobertura_aguas_pct ?? 0}%`,
            barrio.brecha_registros ?? 0,
            barrio.servicio_dominante || "Sin servicio dominante"
          ]],
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3, halign: "center", textColor: [24, 55, 82] },
          headStyles: { fillColor: [18, 93, 160], textColor: 255 },
          margin: { left: 14, right: 14 }
        });

        autoTable(document, {
          startY: (document.lastAutoTable?.finalY ?? 46) + 8,
          head: [["Servicio", "Usuarios"]],
          body: Object.entries(padronStatisticsData.serviceLabels).map(([field, label]) => [
            label,
            Number(barrio.servicios?.[field] || 0)
          ]),
          theme: "striped",
          styles: { fontSize: 9, cellPadding: 3, textColor: [24, 55, 82] },
          headStyles: { fillColor: [226, 240, 253], textColor: [11, 61, 104] },
          margin: { left: 14, right: 14 },
          didDrawPage: addFooter
        });
      }

      addFooter();
      saveReportPdf(document, `reporte-estadistico-padrones-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Reporte estadistico guardado en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el reporte estadistico en PDF.");
    } finally {
      setDownloadingPadronStatsPdf(false);
    }
  };

  const handleMapDraftChange = (event) => {
    const { name, value } = event.target;
    if (["latitude", "longitude"].includes(name) && value) {
      setMapLocationHelp("");
    }
    setMapDraft((current) =>
      withReferenceBarrioPrefix(
        {
          ...current,
          [name]: name === "housing_units" ? normalizeHousingUnitsInput(value) : value
        },
        safeBarrioCodes
      )
    );
  };

  const adjustMapDraftHousingUnits = (delta) => {
    setMapDraft((current) => ({
      ...current,
      housing_units: normalizeHousingUnitsInput(Number(current.housing_units || 1) + delta)
    }));
  };

  const handleMapDraftFromMap = useCallback((updater) => {
    setMapLocationHelp("");
    setMapStatus("Punto marcado");
    setMapDraft(updater);
  }, []);

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

  const handleLocateUser = async () => {
    if (!navigator.geolocation) {
      const message = getGeolocationUnavailableMessage();
      setMapLocationHelp(message);
      showAlert(message);
      setMapStatus("Sin GPS");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext && !isLocalSecureHost()) {
      const message = getGeolocationUnavailableMessage();
      setMapLocationHelp(message);
      showAlert(message);
      setMapStatus("HTTPS requerido");
      return;
    }

    setLocatingUser(true);
    setMapStatus("Buscando");
    setMapLocationHelp("Solicitando permiso de ubicacion. En iPhone confirma el permiso de Safari si aparece.");

    try {
      let position;
      try {
        position = await getCurrentPosition(GEOLOCATION_OPTIONS);
      } catch (error) {
        if (error?.code !== error?.TIMEOUT && error?.code !== 3) {
          throw error;
        }
        setMapLocationHelp("El GPS tardo en responder; intentando lectura compatible para iPhone...");
        position = await getCurrentPosition(GEOLOCATION_FALLBACK_OPTIONS);
      }

        const nextDraft = {
          latitude: Number(position.coords.latitude).toFixed(6),
          longitude: Number(position.coords.longitude).toFixed(6),
          accuracy_meters: Math.round(position.coords.accuracy || 0),
          point_type: mapDraft.point_type,
          description: mapDraft.description,
          reference: mapDraft.reference
        };

        setMapDraft(withReferenceBarrioPrefix(nextDraft, safeBarrioCodes));
        setMapStatus("GPS listo");
        setMapLocationHelp("");
        setMapFocusRequest({
          latitude: Number(nextDraft.latitude),
          longitude: Number(nextDraft.longitude),
          zoom: 18.5,
          key: Date.now()
        });
    } catch (error) {
      const message = getGeolocationErrorMessage(error);
      setMapStatus(error?.code === 1 ? "Sin permiso" : "GPS pendiente");
      setMapLocationHelp(message);
      showAlert(message);
    } finally {
      setLocatingUser(false);
    }
  };

  const resetMapDraft = () => {
    setEditingMapPointId(null);
    setMapLocationHelp("");
    setMapDraft({ ...emptyMapDraft });
  };

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

  const resetReportMapDraft = () => {
    setEditingReportMapPointId(null);
    setReportMapDraft({ ...emptyMapReportDraft });
  };

  const handleSaveMapPoint = async (event) => {
    event.preventDefault();

    const latitude = Number(mapDraft.latitude);
    const longitude = Number(mapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const message = "Define la ubicacion del punto usando GPS, tocando el mapa o escribiendo latitud y longitud.";
      setMapLocationHelp(message);
      showAlert(message);
      return;
    }

    setSavingMapPoint(true);

    try {
      const isEditing = Boolean(editingMapPointId);
      const editingPoint = safeMapPoints.find((point) => point.id === editingMapPointId) ?? null;
      const markerColor = getDefaultMapPointColor(mapDraft.point_type, editingPoint?.marker_color || "#1576d1");
      const enrichedMapDraft = withReferenceBarrioPrefix(mapDraft, safeBarrioCodes);
      const response = await apiFetch(isEditing ? `/map-points/${editingMapPointId}` : "/map-points", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy_meters: Number(mapDraft.accuracy_meters) || null,
          point_type: enrichedMapDraft.point_type,
          description: enrichedMapDraft.description,
          reference: enrichedMapDraft.reference,
          housing_units: enrichedMapDraft.housing_units,
          marker_color: markerColor,
          is_terminal_point: Boolean(editingPoint?.is_terminal_point)
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible guardar el punto.");
      }

      setMapPoints((current) =>
        isEditing ? current.map((point) => (point.id === data.id ? data : point)) : [data, ...current]
      );
      setMapDiaryGroupsSummary((current) => syncMapDiaryGroups(current, data, editingPoint));
      const savedDateKey = getMapDiaryDateKey(data.diary_date || data.created_at) || getTodayMapDiaryKey();
      setMapDiaryDateKey(savedDateKey);
      setSelectedMapPointId(data.id);
      setEditingMapPointId(null);
      setMapStatus(isEditing ? "Punto actualizado" : "Punto guardado");
      setMapFocusRequest({
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        zoom: 19,
        key: Date.now()
      });
      showAlert(isEditing ? "Punto de campo actualizado." : "Punto de campo guardado correctamente.");
      resetMapDraft();
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el punto.");
    } finally {
      setSavingMapPoint(false);
    }
  };

  const handleReportMapDraftChange = (event) => {
    const { name, value, type, checked } = event.target;
    setReportMapDraft((current) =>
      withReferenceBarrioPrefix(
        {
          ...current,
          [name]: type === "checkbox" ? checked : name === "housing_units" ? normalizeHousingUnitsInput(value) : value,
          ...(name === "point_type" && [COMMERCIAL_MAP_POINT_TYPE, ALERT_MAP_POINT_TYPE].includes(value)
            ? { marker_color: getDefaultMapPointColor(value) }
            : {})
        },
        safeBarrioCodes
      )
    );
  };

  const handleMapReportStaffChange = (event) => {
    const { name, value } = event.target;
    setMapReportStaff((current) => normalizeMapReportStaff({
      ...current,
      [name]: value
    }));
  };

  const handleMapReportTechnicianChange = (index, value) => {
    setMapReportStaff((current) => {
      const technicians = getMapReportTechnicians(current);
      technicians[index] = value;
      return normalizeMapReportStaff({
        ...current,
        field_technician_names: technicians
      });
    });
  };

  const addMapReportTechnician = () => {
    setMapReportStaff((current) => normalizeMapReportStaff({
      ...current,
      field_technician_names: [...getMapReportTechnicians(current), ""]
    }));
  };

  const removeMapReportTechnician = (index) => {
    setMapReportStaff((current) => {
      const technicians = getMapReportTechnicians(current);
      if (technicians.length <= 1) return normalizeMapReportStaff(current);
      return normalizeMapReportStaff({
        ...current,
        field_technician_names: technicians.filter((_, itemIndex) => itemIndex !== index)
      });
    });
  };

  const handleMapReportSettingsChange = (event) => {
    const { name, value } = event.target;
    setMapReportSettings((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleMapReportImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAlert("Selecciona una imagen valida para el mapa.");
      return;
    }

    try {
      const optimizedMap = await optimizeImageForUpload(file);
      const dataUrl = await fileToDataUrl(optimizedMap);
      setMapReportSettings((current) => ({
        ...current,
        map_image_data_url: dataUrl,
        map_image_name: optimizedMap.name
      }));
      showAlert("Mapa adjunto listo para el reporte.");
    } catch (error) {
      showAlert(error.message || "No fue posible preparar el mapa.");
    } finally {
      event.target.value = "";
    }
  };

  const clearMapReportImage = () => {
    setMapReportSettings((current) => ({
      ...current,
      map_image_data_url: "",
      map_image_name: ""
    }));
  };

  const captureReportMapImage = async () => {
    if (!reportMapCaptureRef.current) {
      return "";
    }

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(reportMapCaptureRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#edf3f9",
        scale: Math.min(window.devicePixelRatio || 1, 2)
      });
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  };

  const buildFieldDebtReport = async (points = visibleMapPoints) => {
    const pointRows = buildFieldDebtPointRows(points);
    const referencesByKey = new Map();
    pointRows.forEach((row) => {
      row.references.forEach((reference) => {
        if (!referencesByKey.has(reference.key)) {
          referencesByKey.set(reference.key, reference);
        }
      });
    });
    const keys = Array.from(referencesByKey.keys());
    const keyCounts = pointRows.reduce((accumulator, row) => {
      row.keys.forEach((key) => {
        accumulator[key] = (accumulator[key] || 0) + 1;
      });
      return accumulator;
    }, {});

    if (!keys.length) {
      return {
        generatedAt: new Date().toISOString(),
        dateKey: activeMapDiaryDateKey,
        pointRows,
        keyCounts,
        keys,
        results: []
      };
    }

    const results = await Promise.all(
      keys.map(async (key) => {
        const reference = referencesByKey.get(key) || { field: "clave", value: key, label: key };
        try {
          const response = await apiFetch(
            `/claves/search?clave=${encodeURIComponent(reference.value)}&field=${encodeURIComponent(reference.field)}&_padron=${encodeURIComponent(padronMeta?.updated_at || Date.now())}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || "No fue posible consultar la clave.");
          }

          return {
            key,
            field: reference.field,
            label: reference.label,
            query: reference.value,
            exists: Boolean(data.exists),
            total_matches: Number(data.total_matches || 0),
            matches: Array.isArray(data.matches) ? data.matches : [],
            error: ""
          };
        } catch (error) {
          return {
            key,
            field: reference.field,
            label: reference.label,
            query: reference.value,
            exists: false,
            total_matches: 0,
            matches: [],
            error: error.message || "No fue posible consultar la clave."
          };
        }
      })
    );

    return {
      generatedAt: new Date().toISOString(),
      dateKey: activeMapDiaryDateKey,
      pointRows,
      keyCounts,
      keys,
      results
    };
  };

  const buildMapReportPadronData = async (reportData) => {
    const points = reportData?.zones?.flatMap((zone) => zone.items || []);
    const results = (await buildFieldDebtReport(points)).results;
    return {
      padronNames: buildPadronNameIndex(results),
      sharedKeys: buildSharedCadastralKeys(results),
      debtRows: buildReportDebtRows(results)
    };
  };

  const handleVerifyFieldDebt = async () => {
    setLoadingFieldDebtReport(true);
    setShowFieldDebtModal(true);

    try {
      const report = await buildFieldDebtReport();
      setFieldDebtReport(report);
      showAlert(
        report.keys.length
          ? `Verificacion lista: ${report.keys.length} referencias extraidas de la jornada.`
          : "No encontre claves o abonados en las referencias de esta jornada."
      );
    } catch (error) {
      showAlert(error.message || "No fue posible verificar la deuda de la jornada.");
    } finally {
      setLoadingFieldDebtReport(false);
    }
  };

  const buildFieldDebtPrintMarkup = () => {
    const results = fieldDebtReport?.results ?? [];
    const rowsMarkup = results
      .map((result) => {
        const matches = result.matches?.length ? result.matches : [null];
        return matches
          .map((match, matchIndex) => `
            <tr class="${result.exists ? "" : "is-red-report-point"}">
              <td class="field-debt-key-cell">${matchIndex === 0 ? escapeHtml(getFieldDebtResultLabel(result)) : ""}</td>
              <td class="field-debt-account-cell">${matchIndex === 0 ? Number(fieldDebtReport?.keyCounts?.[result.key] || 0) : ""}</td>
              <td class="field-debt-account-cell">${match ? escapeHtml(match.abonado || "--") : "--"}</td>
              <td>${match ? escapeHtml(match.inquilino || match.nombre || "--") : result.error ? escapeHtml(result.error) : "No aparece en el padrón"}</td>
              <td>${match ? escapeHtml(match.barrio_colonia || "--") : "--"}</td>
              <td class="field-debt-money-cell">${match ? escapeHtml(formatCurrency(Number(match.valor || 0))) : "--"}</td>
              <td class="field-debt-money-cell">${match ? escapeHtml(formatCurrency(Number(match.intereses || 0))) : "--"}</td>
              <td class="field-debt-money-cell is-total">${match ? escapeHtml(formatCurrency(Number(match.total || 0))) : "--"}</td>
              <td class="field-debt-services-cell">${match ? buildFieldDebtServicesMarkup(match) : "--"}</td>
            </tr>
          `)
          .join("");
      })
      .join("");

    return `
      <div class="field-report-shell field-debt-print-shell">
        <header class="field-report-header">
          <div class="field-report-brand">
            <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
            <div>
              <p class="field-report-kicker">Verificación de deuda por reporte GPS</p>
              <h1>Jornada ${escapeHtml(formatMapDiaryLabel(fieldDebtReport?.dateKey || activeMapDiaryDateKey))}</h1>
              <p>Claves o abonados extraidos de referencias escritas por el equipo tecnico en campo.</p>
            </div>
          </div>
          <div class="field-report-meta">
            <span>Generado: ${formatDateTime(fieldDebtReport?.generatedAt || new Date().toISOString())}</span>
            <span>Referencias unicas: ${fieldDebtSummary.totalKeys}</span>
            <span>Encontradas: ${fieldDebtSummary.foundKeys}</span>
            <span class="field-debt-meta-money">Deuda total: ${formatCurrency(fieldDebtSummary.totalDebt)} lempiras</span>
          </div>
        </header>
        <section class="field-debt-summary-panel">
          <span class="field-report-kicker">Resumen compacto</span>
          <h2>Totales de zona censada</h2>
          <div class="field-debt-metrics">
            <div><strong>Puntos con referencia</strong><span>${fieldDebtSummary.totalPoints}</span></div>
            <div><strong>Cuentas encontradas</strong><span>${fieldDebtSummary.accounts}</span></div>
            <div class="is-money"><strong>Deuda total</strong><span>${formatCurrency(fieldDebtSummary.totalDebt)} lempiras</span></div>
          </div>
        </section>
        <section class="field-report-zone field-debt-results-section">
          <div class="field-report-zone-head">
            <div>
              <span class="field-report-zone-kicker">Consulta al padrón</span>
              <h3>Resultado por referencia extraida</h3>
            </div>
          </div>
          <table class="field-report-table field-debt-print-table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Reportes</th>
                <th>Abonado</th>
                <th>Nombre</th>
                <th>Barrio</th>
                <th>Valor</th>
                <th>Intereses</th>
                <th>Total</th>
                <th>Servicios</th>
              </tr>
            </thead>
            <tbody>${rowsMarkup || '<tr><td colspan="9">No se extrajeron claves ni abonados de la jornada.</td></tr>'}</tbody>
          </table>
        </section>
        <section class="field-debt-signature">
          <div>
            <strong>Ing. Juan Ordóñez Bonilla</strong>
            <span>Departamento de Catastro</span>
          </div>
          <div class="field-debt-stamp-space">
            Firma
          </div>
        </section>
      </div>
    `;
  };

  const handlePrintFieldDebtReport = async () => {
    if (!fieldDebtReport) {
      showAlert("Primero ejecuta la verificación de deuda.");
      return;
    }

    await printDocument(
      "Verificación de deuda GPS",
      buildFieldDebtPrintMarkup(),
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body",
        showPageFooter: true
      }
    );
  };

  const buildFieldDebtChartPrintMarkup = () => {
    const topRows = fieldDebtChartData.topRows.length ? fieldDebtChartData.topRows : fieldDebtChartData.debtRows.slice(0, 8);
    const maxDebt = fieldDebtChartData.maxDebt || Math.max(1, ...topRows.map((row) => Number(row.total || 0)));
    const barsMarkup = topRows
      .map((row) => {
        const percent = Math.max(3, Math.min(100, (Number(row.total || 0) / maxDebt) * 100));
        return `
          <article class="field-debt-chart-bar">
            <div>
              <strong>${escapeHtml(row.key)}</strong>
              <span>${escapeHtml(row.nombre || "--")} - ${escapeHtml(row.barrio || "--")}</span>
            </div>
            <b>${escapeHtml(formatCurrency(row.total))}</b>
            <svg class="field-debt-chart-svg" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(row.key)} ${escapeHtml(formatCurrency(row.total))}">
              <rect x="0" y="0" width="100" height="10" rx="5" fill="#e8eef5"></rect>
              <rect x="0" y="0" width="${percent.toFixed(2)}" height="10" rx="5" fill="#0d6fb8"></rect>
            </svg>
          </article>
        `;
      })
      .join("");
    const detailRowsMarkup = fieldDebtChartData.debtRows
      .slice(0, 12)
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.key)}</td>
            <td>${escapeHtml(row.abonado)}</td>
            <td>${escapeHtml(row.nombre)}</td>
            <td>${escapeHtml(row.barrio)}</td>
            <td>${escapeHtml(formatCurrency(row.valor))}</td>
            <td>${escapeHtml(formatCurrency(row.intereses))}</td>
            <td class="is-total">${escapeHtml(formatCurrency(row.total))}</td>
          </tr>
        `
      )
      .join("");

    return `
      <div class="field-report-shell field-debt-print-shell field-debt-chart-print-shell">
        <header class="field-report-header">
          <div class="field-report-brand">
            <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
            <div>
              <p class="field-report-kicker">Analitica de mora</p>
              <h1>Mora por referencia del reporte</h1>
              <p>Jornada ${escapeHtml(formatMapDiaryLabel(fieldDebtReport?.dateKey || activeMapDiaryDateKey))}</p>
            </div>
          </div>
          <div class="field-report-meta">
            <span>Generado: ${formatDateTime(fieldDebtReport?.generatedAt || new Date().toISOString())}</span>
            <span>Referencias verificadas: ${fieldDebtSummary.totalKeys}</span>
            <span>Sin coincidencia: ${fieldDebtChartData.missingRows.length}</span>
            <span class="field-debt-meta-money">Mora total: ${formatCurrency(fieldDebtChartData.totalDebt)}</span>
          </div>
        </header>
        <section class="field-debt-chart-kpis">
          <div><span>Referencias verificadas</span><strong>${fieldDebtSummary.totalKeys}</strong></div>
          <div><span>Mora total</span><strong>${formatCurrency(fieldDebtChartData.totalDebt)}</strong></div>
          <div><span>Con mora critica</span><strong>${fieldDebtChartData.criticalRows.length}</strong></div>
          <div><span>Sin coincidencia</span><strong>${fieldDebtChartData.missingRows.length}</strong></div>
        </section>
        <section class="field-debt-chart-print-grid">
          <div class="field-debt-chart-card">
            <h2>Grafico por referencia</h2>
            <div class="field-debt-chart-bars">${barsMarkup || '<p>No hay mora para graficar.</p>'}</div>
          </div>
          <div class="field-debt-chart-card">
            <h2>Detalle ejecutivo</h2>
            <table class="field-report-table field-debt-chart-table">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Abonado</th>
                  <th>Nombre</th>
                  <th>Barrio</th>
                  <th>Valor</th>
                  <th>Intereses</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${detailRowsMarkup || '<tr><td colspan="7">No hay cuentas encontradas.</td></tr>'}</tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  };

  const handlePrintFieldDebtChart = async () => {
    if (!fieldDebtReport) {
      showAlert("Primero genera el grafico de mora.");
      return;
    }

    await printDocument(
      "Grafico de mora por referencia",
      buildFieldDebtChartPrintMarkup(),
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body field-debt-chart-print-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadFieldDebtPdf = async () => {
    if (!fieldDebtReport) {
      showAlert("Primero ejecuta la verificación de deuda.");
      return;
    }

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });

      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.setTextColor(18, 59, 93);
      document.text("Verificación de deuda GPS", 14, 15);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Jornada: ${formatMapDiaryLabel(fieldDebtReport.dateKey)} | Generado: ${formatDateTime(fieldDebtReport.generatedAt)}`, 14, 21);
      document.text(`Referencias unicas: ${fieldDebtSummary.totalKeys} | Encontradas: ${fieldDebtSummary.foundKeys} | Sin coincidencia: ${fieldDebtSummary.missingKeys}`, 14, 28);
      document.text(`Deuda total: ${formatCurrency(fieldDebtSummary.totalDebt)} lempiras | Puntos con referencia: ${fieldDebtSummary.totalPoints}`, 14, 35);

      const body = (fieldDebtReport.results || []).flatMap((result) => {
        if (!result.matches?.length) {
          return [[getFieldDebtResultLabel(result), String(fieldDebtReport?.keyCounts?.[result.key] || 0), "--", result.error || "No aparece", "--", "--", "--", "--"]];
        }

        return result.matches.map((match) => [
          getFieldDebtResultLabel(result),
          String(fieldDebtReport?.keyCounts?.[result.key] || 0),
          match.abonado || "--",
          match.inquilino || match.nombre || "--",
          match.barrio_colonia || "--",
          formatCurrency(Number(match.valor || 0)),
          formatCurrency(Number(match.intereses || 0)),
          formatCurrency(Number(match.total || 0))
        ]);
      });

      autoTable(document, {
        startY: 42,
        head: [["Referencia", "Reportes", "Abonado", "Nombre", "Barrio", "Valor", "Intereses", "Total"]],
        body: body.length ? body : [["Sin referencias", "--", "--", "--", "--", "--", "--", "--"]],
        theme: "grid",
        styles: { fontSize: 7.8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 251, 255] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 17, halign: "center" },
          2: { cellWidth: 24 },
          3: { cellWidth: 54 },
          4: { cellWidth: 42 },
          5: { cellWidth: 24, halign: "right" },
          6: { cellWidth: 24, halign: "right" },
          7: { cellWidth: 24, halign: "right" }
        }
      });

      const pageHeight = document.internal.pageSize.getHeight();
      const signatureY = Math.min((document.lastAutoTable?.finalY ?? 42) + 14, pageHeight - 54);
      document.setDrawColor(180, 205, 224);
      document.setFillColor(248, 252, 255);
      document.roundedRect(14, signatureY, 250, 44, 3, 3, "FD");
      document.setFont("helvetica", "bold");
      document.setFontSize(9.5);
      document.setTextColor(18, 59, 93);
      document.text("Ing. Juan Ordóñez Bonilla", 20, signatureY + 8);
      document.setFont("helvetica", "normal");
      document.setFontSize(8.5);
      document.text("Departamento de Catastro", 20, signatureY + 14);
      document.setDrawColor(120, 151, 178);
      document.line(174, signatureY + 31, 250, signatureY + 31);
      document.text("Firma", 212, signatureY + 38, { align: "center" });

      saveReportPdf(document, `verificacion-deuda-gps-${fieldDebtReport.dateKey || new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("PDF de verificacion de deuda descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el PDF de deuda.");
    }
  };

  const handleEditReportMapPoint = (pointId) => {
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) {
      return;
    }

    setEditingReportMapPointId(point.id);
    setReportMapDraft(withReferenceBarrioPrefix(buildMapReportDraftFromPoint(point), safeBarrioCodes));
  };

  const handleSaveReportMapPoint = async (event) => {
    event.preventDefault();

    const latitude = Number(reportMapDraft.latitude);
    const longitude = Number(reportMapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showAlert("Define la ubicacion del punto en el mapa o escribiendo las coordenadas.");
      return;
    }

    setSavingReportMapPoint(true);

    try {
      const isEditing = Boolean(editingReportMapPointId);
      const enrichedReportMapDraft = withReferenceBarrioPrefix(reportMapDraft, safeBarrioCodes);
      const response = await apiFetch(isEditing ? `/map-points/${editingReportMapPointId}` : "/map-points", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy_meters: Number(reportMapDraft.accuracy_meters) || null,
          point_type: enrichedReportMapDraft.point_type,
          description: enrichedReportMapDraft.description,
          reference: enrichedReportMapDraft.reference,
          housing_units: enrichedReportMapDraft.housing_units,
          marker_color: enrichedReportMapDraft.marker_color,
          is_terminal_point: enrichedReportMapDraft.is_terminal_point
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible guardar el punto del reporte.");
      }

      const previousPoint = safeMapPoints.find((point) => point.id === editingReportMapPointId) ?? null;
      setMapPoints((current) =>
        isEditing ? current.map((point) => (point.id === data.id ? data : point)) : [data, ...current]
      );
      setMapDiaryGroupsSummary((current) => syncMapDiaryGroups(current, data, previousPoint));
      setMapDiaryDateKey(getMapDiaryDateKey(data.created_at) || getMapDiaryDateKey(new Date()));
      setEditingReportMapPointId(null);
      setReportMapDraft({ ...emptyMapReportDraft });
      showAlert(isEditing ? "Punto del reporte actualizado." : "Punto agregado desde reportes de campo.");
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el punto del reporte.");
    } finally {
      setSavingReportMapPoint(false);
    }
  };

  const handleDownloadMapReport = async () => {
    try {
      const response = await apiFetch(`/map-points/export?date=${encodeURIComponent(activeMapDiaryDateKey)}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No fue posible descargar el reporte.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte-detallado-puntos-campo-${activeMapDiaryDateKey || new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showAlert("Reporte detallado de puntos descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte.");
    }
  };

  const handleDeleteMapPoint = async (pointId) => {
    if (!isAdmin) {
      showAlert("Solo administradores pueden eliminar puntos guardados.");
      return;
    }

    const deletedPoint = safeMapPoints.find((point) => point.id === pointId) ?? null;
    try {
      const response = await apiFetch(`/map-points/${pointId}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible eliminar el punto.");
      }

      setMapPoints((current) => current.filter((point) => point.id !== pointId));
      setMapDiaryGroupsSummary((current) => syncMapDiaryGroups(current, null, deletedPoint));
      setSelectedMapPointId((current) => (current === pointId ? null : current));
      showAlert("Punto eliminado del mapa.");
    } catch (error) {
      showAlert(error.message || "No fue posible eliminar el punto.");
    }
  };

  const handleSelectMapPoint = (pointId) => {
    setSelectedMapPointId(pointId);
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) return;

    setMapFocusRequest({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      zoom: 18.5,
      key: Date.now()
    });
  };

  const handleEditMapPoint = (pointId, event) => {
    event?.stopPropagation();
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) return;

    setSelectedMapPointId(point.id);
    setEditingMapPointId(point.id);
    setMapLocationHelp("");
    setMapDraft(withReferenceBarrioPrefix({
      latitude: formatCoordinate(point.latitude),
      longitude: formatCoordinate(point.longitude),
      accuracy_meters: point.accuracy_meters ?? "",
      point_type: point.point_type || "caja_registro",
      description: point.description || "",
      reference: point.reference_note || "",
      marker_color: point.marker_color || "#1576d1"
    }, safeBarrioCodes));
    setMapStatus("Edicion activa");
    setMapFocusRequest({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      zoom: 19,
      key: Date.now()
    });
  };

  const handlePrintMapFieldReport = async ({ includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const mapImageDataUrl = mapReportSettings.map_image_data_url || (await captureReportMapImage());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
    const reportNotes = mapReportSettings.report_notes.trim();
    const totalsMarkup = Object.entries(reportData.totalsByType)
      .map(
        ([label, total]) => `
          <div class="field-report-total-chip">
            <strong>${label}</strong>
            <span>${total}</span>
          </div>
        `
      )
      .join("");
    const portadaMarkup = `
      <section class="field-report-cover">
        <div class="field-report-cover-copy">
          <span class="field-report-kicker">Resumen de operaciones</span>
          <h2>Levantamiento consolidado de puntos de campo</h2>
          <p>Vista institucional del trabajo levantado, lista para seguimiento y revision administrativa.</p>
          <div class="field-report-cover-metrics">
            <div>
              <strong>Total de puntos</strong>
              <span>${reportData.totalPoints}</span>
            </div>
            <div>
              <strong>Total de barrios</strong>
              <span>${reportData.totalZones}</span>
            </div>
            <div>
              <strong>Cajas de registro</strong>
              <span>${reportCajaTotal}</span>
            </div>
          </div>
          ${buildMapReportStaffMarkup(mapReportStaff)}
        </div>
        <div class="field-report-cover-map">
          ${
            mapImageDataUrl
              ? `<img src="${mapImageDataUrl}" alt="Mapa visual del levantamiento" class="field-report-map-image" />`
              : `<div class="field-report-map-fallback">No fue posible capturar la vista del mapa para esta impresion.</div>`
          }
        </div>
      </section>
    `;

    const zonesMarkup = reportData.zones
      .map(
        (zone, index) => `
          <section class="field-report-zone">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">${escapeHtml(zone.displayKicker || `Zona ${index + 1}`)}</span>
                <h3>${escapeHtml(zone.displayName || zone.zone)}</h3>
                <p>Referencia sugerida: ${escapeHtml(zone.displayReference || "Sin contexto cercano")}</p>
                <p>Ubicacion completa: ${escapeHtml(zone.displayLocation || "Sin direccion ampliada")}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>Total: ${zone.total}</span>
                <span>Tipos: ${zone.pointTypesLabel || "--"}</span>
                <span>Precision prom.: ${zone.averageAccuracy ?? "--"} m</span>
              </div>
            </div>
            <table class="field-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Marca</th>
                  <th>Latitud</th>
                  <th>Longitud</th>
                  <th>Precision</th>
                  <th>Barrio</th>
                  <th>Referencia cercana</th>
                  <th>Referencia</th>
                  <th>Descripcion</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${zone.items
                  .map(
                    (point, pointIndex) => `
                      <tr class="${getReportPointRowClassName(point)}">
                        <td>${pointIndex + 1}</td>
                        <td>${getMapPointTypeLabel(point.point_type)}</td>
                        <td>
                          <span class="field-report-color-chip" style="--point-color: ${escapeHtml(point.marker_color || "#1576d1")}"></span>
                          ${point.is_terminal_point ? "Pin final" : point.marker_color || "#1576d1"}
                        </td>
                        <td>${formatCoordinate(point.latitude)}</td>
                        <td>${formatCoordinate(point.longitude)}</td>
                        <td>${point.accuracy_meters ? `${point.accuracy_meters} m` : "--"}</td>
                        <td>${escapeHtml(point.report_zone_label || point.suggested_zone || zone.zone)}</td>
                        <td>${escapeHtml(point.suggested_reference || "--")}</td>
                        <td>${escapeHtml(getMapPointReferenceNote(point) || "--")}</td>
                        <td>${escapeHtml(getMapPointTechnicalDescription(point) || "--")}</td>
                        <td>${formatDateTime(point.created_at)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");

    await printDocument(
      reportTitle,
      `
        <div class="field-report-shell">
          <header class="field-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${escapeHtml(reportDescription)}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Total de puntos: ${reportData.totalPoints}</span>
              <span>Total de barrios: ${reportData.totalZones}</span>
            </div>
            ${buildMapReportStaffMarkup(mapReportStaff)}
          </header>
          ${portadaMarkup}
          <section class="field-report-summary">
            ${totalsMarkup || '<div class="field-report-total-chip"><strong>Sin puntos</strong><span>0</span></div>'}
          </section>
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones del censo</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          ${zonesMarkup || '<p class="field-report-empty">No hay puntos guardados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapFieldPdf = async ({ includedZoneKeys } = {}) => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter",
        compress: true
      });
      const generatedAt = formatDateTime(new Date().toISOString());
      const mapImageDataUrl = mapReportSettings.map_image_data_url || (await captureReportMapImage());
      const reportData = getSelectedMapReportData(includedZoneKeys);
      const reportCajaTotal = getSelectedCajaTotal(reportData);
      const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const reportNotes = mapReportSettings.report_notes.trim();
      const addPdfPageFooter = () => {
        const pageWidth = document.internal.pageSize.getWidth();
        const pageHeight = document.internal.pageSize.getHeight();
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(69, 96, 122);
        document.text(`Pagina ${currentPage}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 20, 20);
      } catch {
        // Keep the report generation going even if the logo cannot be embedded.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(16);
      document.text(reportTitle, 38, 16);
      document.setFontSize(9.5);
      document.setTextColor(64, 91, 117);
      document.text(reportSubtitle, 38, 22);

      document.setTextColor(22, 50, 74);
      document.setFont("helvetica", "normal");
      document.text(`Generado: ${generatedAt}`, 14, 36);
      document.text(`Total de puntos: ${reportData.totalPoints}`, 86, 36);
      document.text(`Total de barrios: ${reportData.totalZones}`, 138, 36);
      document.text(document.splitTextToSize(`Tecnicos: ${getMapReportTechniciansLabel(mapReportStaff)}`, 116), 14, 42);
      document.text(`Ingeniero de datos: ${mapReportStaff.data_engineer || "--"}`, 138, 42);
      document.text(`Cajas de registro: ${reportCajaTotal}`, 14, 56);

      if (mapImageDataUrl) {
        const mapImageType = mapImageDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        document.setFillColor(237, 245, 252);
        document.roundedRect(154, 48, 104, 48, 3, 3, "F");
        document.addImage(mapImageDataUrl, mapImageType, 156, 50, 100, 44);
      } else {
        document.setFillColor(237, 245, 252);
        document.roundedRect(154, 48, 104, 48, 3, 3, "F");
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(69, 96, 122);
        document.text("Mapa no disponible", 206, 73, { align: "center" });
      }

      autoTable(document, {
        startY: 62,
        head: [["Resumen", "Cantidad"]],
        body: Object.entries(reportData.totalsByType).length
          ? Object.entries(reportData.totalsByType)
          : [["Sin puntos", "0"]],
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 2.6,
          textColor: [24, 42, 60]
        },
        headStyles: {
          fillColor: [21, 118, 209],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 54 },
          1: { cellWidth: 20, halign: "center" }
        },
        margin: { left: 14, right: 14 }
      });

      addPdfPageFooter();
      let currentY = (document.lastAutoTable?.finalY ?? 58) + 6;
      if (reportNotes) {
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Observaciones del censo", 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        const noteLines = document.splitTextToSize(reportNotes, 130);
        document.text(noteLines, 14, currentY + 5);
        currentY += Math.min(22, noteLines.length * 4 + 9);
      }

      for (let index = 0; index < reportData.zones.length; index += 1) {
        const zone = reportData.zones[index];

        if (currentY > 175) {
          document.addPage("letter", "landscape");
          addPdfPageFooter();
          currentY = 16;
        }

        document.setFillColor(237, 245, 252);
        document.roundedRect(14, currentY, 250, 16, 3, 3, "F");
        document.setFont("helvetica", "bold");
        document.setFontSize(11.5);
        document.setTextColor(16, 55, 91);
        document.text(`${zone.displayKicker || `Zona ${index + 1}`}: ${zone.displayName || zone.zone}`, 18, currentY + 6);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.text(`Referencia sugerida: ${zone.displayReference || "Sin contexto cercano"}`, 18, currentY + 11);
        document.text(`Ubicacion completa: ${zone.displayLocation || "Sin direccion ampliada"}`, 128, currentY + 11);

        autoTable(document, {
          startY: currentY + 20,
          head: [[
            "#",
            "Tipo",
            "Marca",
            "Latitud",
            "Longitud",
            "Precision",
            "Referencia cercana",
            "Referencia",
            "Descripcion",
            "Fecha"
          ]],
          body: zone.items.map((point, pointIndex) => {
            const row = [
              String(pointIndex + 1),
              getMapPointTypeLabel(point.point_type),
              point.is_terminal_point ? "Pin final" : point.marker_color || "#1576d1",
              formatCoordinate(point.latitude),
              formatCoordinate(point.longitude),
              point.accuracy_meters ? `${point.accuracy_meters} m` : "--",
              point.suggested_reference || "--",
              getMapPointReferenceNote(point) || "--",
              getMapPointTechnicalDescription(point) || "--",
              formatDateTime(point.created_at)
            ];
            row.rawPoint = point;
            return row;
          }),
          theme: "grid",
          styles: {
            fontSize: 7.6,
            cellPadding: 2.1,
            textColor: [28, 44, 62],
            overflow: "linebreak"
          },
          headStyles: {
            fillColor: [21, 118, 209],
            textColor: [255, 255, 255],
            fontStyle: "bold"
          },
          alternateRowStyles: {
            fillColor: [248, 251, 255]
          },
          didParseCell: (data) => {
            if (data.section !== "body") return;
            const rawPoint = data.row.raw?.rawPoint;
            if (isAlertReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_ALERT_RGB;
              data.cell.styles.fillColor = REPORT_POINT_ALERT_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_ALERT_BORDER_RGB;
            } else if (isRedReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_DANGER_RGB;
              data.cell.styles.fillColor = REPORT_POINT_DANGER_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_DANGER_BORDER_RGB;
            } else {
              return;
            }
            if (data.column.index === 1 || data.column.index === 2) {
              data.cell.styles.fontStyle = "bold";
            }
          },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 22 },
            2: { cellWidth: 14 },
            3: { cellWidth: 18 },
            4: { cellWidth: 18 },
            5: { cellWidth: 16 },
            6: { cellWidth: 31 },
            7: { cellWidth: 34 },
            8: { cellWidth: 55 },
            9: { cellWidth: 24 }
          }
        });

        currentY = (document.lastAutoTable?.finalY ?? currentY + 20) + 7;
        addPdfPageFooter();
      }

      saveReportPdf(document, `reporte-campo-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Reporte PDF descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte PDF.");
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

  const handleDownloadRegulatorEvidencePdf = async () => {
    if (generatingRegulatorReport) return;
    const selectedDateKeys = selectedRegulatorDiaryKeys.length ? selectedRegulatorDiaryKeys : [activeMapDiaryDateKey].filter(Boolean);
    if (!selectedDateKeys.length) {
      showAlert("Selecciona al menos una jornada con puntos GPS para generar el resumen.");
      return;
    }

    setGeneratingRegulatorReport(true);
    showAlert("Generando resumen de trabajo realizado...");

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });
      const reportData = mapReportPrintData;
      const generatedAtIso = new Date().toISOString();
      const generatedAt = formatDateTime(generatedAtIso);
      const reportTitle = "Resumen de trabajo realizado";
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const mapImageDataUrl =
        mapReportSettings.map_image_data_url ||
        (await Promise.race([
          captureReportMapImage(),
          new Promise((resolve) => window.setTimeout(() => resolve(""), 3500))
        ]));
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const maxPages = 5;
      const journeyEntries = await Promise.all(
        selectedDateKeys.map(async (dateKey) => {
          const localPoints = safeMapPoints.filter((point) => getMapDiaryDateKey(point) === dateKey);
          if (localPoints.length) {
            return { dateKey, points: localPoints };
          }

          try {
            const response = await apiFetch(`/map-points?date=${encodeURIComponent(dateKey)}`);
            const data = await response.json();
            return { dateKey, points: response.ok && Array.isArray(data) ? data : [] };
          } catch {
            return { dateKey, points: [] };
          }
        })
      );
      const evidencePoints = journeyEntries
        .flatMap((entry) => entry.points.map((point) => ({ ...point, evidence_date_key: entry.dateKey })))
        .sort((left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at));
      let evidenceContexts = {};
      if (evidencePoints.length && isAdmin) {
        try {
          const response = await apiFetch("/map-points/context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              points: evidencePoints.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude
              }))
            })
          });
          const data = await response.json();
          if (response.ok) {
            evidenceContexts = Object.fromEntries((Array.isArray(data.contexts) ? data.contexts : []).map((context) => [context.key, context]));
          }
        } catch {
          evidenceContexts = {};
        }
      }
      const getEvidenceContext = (point) => evidenceContexts[getMapPointContextKey(point)] ?? mapPointContexts[getMapPointContextKey(point)] ?? null;
      const recentPoints = evidencePoints.slice(0, 40);
      const latestPoint = recentPoints[0] || visibleMapPoints[0] || null;
      const partialUserRows = recentPoints.slice(0, 28).map((point, index) => {
        const context = getEvidenceContext(point);
        return [
          String(index + 1),
          getMapReportPointClave(point, context) || "--",
          formatMapDiaryLabel(point.evidence_date_key || getMapDiaryDateKey(point)),
          getMapReportBarrioZone(point, context, safeBarrioCodes),
          getMapPointTypeLabel(point.point_type),
          `${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`,
          getMapPointReferenceNote(point) || point.suggested_reference || getMapPointTechnicalDescription(point) || "--",
          formatDateTime(point.updated_at || point.created_at)
        ];
      });
      const evidenceZoneMap = evidencePoints.reduce((accumulator, point) => {
        const context = getEvidenceContext(point);
        const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
        const current = accumulator.get(zone) ?? { zone, total: 0, dates: new Set(), types: new Set(), claves: new Set() };
        current.total += 1;
        current.dates.add(point.evidence_date_key || getMapDiaryDateKey(point));
        current.types.add(getMapPointTypeLabel(point.point_type));
        const clave = getMapReportPointClave(point, context);
        if (clave) current.claves.add(clave);
        accumulator.set(zone, current);
        return accumulator;
      }, new Map());
      const formatWorkDuration = (minutes) => {
        const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
        const hours = Math.floor(safeMinutes / 60);
        const rest = safeMinutes % 60;
        if (!hours) return `${rest} min`;
        return rest ? `${hours} h ${rest} min` : `${hours} h`;
      };
      const getJourneyStats = (entry) => {
        const sortedPoints = [...entry.points].sort(
          (left, right) => new Date(left.created_at || left.updated_at) - new Date(right.created_at || right.updated_at)
        );
        const first = sortedPoints[0] ?? null;
        const last = sortedPoints[sortedPoints.length - 1] ?? null;
        const firstTime = first ? new Date(first.created_at || first.updated_at).getTime() : 0;
        const lastTime = last ? new Date(last.updated_at || last.created_at).getTime() : 0;
        const rangeMinutes = firstTime && lastTime ? Math.max(0, Math.round((lastTime - firstTime) / 60000)) : 0;
        const estimatedMinutes = entry.points.length ? Math.max(rangeMinutes, Math.min(entry.points.length * 4, 600)) : 0;
        return { first, last, rangeMinutes, estimatedMinutes };
      };
      const journeyStatsByDate = Object.fromEntries(journeyEntries.map((entry) => [entry.dateKey, getJourneyStats(entry)]));
      const totalEstimatedMinutes = Object.values(journeyStatsByDate).reduce(
        (sum, stats) => sum + Number(stats.estimatedMinutes || 0),
        0
      );
      const auditActors = new Map();
      safeAuditLogs.forEach((log) => {
        const actor = String(log.actor_name || log.actor_email || "Sistema").trim();
        if (!actor || actor === "Sistema") return;
        const current = auditActors.get(actor) ?? { actor, total: 0, latest: log.created_at };
        current.total += 1;
        if (new Date(log.created_at) > new Date(current.latest)) {
          current.latest = log.created_at;
        }
        auditActors.set(actor, current);
      });
      const appUserRows = (safeUsers.length ? safeUsers : [session?.user].filter(Boolean))
        .map((user) => {
          const actorActivity = auditActors.get(user.full_name) || auditActors.get(user.email) || auditActors.get(user.username);
          return {
            name: user.full_name || user.username || user.email || "Usuario",
            username: user.username || user.email || "--",
            role: roleLabel(user.role || "operador"),
            sessions: Number(user.active_sessions || 0),
            latest: actorActivity?.latest || user.last_login_at || "",
            events: actorActivity?.total || 0,
            isOnline: Boolean(user.is_online || Number(user.active_sessions || 0) > 0)
          };
        })
        .sort((left, right) => {
          if (right.sessions !== left.sessions) return right.sessions - left.sessions;
          return new Date(right.latest || 0) - new Date(left.latest || 0);
        })
        .slice(0, 12)
        .map((user, index) => [
          String(index + 1),
          user.name,
          user.role,
          user.username,
          user.isOnline ? "En linea" : "Fuera de linea",
          user.latest ? formatDateTime(user.latest) : "--",
          String(user.events)
        ]);
      const evidenceRows = [
        ["Sistema fuente", "Aguas de Choluteca / modulo Reportes GPS"],
        ["Jornadas revisadas", selectedDateKeys.map(formatMapDiaryLabel).join(" / ")],
        ["Generado", generatedAt],
        ["Ultima actualizacion visible", latestPoint ? formatDateTime(latestPoint.updated_at || latestPoint.created_at) : "Sin puntos registrados"],
        ["Puntos incluidos", String(evidencePoints.length)],
        ["Barrios / zonas", String(evidenceZoneMap.size)],
        ["Horas estimadas de campo", formatWorkDuration(totalEstimatedMinutes)],
        ["Usuarios registrados", String(safeUsers.length || appUserRows.length)],
        ["Usuarios con eventos recientes", String(auditActors.size)],
        ["Tecnicos", getMapReportTechniciansLabel(mapReportStaff)],
        ["Responsable de datos", mapReportStaff.data_engineer || "--"]
      ];
      const getJourneyEvidenceSummary = (entry) => {
        const stats = journeyStatsByDate[entry.dateKey] ?? getJourneyStats(entry);
        const creators = Array.from(
          new Set(entry.points.map((point) => String(point.created_by_name || "").trim()).filter(Boolean))
        );
        const zones = new Set();
        const claves = new Set();
        const references = new Set();
        const types = entry.points.reduce((accumulator, point) => {
          const context = getEvidenceContext(point);
          zones.add(getMapReportBarrioZone(point, context, safeBarrioCodes));
          const clave = getMapReportPointClave(point, context);
          if (clave) claves.add(clave);
          const reference = getMapPointReferenceNote(point) || getMapPointTechnicalDescription(point) || context?.reference || "";
          if (reference) references.add(reference);
          const label = getMapPointTypeLabel(point.point_type);
          accumulator[label] = (accumulator[label] || 0) + 1;
          return accumulator;
        }, {});
        return {
          stats,
          creators,
          zones: Array.from(zones).filter(Boolean),
          claves: Array.from(claves).filter(Boolean),
          references: Array.from(references).filter(Boolean),
          types
        };
      };
      const journeyEvidenceRows = journeyEntries.slice(0, 5).map((entry, index) => {
        const summary = getJourneyEvidenceSummary(entry);
        return [
          String(index + 1),
          formatMapDiaryLabel(entry.dateKey),
          `${entry.points.length} puntos\n${formatWorkDuration(summary.stats.estimatedMinutes)}`,
          `${summary.zones.length} zonas\n${summary.creators.slice(0, 3).join(" / ") || getMapReportTechniciansLabel(mapReportStaff)}`,
          Object.entries(summary.types).map(([label, total]) => `${label}: ${total}`).join("\n") || "--",
          [
            summary.claves.length ? `Claves: ${summary.claves.slice(0, 5).join(", ")}` : "",
            summary.references.length ? `Refs: ${summary.references.slice(0, 3).join(" | ")}` : ""
          ].filter(Boolean).join("\n") || "Referencias registradas en puntos GPS."
        ];
      });
      const drawMiniMap = (points, x, y, width, height, title) => {
        document.setDrawColor(185, 209, 228);
        document.setFillColor(237, 245, 252);
        document.roundedRect(x, y, width, height, 3, 3, "FD");
        document.setFont("helvetica", "bold");
        document.setFontSize(8);
        document.setTextColor(18, 59, 93);
        if (title) {
          document.text(title, x + 4, y + 6);
        }
        const validPoints = points.filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)));
        if (!validPoints.length) {
          document.setFont("helvetica", "normal");
          document.setTextColor(91, 116, 139);
          document.text("Sin puntos", x + width / 2, y + height / 2, { align: "center" });
          return;
        }
        const minLat = Math.min(...validPoints.map((point) => Number(point.latitude)));
        const maxLat = Math.max(...validPoints.map((point) => Number(point.latitude)));
        const minLng = Math.min(...validPoints.map((point) => Number(point.longitude)));
        const maxLng = Math.max(...validPoints.map((point) => Number(point.longitude)));
        const latSpan = maxLat - minLat || 0.0001;
        const lngSpan = maxLng - minLng || 0.0001;
        document.setDrawColor(209, 224, 237);
        for (let line = 1; line <= 3; line += 1) {
          document.line(x + 4, y + 10 + (height - 16) * (line / 4), x + width - 4, y + 10 + (height - 16) * (line / 4));
          document.line(x + 4 + (width - 8) * (line / 4), y + 10, x + 4 + (width - 8) * (line / 4), y + height - 4);
        }
        validPoints.slice(0, 55).forEach((point) => {
          const dotX = x + 5 + ((Number(point.longitude) - minLng) / lngSpan) * (width - 10);
          const dotY = y + 11 + ((maxLat - Number(point.latitude)) / latSpan) * (height - 17);
          if (isRedReportPoint(point)) {
            document.setFillColor(220, 38, 38);
          } else if (isAlertReportPoint(point)) {
            document.setFillColor(245, 158, 11);
          } else {
            document.setFillColor(21, 118, 209);
          }
          document.circle(dotX, dotY, 1.5, "F");
        });
        document.setFont("helvetica", "normal");
        document.setFontSize(7);
        document.setTextColor(78, 101, 123);
        document.text(`${validPoints.length} puntos`, x + width - 4, y + height - 4, { align: "right" });
      };

      const addFooter = () => {
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(78, 101, 123);
        document.text(`Pagina ${currentPage} de maximo ${maxPages}`, pageWidth - 14, pageHeight - 8, { align: "right" });
        document.text("Resumen del trabajo realizado", 14, pageHeight - 8);
      };
      const addPage = () => {
        if (document.getNumberOfPages() >= maxPages) return false;
        document.addPage("letter", "landscape");
        addFooter();
        return true;
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 20, 20);
      } catch {
        // Logo optional in generated evidence.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(17);
      document.setTextColor(18, 59, 93);
      document.text(reportTitle, 38, 16);
      document.setFont("helvetica", "normal");
      document.setFontSize(9.5);
      document.setTextColor(71, 95, 118);
      document.text(reportSubtitle, 38, 22);
      document.text("Jornadas seleccionadas, capturas pequenas, puntos de mapa y pruebas generales de trabajo.", 38, 28);

      autoTable(document, {
        startY: 38,
        head: [["Indicador", "Valor"]],
        body: evidenceRows,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.4, overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 251, 255] },
        margin: { left: 14, right: 150 },
        columnStyles: {
          0: { cellWidth: 43, fontStyle: "bold" },
          1: { cellWidth: 94 }
        }
      });
      const distributionStartY = Math.min(Math.max((document.lastAutoTable?.finalY ?? 108) + 10, 116), 166);

      document.setFillColor(237, 245, 252);
      document.roundedRect(154, 38, 104, 62, 3, 3, "F");
      if (mapImageDataUrl) {
        const mapImageType = mapImageDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        document.addImage(mapImageDataUrl, mapImageType, 157, 41, 98, 56);
      } else {
        document.setFont("helvetica", "bold");
        document.setFontSize(10);
        document.setTextColor(81, 106, 128);
        document.text("Mapa / captura no disponible", 206, 69, { align: "center" });
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(11);
      document.setTextColor(18, 59, 93);
      document.text("Distribucion del informe", 14, distributionStartY);
      autoTable(document, {
        startY: distributionStartY + 6,
        head: [["Hoja", "Contenido"]],
        body: [
          ["1", "Resumen ejecutivo del trabajo realizado"],
          ["2", "Usuarios que han trabajado en la aplicacion"],
          ["3", "Jornadas de trabajo seleccionadas"],
          ["4", "Listado parcial de puntos de mapa"],
          ["5", "Mapa principal adjunto y constancia"]
        ],
        theme: "grid",
        styles: { fontSize: 8.4, cellPadding: 2.3, overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
        margin: { left: 14, right: 150 },
        tableWidth: 150,
        columnStyles: {
          0: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 134 }
        }
      });
      addFooter();

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Usuarios que han trabajado en la aplicacion", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Cuentas operativas con actividad, sesiones o eventos recientes dentro del sistema.", 14, 22);
        autoTable(document, {
          startY: 31,
          head: [["#", "Usuario", "Rol", "Cuenta", "Estado", "Ultimo ingreso / evento", "Eventos"]],
          body: appUserRows.length ? appUserRows : [["1", "Sin usuarios cargados", "--", "--", "--", "--", "0"]],
          theme: "grid",
          styles: { fontSize: 8.1, cellPadding: 2.2, overflow: "linebreak" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 251, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 9, halign: "center" },
            1: { cellWidth: 52 },
            2: { cellWidth: 33 },
            3: { cellWidth: 52 },
            4: { cellWidth: 26 },
            5: { cellWidth: 56 },
            6: { cellWidth: 18, halign: "center" }
          }
        });
      }

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Evidencia de jornadas de trabajo", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Resumen legible de las jornadas seleccionadas: trabajo levantado, personal, zonas, claves y referencias.", 14, 22);
        autoTable(document, {
          startY: 31,
          head: [["#", "Jornada", "Puntos / horas", "Zonas / equipo", "Tipos de trabajo", "Evidencia"]],
          body: journeyEvidenceRows.length
            ? journeyEvidenceRows
            : [["1", "Sin jornadas", "0 puntos", "--", "--", "--"]],
          theme: "grid",
          styles: { fontSize: 7.8, cellPadding: 2.4, overflow: "linebreak", valign: "top" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 251, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 9, halign: "center" },
            1: { cellWidth: 30 },
            2: { cellWidth: 28 },
            3: { cellWidth: 50 },
            4: { cellWidth: 58 },
            5: { cellWidth: 71 }
          }
        });
      }

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Listado parcial de puntos de mapa", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Muestra limitada para evidencia documental; el sistema conserva el historial completo en base de datos.", 14, 22);
        autoTable(document, {
          startY: 30,
          head: [["#", "Clave", "Jornada", "Barrio / zona", "Tipo", "Coordenada", "Referencia / evidencia", "Actualizado"]],
          body: partialUserRows.length ? partialUserRows : [["1", "--", "--", "Sin puntos", "--", "--", "--", "--"]],
          theme: "grid",
          styles: { fontSize: 7.1, cellPadding: 1.8, overflow: "linebreak" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 251, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 9, halign: "center" },
            1: { cellWidth: 24 },
            2: { cellWidth: 26 },
            3: { cellWidth: 43 },
            4: { cellWidth: 26 },
            5: { cellWidth: 38 },
            6: { cellWidth: 64 },
            7: { cellWidth: 26 }
          }
        });
      }

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Mapa principal adjunto y constancia", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Evidencia visual separada del resumen operativo para evitar mezclar actividades.", 14, 22);
        document.setFillColor(237, 245, 252);
        document.roundedRect(14, 28, 246, 92, 3, 3, "F");
        if (mapImageDataUrl) {
          const mapImageType = mapImageDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
          document.addImage(mapImageDataUrl, mapImageType, 18, 32, 238, 84);
        } else {
          document.setFont("helvetica", "bold");
          document.setFontSize(11);
          document.setTextColor(81, 106, 128);
          document.text("Adjunta una captura o deja visible el mapa para incluir evidencia grafica.", pageWidth / 2, 75, { align: "center" });
        }
        autoTable(document, {
          startY: 128,
          head: [["Elemento", "Detalle"]],
          body: [
            ["Alcance", "Reporte maximo de 5 paginas con evidencia visual, jornadas seleccionadas y muestra parcial del sistema."],
            ["Base del reporte", `${selectedDateKeys.length} jornadas con ${evidencePoints.length} puntos y ${evidenceZoneMap.size} barrios / zonas.`],
            ["Horas empleadas", `${formatWorkDuration(totalEstimatedMinutes)} estimadas a partir de la bitacora de puntos GPS.`],
            ["Usuarios del sistema", `${safeUsers.length || appUserRows.length} usuarios registrados y ${auditActors.size} con eventos recientes.`],
            ["Actualizacion reciente", latestPoint ? `Ultimo punto actualizado: ${formatDateTime(latestPoint.updated_at || latestPoint.created_at)}` : "Sin actualizacion registrada en la jornada."],
            ["Responsables", `Tecnicos: ${getMapReportTechniciansLabel(mapReportStaff)}. Datos: ${mapReportStaff.data_engineer || "--"}.`],
            ["Observaciones", mapReportSettings.report_notes.trim() || "Sin observaciones adicionales."]
          ],
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 48, fontStyle: "bold" },
            1: { cellWidth: 200 }
          }
        });
        const signY = Math.min((document.lastAutoTable?.finalY ?? 85) + 20, pageHeight - 42);
        document.setDrawColor(120, 151, 178);
        document.line(154, signY, 244, signY);
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(71, 95, 118);
        document.text("Firma y sello", 199, signY + 7, { align: "center" });
      }

      while (document.getNumberOfPages() > maxPages) {
        document.deletePage(document.getNumberOfPages());
      }

      saveReportPdf(document, `resumen-trabajo-realizado-${selectedDateKeys[0] || generatedAtIso.slice(0, 10)}.pdf`);
      showAlert("Resumen de trabajo realizado descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible generar el PDF para ente regulador.");
    } finally {
      setGeneratingRegulatorReport(false);
    }
  };

  const handlePrintMapCensusReport = async ({ includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const { padronNames } = await buildMapReportPadronData(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
    const reportNotes = mapReportSettings.report_notes.trim();
    const mapImageDataUrl = mapReportSettings.map_image_data_url || "";
    const zonesMarkup = reportData.zones
      .map(
        (zone, index) => `
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">${escapeHtml(zone.displayKicker || `Zona ${index + 1}`)}</span>
                <h3>${escapeHtml(zone.displayName || zone.zone)}</h3>
                <p>Ubicación: ${escapeHtml(zone.displayLocation || "Sin referencia")}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>Puntos: ${zone.total}</span>
              </div>
            </div>
            <table class="field-report-table census-report-table map-points-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barrio / sector</th>
                  <th>Clave / abonado</th>
                  <th>Nombre en padrón</th>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                ${zone.items
                  .map(
                    (point, pointIndex) => `
                      <tr class="${getReportPointRowClassName(point)}">
                        <td>${pointIndex + 1}</td>
                        <td>${escapeHtml(zone.displayName || zone.zone || "--")}</td>
                        <td>${escapeHtml(getMapPointReportReferenceLabel(point))}</td>
                        <td>${escapeHtml(getMapPointPadronNames(point, padronNames))}</td>
                        <td>${escapeHtml(getMapPointTypeLabel(point.point_type))}</td>
                        <td>${escapeHtml(getMapPointReferenceNote(point) || zone.displayLocation || "--")}</td>
                        <td>${escapeHtml(getMapPointTechnicalDescription(point) || "--")}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");

    await printDocument(
      `${reportTitle} - Censo sin coordenadas`,
      `
        <div class="field-report-shell census-report-shell">
          <header class="field-report-header census-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${escapeHtml(reportDescription)}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Tipo: Reporte de censo sin coordenadas</span>
              <span>Generado: ${generatedAt}</span>
              <span>Total de puntos: ${reportData.totalPoints}</span>
              <span>Zonas / manzanas: ${reportData.totalZones}</span>
            </div>
            ${buildMapReportStaffMarkup(mapReportStaff)}
          </header>
          ${
            mapImageDataUrl
              ? `<section class="census-report-map"><img src="${mapImageDataUrl}" alt="Mapa del censo" class="field-report-map-image" /></section>`
              : ""
          }
          <section class="field-report-summary">
            <div class="field-report-total-chip"><strong>Total de puntos</strong><span>${reportData.totalPoints}</span></div>
            <div class="field-report-total-chip"><strong>Zonas / manzanas</strong><span>${reportData.totalZones}</span></div>
            <div class="field-report-total-chip"><strong>Cajas de registro</strong><span>${reportCajaTotal}</span></div>
          </section>
          ${buildMapReportTypeChartMarkup(reportData)}
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones del censo</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          ${zonesMarkup || '<p class="field-report-empty">No hay puntos guardados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        bodyClassName: "field-report-body census-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapCensusPdf = async ({ includedZoneKeys } = {}) => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
        compress: true
      });
      const reportData = getSelectedMapReportData(includedZoneKeys);
      const { padronNames } = await buildMapReportPadronData(reportData);
      const generatedAt = formatDateTime(new Date().toISOString());
      const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
      const reportNotes = mapReportSettings.report_notes.trim();
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const addPageFooter = () => {
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        document.text(`Pagina ${currentPage}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 18, 18);
      } catch {
        // Keep the report generation going even if the logo cannot be embedded.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.setTextColor(18, 59, 93);
      document.text(reportTitle, 36, 15);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.setTextColor(64, 91, 117);
      document.text(reportSubtitle, 36, 21);
      document.text(document.splitTextToSize(reportDescription, 150), 36, 26);

      document.setFillColor(237, 245, 252);
      document.roundedRect(14, 38, 188, 22, 3, 3, "F");
      document.setFontSize(8.8);
      document.setTextColor(22, 50, 74);
      document.text(`Tipo: Reporte de censo sin coordenadas`, 18, 45);
      document.text(`Generado: ${generatedAt}`, 18, 51);
      document.text(`Total de puntos: ${reportData.totalPoints}`, 102, 45);
      document.text(`Zonas / manzanas: ${reportData.totalZones}`, 102, 51);
      document.text(document.splitTextToSize(`Tecnicos: ${getMapReportTechniciansLabel(mapReportStaff)}`, 178), 18, 57);

      const chartRows = getMapReportTypeChartRows(reportData);
      let currentY = 66;
      if (chartRows.length) {
        const maxChartValue = Math.max(1, ...chartRows.map(([, total]) => Number(total || 0)));
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Distribucion de puntos", 14, currentY);
        chartRows.forEach(([label, total], index) => {
          const rowY = currentY + 6 + index * 5;
          document.setFont("helvetica", "normal");
          document.setFontSize(7.5);
          document.setTextColor(45, 75, 101);
          document.text(String(label).slice(0, 25), 14, rowY);
          document.setFillColor(224, 235, 245);
          document.roundedRect(62, rowY - 2.7, 120, 3, 1.5, 1.5, "F");
          document.setFillColor(21, 118, 209);
          document.roundedRect(62, rowY - 2.7, Math.max(4, (Number(total || 0) / maxChartValue) * 120), 3, 1.5, 1.5, "F");
          document.text(String(total), 198, rowY, { align: "right" });
        });
        currentY += chartRows.length * 5 + 10;
      }
      if (reportNotes) {
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Observaciones del censo", 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        const noteLines = document.splitTextToSize(reportNotes, 180);
        document.text(noteLines, 14, currentY + 5);
        currentY += Math.min(24, noteLines.length * 4 + 10);
      }

      addPageFooter();

      for (let index = 0; index < reportData.zones.length; index += 1) {
        const zone = reportData.zones[index];
        if (currentY > 235) {
          document.addPage("letter", "portrait");
          addPageFooter();
          currentY = 16;
        }

        document.setFillColor(237, 245, 252);
        document.roundedRect(14, currentY, 188, 13, 3, 3, "F");
        document.setFont("helvetica", "bold");
        document.setFontSize(10.5);
        document.setTextColor(16, 55, 91);
        document.text(`${zone.displayKicker || `Zona ${index + 1}`}: ${zone.displayName || zone.zone}`, 18, currentY + 6);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.2);
        document.text(`Ubicacion: ${zone.displayLocation || "Sin referencia"}`, 18, currentY + 11);

        autoTable(document, {
          startY: currentY + 17,
          head: [["#", "Barrio / sector", "Clave / abonado", "Nombre en padron", "Tipo", "Referencia", "Descripcion"]],
          body: zone.items.map((point, pointIndex) => {
            const row = [
              String(pointIndex + 1),
              zone.displayName || zone.zone || "--",
              getMapPointReportReferenceLabel(point),
              getMapPointPadronNames(point, padronNames),
              getMapPointTypeLabel(point.point_type),
              getMapPointReferenceNote(point) || zone.displayLocation || "--",
              getMapPointTechnicalDescription(point) || "--"
            ];
            row.rawPoint = point;
            return row;
          }),
          theme: "grid",
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [28, 44, 62],
            overflow: "linebreak"
          },
          headStyles: {
            fillColor: [21, 118, 209],
            textColor: [255, 255, 255],
            fontStyle: "bold"
          },
          alternateRowStyles: {
            fillColor: [248, 251, 255]
          },
          didParseCell: (data) => {
            if (data.section !== "body") return;
            const rawPoint = data.row.raw?.rawPoint;
            if (isAlertReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_ALERT_RGB;
              data.cell.styles.fillColor = REPORT_POINT_ALERT_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_ALERT_BORDER_RGB;
            } else if (isRedReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_DANGER_RGB;
              data.cell.styles.fillColor = REPORT_POINT_DANGER_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_DANGER_BORDER_RGB;
            } else {
              return;
            }
            if (data.column.index === 1 || data.column.index === 2) {
              data.cell.styles.fontStyle = "bold";
            }
          },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 27 },
            2: { cellWidth: 25 },
            3: { cellWidth: 35 },
            4: { cellWidth: 22 },
            5: { cellWidth: 28 },
            6: { cellWidth: 43 }
          }
        });

        currentY = (document.lastAutoTable?.finalY ?? currentY + 22) + 7;
        addPageFooter();
      }

      saveReportPdf(document, `reporte-censo-sin-coordenadas-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Reporte de censo sin coordenadas descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte de censo.");
    }
  };

  const handlePrintMapBriefReport = async ({ sharedKeys: includeSharedKeys = false, debtSummary: includeDebtSummary = false, includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const { padronNames, sharedKeys, debtRows } = await buildMapReportPadronData(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportNotes = mapReportSettings.report_notes.trim();
    const sharedAccounts = sharedKeys.reduce((total, item) => total + item.total, 0);
    const totalDebt = debtRows.reduce((total, item) => total + item.total, 0);
    const rowsMarkup = buildMapReportBriefRows(reportData, padronNames)
      .map(
        ([index, barrio, clave, nombre, tipo, descripcion, services]) => `
          <tr>
            <td>${escapeHtml(index)}</td>
            <td>${escapeHtml(barrio)}</td>
            <td>${escapeHtml(clave)}</td>
            <td>${escapeHtml(nombre)}</td>
            <td>${escapeHtml(tipo)}</td>
            <td>${escapeHtml(descripcion)}</td>
            <td class="map-brief-service-cell">${escapeHtml(services)}</td>
          </tr>
        `
      )
      .join("");

    await printDocument(
      `${reportTitle} - Resumen ligero`,
      `
        <div class="field-report-shell map-brief-report-shell">
          <header class="field-report-header map-brief-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>Resumen ligero de jornada GPS para lectura rapida, archivo PDF e impresion.</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Jornada: ${escapeHtml(formatMapDiaryLabel(activeMapDiaryDateKey))}</span>
              <span>Tecnicos: ${escapeHtml(getMapReportTechniciansLabel(mapReportStaff))}</span>
            </div>
          </header>
          <section class="map-brief-report-metrics">
            <div><strong>Total general</strong><span>${reportData.totalPoints}</span></div>
            <div><strong>Barrios / zonas</strong><span>${reportData.totalZones}</span></div>
            <div><strong>Cajas de registro</strong><span>${reportCajaTotal}</span></div>
          </section>
          ${buildMapReportTypeChartMarkup(reportData)}
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          <section class="field-report-zone map-brief-report-table-section">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Listado resumido</span>
                <h3>Listado por barrio y clave</h3>
                <p class="map-brief-service-legend">${escapeHtml(MAP_REPORT_SERVICE_LEGEND)}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>${reportData.totalZones} barrios</span>
              </div>
            </div>
            <table class="field-report-table map-brief-report-table">
              <colgroup>
                <col class="map-brief-col-index" />
                <col class="map-brief-col-barrio" />
                <col class="map-brief-col-clave" />
                <col class="map-brief-col-nombre" />
                <col class="map-brief-col-tipo" />
                <col class="map-brief-col-descripcion" />
                <col class="map-brief-col-servicios" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barrio / zona</th>
                  <th>Clave / abonado</th>
                  <th>Nombre en padrón</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Servicios activos</th>
                </tr>
              </thead>
              <tbody>
                ${rowsMarkup || '<tr><td colspan="7">No hay puntos guardados para generar el resumen.</td></tr>'}
              </tbody>
            </table>
          </section>
          ${includeSharedKeys ? `<section class="map-brief-shared-keys">
            <div>
              <span class="field-report-zone-kicker">Cruce del padrón</span>
              <h3>Abonados que comparten clave catastral</h3>
              <p><strong>${sharedKeys.length}</strong> claves agrupan <strong>${sharedAccounts}</strong> abonados.</p>
            </div>
            ${
              sharedKeys.length
                ? `<table><thead><tr><th>Clave catastral base</th><th>Abonados</th><th>Total</th></tr></thead><tbody>${sharedKeys
                    .map(
                      (item) =>
                        `<tr><td>${escapeHtml(item.clave)}</td><td>${escapeHtml(item.abonados.join(", "))}</td><td>${item.total}</td></tr>`
                    )
                    .join("")}</tbody></table>`
                : "<p>No se detectaron varios abonados con la misma clave catastral.</p>"
            }
          </section>` : ""}
          ${includeDebtSummary ? `<section class="map-brief-debt-summary">
            <header><div><span class="field-report-zone-kicker">Cartera de los abonados</span><h3>Deuda asociada</h3></div><strong>${escapeHtml(formatCurrency(totalDebt))}</strong></header>
            ${
              debtRows.length
                ? `<table><thead><tr><th>Clave</th><th>Abonado</th><th>Nombre</th><th>Deuda</th></tr></thead><tbody>${debtRows
                    .map(
                      (item) =>
                        `<tr><td>${escapeHtml(item.clave)}</td><td>${escapeHtml(item.abonado)}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(formatCurrency(item.total))}</td></tr>`
                    )
                    .join("")}</tbody></table>`
                : "<p>No se encontraron abonados del padrón para calcular deuda.</p>"
            }
          </section>` : ""}
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "9mm",
        bodyClassName: "field-report-body map-brief-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapBriefPdf = async ({ sharedKeys: includeSharedKeys = false, debtSummary: includeDebtSummary = false, includedZoneKeys } = {}) => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
        compress: true
      });
      const reportData = getSelectedMapReportData(includedZoneKeys);
      const reportCajaTotal = getSelectedCajaTotal(reportData);
      const { padronNames, sharedKeys, debtRows } = await buildMapReportPadronData(reportData);
      const generatedAt = formatDateTime(new Date().toISOString());
      const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const reportNotes = mapReportSettings.report_notes.trim();
      const sharedAccounts = sharedKeys.reduce((total, item) => total + item.total, 0);
      const totalDebt = debtRows.reduce((total, item) => total + item.total, 0);
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const addPageFooter = () => {
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(83, 103, 122);
        document.text(`Pagina ${currentPage}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 18, 18);
      } catch {
        // Keep the report generation going even if the logo cannot be embedded.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.setTextColor(18, 59, 93);
      document.text(document.splitTextToSize(reportTitle, 152), 36, 15);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.setTextColor(64, 91, 117);
      document.text(reportSubtitle, 36, 24);
      document.text(`Resumen ligero GPS | ${generatedAt}`, 36, 29);

      document.setFillColor(238, 246, 252);
      document.roundedRect(14, 38, 188, 24, 3, 3, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      document.setTextColor(16, 55, 91);
      document.text("Jornada", 20, 46);
      document.text("Puntos", 80, 46);
      document.text("Barrios", 122, 46);
      document.text("Cajas", 164, 46);
      document.setFontSize(13);
      document.text(formatMapDiaryLabel(activeMapDiaryDateKey), 20, 55);
      document.text(String(reportData.totalPoints), 80, 55);
      document.text(String(reportData.totalZones), 122, 55);
      document.text(String(reportCajaTotal), 164, 55);

      const chartRows = getMapReportTypeChartRows(reportData);
      const maxChartValue = Math.max(1, ...chartRows.map(([, total]) => Number(total || 0)));
      document.setFont("helvetica", "bold");
      document.setFontSize(9);
      document.setTextColor(16, 55, 91);
      document.text("Distribucion de puntos", 14, 70);
      chartRows.forEach(([label, total], index) => {
        const rowY = 76 + index * 5;
        document.setFont("helvetica", "normal");
        document.setFontSize(7.5);
        document.setTextColor(45, 75, 101);
        document.text(String(label).slice(0, 25), 14, rowY);
        document.setFillColor(224, 235, 245);
        document.roundedRect(62, rowY - 2.7, 120, 3, 1.5, 1.5, "F");
        document.setFillColor(21, 118, 209);
        document.roundedRect(62, rowY - 2.7, Math.max(4, (Number(total || 0) / maxChartValue) * 120), 3, 1.5, 1.5, "F");
        document.text(String(total), 198, rowY, { align: "right" });
      });

      let currentY = 80 + chartRows.length * 5;
      if (reportNotes) {
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Observaciones", 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.2);
        document.setTextColor(69, 96, 122);
        const noteLines = document.splitTextToSize(reportNotes, 184);
        document.text(noteLines.slice(0, 4), 14, currentY + 5);
        currentY += Math.min(24, noteLines.length * 4 + 10);
      }

      document.setFont("helvetica", "normal");
      document.setFontSize(7.8);
      document.setTextColor(69, 96, 122);
      document.text(`Servicios: ${MAP_REPORT_SERVICE_LEGEND}`, 14, currentY + 2);

      autoTable(document, {
        startY: currentY + 6,
        head: [["#", "Barrio / zona", "Clave / abonado", "Nombre en padron", "Tipo", "Descripcion", "Servicios"]],
        body: buildMapReportBriefRows(reportData, padronNames),
        theme: "grid",
        styles: {
          fontSize: 7.4,
          cellPadding: 1.8,
          textColor: [28, 44, 62],
          overflow: "linebreak"
        },
        headStyles: {
          fillColor: [21, 118, 209],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [248, 251, 255]
        },
        margin: { left: 14, right: 14, bottom: 14 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 25 },
          2: { cellWidth: 24 },
          3: { cellWidth: 30 },
          4: { cellWidth: 20 },
          5: { cellWidth: 50 },
          6: { cellWidth: 31, fontStyle: "bold" }
        }
      });

      let appendixY = (document.lastAutoTable?.finalY ?? 220) + 10;
      if (includeSharedKeys) {
        if (appendixY > 230) {
          document.addPage("letter", "portrait");
          appendixY = 18;
        }
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(16, 55, 91);
        document.text("Abonados que comparten clave catastral", 14, appendixY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        document.text(`${sharedKeys.length} claves agrupan ${sharedAccounts} abonados.`, 14, appendixY + 6);
        if (sharedKeys.length) {
          autoTable(document, {
            startY: appendixY + 10,
            head: [["Clave catastral base", "Abonados", "Nombres", "Total"]],
            body: sharedKeys.map((item) => [item.clave, item.abonados.join(", "), item.nombres.join(", ") || "--", String(item.total)]),
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, textColor: [28, 44, 62] },
            headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 251, 255] },
            margin: { left: 14, right: 14, bottom: 14 },
            columnStyles: {
              0: { cellWidth: 40 },
              1: { cellWidth: 45 },
              2: { cellWidth: 87 },
              3: { cellWidth: 16, halign: "center" }
            }
          });
          appendixY = (document.lastAutoTable?.finalY ?? appendixY + 10) + 10;
        } else {
          document.text("No se detectaron varios abonados con la misma clave catastral base.", 14, appendixY + 12);
          appendixY += 20;
        }
      }

      if (includeDebtSummary) {
        if (appendixY > 225) {
          document.addPage("letter", "portrait");
          appendixY = 18;
        }
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(16, 55, 91);
        document.text("Deuda de los abonados del informe", 14, appendixY);
        document.setFontSize(12);
        document.text(formatCurrency(totalDebt), 202, appendixY, { align: "right" });
        if (debtRows.length) {
          autoTable(document, {
            startY: appendixY + 5,
            head: [["Clave", "Abonado", "Nombre", "Deuda"]],
            body: debtRows.map((item) => [item.clave, item.abonado, item.nombre, formatCurrency(item.total)]),
            theme: "grid",
            styles: { fontSize: 7.8, cellPadding: 1.8, textColor: [28, 44, 62] },
            headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 251, 255] },
            margin: { left: 14, right: 14, bottom: 14 },
            columnStyles: {
              0: { cellWidth: 38 },
              1: { cellWidth: 30 },
              2: { cellWidth: 80 },
              3: { cellWidth: 40, halign: "right", fontStyle: "bold" }
            }
          });
        } else {
          document.setFont("helvetica", "normal");
          document.setFontSize(8.5);
          document.text("No se encontraron abonados del padron para calcular deuda.", 14, appendixY + 7);
        }
      }

      const pageCount = document.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        document.setPage(pageNumber);
        addPageFooter();
      }

      saveReportPdf(document, `resumen-ligero-gps-${activeMapDiaryDateKey || new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Resumen ligero GPS descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el resumen ligero.");
    }
  };

  const handleOpenPointInMaps = (point, event) => {
    event?.stopPropagation();
    const url = buildExternalMapUrl(point.latitude, point.longitude);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyCoordinates = async (point, event) => {
    event?.stopPropagation();

    try {
      await navigator.clipboard.writeText(`${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`);
      showAlert("Coordenadas copiadas.");
    } catch {
      showAlert("No fue posible copiar las coordenadas.");
    }
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

  const openPrintBatchModalForRecords = (targetRecords = [], documentType = "ficha") => {
    const selectedCopies = {};
    targetRecords.forEach((record) => {
      if (!record?.id) return;
      selectedCopies[record.id] = {
        ficha: documentType === "ficha" ? 1 : 0,
        aviso: documentType === "aviso" ? 1 : 0
      };
    });
    setPrintBatchSearch("");
    setPrintBatchQuickFilter(documentType === "aviso" ? "aviso_selected" : "ficha_selected");
    setPrintBatchStatusView("pending");
    setBatchPrintCopies(selectedCopies);
    setShowPrintBatchModal(true);
  };

  const updateBatchPrintCopies = (recordId, documentType, value) => {
    const nextValue = clampPrintCopies(value);
    setBatchPrintCopies((current) => ({
      ...current,
      [recordId]: {
        ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
        aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
        save: Boolean(current[recordId]?.save),
        printed: Boolean(current[recordId]?.printed),
        [documentType]: nextValue
      }
    }));
  };

  const adjustBatchPrintCopies = (recordId, documentType, delta) => {
    setBatchPrintCopies((current) => {
      const currentValue = clampPrintCopies(current[recordId]?.[documentType] ?? 0);
      return {
        ...current,
        [recordId]: {
          ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
          aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
          save: Boolean(current[recordId]?.save),
          printed: Boolean(current[recordId]?.printed),
          [documentType]: clampPrintCopies(currentValue + delta)
        }
      };
    });
  };

  const clearBatchPrintCopies = () => {
    setBatchPrintCopies({});
  };

  const selectVisibleBatchPrintCopies = (documentType) => {
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      filteredPrintBatchRecords.forEach((record) => {
        nextCopies[record.id] = {
          ficha: documentType === "ficha" ? 1 : clampPrintCopies(nextCopies[record.id]?.ficha ?? 0),
          aviso: documentType === "aviso" ? 1 : clampPrintCopies(nextCopies[record.id]?.aviso ?? 0),
          save: Boolean(nextCopies[record.id]?.save),
          printed: Boolean(nextCopies[record.id]?.printed)
        };
      });
      return nextCopies;
    });
  };

  const togglePrintedSaveSelection = (recordId) => {
    setBatchPrintCopies((current) => ({
      ...current,
      [recordId]: {
        ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
        aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
        save: !current[recordId]?.save,
        printed: Boolean(current[recordId]?.printed)
      }
    }));
  };

  const togglePendingPrintedSelection = (recordId) => {
    setBatchPrintCopies((current) => ({
      ...current,
      [recordId]: {
        ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
        aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
        save: Boolean(current[recordId]?.save),
        printed: !current[recordId]?.printed
      }
    }));
  };

  const selectVisiblePrintedForSave = () => {
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      filteredPrintBatchRecords
        .filter((record) => record.estado_padron === "reportada")
        .forEach((record) => {
          nextCopies[record.id] = {
            ficha: clampPrintCopies(nextCopies[record.id]?.ficha ?? 0),
            aviso: clampPrintCopies(nextCopies[record.id]?.aviso ?? 0),
            save: true,
            printed: Boolean(nextCopies[record.id]?.printed)
          };
        });
      return nextCopies;
    });
  };

  const selectVisiblePendingAsPrinted = () => {
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      filteredPrintBatchRecords
        .filter((record) => record.estado_padron !== "reportada")
        .forEach((record) => {
          nextCopies[record.id] = {
            ficha: clampPrintCopies(nextCopies[record.id]?.ficha ?? 0),
            aviso: clampPrintCopies(nextCopies[record.id]?.aviso ?? 0),
            save: Boolean(nextCopies[record.id]?.save),
            printed: true
          };
        });
      return nextCopies;
    });
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
    setDraftSavedAt(null);
    setSelectedFile(null);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_SAVED_AT_STORAGE_KEY);
    focusSheet();
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
  };

  const handleUserFormChange = (event) => {
    const { name, value } = event.target;
    setUserForm((current) => ({ ...current, [name]: value }));
  };

  const handlePadronFileChange = (event) => {
    setPadronFile(event.target.files?.[0] ?? null);
  };

  const handleAlcaldiaFileChange = (event) => {
    setAlcaldiaFile(event.target.files?.[0] ?? null);
  };

  const handleAuditFilterChange = (event) => {
    const { name, value } = event.target;
    setAuditFilters((current) => ({ ...current, [name]: value }));
  };

  const handleAuditFilterClear = (key) => {
    setAuditFilters((current) => ({ ...current, [key]: "" }));
  };

  const handleAuditFiltersReset = () => {
    setAuditFilters(EMPTY_AUDIT_FILTERS);
  };

  const handleAuditReportArchiveShortcut = () => {
    setAuditFilters((current) => ({ ...current, action: "report.generated", entity_type: "report" }));
    setAuditFiltersOpen(true);
  };

  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;
    setPasswordFeedback("");
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    intentionalLogoutRef.current = false;
    setLoginLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(loginForm)
      }).catch(() => {
        throw new Error("No se pudo conectar con la API. Revisa que el backend este disponible.");
      });
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        throw new Error(data.message || "No fue posible iniciar sesión.");
      }

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
      sessionInvalidatingRef.current = false;
      setSessionVerified(true);
      setAuthFx({ mode: "login", text: "Abriendo sesión..." });
      await pause(550);
      setSession(data);
      setShowPasswordModal(Boolean(data?.user?.force_password_change));
      setPasswordFeedback("");
      setPasswordForm({
        current_password: loginForm.password,
        new_password: "",
        confirm_password: ""
      });
      setWorkspaceView(getWorkspaceViewByRole(data?.user?.role));
    } catch (error) {
      showAlert(error.message);
    } finally {
      setAuthFx(null);
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    intentionalLogoutRef.current = true;
    try {
      setAuthFx({ mode: "logout", text: "Cerrando sesión..." });
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // The local session should still be removed even if the request fails.
    } finally {
      await pause(450);
      clearSession();
      // Quien entre despues no debe caer en la ultima vista de esta sesion.
      window.history.replaceState(null, "", "/");
      setAuthFx(null);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordFeedback("");

    if (!passwordForm.current_password.trim()) {
      setPasswordFeedback("Ingresa la contraseña actual.");
      return;
    }

    if (passwordForm.new_password.trim().length < 8) {
      setPasswordFeedback("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordFeedback("La confirmación de la nueva contraseña no coincide.");
      return;
    }

    setChangingPassword(true);

    try {
      const response = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(passwordForm)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo actualizar la contraseña.");
      }

      const nextSession = {
        ...session,
        user: data.user
      };

      setSession(nextSession);
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      setShowPasswordModal(false);
      setPasswordFeedback("");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: ""
      });
      showAlert("Contraseña actualizada correctamente.");
      loadAuditLogs();
    } catch (error) {
      setPasswordFeedback(error.message || "No se pudo actualizar la contraseña.");
      showAlert(error.message || "No se pudo actualizar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUploadPadron = async (event) => {
    event.preventDefault();

    if (!padronFile) {
      showAlert("Selecciona un archivo Excel del padron maestro.");
      return;
    }

    setUploadingPadron(true);

    try {
      const payload = new FormData();
      payload.append("padron", padronFile);

      await runPadronSyncSteps(
        () =>
          apiFetch(`/claves/upload?_padron=${Date.now()}`, {
            method: "POST",
            body: payload
          }),
        (data) => `Padron maestro actualizado con ${data.meta?.total_records ?? 0} claves. Excel verificado al ${data.verification?.verified_percent ?? 0}%.`
      );
      setPadronFile(null);
    } catch (error) {
      updatePadronSyncState({
        status: "error",
        progress: 100,
        message: error.message || "No se pudo actualizar el padron maestro."
      });
      showAlert(error.message || "No se pudo actualizar el padron maestro.");
    } finally {
      setUploadingPadron(false);
    }
  };

  const handleActivatePadronBatch = async () => {
    if (!selectedPadronBatch) {
      showAlert("Selecciona un lote FoxPro.");
      return;
    }
    if (!["LISTO", "PARCIALMENTE_APLICADO", "APLICADO"].includes(selectedPadronBatch.estado)) {
      showAlert(`El lote esta en estado ${selectedPadronBatch.estado} y todavia no puede activarse.`);
      return;
    }
    setConfirmingPadronBatch(selectedPadronBatch);
  };

  const confirmActivatePadronBatch = async () => {
    if (!confirmingPadronBatch) return;

    const batch = confirmingPadronBatch;
    setConfirmingPadronBatch(null);

    setActivatingPadronBatch(true);
    try {
      await runPadronSyncSteps(
        () => apiFetch(`/integracion/foxpro/lotes/${encodeURIComponent(batch.codigo_lote)}/activar`, { method: "POST" }),
        (data) => `Lote ${batch.codigo_lote} activado con ${data.meta?.total_records ?? 0} claves. Cache y consultas anteriores limpiadas.`,
        "lote FoxPro"
      );
      await loadPadronBatches({ silent: true });
    } catch (error) {
      updatePadronSyncState({ status: "error", progress: 100, message: error.message || "No se pudo activar el lote FoxPro." });
      showAlert(error.message || "No se pudo activar el lote FoxPro.");
    } finally {
      setActivatingPadronBatch(false);
    }
  };

  const handleVerifyPadronBatch = async () => {
    if (!selectedPadronBatch) return;
    setVerifyingPadronBatch(true);
    try {
      const response = await apiFetch(`/integracion/foxpro/lotes/${encodeURIComponent(selectedPadronBatch.codigo_lote)}/verificar`);
      const data = await readJsonResponse(response, "La API no devolvio el resultado de la verificacion.");
      if (!response.ok) throw new Error(data.message || "No fue posible verificar el lote.");
      const verification = data.verification;
      updatePadronSyncState({
        status: verification.ok ? "complete" : "error",
        progress: verification.verified_percent,
        message: verification.ok
          ? `Verificado: ${verification.selected_lot} es el padron activo`
          : `No coincide: el padron activo es ${verification.active_lot || "desconocido"}`,
        verification
      });
      showAlert(verification.ok
        ? `Verificacion 100% correcta. El lote ${verification.selected_lot} esta activo con ${verification.active_records.toLocaleString("es-HN")} registros${verification.excluded_invalid_keys ? `; ${verification.excluded_invalid_keys.toLocaleString("es-HN")} filas sin clave valida fueron excluidas` : ""}.`
        : `El lote seleccionado no coincide completamente con el padron activo. Coincidencia: ${verification.verified_percent}%.`);
    } catch (error) {
      showAlert(error.message || "No fue posible verificar el lote.");
    } finally {
      setVerifyingPadronBatch(false);
    }
  };

  const handleUploadAlcaldia = async (event) => {
    event.preventDefault();

    if (!alcaldiaFile) {
      showAlert("Selecciona un archivo Excel del padron de alcaldia.");
      return;
    }

    setUploadingAlcaldia(true);
    let progressTimer = null;
    updateAlcaldiaSyncState({
      status: "running",
      progress: 8,
      message: "Iniciando reemplazo del padron de alcaldia"
    });
    clearClientPadronCaches();
    updateAlcaldiaSyncState({ progress: 24, message: "Cache local y comparativas anteriores borradas" });
    progressTimer = window.setInterval(() => {
      setAlcaldiaSyncState((current) => {
        if (current.status !== "running" || current.progress >= 68) return current;
        return {
          ...current,
          progress: Math.min(68, current.progress + 4),
          message: current.progress >= 48 ? "Verificando columnas y claves catastrales" : "Reemplazando data de alcaldia en consultas"
        };
      });
    }, 420);

    try {
      const payload = new FormData();
      payload.append("padron", alcaldiaFile);

      const response = await apiFetch("/claves/alcaldia/upload", {
        method: "POST",
        body: payload
      });
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo actualizar el padron de alcaldia.");
      }

      updateAlcaldiaSyncState({ progress: 72, message: "Data de alcaldia reemplazada en el sistema" });
      applyAlcaldiaSyncResult(data);
      setAlcaldiaFile(null);
      clearPadronDerivedState();
      setDashboardLastUpdatedAt(Date.now());
      showAlert(`Padron de alcaldia actualizado con ${data.meta?.total_records ?? 0} claves.`);
    } catch (error) {
      updateAlcaldiaSyncState({
        status: "error",
        progress: 100,
        message: error.message || "No se pudo actualizar el padron de alcaldia."
      });
      showAlert(error.message || "No se pudo actualizar el padron de alcaldia.");
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setUploadingAlcaldia(false);
    }
  };

  const handleReprocessPadron = async () => {
    setReprocessingPadron(true);

    try {
      await runPadronSyncSteps(
        () =>
          apiFetch(`/claves/sync?_padron=${Date.now()}`, {
            method: "POST"
          }),
        (data) => `Padron maestro sincronizado con ${data.meta?.total_records ?? 0} claves. Verificacion global ${data.verification?.verified_percent ?? 0}%.`
      );
    } catch (error) {
      updatePadronSyncState({
        status: "error",
        progress: 100,
        message: error.message || "No se pudo reprocesar el padron maestro."
      });
      showAlert(error.message || "No se pudo reprocesar el padron maestro.");
    } finally {
      setReprocessingPadron(false);
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: "500" });
      Object.entries(auditFilters).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          params.set(key, String(value).trim());
        }
      });

      const response = await apiFetch(`/users/audit-logs/export?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "No se pudo exportar la bitacora.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bitacora-auditoria.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAlert(error.message || "No se pudo exportar la bitacora.");
    }
  };

  // Baja un Excel del API respetando el nombre que manda el servidor.
  const downloadExcelFile = async (path, { fallbackName, errorMessage }) => {
    const response = await apiFetch(path);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || errorMessage);
    }

    const blob = await response.blob();
    const contentType = response.headers.get("Content-Type") || blob.type || "";
    const isExcelResponse =
      contentType.includes("spreadsheet") ||
      contentType.includes("vnd.ms-excel") ||
      contentType.includes("octet-stream");

    if (!isExcelResponse) {
      const message = await blob.text().catch(() => "");
      throw new Error(
        message.includes("<!doctype") || message.includes("<html")
          ? "El servidor devolvio una pagina web en lugar del padron. Revisa la URL del API configurada."
          : "El servidor no devolvio un archivo Excel valido."
      );
    }

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);

    link.href = downloadUrl;
    link.download = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleDownloadPadron = async () => {
    setDownloadingPadron(true);
    try {
      await downloadExcelFile("/claves/download", {
        fallbackName: `padron-maestro-${new Date().toISOString().slice(0, 10)}.xlsx`,
        errorMessage: "No se pudo descargar el padron maestro."
      });
      showAlert("Descarga del padron iniciada.");
    } catch (error) {
      showAlert(error.message || "No se pudo descargar el padron maestro.");
    } finally {
      setDownloadingPadron(false);
    }
  };

  const handleDownloadPadronBatch = async () => {
    if (!selectedPadronBatch) return;
    setDownloadingPadronBatch(true);
    try {
      await downloadExcelFile(`/integracion/foxpro/lotes/${encodeURIComponent(selectedPadronBatch.codigo_lote)}/excel`, {
        fallbackName: `padron-${selectedPadronBatch.codigo_lote}.xlsx`,
        errorMessage: "No se pudo descargar el lote en Excel."
      });
      showAlert(`Descarga del lote ${selectedPadronBatch.codigo_lote} en Excel iniciada.`);
    } catch (error) {
      showAlert(error.message || "No se pudo descargar el lote en Excel.");
    } finally {
      setDownloadingPadronBatch(false);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setCreatingUser(true);

    try {
      const response = await apiFetch("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(userForm)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo crear el usuario.");
      }

      setLatestUserResult(data);
      setSelectedUserId(data.user?.id ?? null);
      setUserForm({
        full_name: "",
        email: "",
        role: "operator"
      });
      showAlert("Usuario creado satisfactoriamente.");
      loadUsers();
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo crear el usuario.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!user?.id) return;

    try {
      const response = await apiFetch(`/users/${user.id}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo eliminar el usuario.");
      }

      setUsers((current) => current.filter((item) => item.id !== user.id));
      setSelectedUserId((current) => (current === user.id ? null : current));
      if (latestUserResult?.user?.id === user.id) {
        setLatestUserResult(null);
      }
      setPendingDeleteUser(null);
      showAlert(`Usuario ${user.username} eliminado.`);
      loadUsers();
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo eliminar el usuario.");
    }
  };

  const handleResetUserPassword = async (user) => {
    if (!user?.id) return;

    try {
      const response = await apiFetch(`/users/${user.id}/reset-password`, {
        method: "POST"
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo regenerar la contrasena temporal.");
      }

      setLatestUserResult(data);
      setSelectedUserId(data.user?.id ?? user.id);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                ...data.user
              }
            : item
        )
      );
      showAlert(`Se genero una nueva contrasena temporal para ${data.user?.username || user.username}.`);
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo regenerar la contrasena temporal.");
    }
  };

  const handleUpdateUserRole = async (user, role) => {
    if (!user?.id || !role || user.role === role) return;

    setSavingUserRoleId(user.id);

    try {
      const response = await apiFetch(`/users/${user.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo cambiar el perfil del usuario.");
      }

      setUsers((current) => current.map((item) => (item.id === data.id ? { ...item, ...data } : item)));
      if (latestUserResult?.user?.id === data.id) {
        setLatestUserResult((current) => ({
          ...current,
          user: {
            ...current.user,
            ...data
          }
        }));
      }
      setSelectedUserId(data.id);
      showAlert(`Perfil de ${data.username} actualizado a ${roleLabel(data.role)}.`);
      loadUsers({ silent: true });
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo cambiar el perfil del usuario.");
    } finally {
      setSavingUserRoleId(null);
    }
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

  const buildFichaPrintDocument = async (recordOverride = null) => {
    const targetRecord = recordOverride ? { ...emptyForm, ...normalizeRecord(recordOverride) } : form;
    let photoMarkup = "";
    let alcaldiaFichaMatch = null;
    let alcaldiaSearchMode = "";
    const visibleClaveInput = document.querySelector('input[name="clave_catastral"]')?.value?.trim() || "";
    const recordClaveCatastral = String(targetRecord.clave_catastral || visibleClaveInput || "").trim();

    try {
      if (!recordOverride && selectedFile) {
        const dataUrl = await fileToDataUrl(selectedFile);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      } else if (!recordOverride && selectedPhotoUrl) {
        const dataUrl = await urlToDataUrl(selectedPhotoUrl);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      } else if (recordOverride?.foto_path) {
        const dataUrl = await urlToDataUrl(buildPhotoUrl(recordOverride.foto_path, recordOverride.updated_at || Date.now()));
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      }
    } catch (_error) {
      showAlert("La ficha se imprimira sin foto porque no fue posible cargarla a tiempo.");
    }

    const fetchAlcaldiaMatches = async (query, field = "clave") => {
      if (!String(query ?? "").trim()) return [];
      const response = await apiFetch(
        `/claves/alcaldia/search?field=${encodeURIComponent(field)}&clave=${encodeURIComponent(query)}`
      );
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.matches) ? data.matches : [];
    };

    if (recordClaveCatastral) {
      try {
        const matches = await fetchAlcaldiaMatches(recordClaveCatastral, "clave");
        alcaldiaFichaMatch = matches[0] ?? null;
        alcaldiaSearchMode = alcaldiaFichaMatch ? "clave" : "";
      } catch {
        alcaldiaFichaMatch = null;
      }
    }

    if (!alcaldiaFichaMatch) {
      const textCandidates = [
        targetRecord.nombre_catastral,
        targetRecord.inquilino,
        targetRecord.identidad,
        getRecordBarrioName(targetRecord, "")
      ]
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length >= 3 && value !== "--");

      for (const candidate of textCandidates) {
        try {
          const matches = await fetchAlcaldiaMatches(candidate, "texto");
          alcaldiaFichaMatch =
            matches.find((item) => !item.exists_in_aguas) ??
            matches.find((item) =>
              normalizeRecord({ nombre_catastral: item.nombre }).nombre_catastral
                ?.toLowerCase()
                .includes(candidate.toLowerCase())
            ) ??
            matches[0] ??
            null;
          if (alcaldiaFichaMatch) {
            alcaldiaSearchMode = "nombre/barrio";
            break;
          }
        } catch {
          alcaldiaFichaMatch = null;
        }
      }
    }

    const aguasMatchKey = alcaldiaFichaMatch?.aguas_matches?.[0]?.clave_catastral || "";
    const hasAguasPadronMatch = Boolean(alcaldiaFichaMatch?.exists_in_aguas || targetRecord.estado_padron === "varios_padrones");
    const fichaClaveAguas = hasAguasPadronMatch
      ? aguasMatchKey || recordClaveCatastral || alcaldiaFichaMatch?.clave_aguas_formato || "--"
      : "No registrada en Aguas";
    const fichaClaveAlcaldia = targetRecord.clave_alcaldia || alcaldiaFichaMatch?.clave_catastral || (!hasAguasPadronMatch ? recordClaveCatastral : "--");
    const fichaNombre = targetRecord.nombre_alcaldia || alcaldiaFichaMatch?.nombre || targetRecord.nombre_catastral || targetRecord.inquilino || "--";
    const fichaBarrio = getRecordBarrioName(targetRecord, "") || targetRecord.barrio_alcaldia || alcaldiaFichaMatch?.caserio || alcaldiaFichaMatch?.direccion || "--";
    const alcaldiaBarrio = targetRecord.barrio_alcaldia || alcaldiaFichaMatch?.caserio || alcaldiaFichaMatch?.direccion || "--";
    const fichaDireccion = alcaldiaFichaMatch?.direccion || targetRecord.barrio_alcaldia || getRecordBarrioName(targetRecord, "") || "--";
    const estadoPadronLabel = targetRecord.estado_padron === "reportada"
      ? "Reportada"
      : targetRecord.estado_padron === "varios_padrones" || alcaldiaFichaMatch?.exists_in_aguas
        ? "En varios padrones"
        : "Clandestina";
    const estadoPadronClass = estadoPadronLabel === "Clandestina" ? "is-clandestine" : "is-matched";
    const alcaldiaStatus = alcaldiaFichaMatch
      ? alcaldiaFichaMatch.exists_in_aguas
        ? "Aparece en ambos padrones"
        : "Clandestino: aparece en Alcaldia y no en Aguas"
      : targetRecord.estado_padron === "reportada"
        ? "Clandestino procesada y enviada a reportadas"
      : targetRecord.estado_padron === "varios_padrones"
        ? "Aparece en varios padrones"
        : "Sin coincidencia en Alcaldia";

    return {
      title: `Ficha ${fichaClaveAlcaldia !== "--" ? fichaClaveAlcaldia : fichaClaveAguas}`,
      body: `
        <div class="print-ficha-compact-header">
          <div class="print-ficha-brand">
            <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
            <div>
              <p>Aguas de Choluteca, S.A. de C.V.</p>
              <h2 class="print-title">Ficha Tecnica Catastral</h2>
              <span>Barrio El Centro Antiguo Local de Cooperativa Guadalupe · Tel: 2782-5075</span>
            </div>
          </div>
          <div class="print-key-grid">
            <div class="print-key"><strong>Clave Aguas de Choluteca</strong><span>${escapeHtml(fichaClaveAguas)}</span></div>
            <div class="print-key"><strong>Clave Alcaldia</strong><span>${escapeHtml(fichaClaveAlcaldia)}</span></div>
          </div>
        </div>
        <section class="print-clandestine-band ${estadoPadronClass}">
          <div>
            <strong>${escapeHtml(estadoPadronLabel)}</strong>
            <span>${escapeHtml(alcaldiaStatus)} - Busqueda por ${escapeHtml(alcaldiaSearchMode || "clave/nombre")}</span>
          </div>
          <div>
            <strong>${escapeHtml(fichaNombre)}</strong>
            <span>${escapeHtml(fichaBarrio)}</span>
          </div>
        </section>
        <div class="print-layout">
          <div class="print-top-layout">
            <div class="print-main-column">
              <section class="print-section print-section-feature">
                <h3>Resumen de padrones</h3>
                <div class="print-summary-grid">
                  <div><strong>Nombre Alcaldia</strong><span>${escapeHtml(fichaNombre)}</span></div>
                  <div><strong>Barrio ficha</strong><span>${escapeHtml(fichaBarrio)}</span></div>
                  <div><strong>Barrio Alcaldia</strong><span>${escapeHtml(alcaldiaBarrio)}</span></div>
                  <div><strong>Direccion</strong><span>${escapeHtml(fichaDireccion)}</span></div>
                  <div><strong>Identificador</strong><span>${escapeHtml(alcaldiaFichaMatch?.identificador || targetRecord.identidad || "--")}</span></div>
                  <div><strong>Estado</strong><span>${escapeHtml(estadoPadronLabel)}</span></div>
                </div>
              </section>
              <section class="print-section">
                <h3>Datos principales</h3>
                <div class="print-data-grid">
                  <div><strong>Abonado</strong><span>${escapeHtml(targetRecord.abonado || "--")}</span></div>
                  <div><strong>Catastral/Ficha</strong><span>${escapeHtml(targetRecord.nombre_catastral || fichaNombre)}</span></div>
                  <div><strong>Inquilino</strong><span>${escapeHtml(targetRecord.inquilino || "--")}</span></div>
                  <div><strong>Identidad</strong><span>${escapeHtml(targetRecord.identidad || alcaldiaFichaMatch?.identificador || "--")}</span></div>
                  <div><strong>Telefono</strong><span>${escapeHtml(targetRecord.telefono || "--")}</span></div>
                  <div><strong>Sector</strong><span>${escapeHtml(targetRecord.codigo_sector || alcaldiaFichaMatch?.codigo_caserio || "--")}</span></div>
                </div>
              </section>
              <section class="print-section">
                <h3>Identificacion del inmueble</h3>
                <p class="print-note">${escapeHtml(targetRecord.accion_inspeccion || "--")}</p>
              </section>
              <section class="print-section">
                <h3>Datos del inmueble</h3>
                <div class="print-data-grid is-four">
                  <div><strong>Situacion</strong><span>${escapeHtml(targetRecord.situacion_inmueble || "--")}</span></div>
                  <div><strong>Tendencia</strong><span>${escapeHtml(targetRecord.tendencia_inmueble || "--")}</span></div>
                  <div><strong>Uso del suelo</strong><span>${escapeHtml(targetRecord.uso_suelo || alcaldiaFichaMatch?.naturaleza || "--")}</span></div>
                  <div><strong>Actividad</strong><span>${escapeHtml(targetRecord.actividad || "--")}</span></div>
                  <div><strong>Codigo sector</strong><span>${escapeHtml(targetRecord.codigo_sector || alcaldiaFichaMatch?.codigo_caserio || "--")}</span></div>
                  <div class="is-wide"><strong>Comentarios</strong><span>${escapeHtml(targetRecord.comentarios || (alcaldiaFichaMatch && !alcaldiaFichaMatch.exists_in_aguas ? "Clandestino" : "--"))}</span></div>
                </div>
              </section>
              <section class="print-section">
                <h3>Datos de los servicios</h3>
                <div class="print-service-row">
                  <div><strong>Agua potable</strong><span>${escapeHtml(targetRecord.conexion_agua || "--")}</span></div>
                  <div><strong>Alcantarillado</strong><span>${escapeHtml(targetRecord.conexion_alcantarillado || "--")}</span></div>
                  <div><strong>Desechos</strong><span>${escapeHtml(targetRecord.recoleccion_desechos || "--")}</span></div>
                </div>
              </section>
            </div>
            <div class="print-side-column">
              <section class="print-section">
                <h3>Fotografia del inmueble</h3>
                <div class="print-photo-panel">
                  ${photoMarkup || '<div class="print-field"><strong>Fotografia</strong>Sin fotografia registrada.</div>'}
                </div>
              </section>
            </div>
          </div>
          <section class="print-section">
            <h3>Responsables</h3>
            <div class="print-roles">
              <div class="print-signature-line">
                <strong>${targetRecord.levantamiento_datos || "--"}</strong><br />
                LEVANTAMIENTO DE DATOS
              </div>
              <div class="print-signature-line">
                <strong>${targetRecord.analista_datos || "--"}</strong><br />
                ANALISTA DE DATOS
              </div>
            </div>
          </section>
        </div>
      `,
      options: {
        bodyClassName: "print-ficha",
        pageSize: "Letter landscape",
        pageMargin: "8mm 8mm 8mm 12mm",
        windowFeatures: "width=1400,height=900"
      }
    };
  };

  const handlePrintFicha = async (recordOverride = null) => {
    const document = await buildFichaPrintDocument(recordOverride);
    const printResult = await printDocument(document.title, document.body, document.options);
    const targetRecord = recordOverride || form;
    if (printResult?.printed && targetRecord?.id) {
      await markBatchFichaRecordsAsPrinted([{ record: targetRecord, ficha: 1, aviso: 0 }]);
      setPrintBatchStatusView("printed");
      showAlert(`Ficha ${targetRecord.clave_catastral || ""} impresa y retirada de alertas.`);
    }
  };

  const buildAvisoPrintMarkup = (record = form) => {
    const targetRecord = { ...emptyForm, ...normalizeRecord(record) };
    const fecha = targetRecord.fecha_aviso ? formatSpanishDate(targetRecord.fecha_aviso) : "__________";
    const barrio = getRecordBarrioName(targetRecord, "__________");
    const clave = targetRecord.clave_catastral || "__________";
    const firmante = targetRecord.firmante_aviso || "Jefatura de Comercializacion";
    const cargo = targetRecord.cargo_firmante || "Aguas de Choluteca";
    const destinatario = targetRecord.aviso_destinatario || targetRecord.abonado || targetRecord.inquilino || targetRecord.nombre_catastral || "Señor(a)";
    const plazoDias = Math.max(1, Math.min(90, Number(targetRecord.aviso_plazo_dias) || 7));
    const fechaLimite = targetRecord.fecha_limite_aviso ? formatSpanishDate(targetRecord.fecha_limite_aviso) : "";
    const plazoTexto = fechaLimite
      ? `a más tardar el ${escapeHtml(fechaLimite)}`
      : `en un plazo máximo de ${plazoDias} (${plazoDias}) días calendario a partir de la recepción del presente aviso`;
    const instrucciones = String(targetRecord.aviso_instrucciones || "").trim();

    return `
      <div class="print-header"><img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" /></div>
      <section class="aviso">
        <div class="aviso-header">
          <p><strong>AGUAS DE CHOLUTECA</strong></p>
          <p>Departamento de Comercialización</p>
        </div>
        <h2 class="aviso-title">AVISO IMPORTANTE AL ABONADO</h2>
        <p class="aviso-date">Fecha: Choluteca, ${escapeHtml(fecha)}</p>
        <p class="aviso-saludo">Estimado(a) ${escapeHtml(destinatario)}:</p>
        <p class="aviso-body">
          Por medio de la presente, se le informa que, como resultado del reciente levantamiento de información realizado por la Unidad Técnica de Catastro, se ha identificado que el inmueble ubicado en ${escapeHtml(barrio)}, con Clave Catastral ${escapeHtml(clave)}, no se encuentra registrado en la base de datos de la empresa, pese a contar con servicios activos.
        </p>
        <p class="aviso-body">
          Con el propósito de regularizar su situación, evitar circunstancias legales y establecer un acuerdo acorde al caso, se le solicita presentarse al Departamento de Comercialización de Aguas de Choluteca ${plazoTexto}, debiendo presentar la siguiente documentación:
        </p>
        <ul class="aviso-list">
          <li>Copia de Escritura pública del inmueble.</li>
          <li>Copia de Constancia Catastral vigente.</li>
          <li>Copia de Documento Nacional de Identificación (DNI).</li>
          <li>Constancia de solvencia municipal.</li>
        </ul>
        ${instrucciones ? `<p class="aviso-body"><strong>Indicación adicional:</strong><br />${escapeHtml(instrucciones).replace(/\n/g, "<br />")}</p>` : ""}
        <p class="aviso-body">
          En caso de no presentarse dentro del plazo indicado, la empresa procederá conforme a los lineamientos administrativos establecidos por la ley que implican recargos y multas.
        </p>
        <p class="aviso-body">Sin otro particular, agradecemos su pronta colaboración.</p>
        <p class="aviso-body">Atentamente,</p>
        <div class="aviso-signature">
          <p><strong>${escapeHtml(firmante)}</strong></p>
          <p>${escapeHtml(cargo)}</p>
          <p>Aguas de Choluteca</p>
        </div>
        <p class="aviso-copy">C.c. Archivo</p>
      </section>
    `;
  };

  const markBatchFichaRecordsAsPrinted = async (entries) => {
    const recordsToMove = entries
      .filter((item) => item.ficha > 0 && item.record?.id)
      .map((item) => item.record);

    if (!recordsToMove.length) return 0;

    const movedIds = new Set(recordsToMove.map((record) => record.id));
    const optimisticRecords = recordsToMove.map((record) =>
      normalizeRecord({
        ...record,
        estado_padron: "reportada",
        printed_at: record.printed_at || new Date().toISOString(),
        comentarios: record.comentarios || "Ficha impresa desde impresion rapida"
      })
    );
    const optimisticById = new Map(optimisticRecords.map((record) => [record.id, record]));

    setRecords((current) =>
      current.map((record) => (optimisticById.has(record.id) ? optimisticById.get(record.id) : record))
    );
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      movedIds.forEach((id) => {
        delete nextCopies[id];
      });
      return nextCopies;
    });

    if (movedIds.has(form.id)) {
      const updatedForm = optimisticById.get(form.id);
      if (updatedForm) {
        setForm({ ...emptyForm, ...updatedForm });
      }
    }

    const updatedRecords = await Promise.all(
      optimisticRecords.map(async (record) => {
        const response = await apiFetch(`/inmuebles/${record.id}/mark-printed`, {
          method: "POST"
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || `No se pudo mover la ficha ${record.clave_catastral}.`);
        }

        return normalizeRecord(data);
      })
    );
    const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));

    setRecords((current) =>
      current.map((record) => (updatedById.has(record.id) ? updatedById.get(record.id) : record))
    );
    if (updatedById.has(form.id)) {
      setForm({ ...emptyForm, ...updatedById.get(form.id) });
    }

    return updatedRecords.length;
  };

  const handleMoveSelectedFichasToPrinted = async () => {
    const manualEntries = manualPrintedSelection.entries.map((record) => ({ record, ficha: 1, aviso: 0 }));
    const entriesToMove = [
      ...batchPrintSelection.entries.filter((item) => item.ficha > 0),
      ...manualEntries.filter(
        (manualItem) => !batchPrintSelection.entries.some((item) => item.record.id === manualItem.record.id && item.ficha > 0)
      )
    ];

    if (!entriesToMove.length) {
      showAlert("Selecciona fichas o marca las que ya fueron impresas.");
      return;
    }

    setBatchPrinting(true);
    try {
      const movedCount = await markBatchFichaRecordsAsPrinted(entriesToMove);
      setPrintBatchStatusView("printed");
      showAlert(`${movedCount} fichas pasaron a impresas.`);
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible mover las fichas seleccionadas.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const handleMarkSelectedAlertsAsPrinted = async () => {
    const entriesToMove = manualPrintedSelection.entries.map((record) => ({ record, ficha: 1, aviso: 0 }));
    if (!entriesToMove.length) {
      showAlert("Marca al menos una ficha como ya impresa.");
      return;
    }

    setBatchPrinting(true);
    try {
      const movedCount = await markBatchFichaRecordsAsPrinted(entriesToMove);
      setShowDashboardAlertsModal(false);
      setPrintBatchStatusView("printed");
      showAlert(`${movedCount} fichas pasaron a impresas sin reimprimir.`);
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible marcar las fichas como impresas.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const handleSaveSelectedPrintedRecords = async () => {
    if (!printedSaveSelection.total) {
      showAlert("Marca al menos una ficha impresa para enviarla a guardadas.");
      return;
    }

    setBatchPrinting(true);
    try {
      const selectedRecords = printedSaveSelection.entries;
      await Promise.all(
        selectedRecords.map(async (record) => {
          const response = await apiFetch(`/inmuebles/${record.id}/archive`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ archived_reason: "Ficha impresa enviada a guardadas" })
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || `No se pudo guardar la ficha ${record.clave_catastral}.`);
          }

          return normalizeRecord(data);
        })
      );

      const savedIds = new Set(selectedRecords.map((record) => record.id));
      setRecords((current) => current.filter((record) => !savedIds.has(record.id)));
      setBatchPrintCopies((current) => {
        const nextCopies = { ...current };
        savedIds.forEach((id) => {
          delete nextCopies[id];
        });
        return nextCopies;
      });
      if (savedIds.has(form.id)) {
        setForm(emptyForm);
      }
      showAlert(`${selectedRecords.length} fichas impresas pasaron a guardadas.`);
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible enviar las fichas impresas a guardadas.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const handlePrintBatch = async () => {
    if (!batchPrintSelection.fichas && !batchPrintSelection.avisos) {
      showAlert("Selecciona al menos una ficha o aviso para imprimir.");
      return;
    }

    setBatchPrinting(true);
    setShowPrintBatchModal(false);

    try {
      let movedCount = 0;
      const fichaPages = [];
      for (const item of batchPrintSelection.entries) {
        for (let copy = 0; copy < item.ficha; copy += 1) {
          const fichaDocument = await buildFichaPrintDocument(item.record);
          fichaPages.push(`<section class="print-batch-page">${fichaDocument.body}</section>`);
        }
      }

      if (fichaPages.length) {
        const printResult = await printDocument(`Lote de fichas (${fichaPages.length})`, fichaPages.join(""), {
          bodyClassName: "print-ficha",
          pageSize: "Letter landscape",
          pageMargin: "8mm 8mm 8mm 12mm",
          windowFeatures: "width=1400,height=900"
        });

        if (!printResult?.printed) {
          showAlert("Vista previa cerrada. Las fichas no se movieron a reportadas.");
          return;
        }

        movedCount = await markBatchFichaRecordsAsPrinted(batchPrintSelection.entries);
        if (movedCount) {
          setPrintBatchStatusView("printed");
        }
      }

      const avisoPages = [];
      for (const item of batchPrintSelection.entries) {
        for (let copy = 0; copy < item.aviso; copy += 1) {
          avisoPages.push(`<section class="print-batch-page">${buildAvisoPrintMarkup(item.record)}</section>`);
        }
      }

      if (avisoPages.length) {
        await printDocument(`Lote de avisos (${avisoPages.length})`, avisoPages.join(""), {
          pageSize: "Letter portrait",
          pageMargin: "10mm",
          windowFeatures: "width=980,height=1200"
        });
      }

      showAlert(
        movedCount
          ? `Lote impreso: ${batchPrintSelection.fichas} fichas y ${batchPrintSelection.avisos} avisos. ${movedCount} fichas pasaron a reportadas.`
          : `Lote preparado: ${batchPrintSelection.fichas} fichas y ${batchPrintSelection.avisos} avisos.`
      );
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible preparar el lote de impresion.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const handlePrintAguasComparisonList = async (recordsToPrint = overdueComparisonRecords) => {
    const rows = recordsToPrint.filter(Boolean);
    if (!rows.length) {
      showAlert("No hay fichas vencidas para comparar e imprimir.");
      return;
    }

    setPrintingComparison(true);
    try {
      let comparisonByClave = alcaldiaComparisonByClave;
      if (!alcaldiaComparison?.summary) {
        const comparisonData = await loadAlcaldiaComparison({ silent: true }).catch(() => null);
        const comparisonRows = [
          ...(comparisonData?.candidates || []),
          ...(comparisonData?.matched_by_base || []),
          ...(comparisonData?.matched_exact || [])
        ];
        if (comparisonRows.length) {
          comparisonByClave = comparisonRows.reduce((map, row) => {
            [row.clave_catastral, row.clave_aguas_formato].forEach((key) => {
              const cleanKey = String(key || "").trim();
              if (cleanKey && !map.has(cleanKey)) {
                map.set(cleanKey, row);
              }
            });
            return map;
          }, new Map());
        }
      }

      const generatedAt = formatDashboardSyncDate(Date.now());
      const headerKicker = String(printComparisonHeader.kicker || "").trim() || "Lista de fichas vencidas";
      const headerTitle = String(printComparisonHeader.title || "").trim() || "Comparacion contra Aguas";
      const headerNote = String(printComparisonHeader.note || "").trim();
      setShowPrintComparisonModal(false);
      const printResult = await printDocument(
        `${headerTitle} (${rows.length})`,
        `
        <style>
          .comparison-print-body {
            margin: 0;
            color: #111827;
            font-family: Arial, sans-serif;
            background: #fff;
          }
          .comparison-print-sheet {
            display: grid;
            gap: 9px;
            padding: 2px;
          }
          .comparison-print-head {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            align-items: start;
            border: 1px solid #bfdbfe;
            border-left: 6px solid #1d4ed8;
            border-radius: 10px;
            background: #eff6ff;
            padding: 10px 12px;
          }
          .comparison-print-head span {
            display: block;
            color: #1d4ed8;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .comparison-print-head h1 {
            margin: 2px 0 3px;
            color: #0f172a;
            font-size: 18px;
            line-height: 1.1;
          }
          .comparison-print-head p {
            margin: 0;
            color: #475569;
            font-size: 10px;
          }
          .comparison-print-count {
            align-self: center;
            border-radius: 999px;
            background: #1d4ed8;
            color: #fff;
            padding: 5px 9px;
            font-size: 11px;
            white-space: nowrap;
          }
          .comparison-print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .comparison-print-table th,
          .comparison-print-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            text-align: left;
            vertical-align: top;
            font-size: 10px;
            line-height: 1.25;
            word-break: break-word;
          }
          .comparison-print-table th {
            background: #dbeafe;
            color: #1e3a8a;
            font-size: 8px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }
          .comparison-print-table tr:nth-child(even) td {
            background: #f8fafc;
          }
          .comparison-print-table .is-missing {
            color: #b91c1c;
            font-weight: 700;
          }
          .comparison-print-table .is-found {
            color: #166534;
            font-weight: 700;
          }
          .comparison-print-status {
            display: inline-block;
            border-radius: 999px;
            background: #fee2e2;
            color: #b91c1c;
            font-size: 9px;
            font-weight: 700;
            line-height: 1;
            padding: 4px 7px;
            white-space: nowrap;
          }
        </style>
        <section class="comparison-print-sheet">
          <header class="comparison-print-head">
            <div>
              <span>${escapeHtml(headerKicker)}</span>
              <h1>${escapeHtml(headerTitle)}</h1>
              <p>${escapeHtml(headerNote ? `${headerNote} | Generado: ${generatedAt}` : `Generado: ${generatedAt}`)}</p>
            </div>
            <strong class="comparison-print-count">${rows.length} fichas</strong>
          </header>
          <table class="comparison-print-table">
            <thead>
              <tr>
                <th>Clave catastral</th>
                <th>Nombre</th>
                <th>Barrio</th>
                <th>Fecha ficha</th>
                <th>Estado</th>
                <th>Aguas</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((record) => {
                  const alcaldiaMatch = comparisonByClave.get(String(record.clave_catastral || "").trim()) || null;
                  const aguasLabel = getRecordAguasPresenceLabel(record);
                  const aguasClass = aguasLabel === "Si aparece en Aguas" ? "is-found" : "is-missing";
                  return `
                    <tr>
                      <td>${escapeHtml(record.clave_catastral || "--")}</td>
                      <td>${escapeHtml(getRecordDisplayName(record, alcaldiaMatch))}</td>
                      <td>${escapeHtml(getRecordBarrioName(record, "") || record.barrio_alcaldia || alcaldiaMatch?.caserio || alcaldiaMatch?.direccion || "--")}</td>
                      <td>${escapeHtml(getRecordFichaDateLabel(record))}</td>
                      <td><span class="comparison-print-status">Vencida</span></td>
                      <td class="${aguasClass}">${escapeHtml(aguasLabel)}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </section>
      `,
      {
        bodyClassName: "comparison-print-body",
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        windowFeatures: "width=980,height=1200"
      }
      );
      if (!printResult?.printed) {
        showAlert("Vista previa cerrada. La lista comparativa no se marco como impresa.");
        return;
      }

      const movedCount = await markBatchFichaRecordsAsPrinted(rows.map((record) => ({ record, ficha: 1, aviso: 0 })));
      showAlert(
        movedCount
          ? `Lista comparativa impresa. ${movedCount} fichas salieron de alertas y pasaron a impresas.`
          : "Lista comparativa impresa."
      );
    } catch (error) {
      showAlert(error.message || "No fue posible preparar la lista comparativa.");
    } finally {
      setPrintingComparison(false);
    }
  };

  const handleDownloadExecutiveReportPdf = async () => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter"
      });
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const marginX = 14;
      let y = 16;
      const addFooter = () => {
        const pageCount = document.internal.getNumberOfPages();
        for (let page = 1; page <= pageCount; page += 1) {
          document.setPage(page);
          document.setFontSize(8);
          document.setTextColor(96, 116, 134);
          document.text("Aguas de Choluteca - Resumen de Operaciones realizadas", marginX, pageHeight - 8);
          document.text(`Página ${page} de ${pageCount}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
        }
      };
      const ensureSpace = (needed = 24) => {
        if (y + needed > pageHeight - 18) {
          document.addPage();
          y = 16;
        }
      };
      const sectionTitle = (title) => {
        ensureSpace(14);
        document.setFont("helvetica", "bold");
        document.setFontSize(13);
        document.setTextColor(18, 59, 93);
        document.text(title, marginX, y);
        y += 7;
      };
      const addReportPage = (title, subtitle = "") => {
        document.addPage();
        y = 16;
        document.setFont("helvetica", "bold");
        document.setFontSize(15);
        document.setTextColor(18, 59, 93);
        document.text(title, marginX, y);
        y += 7;
        if (subtitle) {
          document.setFont("helvetica", "normal");
          document.setFontSize(9);
          document.setTextColor(84, 113, 139);
          document.text(document.splitTextToSize(subtitle, pageWidth - marginX * 2), marginX, y);
          y += 12;
        }
      };
      const drawBarChart = (title, rows, options = {}) => {
        const chartRows = rows.slice(0, options.limit ?? 10);
        const chartHeight = options.height ?? 72;
        const chartWidth = pageWidth - marginX * 2;
        const labelWidth = options.labelWidth ?? 54;
        const barWidth = chartWidth - labelWidth - 20;
        const rowHeight = chartHeight / Math.max(chartRows.length, 1);
        const maxValue = Math.max(...chartRows.map((item) => Number(item.total || item.value || 0)), 1);

        ensureSpace(chartHeight + 18);
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(18, 59, 93);
        document.text(title, marginX, y);
        y += 7;

        chartRows.forEach((item, index) => {
          const rawValue = Number(item.total || item.value || 0);
          const barLength = Math.max(2, (rawValue / maxValue) * barWidth);
          const rowY = y + index * rowHeight;
          document.setFont("helvetica", "normal");
          document.setFontSize(7.2);
          document.setTextColor(64, 92, 118);
          document.text(String(item.label || item.name || "--").slice(0, 28), marginX, rowY + 4);
          document.setFillColor(...(options.color || [21, 118, 209]));
          document.roundedRect(marginX + labelWidth, rowY, barLength, Math.max(3, rowHeight - 2), 1.4, 1.4, "F");
          document.setFont("helvetica", "bold");
          document.setTextColor(18, 59, 93);
          document.text(String(rawValue), marginX + labelWidth + barLength + 3, rowY + 4);
        });

        y += chartHeight + 8;
      };

      document.setFillColor(237, 246, 255);
      document.rect(0, 0, pageWidth, 42, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(22);
      document.setTextColor(18, 59, 93);
      document.text("Resumen de Operaciones realizadas", marginX, 18);
      document.setFontSize(11);
      document.setFont("helvetica", "normal");
      document.setTextColor(64, 92, 118);
      document.text("Aplicación de inmuebles clandestinos, geolocalización, mapeo, reportes y trazabilidad", marginX, 26);
      const creditLines = document.splitTextToSize(EXECUTIVE_REPORT_CREDIT, pageWidth - marginX * 2);
      document.text(creditLines, marginX, 34);
      document.text(`Generado: ${formatSpanishDate(executiveReportData.generatedAt)}`, marginX, 34 + creditLines.length * 5);
      y = 52 + Math.max(0, creditLines.length - 1) * 5;

      autoTable(document, {
        startY: y,
        head: [["Periodo", "Primera actividad", "Última actividad", "Acreditación del trabajo"]],
        body: [[
          "Desde el primer día registrado",
          executiveReportData.firstDate ? formatSpanishDate(executiveReportData.firstDate) : "Sin registros",
          executiveReportData.lastDate ? formatSpanishDate(executiveReportData.lastDate) : "Sin registros",
          EXECUTIVE_REPORT_CREDIT
        ]],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3, textColor: [23, 52, 78] },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Indicadores principales");
      autoTable(document, {
        startY: y,
        head: [["Indicador", "Total", "Lectura ejecutiva"]],
        body: [
          ["Fichas activas", safeRecords.length, "Registros operativos visibles en el módulo de fichas."],
          ["Clandestinas", executiveReportData.statusTotals.clandestino || 0, "Pendientes de cierre o procesamiento."],
          ["Reportadas", executiveReportData.statusTotals.reportada || 0, "Procesadas y retiradas del flujo activo."],
          ["Varios padrones", executiveReportData.statusTotals.varios_padrones || 0, "Coincidencias entre Alcaldía y Aguas."],
          ["Puntos geolocalizados", safeMapPoints.length, "Levantamientos GPS y puntos técnicos de campo."],
          ["Jornadas de campo", mapDiaryGroups.length, "Días con bitácora de mapeo."],
          ["Eventos auditados", safeAuditLogs.length, "Historial de accesos, cambios y operaciones."],
          ["Usuarios", safeUsers.length, "Cuentas registradas para operación y administración."]
        ],
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 2.6, textColor: [23, 52, 78] },
        headStyles: { fillColor: [18, 59, 93], textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: "center", cellWidth: 24 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Trabajo realizado por módulo");
      autoTable(document, {
        startY: y,
        head: [["Módulo", "Alcance construido", "Evidencia actual"]],
        body: executiveReportData.modules.map((item) => [item.title, item.detail, item.evidence]),
        theme: "grid",
        styles: { fontSize: 8.2, cellPadding: 2.5, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 82 }, 2: { cellWidth: 62 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Funciones desarrolladas en la aplicación");
      autoTable(document, {
        startY: y,
        head: [["Función", "Descripción operativa"]],
        body: executiveReportData.applicationFunctions,
        theme: "grid",
        styles: { fontSize: 8.1, cellPadding: 2.4, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 138 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Ahorro estimado de tiempo para técnicos");
      autoTable(document, {
        startY: y,
        head: [["Proceso", "Antes", "Con la aplicación", "Beneficio"]],
        body: executiveReportData.timeSavingsRows,
        theme: "striped",
        styles: { fontSize: 7.4, cellPadding: 2.1, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 36 }, 2: { cellWidth: 39 }, 3: { cellWidth: 67 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Trabajo realizado en campo");
      autoTable(document, {
        startY: y,
        head: [["Jornada", "Puntos GPS", "Zonas", "Fichas trabajadas", "Con foto"]],
        body: executiveReportData.fieldJourneyRows.length
          ? executiveReportData.fieldJourneyRows.map((item) => [item.label, item.points, item.zones, item.records, item.photos])
          : [["Sin jornadas registradas", 0, 0, 0, 0]],
        theme: "striped",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 8;

      autoTable(document, {
        startY: y,
        head: [["Responsable / técnico", "Fichas", "Con foto", "En alerta"]],
        body: executiveReportData.fieldResponsibleRows.length
          ? executiveReportData.fieldResponsibleRows.map((item) => [item.name, item.records, item.withPhoto, item.alert])
          : [["Sin responsable asignado", 0, 0, 0]],
        theme: "grid",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Detalle de fichas");
      autoTable(document, {
        startY: y,
        head: [["Concepto", "Cantidad", "Porcentaje"]],
        body: [
          ["Con fotografía", executiveReportData.photoCount, formatPercent(executiveReportData.photoCount, safeRecords.length)],
          ["Sin fotografía", executiveReportData.pendingPhotoCount, formatPercent(executiveReportData.pendingPhotoCount, safeRecords.length)],
          ["Listas para aviso", executiveReportData.printedReadyRecords, formatPercent(executiveReportData.printedReadyRecords, safeRecords.length)],
          ["Con plazo crítico", alertRecords.length, formatPercent(alertRecords.length, safeRecords.length)],
          ["Archivadas según bitácora", executiveReportData.archivedEvents, "Evento histórico"]
        ],
        theme: "striped",
        styles: { fontSize: 8.6, cellPadding: 2.5, textColor: [23, 52, 78] },
        headStyles: { fillColor: [22, 112, 75], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Geolocalización y mapeo");
      autoTable(document, {
        startY: y,
        head: [["Tipo de punto", "Total"]],
        body: executiveReportData.mapTypeRows.length
          ? executiveReportData.mapTypeRows.map((item) => [item.label, item.total])
          : [["Sin puntos registrados", 0]],
        theme: "grid",
        styles: { fontSize: 8.6, cellPadding: 2.5, textColor: [23, 52, 78] },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 8;

      autoTable(document, {
        startY: y,
        head: [["Zonas principales", "Puntos"]],
        body: executiveReportData.mapZoneRows.length
          ? executiveReportData.mapZoneRows.map((item) => [item.label, item.total])
          : [["Sin zonas registradas", 0]],
        theme: "striped",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Trazabilidad y control");
      autoTable(document, {
        startY: y,
        head: [["Evento", "Total"]],
        body: executiveReportData.auditRows.length
          ? executiveReportData.auditRows.map((item) => [item.label, item.total])
          : [["Sin eventos registrados", 0]],
        theme: "grid",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [95, 63, 177], textColor: [255, 255, 255] }
      });

      addReportPage(
        "Análisis estadístico de fichas por barrio",
        "Distribución territorial de las fichas registradas, con lectura por estado operativo, evidencia fotográfica y alertas."
      );
      drawBarChart("Barrios con mayor cantidad de fichas", executiveReportData.recordZoneRows, {
        limit: 12,
        height: 88,
        color: [18, 59, 93],
        labelWidth: 64
      });
      autoTable(document, {
        startY: y,
        head: [["Barrio / colonia", "Total", "Clandestinas", "Reportadas", "Varios padrones", "Con foto", "Alertas"]],
        body: executiveReportData.recordZoneRows.length
          ? executiveReportData.recordZoneRows.slice(0, 18).map((item) => [
              item.label,
              item.total,
              item.clandestino || 0,
              item.reportada || 0,
              item.varios_padrones || 0,
              item.withPhoto,
              item.alert
            ])
          : [["Sin barrios registrados", 0, 0, 0, 0, 0, 0]],
        theme: "striped",
        styles: { fontSize: 7.3, cellPadding: 2.1, textColor: [23, 52, 78] },
        headStyles: { fillColor: [18, 59, 93], textColor: [255, 255, 255] }
      });

      addReportPage(
        "Análisis GPS distribuido por zona",
        "Resumen de puntos levantados en campo, tipos de punto, precisión promedio disponible y primera/última jornada detectada por zona."
      );
      drawBarChart("Zonas con mayor levantamiento GPS", executiveReportData.gpsZoneDetailRows, {
        limit: 12,
        height: 84,
        color: [17, 116, 95],
        labelWidth: 64
      });
      autoTable(document, {
        startY: y,
        head: [["Zona", "Puntos", "Tipos registrados", "Precisión prom.", "Primera jornada", "Última jornada"]],
        body: executiveReportData.gpsZoneDetailRows.length
          ? executiveReportData.gpsZoneDetailRows.slice(0, 14).map((item) => [
              item.label,
              item.total,
              item.typeLabel || "--",
              item.averageAccuracy === null ? "--" : `${item.averageAccuracy} m`,
              item.firstDate ? formatSpanishDate(item.firstDate) : "--",
              item.lastDate ? formatSpanishDate(item.lastDate) : "--"
            ])
          : [["Sin zonas GPS registradas", 0, "--", "--", "--", "--"]],
        theme: "grid",
        styles: { fontSize: 7.1, cellPadding: 2, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 17 }, 2: { cellWidth: 55 } }
      });

      addReportPage(
        "Gráficos estadísticos generales",
        "Lectura visual de estados de fichas, evidencia fotográfica, puntos GPS por tipo y actividad acumulada."
      );
      drawBarChart("Estados de fichas", executiveReportData.statusRows, {
        limit: 6,
        height: 44,
        color: [21, 118, 209],
        labelWidth: 58
      });
      drawBarChart("Puntos GPS por tipo", executiveReportData.mapTypeRows, {
        limit: 8,
        height: 58,
        color: [17, 116, 95],
        labelWidth: 64
      });
      drawBarChart(
        "Evidencia fotográfica",
        [
          { label: "Con fotografía", total: executiveReportData.photoCount },
          { label: "Sin fotografía", total: executiveReportData.pendingPhotoCount }
        ],
        {
          limit: 2,
          height: 28,
          color: [13, 77, 134],
          labelWidth: 58
        }
      );

      addReportPage(
        "Evolución mensual de trabajo",
        "Comparativo acumulado por mes entre fichas registradas o actualizadas y puntos geolocalizados en campo."
      );
      autoTable(document, {
        startY: y,
        head: [["Mes", "Fichas", "Puntos GPS", "Lectura"]],
        body: executiveReportData.monthlyRows.length
          ? executiveReportData.monthlyRows.map((item) => [
              item.label,
              item.records,
              item.points,
              item.records || item.points ? "Mes con movimiento operativo registrado." : "Sin movimiento."
            ])
          : [["Sin meses registrados", 0, 0, "Sin información acumulada."]],
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 8;
      drawBarChart(
        "Fichas por mes",
        executiveReportData.monthlyRows.map((item) => ({ label: item.label, total: item.records })),
        { limit: 12, height: 64, color: [18, 59, 93], labelWidth: 58 }
      );
      drawBarChart(
        "Puntos GPS por mes",
        executiveReportData.monthlyRows.map((item) => ({ label: item.label, total: item.points })),
        { limit: 12, height: 64, color: [17, 116, 95], labelWidth: 58 }
      );

      addReportPage(
        "Resumen de operaciones, avance y defensa del trabajo",
        "Síntesis para presentar el valor operativo del sistema y del levantamiento realizado."
      );
      autoTable(document, {
        startY: y,
        head: [["Eje", "Resultado defendible"]],
        body: [
          ["Campo", `${safeMapPoints.length} puntos GPS distribuidos por zona, con ${mapDiaryGroups.length} jornadas registradas y lectura por tipo de punto.`],
          ["Fichas", `${safeRecords.length} fichas administradas, ${executiveReportData.photoCount} con fotografía y ${executiveReportData.printedReadyRecords} con datos base para aviso.`],
          ["Barrios", `${executiveReportData.recordZoneRows.length} barrios o colonias aparecen en el consolidado operativo.`],
          ["Reportes", "Se cuenta con impresión de fichas, avisos, lote de impresiones, reportes de campo, reportes de padrón y resumen de operaciones PDF."],
          ["Ahorro técnico", "La aplicación reduce búsqueda, validación, redacción, impresión y consolidación de reportes que antes se hacían manualmente."],
          ["Control", `${safeAuditLogs.length} eventos en bitácora respaldan trazabilidad de cambios, usuarios y operaciones.`],
          ["Acreditación", EXECUTIVE_REPORT_CREDIT]
        ],
        theme: "grid",
        styles: { fontSize: 8.3, cellPadding: 2.6, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [95, 63, 177], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 148 } }
      });

      addReportPage(
        "Matriz de información generada",
        "Inventario de salidas y evidencias producidas por la aplicación para sustentar el trabajo operativo."
      );
      autoTable(document, {
        startY: y,
        head: [["Producto", "Contenido", "Uso para defensa del trabajo"]],
        body: [
          ["Ficha técnica", "Datos catastrales, servicios, fotografía, responsables, estado de padrón y datos de aviso.", "Demuestra levantamiento individual y seguimiento del inmueble."],
          ["Aviso", "Documento formal para regularización del inmueble clandestino.", "Permite evidenciar comunicación administrativa al abonado."],
          ["Mapa de campo", "Puntos GPS, precisión, tipo de punto, referencia y jornada.", "Acredita presencia y registro en sitio."],
          ["Reporte de campo", "Puntos agrupados por zona y detalles técnicos de levantamiento.", "Sirve para socializar rutas, zonas y avance por jornada."],
          ["Padrón maestro", "Búsqueda por clave, nombre o abonado y solicitudes por palabras clave.", "Soporta validación contra base administrativa."],
          ["Bitácora", "Eventos de usuarios, fichas, fotos, padrones y operaciones.", "Respalda trazabilidad y control interno."],
          ["Resumen de operaciones", "Indicadores, gráficos, barrios, zonas GPS, responsables, funciones, ahorro de tiempo y conclusiones.", "Resume el proyecto para supervisión y presentación institucional."]
        ],
        theme: "grid",
        styles: { fontSize: 8.1, cellPadding: 2.4, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 72 }, 2: { cellWidth: 74 } }
      });

      addReportPage(
        "Conclusiones ejecutivas",
        "Cierre del informe con la lectura administrativa del trabajo de campo y del sistema implementado."
      );
      autoTable(document, {
        startY: y,
        head: [["Conclusión", "Detalle"]],
        body: [
          ["Digitalización del proceso", "El flujo manual de fichas, avisos, búsqueda, fotografía e impresión queda centralizado en una aplicación web con actualización sin recargar."],
          ["Evidencia territorial", "El módulo GPS permite demostrar zonas cubiertas, puntos técnicos levantados y jornadas de campo registradas."],
          ["Control institucional", "La integración de padrones, reportes PDF y bitácora permite sustentar decisiones con datos y trazabilidad."],
          ["Operación defendible", "El informe consolida fichas por barrio, puntos por zona, responsables, estados, fotografías, eventos y resultados acumulados."],
          ["Siguiente etapa", "El sistema queda preparado para ampliar filtros, exportaciones, autenticación más granular, mejoras de rendimiento y analítica histórica adicional."]
        ],
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [18, 59, 93], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 138 } }
      });

      addFooter();
      saveReportPdf(document, `resumen-operaciones-realizadas-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Resumen de operaciones descargado en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el resumen de operaciones.");
    }
  };

  const handlePrintAviso = async (recordOverride = null) => {
    const targetRecord = recordOverride ? { ...emptyForm, ...normalizeRecord(recordOverride) } : form;
    await printDocument(
      `Aviso ${targetRecord.clave_catastral || "inmueble"}`,
      buildAvisoPrintMarkup(targetRecord),
      {
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        windowFeatures: "width=980,height=1200"
      }
    );
  };

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
      <div
        className="login-shell login-scene"
        style={{ "--login-bridge-background": `url(${loginBridgeBackground})` }}
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
        <div className="login-droplet-sequence" aria-hidden="true">
          <img className="login-droplet-fall" src={loginDroplet} alt="" />
          <img className="login-droplet-splash" src={loginSplash} alt="" />
          <img className="login-droplet-resolve" src={loginDroplet} alt="" />
        </div>
        <div className="login-layout">
          <main className="login-card" aria-labelledby="login-title">
            <header className="login-card-head">
              <img src={loginDroplet} alt="Logo de Control Aguas" className="login-logo" />
              <p className="login-brand-kicker">AGUAS DE CHOLUTECA</p>
              <h1 id="login-title">Control Aguas</h1>
              <p className="login-subtitle">Acceso al sistema de registro y seguimiento.</p>
            </header>

            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label htmlFor="login-username">Usuario o correo</label>
                <div className="login-input-shell">
                  <span className="login-input-icon" aria-hidden="true"><Icon name="users" /></span>
                  <input
                    id="login-username"
                    name="username"
                    value={loginForm.username}
                    onChange={handleLoginChange}
                    autoComplete="username"
                    placeholder="Ingresa tu usuario o correo"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="login-password">Contraseña</label>
                <div className="login-input-shell">
                  <span className="login-input-icon" aria-hidden="true"><Icon name="auth" /></span>
                  <input
                    id="login-password"
                    name="password"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    autoComplete="current-password"
                    placeholder="Ingresa tu contraseña"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowLoginPassword((current) => !current)}
                    aria-label={showLoginPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showLoginPassword}
                  >
                    {showLoginPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <button className="login-submit" type="submit" disabled={loginLoading}>
                {loginLoading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <p className="login-footnote">Acceso exclusivo para personal autorizado.</p>
          </main>
        </div>
      </div>
    );
  }

  const dashboardWidgetItems = [
    {
      key: "spotlight",
      label: "Vision y acciones",
      helper: "Entrada principal del tablero",
      className: "is-wide",
      content: (
        <section className="dashboard-spotlight-grid">
          <article className="preview-panel dashboard-spotlight-panel">
            <div className="dashboard-panel-head dashboard-spotlight-head">
              <div>
                <p className="sheet-kicker">Vision ejecutiva</p>
                  <h2><Icon name="dashboard" className="title-icon" />Tablero</h2>
                <p className="workspace-title">
                  Una vista rapida para decidir a donde entrar, que revisar y donde hace falta atencion inmediata.
                </p>
              </div>
              <span className="panel-pill">Computadora primero</span>
            </div>
            <div className="dashboard-focus-grid">
              {dashboardFocusCards.map((card) => (
                <article key={card.title} className="dashboard-focus-card">
                  <span className="dashboard-focus-icon"><Icon name={card.icon} /></span>
                  <strong>{card.title}</strong>
                  <h3>{card.value}</h3>
                  <p>{card.detail}</p>
                  <button type="button" className="button-secondary" onClick={() => setWorkspaceView(card.actionView)}>
                    {card.actionLabel}
                  </button>
                </article>
              ))}
            </div>
          </article>

          <article className="preview-panel dashboard-command-panel">
            <div className="dashboard-panel-head">
              <div>
                <p className="sheet-kicker">Acciones rapidas</p>
                <h2><Icon name="activity" className="title-icon" />Que quieres hacer ahora</h2>
              </div>
            </div>
            <div className="dashboard-command-list">
              {dashboardQuickActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="dashboard-command-card"
                  onClick={() => setWorkspaceView(action.key)}
                >
                  <span className="dashboard-command-icon"><Icon name={action.icon} /></span>
                  <span className="dashboard-command-copy">
                    <strong>{action.label}</strong>
                    <small>{action.helper}</small>
                  </span>
                </button>
              ))}
            </div>
          </article>
        </section>
      )
    },
    {
      key: "metrics",
      label: "Metricas base",
      helper: "Volumen operativo rapido",
      className: "is-wide",
      content: (
        <div className="dashboard-metric-grid">
          {dashboardMetrics.map((metric) => (
            <article key={metric.label} className="dashboard-metric-card">
              <span className="dashboard-metric-icon"><Icon name={metric.icon} /></span>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <small>{metric.helper}</small>
            </article>
          ))}
        </div>
      )
    },
    {
      key: "signals",
      label: "Senales operativas",
      helper: "Alertas y semaforos",
      className: "is-wide",
      content: (
        <section className="dashboard-signal-grid">
          {dashboardSignalCards.map((card) => (
            <article key={card.title} className={`dashboard-signal-card ${card.tone}`}>
              <span className="dashboard-signal-icon"><Icon name={card.icon} /></span>
              <div>
                <strong>{card.title}</strong>
                <h3>{card.value}</h3>
                <p>{card.helper}</p>
              </div>
            </article>
          ))}
        </section>
      )
    },
    {
      key: "executive",
      label: "Operaciones realizadas",
      helper: "Comparativos y carga",
      className: "is-wide",
      content: (
        <section className="dashboard-dual-grid">
          <article className="preview-panel dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <p className="sheet-kicker">Comparativo</p>
                <h2><Icon name="dashboard" className="title-icon" />Hoy contra semana</h2>
              </div>
            </div>
            <div className="dashboard-comparison-list">
              {dashboardExecutiveCards.map((card) => (
                <article key={card.title} className={`dashboard-comparison-card ${card.tone}`}>
                  <div className="dashboard-comparison-head">
                    <span className="dashboard-comparison-icon"><Icon name={card.icon} /></span>
                    <div>
                      <strong>{card.title}</strong>
                      <p>{card.helper}</p>
                    </div>
                  </div>
                  <div className="dashboard-comparison-metrics">
                    <div>
                      <small>Hoy</small>
                      <span>{card.today}</span>
                    </div>
                    <div>
                      <small>7 dias</small>
                      <span>{card.week}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="preview-panel dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <p className="sheet-kicker">Carga operativa</p>
                <h2><Icon name="users" className="title-icon" />Equipo y zonas clave</h2>
              </div>
            </div>
            <div className="dashboard-summary-stack">
              <section className="dashboard-summary-block">
                <div className="dashboard-summary-title">
                  <strong>Tecnicos con mas fichas</strong>
                  <span>{dashboardTechnicianSummary.length} visibles</span>
                </div>
                <div className="dashboard-summary-list">
                  {dashboardTechnicianSummary.length ? (
                    dashboardTechnicianSummary.map((item) => (
                      <article key={item.name} className="dashboard-summary-item">
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.withPhoto}/{item.total} con foto · {item.alert} en alerta</p>
                        </div>
                        <span className="dashboard-summary-badge">{item.total}</span>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <h3>Sin responsables visibles</h3>
                      <p>Cuando existan fichas activas se resumiran aqui.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="dashboard-summary-block">
                <div className="dashboard-summary-title">
                  <strong>Barrios con mas movimiento</strong>
                  <span>{dashboardZoneSummary.length} zonas</span>
                </div>
                <div className="dashboard-summary-list">
                  {dashboardZoneSummary.length ? (
                    dashboardZoneSummary.map((item) => (
                      <article key={item.name} className="dashboard-summary-item">
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.pendingPhoto} sin foto · {item.alert} en alerta</p>
                        </div>
                        <span className="dashboard-summary-badge">{item.total}</span>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <h3>Sin zonas activas</h3>
                      <p>Los barrios con mayor actividad apareceran aqui.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </article>
        </section>
      )
    },
    {
      key: "activity",
      label: "Actividad reciente",
      helper: "Bitacora viva",
      className: "is-half",
      content: (
        <section className="preview-panel dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="sheet-kicker">Actividad reciente</p>
              <h2><Icon name="activity" className="title-icon" />Pulso operativo</h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => setWorkspaceView("logs")}>
              <Icon name="logs" />
              Bitacora completa
            </button>
          </div>
          <div className="dashboard-activity-list">
            {dashboardActivity.length ? (
              dashboardActivity.map((log) => (
                <article key={log.id} className="dashboard-activity-item">
                  <span className="dashboard-activity-icon">
                    <Icon name={actionIconName(log.action)} />
                  </span>
                  <div>
                    <strong>{log.summary || actionLabel(log.action)}</strong>
                    <p>{log.actor_name || log.actor_email || "Sistema"} · {formatDateTime(log.created_at)}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <h3>Sin actividad reciente</h3>
                <p>Cuando el equipo opere fichas, mapa o usuarios, veras el resumen aqui.</p>
              </div>
            )}
          </div>
        </section>
      )
    },
    {
      key: "lookup",
      label: "Busquedas recientes",
      helper: "Consultas reutilizables",
      className: "is-half",
      content: (
        <section className="preview-panel dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="sheet-kicker">Consulta operativa</p>
              <h2><Icon name="search" className="title-icon" />Busquedas recientes</h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => setWorkspaceView("lookup")}>
              <Icon name="search" />
              Abrir consulta
            </button>
          </div>
          <div className="dashboard-activity-list">
            {dashboardLookupItems.length ? (
              dashboardLookupItems.map((item) => (
                <button
                  key={`${item.mode}-${item.normalized_query}-${item.searched_at}`}
                  type="button"
                  className="dashboard-activity-item dashboard-lookup-item"
                  onClick={() => {
                    setLookupSearchMode(item.mode);
                    setLookupQuery(String(item.normalized_query || item.query || ""));
                    setLookupResult(null);
                    setLookupFeedback("");
                    if (item.mode === "clave") {
                      const firstPart = String(item.normalized_query || item.query || "").split("-")[0] || "";
                      setLookupPrefixMode(firstPart.length === 3 ? "three" : "auto");
                    } else {
                      setLookupPrefixMode("auto");
                    }
                    setWorkspaceView("lookup");
                  }}
                >
                  <span className="dashboard-activity-icon">
                    <Icon name={item.mode === "clave" ? "records" : item.mode === "nombre" ? "users" : "search"} />
                  </span>
                  <div>
                    <strong>{item.normalized_query || item.query}</strong>
                    <p>
                      {item.mode === "clave" ? "Clave" : item.mode === "nombre" ? "Nombre" : "Abonado"} ·{" "}
                      {item.exists ? `${item.total_matches} coincidencias` : "Sin registro"} · {formatDateTime(item.searched_at)}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <h3>Sin consultas guardadas</h3>
                <p>Las ultimas busquedas de clave, nombre o abonado apareceran aqui para repetirlas rapido.</p>
              </div>
            )}
          </div>
        </section>
      )
    },
    {
      key: "journeys",
      label: "Jornadas de campo",
      helper: "Resumen geografico",
      className: "is-half",
      content: (
        <article className="preview-panel dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="sheet-kicker">Campo</p>
              <h2><Icon name="map" className="title-icon" />Jornadas recientes</h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => setWorkspaceView("mapReports")}>
              <Icon name="records" />
              Reportes campo
            </button>
          </div>
          <div className="dashboard-journey-list">
            {dashboardJourneys.length ? (
              dashboardJourneys.map((journey) => (
                <button
                  key={journey.key}
                  type="button"
                  className="dashboard-journey-card"
                  onClick={() => {
                    setMapDiaryDateKey(journey.key);
                    setWorkspaceView("map");
                  }}
                >
                  <strong>{formatMapDiaryLabel(journey.key)}</strong>
                  <span>{journey.total} puntos levantados</span>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <h3>Sin jornadas de campo</h3>
                <p>Los levantamientos del mapa apareceran aqui por fecha.</p>
              </div>
            )}
          </div>
        </article>
      )
    },
    {
      key: "online",
      label: "Usuarios en linea",
      helper: "Operacion activa",
      className: "is-half",
      content: (
        <article className="preview-panel dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="sheet-kicker">Equipo activo</p>
              <h2><Icon name="users" className="title-icon" />Usuarios en linea</h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => setWorkspaceView("users")}>
              <Icon name="users" />
              Gestionar accesos
            </button>
          </div>
          <div className="dashboard-online-list">
            {onlineUsers.length ? (
              onlineUsers.map((user) => (
                <article key={user.id} className="dashboard-online-card">
                  <div>
                    <strong>{user.full_name || user.username}</strong>
                    <p>{roleLabel(user.role)} · {user.active_sessions || 0} sesiones</p>
                  </div>
                  <span className="record-badge is-online">En linea</span>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <h3>Sin usuarios conectados</h3>
                <p>Cuando alguien tenga sesion activa, lo veras reflejado aqui.</p>
              </div>
            )}
          </div>
        </article>
      )
    }
  ];
  const visibleDashboardWidgetItems = dashboardWidgetPrefs.order
    .map((key) => dashboardWidgetItems.find((item) => item.key === key))
    .filter(Boolean)
    .filter((item) => !dashboardWidgetPrefs.hidden.includes(item.key));

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
      <Dialog open={showFieldDebtModal} onOpenChange={setShowFieldDebtModal}>
        <DialogContent className="field-debt-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-6xl">
          <DialogHeader className="password-modal-head">
            <p className="eyebrow">Verificación administrativa</p>
            <DialogTitle>Verificación</DialogTitle>
            <DialogDescription className="lead">
              Claves o abonados detectados en las referencias de la jornada {formatMapDiaryLabel(fieldDebtReport?.dateKey || activeMapDiaryDateKey)}, cruzados contra el padron maestro.
            </DialogDescription>
          </DialogHeader>
          <div className="field-debt-modal-body">
            {loadingFieldDebtReport ? (
              <div className="empty-state field-debt-loading-state">
                <Icon name="refresh" className="empty-state-icon field-debt-loading-icon" />
                <h3>Verificación en proceso</h3>
                <p>Estoy extrayendo claves y abonados de las referencias, y consultando el padron cargado.</p>
                <span className="field-debt-loading-bar" aria-hidden="true" />
              </div>
            ) : fieldDebtReport ? (
              <>
                <div className="field-debt-summary-grid">
                  <div className="log-summary-card">
                    <span>Referencias unicas</span>
                    <strong>{fieldDebtSummary.totalKeys}</strong>
                  </div>
                  <div className="log-summary-card">
                    <span>Encontradas</span>
                    <strong>{fieldDebtSummary.foundKeys}</strong>
                  </div>
                  <div className="log-summary-card">
                    <span>Sin coincidencia</span>
                    <strong>{fieldDebtSummary.missingKeys}</strong>
                  </div>
                  <div className="log-summary-card">
                    <span>Deuda total</span>
                    <strong>{formatCurrency(fieldDebtSummary.totalDebt)} lempiras</strong>
                  </div>
                </div>

                <div className="field-debt-service-grid">
                  {FIELD_DEBT_SERVICE_DEFINITIONS.map((service) => (
                    <div key={service.field} className="field-debt-service-card">
                      <span>{service.label}</span>
                      <strong>{fieldDebtSummary.services[service.field] || 0}</strong>
                    </div>
                  ))}
                </div>

                <div className="field-debt-table-wrap">
                  <table className="field-debt-table">
                    <thead>
                      <tr>
                        <th>Referencia detectada</th>
                        <th>Reportes</th>
                        <th>Abonado</th>
                        <th>Nombre</th>
                        <th>Barrio</th>
                        <th>Servicios</th>
                        <th>Total sin interés</th>
                        <th>Intereses</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldDebtReport.results.length ? (
                        fieldDebtReport.results.flatMap((result) => {
                          if (!result.matches?.length) {
                            return (
                              <tr key={`${result.key}-missing`} className="is-missing">
                                <td>{getFieldDebtResultLabel(result)}</td>
                                <td>{fieldDebtReport?.keyCounts?.[result.key] || 0}</td>
                                <td>--</td>
                                <td>{result.error || "No aparece en el padrón"}</td>
                                <td>--</td>
                                <td>--</td>
                                <td>--</td>
                                <td>--</td>
                                <td>--</td>
                              </tr>
                            );
                          }

                          return result.matches.map((match, matchIndex) => (
                            <tr key={`${result.key}-${match.abonado || match.clave_catastral || matchIndex}`}>
                              <td>{matchIndex === 0 ? getFieldDebtResultLabel(result) : ""}</td>
                              <td>{matchIndex === 0 ? fieldDebtReport?.keyCounts?.[result.key] || 0 : ""}</td>
                              <td>{match.abonado || "--"}</td>
                              <td>{match.inquilino || match.nombre || "--"}</td>
                              <td>{match.barrio_colonia || "--"}</td>
                              <td>
                                {FIELD_DEBT_SERVICE_DEFINITIONS.map((service) => (
                                  <span
                                    key={service.field}
                                    className={`field-debt-service-pill ${getFieldDebtServiceStatus(match, service.field) === "Sí" ? "is-on" : "is-off"}`}
                                  >
                                    <b>{getFieldDebtServiceStatus(match, service.field) === "Sí" ? "✓" : "×"}</b>
                                    {service.shortLabel}
                                  </span>
                                ))}
                              </td>
                              <td className="field-debt-table-money">{formatCurrency(Number(match.valor || 0))}</td>
                              <td className="field-debt-table-money">{formatCurrency(Number(match.intereses || 0))}</td>
                              <td className="field-debt-table-money is-total">{formatCurrency(Number(match.total || 0))}</td>
                            </tr>
                          ));
                        })
                      ) : (
                        <tr>
                          <td colSpan="9">No se detectaron claves ni abonados en esta jornada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="helper-text">
                  Se revisaron {fieldDebtSummary.totalPoints} puntos con referencia manual. El detalle final se resume arriba para evitar duplicar la referencia de campo.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <h3>Sin verificación</h3>
                <p>Ejecuta la verificacion desde Reportes GPS para revisar las claves o abonados de la jornada.</p>
              </div>
            )}
          </div>
          <DialogFooter className="password-form-actions print-batch-footer">
            <button type="button" className="button-secondary" onClick={() => setShowFieldDebtModal(false)}>
              Cerrar
            </button>
            <button type="button" className="button-secondary" onClick={handlePrintFieldDebtReport} disabled={!fieldDebtReport || loadingFieldDebtReport}>
              <Icon name="records" />
              Imprimir
            </button>
            <button type="button" onClick={handleDownloadFieldDebtPdf} disabled={!fieldDebtReport || loadingFieldDebtReport}>
              <Icon name="records" />
              Generar PDF
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showMapDiaryArchiveModal} onOpenChange={setShowMapDiaryArchiveModal}>
        <DialogContent className="map-diary-archive-modal shadcn-print-dialog max-h-[calc(100vh-1rem)] overflow-hidden sm:max-w-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Calendario de jornadas trabajadas</DialogTitle>
            <DialogDescription>Selecciona una fecha trabajada para revisar sus puntos.</DialogDescription>
          </DialogHeader>
          <div className="map-diary-archive-toolbar">
            <button type="button" className="button-secondary map-diary-sidebar-toggle" onClick={() => setSidebarCollapsed((current) => !current)}>
              <Icon name="arrowLeft" />
              {sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            </button>
          </div>
          <div className="map-diary-archive-layout">
            <MapDiaryArchiveCalendar
              groups={archivedMapDiaryGroups}
              selectedDateKey={selectedArchiveMapDiaryGroup?.key}
              loading={loadingArchiveMapDiaryPoints}
              onSelectDate={loadArchivedMapDiaryPoints}
            />
            <section className="map-diary-archive-detail">
              <div className="map-diary-archive-detail-head">
                <div>
                  <span className="sheet-kicker"><CalendarDays size={14} /> Jornada seleccionada</span>
                  <h3>{selectedArchiveMapDiaryGroup ? formatMapDiaryLabel(selectedArchiveMapDiaryGroup.key) : "Sin jornada"}</h3>
                  <p className="map-diary-archive-points"><MapPin size={15} /> {selectedArchiveMapDiaryGroup?.total || 0} puntos guardados</p>
                </div>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleUseArchivedMapDiary}
                  disabled={!selectedArchiveMapDiaryGroup}
                >
                  <Icon name="map" />
                  Abrir jornada
                </button>
              </div>
              <div className="map-diary-archive-table-wrap">
                <table className="map-diary-archive-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tipo</th>
                      <th>Referencia</th>
                      <th>Descripcion</th>
                      <th>Coordenadas</th>
                      <th>Precision</th>
                      <th>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingArchiveMapDiaryPoints ? (
                      <tr>
                        <td colSpan="7">Cargando datos guardados...</td>
                      </tr>
                    ) : archiveMapDiaryPoints.length ? (
                      archiveMapDiaryPoints.map((point, index) => (
                        <tr key={point.id || `${point.latitude}-${point.longitude}-${index}`}>
                          <td data-label="#">{index + 1}</td>
                          <td data-label="Tipo">{getMapPointTypeLabel(point.point_type)}</td>
                          <td data-label="Referencia">{getMapPointReferenceNote(point) || "--"}</td>
                          <td data-label="Descripción">{getMapPointTechnicalDescription(point) || "--"}</td>
                          <td data-label="Coordenadas">{formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}</td>
                          <td data-label="Precisión">{point.accuracy_meters ? `${point.accuracy_meters} m` : "--"}</td>
                          <td data-label="Hora">{formatDateTime(point.created_at)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7">Selecciona una jornada para ver los datos guardados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showPrintBatchModal} onOpenChange={(open) => !batchPrinting && setShowPrintBatchModal(open)}>
        <DialogContent className="print-batch-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-3xl">
          <DialogHeader className="password-modal-head">
            <p className="eyebrow">Impresion rapida</p>
            <DialogTitle>Seleccionar fichas, avisos y copias</DialogTitle>
            <DialogDescription className="lead">
              Selecciona el lote, revisa pendientes o impresas y evita repetir impresiones.
            </DialogDescription>
            <p className="helper-text">
              Al imprimir, las fichas pasan a impresas y salen de alertas. Desde impresas puedes marcarlas y enviarlas a guardadas.
            </p>
          </DialogHeader>
          <div className="print-batch-toolbar">
            <div className="print-batch-filters" aria-label="Apartados de impresion">
              {[
                { key: "pending", label: `Pendientes (${printBatchStatusCounts.pending})` },
                { key: "printed", label: `Impresas (${printBatchStatusCounts.printed})` }
              ].map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant={printBatchStatusView === filter.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setPrintBatchStatusView(filter.key);
                    if (filter.key === "printed" && printBatchQuickFilter === "clandestina") {
                      setPrintBatchQuickFilter("all");
                    }
                  }}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <label className="print-batch-search">
              <span>Buscar ficha</span>
              <Input
                type="search"
                value={printBatchSearch}
                onChange={(event) => setPrintBatchSearch(event.target.value)}
                placeholder="Buscar por clave..."
              />
            </label>
            <div className="print-batch-filters" aria-label="Filtros rapidos de impresion">
              {[
                { key: "all", label: "Todas" },
                { key: "clandestina", label: "Clandestinas" },
                { key: "ficha_selected", label: "Con ficha seleccionada" },
                { key: "aviso_selected", label: "Con aviso seleccionado" }
              ].map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant={printBatchQuickFilter === filter.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrintBatchQuickFilter(filter.key)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="print-batch-summary" aria-label="Resumen de seleccion">
              <Badge variant="secondary">{batchPrintSelection.fichas} fichas</Badge>
              <Badge variant="secondary">{batchPrintSelection.avisos} avisos</Badge>
              <Badge variant="outline">{filteredPrintBatchRecords.length} visibles</Badge>
              <Badge variant="outline">
                {filteredPrintBatchRecords.filter((record) => (record.estado_padron || "clandestino") === "clandestino").length} clandestinas
              </Badge>
              {printBatchStatusView === "printed" ? (
                <Badge variant="outline">{printedSaveSelection.total} para guardar</Badge>
              ) : manualPrintedSelection.total ? (
                <Badge variant="outline">{manualPrintedSelection.total} ya impresas</Badge>
              ) : null}
            </div>
            <div className="print-batch-actions">
              {printBatchStatusView === "printed" ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={selectVisiblePrintedForSave}>
                    Marcar visibles
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveSelectedPrintedRecords}
                    disabled={batchPrinting || !printedSaveSelection.total}
                  >
                    Enviar a guardadas
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => selectVisibleBatchPrintCopies("ficha")}>
                    Seleccionar fichas visibles
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => selectVisibleBatchPrintCopies("aviso")}>
                    Seleccionar avisos visibles
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={selectVisiblePendingAsPrinted}>
                    Marcar visibles ya impresas
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={clearBatchPrintCopies}>
                Limpiar seleccion
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPrintComparisonModal(true)}
              >
                Comparar todas las fichas
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMoveSelectedFichasToPrinted}
                disabled={batchPrinting || printBatchStatusView === "printed" || (!batchPrintSelection.fichas && !manualPrintedSelection.total)}
              >
                Marcar como impresas
              </Button>
            </div>
          </div>
          <div className="print-batch-scroll">
            <div className="print-batch-grid">
              {filteredPrintBatchRecords.length ? (
                filteredPrintBatchRecords.map((record) => {
                  const copies = batchPrintCopies[record.id] || {};
                  const fichaCopies = clampPrintCopies(copies.ficha ?? 0);
                  const avisoCopies = clampPrintCopies(copies.aviso ?? 0);
                  const padronStatus = record.estado_padron || "clandestino";
                  const isClandestina = padronStatus === "clandestino";
                  const isPrinted = padronStatus === "reportada";
                  const isSelected = Boolean(fichaCopies || avisoCopies);
                  const isMarkedForSave = Boolean(copies.save);
                  const isMarkedPrinted = Boolean(copies.printed);

                  return (
                    <article
                      key={`print-${record.id}`}
                      className={`print-batch-card ${isSelected ? "is-selected" : ""}`}
                    >
                      <div className="print-batch-card-main">
                        <div className="print-batch-card-title">
                          <strong>{record.clave_catastral}</strong>
                          {isSelected ? <Badge variant="outline" className="print-selected-badge">Seleccionada</Badge> : null}
                        </div>
                        <span>{getRecordBarrioName(record, "Sin ubicacion")}</span>
                        <div className="print-batch-card-meta">
                          <Badge
                            variant={isClandestina ? "destructive" : padronStatus === "reportada" ? "secondary" : "outline"}
                            className={`print-status-badge is-${padronStatus}`}
                          >
                            {getPadronStatusLabel(padronStatus)}
                          </Badge>
                          <small>Creada: {getRecordFichaDateLabel(record)}</small>
                          {isPrinted ? <small>Impresa: {getRecordPrintedDateLabel(record)}</small> : null}
                        </div>
                      </div>
                      <div className="print-batch-status">
                        {isPrinted ? (
                          <label className="print-save-check">
                            <input
                              type="checkbox"
                              checked={isMarkedForSave}
                              onChange={() => togglePrintedSaveSelection(record.id)}
                            />
                            <span>Enviar a guardadas</span>
                          </label>
                        ) : (
                          <>
                            <label className="print-save-check">
                              <input
                                type="checkbox"
                                checked={isMarkedPrinted}
                                onChange={() => togglePendingPrintedSelection(record.id)}
                              />
                              <span>Ya fue impresa</span>
                            </label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="print-validate-button"
                              onClick={() => handleValidatePrintRecord(record)}
                              disabled={processingRecordId === record.id}
                            >
                              <Icon name="search" />
                              {processingRecordId === record.id ? "Validando..." : "Validar padrones"}
                            </Button>
                          </>
                        )}
                      </div>
                      {!isPrinted ? (
                        <>
                          <div className="print-copy-group">
                            <span>Ficha</span>
                            <div className="print-copy-stepper">
                              <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "ficha", -1)}>-</Button>
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-5]"
                                aria-label={`Copias de ficha para ${record.clave_catastral}`}
                                min="0"
                                max="5"
                                value={String(fichaCopies)}
                                onChange={(event) => updateBatchPrintCopies(record.id, "ficha", event.target.value)}
                              />
                              <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "ficha", 1)}>+</Button>
                            </div>
                          </div>
                          <div className="print-copy-group">
                            <span>Aviso</span>
                            <div className="print-copy-stepper">
                              <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "aviso", -1)}>-</Button>
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-5]"
                                aria-label={`Copias de aviso para ${record.clave_catastral}`}
                                min="0"
                                max="5"
                                value={String(avisoCopies)}
                                onChange={(event) => updateBatchPrintCopies(record.id, "aviso", event.target.value)}
                              />
                              <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustBatchPrintCopies(record.id, "aviso", 1)}>+</Button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  <h3>No hay fichas visibles</h3>
                  <p>Ajusta el filtro por clave, barrio o estado para preparar impresiones.</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="password-form-actions print-batch-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPrintBatchModal(false)}
              disabled={batchPrinting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handlePrintBatch}
              disabled={batchPrinting || (!batchPrintSelection.fichas && !batchPrintSelection.avisos)}
              className={batchPrintSelection.fichas || batchPrintSelection.avisos ? "print-preview-button is-ready" : "print-preview-button"}
            >
              <Icon name="records" />
              {batchPrinting
                ? "Preparando..."
                : `Vista previa: ${batchPrintSelection.fichas} fichas / ${batchPrintSelection.avisos} avisos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showPrintComparisonModal} onOpenChange={setShowPrintComparisonModal}>
        <DialogContent className="print-comparison-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-3xl">
          <DialogHeader className="password-modal-head">
            <p className="eyebrow">Menu aparte</p>
            <DialogTitle>Comparar fichas vencidas contra Aguas</DialogTitle>
            <DialogDescription className="lead">
              Imprime una lista simple: clave catastral, nombre, barrio, fecha de ficha, estado y si aparece en Aguas.
            </DialogDescription>
          </DialogHeader>
          <div className="comparison-modal-summary">
            <div>
              <span>Fichas vencidas</span>
              <strong>{overdueComparisonRecords.length}</strong>
            </div>
            <div>
              <span>No aparecen en Aguas</span>
              <strong>{overdueComparisonRecords.filter((record) => getRecordAguasPresenceLabel(record) === "No aparece en Aguas").length}</strong>
            </div>
            <div>
              <span>Aparecen en Aguas</span>
              <strong>{overdueComparisonRecords.filter((record) => getRecordAguasPresenceLabel(record) === "Si aparece en Aguas").length}</strong>
            </div>
          </div>
          <section className="comparison-header-editor">
            <div className="comparison-header-editor-head">
              <strong>Encabezado de impresion</strong>
              <span>Edita solo el titulo del reporte, no cambia datos ni padrones.</span>
            </div>
            <label>
              <span>Etiqueta superior</span>
              <Input
                value={printComparisonHeader.kicker}
                onChange={(event) =>
                  setPrintComparisonHeader((current) => ({ ...current, kicker: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Titulo principal</span>
              <Input
                value={printComparisonHeader.title}
                onChange={(event) =>
                  setPrintComparisonHeader((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="is-wide">
              <span>Nota del encabezado</span>
              <Input
                value={printComparisonHeader.note}
                onChange={(event) =>
                  setPrintComparisonHeader((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
          </section>
          <div className="comparison-modal-scroll">
            {overdueComparisonRecords.length ? (
              <table className="comparison-modal-table">
                <thead>
                  <tr>
                    <th>Clave catastral</th>
                    <th>Nombre</th>
                    <th>Barrio</th>
                    <th>Fecha ficha</th>
                    <th>Estado</th>
                    <th>Aguas</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueComparisonRecords.map((record) => (
                    (() => {
                      const alcaldiaMatch = alcaldiaComparisonByClave.get(String(record.clave_catastral || "").trim()) || null;
                      return (
                        <tr key={`comparison-${record.id}`}>
                          <td>{record.clave_catastral || "--"}</td>
                          <td>{getRecordDisplayName(record, alcaldiaMatch)}</td>
                          <td>{getRecordBarrioName(record, "") || record.barrio_alcaldia || alcaldiaMatch?.caserio || alcaldiaMatch?.direccion || "--"}</td>
                          <td>{getRecordFichaDateLabel(record)}</td>
                          <td>
                            <span className="comparison-status-badge">Vencida</span>
                          </td>
                          <td>
                            <Badge variant={getRecordAguasPresenceLabel(record) === "Si aparece en Aguas" ? "secondary" : "destructive"}>
                              {getRecordAguasPresenceLabel(record)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <h3>Sin fichas vencidas</h3>
                <p>No hay registros vencidos para comparar en este momento.</p>
              </div>
            )}
          </div>
          <DialogFooter className="password-form-actions print-batch-footer">
            <Button type="button" variant="outline" onClick={() => setShowPrintComparisonModal(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={() => handlePrintAguasComparisonList(overdueComparisonRecords)}
              disabled={printingComparison || !overdueComparisonRecords.length}
            >
              <Icon name="records" />
              {printingComparison ? "Preparando..." : "Imprimir lista comparativa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDashboardAlertsModal} onOpenChange={setShowDashboardAlertsModal}>
        <DialogContent className="dashboard-alert-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-3xl">
          <DialogHeader className="password-modal-head">
            <p className="eyebrow">Alertas vencidas</p>
            <DialogTitle>Lista de fichas en alerta</DialogTitle>
            <DialogDescription className="lead">
              Menu aparte para revisar fichas vencidas, abrir una ficha individual, imprimir o generar la comparacion contra Aguas.
            </DialogDescription>
          </DialogHeader>
          <div className="dashboard-alert-summary">
            <div>
              <span>Total</span>
              <strong>{dashboardAlertCounts.all}</strong>
            </div>
            <div>
              <span>Vencidas</span>
              <strong>{dashboardAlertCounts.critical}</strong>
            </div>
            <div>
              <span>Sin foto</span>
              <strong>{dashboardAlertCounts.noPhoto}</strong>
            </div>
          </div>
          <div className="dashboard-alert-filters" aria-label="Filtros de alertas operativas">
            {[
              { key: "all", label: "Todas", count: dashboardAlertCounts.all },
              { key: "critical", label: "Criticas", count: dashboardAlertCounts.critical },
              { key: "today", label: "Hoy", count: dashboardAlertCounts.today },
              { key: "no-photo", label: "Sin foto", count: dashboardAlertCounts.noPhoto },
              { key: "printable", label: "Para imprimir", count: dashboardAlertCounts.printable }
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={dashboardAlertFilter === filter.key ? "is-active" : ""}
                onClick={() => setDashboardAlertFilter(filter.key)}
              >
                {filter.label}
                <span>{filter.count}</span>
              </button>
            ))}
          </div>
          <div className="dashboard-alerts-list dashboard-alert-modal-list">
            {filteredDashboardAlertRecords.length ? (
              filteredDashboardAlertRecords.map(({ record, statusKey, detail, status }) => (
                <article
                  key={`modal-${record.id}-${statusKey}`}
                  className={`dashboard-alert-item ${statusKey || "warning"}`}
                >
                  <span className="dashboard-alert-icon">
                    <Icon name={statusKey === "no-photo" ? "records" : "warning"} />
                  </span>
                  <div>
                    <strong>{record.clave_catastral || "Sin clave"}</strong>
                    <p>{detail}</p>
                    <span>{status}</span>
                  </div>
                  <div className="dashboard-alert-actions">
                    <label className="print-save-check dashboard-alert-check">
                      <input
                        type="checkbox"
                        checked={Boolean(batchPrintCopies[record.id]?.printed)}
                        onChange={() => togglePendingPrintedSelection(record.id)}
                      />
                      <span>Ya impresa</span>
                    </label>
                    <button
                      type="button"
                      className="dashboard-alert-action"
                      onClick={() => {
                        handleSelectRecord(record);
                        setShowDashboardAlertsModal(false);
                        setWorkspaceView("records");
                      }}
                    >
                      Ver ficha
                    </button>
                    <button
                      type="button"
                      className="dashboard-alert-action is-print"
                      onClick={() => {
                        setShowDashboardAlertsModal(false);
                        openPrintBatchModalForRecords([record], "ficha");
                      }}
                    >
                      Imprimir
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <h3>Sin alertas pendientes</h3>
                <p>Todas las fichas estan al dia.</p>
              </div>
            )}
          </div>
          <DialogFooter className="password-form-actions print-batch-footer">
            <Button type="button" variant="outline" onClick={() => setShowDashboardAlertsModal(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleMarkSelectedAlertsAsPrinted}
              disabled={batchPrinting || !manualPrintedSelection.total}
            >
              {batchPrinting ? "Marcando..." : `Marcar impresas${manualPrintedSelection.total ? ` (${manualPrintedSelection.total})` : ""}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDashboardAlertsModal(false);
                setShowPrintComparisonModal(true);
              }}
            >
              Comparar vencidas
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowDashboardAlertsModal(false);
                openPrintBatchModalForRecords(overdueComparisonRecords, "ficha");
              }}
              disabled={!overdueComparisonRecords.length}
            >
              <Icon name="records" />
              Imprimir vencidas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedAuditReport)} onOpenChange={(open) => !open && setSelectedAuditReport(null)}>
        <DialogContent className="audit-report-viewer-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-6xl">
          <DialogHeader className="password-modal-head audit-report-viewer-head">
            <DialogTitle><Icon name="print" className="title-icon" />{selectedAuditReport?.title || "Reporte archivado"}</DialogTitle>
            <DialogDescription className="lead">
              ID {selectedAuditReport?.report_id || "--"} · Archivado {selectedAuditReport?.created_at ? formatDateTime(selectedAuditReport.created_at) : "sin fecha"}
            </DialogDescription>
          </DialogHeader>
          {selectedAuditReport ? (
            <div className="audit-report-viewer-frame">
              <iframe
                title={`Vista archivada ${selectedAuditReport.report_id}`}
                sandbox=""
                srcDoc={buildPrintHtml(selectedAuditReport.title, selectedAuditReport.body_markup, {
                  reportId: selectedAuditReport.report_id,
                  pageSize: selectedAuditReport.page_size || "Letter portrait",
                  pageMargin: selectedAuditReport.page_margin || "10mm",
                  bodyClassName: selectedAuditReport.body_class_name || ""
                })}
              />
            </div>
          ) : null}
          <DialogFooter className="password-form-actions print-batch-footer">
            <button type="button" className="button-secondary" onClick={() => setSelectedAuditReport(null)}>Cerrar</button>
            <button type="button" className="button-primary" onClick={handleReprintAuditReport} disabled={!selectedAuditReport?.body_markup}>
              <Icon name="print" /> Imprimir nuevamente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          {/* En el tablero la barra lleva el título de la página: la marca ya está
              en el menú lateral y aquí ya se está en el inicio. En los demás módulos
              la marca es el atajo al inicio (el tablero o la vista de entrada del rol). */}
          {workspaceView === "dashboard" ? (
            <h1 className="app-topbar-title">{headerMeta.title}</h1>
          ) : (
            <button
              type="button"
              className="app-topbar-brand"
              onClick={() => setWorkspaceView(getDefaultWorkspaceView(session?.user?.role))}
              aria-label="Ir al inicio"
            >
              <span className="app-brand-mark" aria-hidden="true">
                <img src={logoAguasCholuteca} alt="" className="app-topbar-logo" />
              </span>
              <div>
                <strong>Aguas de Choluteca</strong>
                <span>{headerMeta.title}</span>
              </div>
            </button>
          )}
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

        <div className={`search-card ${headerMeta.cardClass} ${workspaceView === "requests" ? "is-hidden" : ""}`}>
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
          ) : workspaceView === "entregas" ? (
            <div className="workspace-summary">
              <p className="workspace-title">Cierre diario, seguimiento de pendientes y trazabilidad de cada lote.</p>
              <div className="search-actions">
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
                </button>
              </div>
            </div>
          ) : (
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
                  <Icon name="records" />
                  Operaciones realizadas
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : workspaceView === "profile" ? (
            <div className="workspace-summary">
              <p className="workspace-title">
                Perfil operativo con rendimiento, puntos censados, zonas trabajadas, mensajes y logros del equipo.
              </p>
              <div className="dashboard-summary-chips">
                <span className="panel-pill">Vista en vivo</span>
                <span className="panel-pill">Mapa personal</span>
                <span className="panel-pill">Mensajes y logros</span>
              </div>
              <div className="search-actions">
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contrasena
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesion
                </button>
              </div>
            </div>
          ) : workspaceView === "executiveReport" ? (
            <div className="workspace-summary">
              <p className="workspace-title">
                Informe descargable para presentar las operaciones realizadas, funciones desarrolladas, ahorro de tiempo técnico y datos acumulados desde el primer registro disponible.
              </p>
              <div className="dashboard-summary-chips">
                <span className="panel-pill">Periodo: {executiveReportData.firstDate ? formatSpanishDate(executiveReportData.firstDate) : "Sin registros"} - {formatSpanishDate(executiveReportData.generatedAt)}</span>
                <span className="panel-pill">{safeRecords.length} fichas</span>
                <span className="panel-pill">{safeMapPoints.length} puntos GPS</span>
                <span className="panel-pill">{safeAuditLogs.length} eventos</span>
              </div>
              <div className="search-actions">
                <button type="button" onClick={handleDownloadExecutiveReportPdf}>
                  <Icon name="records" />
                  Descargar PDF de operaciones
                </button>
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("dashboard")}>
                  <Icon name="dashboard" />
                  Volver al tablero
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
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
              <div className="search-row">
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
            <div className="workspace-summary">
              <p className="workspace-title">
                Módulo independiente para geolocalizar puntos técnicos en campo y dejar registro de cajas de aguas negras.
              </p>
              <div className="map-diary-summary">
                <span className="panel-pill">Bitácora: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
                <span className="helper-text">{visibleMapPoints.length} puntos de {mapDiaryGroups.length} jornadas registradas.</span>
              </div>
              <div className="search-actions">
                <button type="button" className="button-secondary" onClick={handleLocateUser} disabled={locatingUser}>
                  <Icon name="map" />
                  {locatingUser ? "Ubicando..." : "Mi ubicación"}
                </button>
                <button type="button" className="button-secondary" onClick={() => loadMapPoints()} disabled={loadingMapPoints}>
                  <Icon name="refresh" />
                  {loadingMapPoints ? "Actualizando..." : "Refrescar puntos"}
                </button>
                <button type="button" className="button-secondary" onClick={handleDownloadMapReport}>
                  <Icon name="records" />
                  Descargar reporte detallado
                </button>
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("executiveReport")}>
                  <Icon name="records" />
                  Operaciones realizadas
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : workspaceView === "importacion" ? (
            <div className="workspace-summary">
              <p className="workspace-title">Revisa los lotes recibidos desde FoxPro antes de aplicar cambios al padron maestro.</p>
              <div className="search-actions">
                <button type="button" className="button-secondary" onClick={handleLogout}><Icon name="logout" />Cerrar sesion</button>
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
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
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
                <div className="map-report-action-group is-session">
                  <span>Cuenta</span>
                  <div className="search-actions">
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
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
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
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
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
                </button>
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
      )}
    </div>
  );
}

export default App;
