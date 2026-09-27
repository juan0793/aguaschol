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
  AUDIT_FILTER_KEYS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_ENTITY_OPTIONS,
} from "./utils/audit";
import {
  MAP_DIARY_PRIMARY_LIMIT,
} from "./constants/workspace";
import { getTodayMapDiaryKey } from "./utils/mapDiary";
import {
  normalizeMapReportSettings,
} from "./utils/mapReport";
import {
  formatDashboardSyncRelativeTime,
} from "./utils/timeFormat";
import {
  getAlertDetails,
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
  const peticionesEnCursoRef = useRef(0);
  const actividadTimerRef = useRef(0);
  const navigateWithFocus = (view, focus) => { setCrossModuleFocus(focus ? { view, requestId: Date.now(), ...focus } : null); setWorkspaceView(view); };
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
  const fieldMapPoints = useFieldMapPoints({ ...fieldMapState, activeMapDiaryDateKey, safeMapPoints });
  const mapReportModel = useMapReportData({ ...fieldMapState, ...fieldMapPoints, mapDiaryGroups, mapReportSettings, safeBarrioCodes });
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
  const lookupActions = useLookupActions({
    ...lookupState,
    ...padronState,
    ...appShellState,
    apiFetch,
    clearSession,
    isAuthenticated,
    showAlert
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






































  const fieldDebtReports = createFieldDebtReports({
    ...mapReportModel,
    ...fieldMapState,
    ...padronState,
    ...fieldMapPoints,
    activeMapDiaryDateKey,
    apiFetch,
    showAlert
  });
  const dashboardData = useDashboardData({
    ...padronState,
    ...recordFilterModel,
    ...dashboardState,
    ...fieldMapState,
    getRecordBarrioName,
    isAdmin,
    mapDiaryGroups,
    mapPointsTotal,
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
    ...padronState,
    ...dashboardData,
    ...fieldMapState,
    ...mapReportModel,
    ...padronRequestState,
    ...recordFilterModel,
    getRecordBarrioName,
    mapDiaryGroups,
    onlineUsers,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeRecords,
    safeUsers
  });
  const { handleDownloadExecutiveReportPdf } = createExecutiveReportPdf({
    ...recordFilterModel,
    executiveReportData,
    mapDiaryGroups,
    safeAuditLogs,
    safeMapPoints,
    safeRecords,
    safeUsers,
    showAlert
  });
  const reportMapActions = useReportMapActions({
    ...fieldMapState,
    ...fieldMapPoints,
    apiFetch,
    clearSession,
    reportMapCaptureRef,
    safeBarrioCodes,
    safeMapPoints,
    setMapReportSettings,
    showAlert
  });
  const { handleDownloadRegulatorEvidencePdf } = createRegulatorEvidencePdf({
    ...reportMapActions,
    ...fieldMapState,
    ...sessionState,
    ...fieldMapPoints,
    activeMapDiaryDateKey,
    apiFetch,
    isAdmin,
    mapReportSettings,
    safeAuditLogs,
    safeBarrioCodes,
    safeMapPoints,
    safeUsers,
    selectedRegulatorDiaryKeys,
    showAlert
  });
  const mapReportPrinters = createMapReportPrinters({
    ...fieldDebtReports,
    ...reportMapActions,
    ...mapReportModel,
    ...fieldMapState,
    activeMapDiaryDateKey,
    apiFetch,
    mapReportSettings,
    showAlert
  });
  const printBatchSelection = usePrintBatchSelection({ ...recordsState, ...recordFilterModel, getRecordBarrioName, safeRecords });
  const recordLoaders = createRecordLoaders({ ...recordsState, apiFetch, clearSession, isAdmin, isAuthenticated, showAlert });
  const { loadRecordSummary } = recordLoaders;
  const fichaPrinting = createFichaPrinting({
    ...printBatchSelection,
    ...recordsState,
    ...recordLoaders,
    apiFetch,
    getRecordBarrioName,
    selectedPhotoUrl,
    showAlert
  });
  const { handlePrintFicha, handlePrintAviso } = fichaPrinting;
  const padronDataActions = createPadronDataActions({
    ...padronRequestState,
    ...lookupActions,
    ...padronState,
    ...dashboardState,
    ...fieldMapState,
    ...lookupState,
    ...appShellState,
    apiFetch,
    clearSession,
    isAdmin,
    isAuthenticated,
    showAlert
  });
  const padronReportPrinters = createPadronReportPrinters({
    ...padronReportData,
    ...padronState,
    ...dashboardData,
    ...padronDataActions,
    ...fichaPrinting,
    ...padronRequestState,
    ...recordsState,
    getRecordBarrioName,
    safeBarrioCodes,
    showAlert
  });

  const { loadUsers } = createUserLoaders({ ...usersState, apiFetch, clearSession, isAdmin, isAuthenticated, showAlert });
  const auditLoaders = createAuditLoaders({ ...auditState, apiFetch, clearSession, isAdmin, isAuthenticated, showAlert });
  const { loadAuditLogs } = auditLoaders;
  const userAdminActions = createUserAdminActions({ ...usersState, ...auditLoaders, apiFetch, clearSession, loadUsers, showAlert });
  const { handleDeleteUser } = userAdminActions;
  const padronAdminActions = createPadronAdminActions({ ...padronState, ...padronDataActions, ...dashboardState, apiFetch, clearSession, showAlert });
  const auditActions = createAuditActions({ ...auditState, apiFetch, showAlert });
  const authActions = createAuthActions({
    ...auditLoaders,
    ...sessionState,
    ...appShellState,
    apiFetch,
    clearSession,
    intentionalLogoutRef,
    sessionInvalidatingRef,
    showAlert
  });
  const { handleLogout } = authActions;
  const fieldMapActions = createFieldMapActions({
    ...fieldMapState,
    ...fieldMapPoints,
    apiFetch,
    clearSession,
    isAdmin,
    safeBarrioCodes,
    safeMapPoints,
    showAlert
  });
  const { headerStats } = useHeaderStats({
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
    mapDiaryGroups,
    mapPointsTotal,
    onlineUsers,
    safeAuditLogs,
    safeBarrioCodes,
    safeRecords
  });
  const appNavigation = useAppNavigation({
    ...mapReportModel,
    ...padronState,
    ...padronRequestState,
    ...fieldMapPoints,
    ...appShellState,
    isAdmin,
    isFieldValidator,
    mapPointsTotal,
    safeAuditLogs,
    safeBarrioCodes,
    safeRecords,
    safeUsers
  });
  const { sidebarNavigationSections } = appNavigation;
  const barrioCodeActions = createBarrioCodeActions({ ...barrioCodesState, apiFetch, clearSession, isAuthenticated, showAlert });
  const mapDataLoaders = createMapDataLoaders({
    ...fieldMapState,
    apiFetch,
    archivedMapDiaryGroups,
    clearSession,
    isAdmin,
    isAuthenticated,
    mapPointsRequestRef,
    safeMapPoints,
    selectedArchiveMapDiaryGroup,
    selectedRegulatorDiaryKeys,
    showAlert
  });
  const { loadMapDiaryGroups } = mapDataLoaders;
  const recordFormActions = createRecordFormActions({
    ...recordsState,
    ...recordLoaders,
    ...usersState,
    apiFetch,
    getRecordBarrioName,
    safeBarrioCodes,
    sheetRef,
    showAlert
  });
  const { resetForm, handleDeleteArchivedRecord } = recordFormActions;
  const lookupRecordBridge = createLookupRecordBridge({
    ...recordFormActions,
    ...recordsState,
    ...appShellState,
    apiFetch,
    clearSession,
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
    ...fieldMapState,
    ...mapDataLoaders,
    ...mapReportModel,
    ...padronState,
    ...fieldMapPoints,
    ...appShellState,
    activeMapDiaryDateKey,
    apiFetch,
    isAdmin,
    isAuthenticated,
    mapPointsRequestRef,
    regulatorReportDiaryOptions,
    safeBarrioCodes
  });
  useAdminDataEffects({
    ...padronState,
    ...auditState,
    ...padronDataActions,
    ...auditLoaders,
    ...barrioCodeActions,
    ...mapDataLoaders,
    ...recordLoaders,
    ...appShellState,
    apiFetch,
    isAdmin,
    isAuthenticated,
    loadUsers,
    refreshDashboard
  });
  useAppShellEffects({
    ...sessionState,
    ...fieldMapState,
    ...appShellState,
    apiFetch,
    clearSession,
    intentionalLogoutRef,
    isAdmin,
    isAuthenticated,
    isFieldValidator,
    mustChangePassword,
    sessionInvalidatingRef,
    setShowUserMenu,
    showAlert,
    sidebarCollapsed
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
        model={{ ...fieldMapState, ...mapReportModel, ...fieldDebtReports, activeMapDiaryDateKey }}
      />
      <MapDiaryArchiveDialog
        model={{
          ...fieldMapState,
          ...mapDataLoaders,
          archivedMapDiaryGroups,
          selectedArchiveMapDiaryGroup,
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
          activeMapDiaryDateKey,
          apiFetch,
          executiveReportData,
          handleDownloadExecutiveReportPdf,
          headerStats,
          isAdmin,
          isDirty,
          loadUsers,
          mapDiaryGroups,
          onlineUsers,
          safeAuditLogs,
          safeMapPoints,
          safeRecords,
          setShowUserMenu,
          showAlert,
          showUserMenu
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
          ...padronState,
          ...recordFilterModel,
          executiveReportData,
          handleDownloadExecutiveReportPdf,
          mapDiaryGroups,
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
            ...lookupRecordBridge,
            ...padronState,
            ...padronAdminActions,
            ...lookupActions,
            ...lookupState,
            apiFetch
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
            ...fieldMapActions,
            ...fieldMapState,
            ...mapReportPrinters,
            ...fieldMapPoints,
            ...mapDataLoaders,
            ...appShellState,
            activeMapDiaryDateKey,
            archivedMapDiaryGroups,
            isAdmin,
            mapDiaryGroups,
            primaryMapDiaryGroups
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
            activeMapDiaryDateKey,
            apiFetch,
            auditDayGroups,
            auditFilterChips,
            auditRangeLabel,
            auditSyncing,
            handleDownloadRegulatorEvidencePdf,
            mapDiaryGroups,
            mapReportSettings,
            regulatorReportDiaryOptions,
            safeAuditLogs,
            safeBarrioCodes,
            safeUsers,
            selectedRegulatorDiaryKeys,
            selectedUser,
            showAlert
          }}
        />
      )}
    </div>
  );
}

export default App;
