import { useEffect, useMemo, useRef, useState } from "react";
import FieldMap from "./components/FieldMap";
import { Icon, actionIconName } from "./components/Icon";
import TransportWorkspace from "./components/TransportWorkspace";
import logoAguasCholuteca from "./assets/logo-aguas-choluteca.png";
import { API_URL } from "./config/api";
import {
  AUTH_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  DRAFT_SAVED_AT_STORAGE_KEY,
  LOOKUP_HISTORY_STORAGE_KEY,
  RECORD_ALERT_NOTIFICATION_STORAGE_KEY,
  NOTIFICATION_REQUEST_STORAGE_KEY
} from "./constants/storageKeys";
import {
  defaultMapReportStaff,
  defaultPadronRequestForm,
  emptyForm,
  emptyMapDraft,
  emptyMapReportDraft,
  fieldGroups,
  LOOKUP_SEARCH_MODES,
  MAP_MARKER_COLORS,
  MAP_POINT_TYPES,
  MAX_LOOKUP_HISTORY_ITEMS,
  recordQuickFilterOptions,
  recordStatusFilterOptions,
  saveIntentOptions,
  sectionDefinitions
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
  formatClaveInput,
  getLookupServiceMeta,
  getLookupValidationMessage,
  isLookupKeyComplete,
  isLookupQueryReady,
  sanitizeLookupInput
} from "./utils/claveAndLookup";
import {
  formatDateTime,
  formatMapDiaryLabel,
  formatMonthGroup,
  formatSpanishDate,
  getMapDiaryDateKey,
  normalizeDateField,
  normalizeRecord
} from "./utils/datesAndBusiness";
import {
  buildExternalMapUrl,
  buildMapReportDraftFromPoint,
  deriveMapPointZone,
  formatCoordinate,
  getMapPointContextKey,
  getMapPointTypeLabel
} from "./utils/mapField";
import {
  comparableFormShape,
  getRecordDeadlineMeta,
  getRecordGroupDate,
  getRecordValidationIssues,
  hasDraftContent
} from "./utils/records";
import { loadStoredLookupHistory, loadStoredRecordNotifications } from "./utils/localStorage";
import { escapeHtml } from "./utils/html";
import { fileToDataUrl, optimizeImageForUpload, urlToDataUrl } from "./utils/imageUtils";
import { pause, printDocument } from "./utils/printDocument";

const DASHBOARD_WIDGET_STORAGE_KEY = "aguaschol:dashboard-widgets:v1";
const DEFAULT_DASHBOARD_WIDGET_ORDER = [
  "spotlight",
  "metrics",
  "signals",
  "executive",
  "activity",
  "lookup",
  "journeys",
  "online"
];

const normalizeDashboardWidgetPrefs = (value) => {
  const orderSource = Array.isArray(value?.order) ? value.order : [];
  const hiddenSource = Array.isArray(value?.hidden) ? value.hidden : [];
  const order = [
    ...orderSource.filter((item, index) => DEFAULT_DASHBOARD_WIDGET_ORDER.includes(item) && orderSource.indexOf(item) === index),
    ...DEFAULT_DASHBOARD_WIDGET_ORDER.filter((item) => !orderSource.includes(item))
  ];
  const hidden = hiddenSource.filter((item, index) => DEFAULT_DASHBOARD_WIDGET_ORDER.includes(item) && hiddenSource.indexOf(item) === index);

  return { order, hidden };
};

const getWorkspaceViewByRole = (role) =>
  role === "admin" ? "dashboard" : role === "transport" ? "transport" : "records";

function App() {
  const sheetRef = useRef(null);
  const reportMapCaptureRef = useRef(null);
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
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
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
  const [draftSaveState, setDraftSaveState] = useState(() => (draftForm ? "saved" : "idle"));
  const [search, setSearch] = useState("");
  const [emptyRecordsMessage, setEmptyRecordsMessage] = useState("Cargando registros...");
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState(saveIntentOptions.stay);
  const [loading, setLoading] = useState(true);
  const [loadingRecordHistory, setLoadingRecordHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [avisoHtml, setAvisoHtml] = useState("");
  const [loadingAviso, setLoadingAviso] = useState(false);
  const [activeSection, setActiveSection] = useState("abonado");
  const [recordView, setRecordView] = useState("active");
  const [recordQuickFilter, setRecordQuickFilter] = useState("all");
  const [recordFilters, setRecordFilters] = useState({
    barrio: "",
    responsible: "",
    date_from: "",
    date_to: "",
    status: "all"
  });
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(
    () => window.localStorage.getItem(DRAFT_SAVED_AT_STORAGE_KEY) || null
  );
  const [notifiedRecordAlerts, setNotifiedRecordAlerts] = useState(() => loadStoredRecordNotifications());
  const [workspaceView, setWorkspaceView] = useState(() => getWorkspaceViewByRole(session?.user?.role));
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
  const [showMobileModuleMenu, setShowMobileModuleMenu] = useState(false);
  const [lookupSearchMode, setLookupSearchMode] = useState("clave");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPrefixMode, setLookupPrefixMode] = useState("auto");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupFeedback, setLookupFeedback] = useState("");
  const [lookupHistory, setLookupHistory] = useState(() => loadStoredLookupHistory());
  const [padronRequestTemplates, setPadronRequestTemplates] = useState([]);
  const [padronRequestForm, setPadronRequestForm] = useState(defaultPadronRequestForm);
  const [padronRequestResult, setPadronRequestResult] = useState(null);
  const [loadingPadronRequest, setLoadingPadronRequest] = useState(false);
  const [loadingPadronRequestMeta, setLoadingPadronRequestMeta] = useState(false);
  const [mapPoints, setMapPoints] = useState([]);
  const [loadingMapPoints, setLoadingMapPoints] = useState(false);
  const [loadingMapContexts, setLoadingMapContexts] = useState(false);
  const [mapPointContexts, setMapPointContexts] = useState({});
  const [mapReportPage, setMapReportPage] = useState(1);
  const [savingReportMapPoint, setSavingReportMapPoint] = useState(false);
  const [editingReportMapPointId, setEditingReportMapPointId] = useState(null);
  const [selectedReportMapPointId, setSelectedReportMapPointId] = useState(null);
  const [reportMapStatus, setReportMapStatus] = useState("Sincronizado");
  const [reportMapDraft, setReportMapDraft] = useState(emptyMapReportDraft);
  const [reportMapFocusRequest, setReportMapFocusRequest] = useState(null);
  const [mapReportStaff, setMapReportStaff] = useState(defaultMapReportStaff);
  const [savingMapPoint, setSavingMapPoint] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [selectedMapPointId, setSelectedMapPointId] = useState(null);
  const [mapStatus, setMapStatus] = useState("Sincronizado");
  const [mapDraft, setMapDraft] = useState(emptyMapDraft);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [mapDiaryDateKey, setMapDiaryDateKey] = useState(() => getMapDiaryDateKey(new Date()));
  const [padronMeta, setPadronMeta] = useState(null);
  const [padronImportSummary, setPadronImportSummary] = useState(null);
  const [padronFile, setPadronFile] = useState(null);
  const [uploadingPadron, setUploadingPadron] = useState(false);
  const [reprocessingPadron, setReprocessingPadron] = useState(false);
  const [loadingPadronMeta, setLoadingPadronMeta] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    full_name: "",
    email: "",
    role: "operator"
  });
  const [latestUserResult, setLatestUserResult] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [recordHistory, setRecordHistory] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    action: "",
    entity_type: "",
    actor: "",
    search: "",
    date_from: "",
    date_to: ""
  });
  const lookupModeConfig =
    LOOKUP_SEARCH_MODES.find((mode) => mode.value === lookupSearchMode) ?? LOOKUP_SEARCH_MODES[0];
  const lookupInputLabel =
    lookupSearchMode === "clave"
      ? "Clave catastral"
      : lookupSearchMode === "nombre"
        ? "Nombre o inquilino"
        : "Numero de abonado";
  const lookupInputPlaceholder =
    lookupSearchMode === "clave"
      ? lookupPrefixMode === "three"
        ? "000-00-00 o 000-00-00-00"
        : "00-00-00, 000-00-00 o clave completa"
      : lookupSearchMode === "nombre"
        ? "Ej. Juan Aguilera Estrada"
        : "Ej. 16523";
  const isAuthenticated = Boolean(session?.token);
  const isAdmin = session?.user?.role === "admin";
  const isTransport = session?.user?.role === "transport";
  const mustChangePassword = Boolean(session?.user?.force_password_change);
  const passwordModalVisible = isAuthenticated && (mustChangePassword || showPasswordModal);
  const safeRecords = Array.isArray(records) ? records : [];
  const safeMapPoints = Array.isArray(mapPoints) ? mapPoints : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const mapDiaryGroups = useMemo(() => {
    const groups = safeMapPoints.reduce((accumulator, point) => {
      const key = getMapDiaryDateKey(point.created_at);
      if (!key) return accumulator;
      const current = accumulator.get(key) ?? { key, total: 0 };
      current.total += 1;
      accumulator.set(key, current);
      return accumulator;
    }, new Map());

    return Array.from(groups.values()).sort((left, right) => right.key.localeCompare(left.key));
  }, [safeMapPoints]);
  const activeMapDiaryDateKey = useMemo(
    () =>
      mapDiaryGroups.some((group) => group.key === mapDiaryDateKey)
        ? mapDiaryDateKey
        : mapDiaryGroups[0]?.key ?? getMapDiaryDateKey(new Date()),
    [mapDiaryDateKey, mapDiaryGroups]
  );
  const visibleMapPoints = useMemo(
    () => safeMapPoints.filter((point) => getMapDiaryDateKey(point.created_at) === activeMapDiaryDateKey),
    [activeMapDiaryDateKey, safeMapPoints]
  );
  const selectedMapPoint = visibleMapPoints.find((point) => point.id === selectedMapPointId) ?? null;
  const selectedReportMapPoint = visibleMapPoints.find((point) => point.id === selectedReportMapPointId) ?? null;
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
            lead: "Gestion centralizada de fichas, avisos y seguimiento operativo del sistema.",
            kicker: "Operacion segura"
          },
          users: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Administracion de accesos",
            title: "Gestion de usuarios",
            lead: "Creacion de cuentas, control de perfiles y entrega de credenciales con un flujo claro.",
            kicker: "Control de acceso"
          },
          dashboard: {
            panelClass: "hero-panel-dashboard",
            cardClass: "search-card-dashboard",
            toplineLabel: "Centro administrativo",
            title: "Tablero de control",
            lead: "Resumen ejecutivo con operaciones, actividad reciente y accesos rapidos para gestionar toda la plataforma.",
            kicker: "Vision general"
          },
          padron: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Administracion de padron",
            title: "Padron maestro",
            lead: "Carga y reemplazo del archivo maestro usado por la consulta rapida de claves.",
            kicker: "Actualizacion central"
          },
          lookup: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Consulta rapida",
            title: "Buscar clave catastral",
            lead: "Consulta apartada del modulo de fichas para validar si una clave ya existe en el padron maestro.",
            kicker: "Uso en campo"
          },
          map: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Geolocalizacion operativa",
            title: "Mapa de campo",
            lead: "Modulo independiente para ubicar y registrar puntos tecnicos de cajas y descargas en terreno.",
            kicker: "Trabajo en sitio"
          },
          mapReports: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-users",
            toplineLabel: "Administracion de campo",
            title: "Reportes de levantamiento",
            lead: "Centro de reportes compacto para imprimir coordenadas, totales y zonas del trabajo levantado en campo.",
            kicker: "Reporte institucional"
          },
          transport: {
            panelClass: "hero-panel-records",
            cardClass: "search-card-records",
            toplineLabel: "Monitoreo de transporte",
            title: "Seguimiento del vehiculo recolector",
            lead: "Traza la calle autorizada, ve el recorrido en verde y detecta a tiempo si el vehiculo se sale de la ruta.",
            kicker: "Ruta supervisada"
          },
          requests: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Peticiones institucionales",
            title: "Solicitudes al padron maestro",
            lead: "Generacion de listados administrativos filtrados desde el padron, listos para impresion y PDF.",
            kicker: "Analisis ejecutivo"
          },
          logs: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-logs",
            toplineLabel: "Bitacora profesional",
            title: "Historial de actividad",
            lead: "Seguimiento continuo de movimientos relevantes con una lectura mas limpia y trazable.",
            kicker: "Trazabilidad"
          }
        }[workspaceView] ?? {
          panelClass: "hero-panel-records",
          cardClass: "search-card-records",
          toplineLabel: "Panel operativo",
          title: "Registro de inmuebles clandestinos",
          lead: "Gestion centralizada de fichas, avisos y seguimiento operativo del sistema.",
          kicker: "Operacion segura"
        }
      ),
    [workspaceView]
  );
  const headerStats = useMemo(() => {
    if (workspaceView === "dashboard") {
      return [
        {
          icon: "records",
          label: "Fichas activas",
          value: String(safeRecords.length)
        },
        {
          icon: "users",
          label: "Usuarios en linea",
          value: String(onlineUsers.length)
        },
        {
          icon: "map",
          label: "Jornadas de campo",
          value: String(mapDiaryGroups.length)
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

    if (workspaceView === "map") {
      return [
        {
          icon: "map",
          label: "Puntos guardados",
          value: String(visibleMapPoints.length)
        },
        {
          icon: locatingUser ? "refresh" : "activity",
          label: "Geolocalizacion",
          value: locatingUser ? "Buscando" : mapStatus
        },
        {
          icon: selectedMapPoint ? "success" : "map",
          label: "Seleccion",
          value: selectedMapPoint ? getMapPointTypeLabel(selectedMapPoint.point_type) : "Sin punto"
        }
      ];
    }

    if (workspaceView === "mapReports") {
      const zones = new Set(visibleMapPoints.map((point) => deriveMapPointZone(point)));
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

    if (workspaceView === "transport") {
      return [
        {
          icon: "transport",
          label: "Modulo",
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

    if (workspaceView === "requests") {
      return [
        {
          icon: "records",
          label: "Registros",
          value: String(padronRequestResult?.summary?.total_registros ?? 0)
        },
        {
          icon: "dashboard",
          label: "Barrios",
          value: String(padronRequestResult?.summary?.total_barrios ?? 0)
        },
        {
          icon: loadingPadronRequest ? "refresh" : "activity",
          label: "Estado",
          value: loadingPadronRequest ? "Generando" : padronRequestResult ? "Listo" : "Sin consulta"
        }
      ];
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
        value: form.id ? "Edicion" : "Nueva ficha"
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
    onlineUsers.length,
    padronMeta,
    loadingMapPoints,
    visibleMapPoints.length,
    safeRecords.length,
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
  const availableRecordBarrios = useMemo(
    () =>
      Array.from(
        new Set(
          safeRecords
            .map((record) => String(record.barrio_colonia || "").trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, "es")),
    [safeRecords]
  );
  const availableRecordResponsibles = useMemo(
    () =>
      Array.from(
        new Set(
          safeRecords
            .flatMap((record) => [record.levantamiento_datos, record.analista_datos])
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, "es")),
    [safeRecords]
  );
  const advancedFilteredRecords = useMemo(() => {
    return safeRecords.filter((record) => {
      if (recordFilters.barrio) {
        const barrio = String(record.barrio_colonia || "").trim();
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
  const visibleRecordGroups = useMemo(() => {
    const visibleLimit = draftForm ? 9 : 10;
    const limitedRecords = filteredRecords.slice(0, Math.max(visibleLimit, 0));
    const groups = [];

    limitedRecords.forEach((record) => {
      const label = formatMonthGroup(getRecordGroupDate(record, recordView));
      const currentGroup = groups[groups.length - 1];

      if (!currentGroup || currentGroup.label !== label) {
        groups.push({ label, items: [record] });
        return;
      }

      currentGroup.items.push(record);
    });

    return groups;
  }, [draftForm, filteredRecords, recordView]);
  const recordValidationIssues = useMemo(
    () => getRecordValidationIssues(form, Boolean(form.foto_path), selectedFile),
    [form, selectedFile]
  );
  const selectedRecordDeadlineMeta = useMemo(
    () => (form.id ? recordDeadlineMetaById[form.id] ?? null : null),
    [form.id, recordDeadlineMetaById]
  );
  const mapReportData = useMemo(() => {
    const points = [...visibleMapPoints].sort((left, right) => {
      const leftContext = mapPointContexts[getMapPointContextKey(left)] ?? null;
      const rightContext = mapPointContexts[getMapPointContextKey(right)] ?? null;
      const leftZone = leftContext?.zone || deriveMapPointZone(left);
      const rightZone = rightContext?.zone || deriveMapPointZone(right);
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
      const zone = context?.zone || deriveMapPointZone(point);
      const current = zoneMap.get(zone) ?? {
        zone,
        total: 0,
        items: [],
        accuracyValues: [],
        pointTypes: new Set(),
        nearbyReferences: new Set(),
        locationHints: new Set()
      };

      current.total += 1;
      current.items.push({
        ...point,
        suggested_zone: context?.zone || "",
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
      nearbyReferencesLabel: Array.from(zone.nearbyReferences).slice(0, 3).join(" | "),
      primaryLocationLabel: Array.from(zone.locationHints)[0] || ""
    }));

    return {
      totalPoints: points.length,
      totalZones: zones.length,
      totalsByType,
      zones
    };
  }, [mapPointContexts, visibleMapPoints]);
  const adminWorkspaceItems = useMemo(
    () =>
      isAdmin
        ? [
            { key: "dashboard", section: "vision", label: "Tablero", icon: "dashboard", meta: "Vista ejecutiva", tone: "is-vision" },
            { key: "records", section: "operacion", label: "Fichas", icon: "records", meta: `${safeRecords.length} visibles`, tone: "is-records" },
            { key: "lookup", section: "operacion", label: "Buscar clave", icon: "search", meta: "Consulta rapida", tone: "is-lookup" },
            { key: "map", section: "operacion", label: "Mapa de campo", icon: "map", meta: `${safeMapPoints.length} puntos`, tone: "is-map" },
            { key: "transport", section: "operacion", label: "Transporte", icon: "transport", meta: "Ruta y monitoreo", tone: "is-map" },
            { key: "mapReports", section: "control", label: "Reportes campo", icon: "records", meta: `${mapReportData.totalZones} zonas`, tone: "is-report" },
            { key: "requests", section: "control", label: "Peticiones", icon: "dashboard", meta: `${padronRequestResult?.summary?.total_registros ?? 0} filas`, tone: "is-report" },
            { key: "users", section: "control", label: "Usuarios", icon: "users", meta: `${safeUsers.length} registrados`, tone: "is-users" },
            { key: "padron", section: "control", label: "Padron", icon: "refresh", meta: `${padronMeta?.total_records ?? 0} claves`, tone: "is-padron" },
            { key: "logs", section: "control", label: "Historial", icon: "logs", meta: `${safeAuditLogs.length} eventos`, tone: "is-logs" }
          ]
        : [],
    [
      isAdmin,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalZones,
      padronMeta?.total_records,
      safeAuditLogs.length,
      safeMapPoints.length,
      safeRecords.length,
      safeUsers.length
    ]
  );
  const adminWorkspaceSections = useMemo(() => {
    const sectionMeta = {
      vision: {
        title: "Vision",
        detail: "Lectura rapida del sistema y acceso al tablero."
      },
      operacion: {
        title: "Operacion",
        detail: "Trabajo diario de fichas, consulta y levantamiento."
      },
      control: {
        title: "Control",
        detail: "Supervision, reportes, usuarios y padron maestro."
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
            { key: "records", label: "Fichas", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rapida" },
            { key: "map", label: "Mapa de campo", icon: "map", group: "operacion", helper: `${visibleMapPoints.length} puntos hoy` },
            { key: "transport", label: "Transporte", icon: "transport", group: "operacion", helper: "Tiempo real" },
            { key: "mapReports", label: "Reportes campo", icon: "records", group: "control", helper: `${mapReportData.totalZones} zonas` },
            { key: "requests", label: "Peticiones", icon: "dashboard", group: "control", helper: `${padronRequestResult?.summary?.total_registros ?? 0} filas` },
            { key: "padron", label: "Padron", icon: "refresh", group: "control", helper: `${padronMeta?.total_records ?? 0} claves` },
            { key: "logs", label: "Historial", icon: "logs", group: "control", helper: `${safeAuditLogs.length} eventos` },
            { key: "users", label: "Usuarios", icon: "users", group: "administracion", helper: `${safeUsers.length} registrados` }
          ]
        : isTransport
          ? [{ key: "transport", label: "Transporte", icon: "transport", group: "operacion", helper: "Ruta asignada" }]
        : [
            { key: "records", label: "Fichas", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rapida" },
            { key: "map", label: "Mapa", icon: "map", group: "operacion", helper: `${visibleMapPoints.length} puntos hoy` }
          ]),
    [
      isAdmin,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalZones,
      padronMeta?.total_records,
      safeAuditLogs.length,
      safeRecords.length,
      safeUsers.length,
      visibleMapPoints.length,
      isTransport
    ]
  );
  const mobilePrimaryModuleKeys = useMemo(
    () => (isTransport ? ["transport"] : ["records", "lookup", "map", "transport"]),
    [isTransport]
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
  const adminInsight = useMemo(() => {
    if (!isAdmin) {
      return null;
    }

    if (!padronMeta?.total_records) {
      return {
        icon: "refresh",
        title: "Padron pendiente",
        detail: "Conviene validar o actualizar el padron maestro antes de abrir consultas masivas."
      };
    }

    if (onlineUsers.length >= 4) {
      return {
        icon: "users",
        title: "Equipo conectado",
        detail: `Hay ${onlineUsers.length} usuarios en linea; el tablero te ayuda a monitorear campo, fichas y actividad sin cambiar de modulo.`
      };
    }

    if (mapDiaryGroups.length > 1) {
      return {
        icon: "map",
        title: "Bitacora activa",
        detail: `Ya hay ${mapDiaryGroups.length} jornadas registradas; puedes entrar a Reportes campo para revisar la del dia con mejor contexto.`
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
      detail: "Empieza por Tablero para una vista ejecutiva o entra directo al modulo que necesites."
    };
  }, [isAdmin, mapDiaryGroups.length, onlineUsers.length, padronMeta?.total_records, safeAuditLogs.length]);
  const totalCajaRegistro = useMemo(
    () => visibleMapPoints.filter((point) => point.point_type === "caja_registro").length,
    [visibleMapPoints]
  );
  const recordsUpdatedToday = useMemo(
    () =>
      safeRecords.filter((record) => getMapDiaryDateKey(record.updated_at || record.created_at) === todayDateKey)
        .length,
    [safeRecords, todayDateKey]
  );
  const mapPointsToday = useMemo(
    () => safeMapPoints.filter((point) => getMapDiaryDateKey(point.created_at) === todayDateKey).length,
    [safeMapPoints, todayDateKey]
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
    const totalPages = Math.max(1, Math.ceil(mapReportData.zones.length / pageSize));
    const currentPage = Math.min(mapReportPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      pageSize,
      totalPages,
      currentPage,
      zones: mapReportData.zones.slice(start, start + pageSize)
    };
  }, [mapReportData.zones, mapReportPage]);
  const dashboardMetrics = useMemo(
    () => [
      {
        label: "Movimiento de hoy",
        value: recordsUpdatedToday,
        helper: `${safeRecords.length} fichas activas en operacion`,
        icon: "records"
      },
      {
        label: "Borrador de campo",
        value: draftForm ? "Listo" : "Vacio",
        helper: draftForm
          ? `Ultimo guardado ${draftSavedAt ? formatDateTime(draftSavedAt) : "hace un momento"}`
          : "Sin captura pendiente en este equipo",
        icon: draftForm ? "success" : "history"
      },
      {
        label: "Campo hoy",
        value: mapPointsToday,
        helper: `${mapDiaryGroups.length} jornadas guardadas en bitacora`,
        icon: "map"
      },
      {
        label: "Consultas rapidas",
        value: recentLookupCountToday,
        helper: lookupHistory.length
          ? `${lookupHistory.length} consultas recientes listas para repetir`
          : "Aun no hay busquedas guardadas",
        icon: "search"
      }
    ],
    [draftForm, draftSavedAt, lookupHistory.length, mapDiaryGroups.length, mapPointsToday, recentLookupCountToday, recordsUpdatedToday, safeRecords.length]
  );
  const dashboardActivity = useMemo(() => safeAuditLogs.slice(0, 5), [safeAuditLogs]);
  const dashboardJourneys = useMemo(() => mapDiaryGroups.slice(0, 4), [mapDiaryGroups]);
  const dashboardFocusCards = useMemo(
    () => [
      {
        title: "Operacion del dia",
        value: `${recordsUpdatedToday} movimientos hoy`,
        detail: draftForm
          ? "Tienes un borrador operativo listo para retomarse."
          : pendingPhotoRecords
            ? `${pendingPhotoRecords} fichas siguen sin fotografia asociada.`
            : "El modulo de fichas esta listo para captura y seguimiento.",
        icon: "records",
        actionLabel: "Abrir fichas",
        actionView: "records"
      },
      {
        title: "Campo y geolocalizacion",
        value: `${mapPointsToday} puntos hoy`,
        detail: dashboardJourneys[0]
          ? `Ultima jornada: ${formatMapDiaryLabel(dashboardJourneys[0].key)} con ${dashboardJourneys[0].total} puntos.`
          : "Todavia no hay jornadas cargadas en mapa de campo.",
        icon: "map",
        actionLabel: "Ir a mapa",
        actionView: "map"
      },
      {
        title: "Consulta y padron",
        value: `${lookupHistory.length} consultas`,
        detail: padronMeta?.file_name
          ? `Padron activo: ${padronMeta.file_name}`
          : "Conviene validar el padron maestro antes de consultas masivas.",
        icon: "search",
        actionLabel: "Buscar clave",
        actionView: "lookup"
      }
    ],
    [dashboardJourneys, draftForm, lookupHistory.length, mapPointsToday, padronMeta?.file_name, pendingPhotoRecords, recordsUpdatedToday]
  );
  const dashboardQuickActions = useMemo(
    () => [
      { key: "lookup", label: "Buscar clave", helper: "Consulta rapida de padron", icon: "search" },
      { key: "mapReports", label: "Reportes campo", helper: "Revision institucional del levantamiento", icon: "map" },
      { key: "requests", label: "Peticiones", helper: "Listados especiales desde el padron", icon: "dashboard" },
      { key: "users", label: "Usuarios", helper: "Accesos, sesiones y roles", icon: "users" }
    ],
    []
  );
  const dashboardPriorityItems = useMemo(() => {
    const items = [];

    if (!padronMeta?.total_records) {
      items.push({
        tone: "is-warning",
        title: "Padron pendiente",
        detail: "Actualiza o valida el padron maestro para consultas y peticiones confiables.",
        icon: "refresh",
        actionView: "padron",
        actionLabel: "Revisar padron"
      });
    }

    if (alertRecords.length) {
      items.push({
        tone: "is-warning",
        title: "Fichas con plazo critico",
        detail: `${alertRecords.length} fichas estan en alerta o vencidas por regla de 7 dias habiles.`,
        icon: "warning",
        actionView: "records",
        actionLabel: "Ver alertas"
      });
    }

    if (pendingPhotoRecords >= 3) {
      items.push({
        tone: "is-warning",
        title: "Fichas sin foto",
        detail: `${pendingPhotoRecords} fichas visibles aun no tienen evidencia fotografica asociada.`,
        icon: "records",
        actionView: "records",
        actionLabel: "Completar fichas"
      });
    }

    if (onlineUsers.length >= 4) {
      items.push({
        tone: "is-live",
        title: "Operacion intensiva",
        detail: `${onlineUsers.length} usuarios conectados al mismo tiempo. Conviene vigilar actividad y jornadas de campo.`,
        icon: "users",
        actionView: "logs",
        actionLabel: "Ver actividad"
      });
    }

    if (dashboardJourneys[0]) {
      items.push({
        tone: "is-info",
        title: "Jornada activa",
        detail: `${formatMapDiaryLabel(dashboardJourneys[0].key)} registra ${dashboardJourneys[0].total} puntos listos para revisar.`,
        icon: "map",
        actionView: "mapReports",
        actionLabel: "Abrir reportes"
      });
    }

    if (!items.length) {
      items.push({
        tone: "is-calm",
        title: "Sistema estable",
        detail: "El tablero esta listo para arrancar captura, consulta o control administrativo.",
        icon: "success",
        actionView: "records",
        actionLabel: "Ir a fichas"
      });
    }

    return items.slice(0, 3);
  }, [alertRecords.length, dashboardJourneys, onlineUsers.length, padronMeta?.total_records, pendingPhotoRecords]);
  const dashboardLookupItems = useMemo(() => lookupHistory.slice(0, 5), [lookupHistory]);
  const currentSectionIndex = useMemo(
    () => Math.max(0, sectionDefinitions.findIndex((section) => section.key === activeSection)),
    [activeSection]
  );
  const previousSection = currentSectionIndex > 0 ? sectionDefinitions[currentSectionIndex - 1] : null;
  const nextSection =
    currentSectionIndex < sectionDefinitions.length - 1 ? sectionDefinitions[currentSectionIndex + 1] : null;
  const dashboardSignalCards = useMemo(
    () => [
      {
        title: "Plazo critico",
        value: alertRecords.length,
        helper: alertRecords.length ? "Fichas que requieren seguimiento hoy." : "Sin fichas criticas por plazo.",
        tone: alertRecords.length ? "is-warning" : "is-calm",
        icon: alertRecords.length ? "warning" : "success"
      },
      {
        title: "Sin fotografia",
        value: pendingPhotoRecords,
        helper: pendingPhotoRecords ? "Pendientes de evidencia visual." : "Todas las visibles tienen foto.",
        tone: pendingPhotoRecords ? "is-warning" : "is-calm",
        icon: pendingPhotoRecords ? "activity" : "success"
      },
      {
        title: "Consultas de hoy",
        value: recentLookupCountToday,
        helper: lookupHistory.length ? "Busqueda rapida reutilizable desde el tablero." : "Aun no hay consultas en este equipo.",
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
    const weekMapPoints = safeMapPoints.filter((point) => {
      const stamp = Date.parse(point.created_at || point.updated_at || "");
      return Number.isFinite(stamp) && stamp >= weekAgo;
    }).length;
    const weekLookups = lookupHistory.filter((item) => {
      const stamp = Date.parse(item.searched_at || "");
      return Number.isFinite(stamp) && stamp >= weekAgo;
    }).length;

    return [
      {
        title: "Fichas",
        today: todayRecords,
        week: weekRecords,
        helper: weekRecords ? `${todayRecords} hoy frente a ${weekRecords} movimientos de la semana.` : "Todavia no hay movimiento semanal.",
        icon: "records",
        tone: todayRecords ? "is-info" : "is-calm"
      },
      {
        title: "Campo",
        today: mapPointsToday,
        week: weekMapPoints,
        helper: weekMapPoints ? `${mapPointsToday} puntos hoy y ${weekMapPoints} en los ultimos 7 dias.` : "Sin levantamientos en la ultima semana.",
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
  }, [lookupHistory, mapPointsToday, recentLookupCountToday, safeMapPoints, safeRecords, todayDateKey]);
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
      const zone = String(record.barrio_colonia || "Sin zona").trim() || "Sin zona";
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
    window.localStorage.setItem(DASHBOARD_WIDGET_STORAGE_KEY, JSON.stringify(dashboardWidgetPrefs));
  }, [dashboardWidgetPrefs]);

  useEffect(() => {
    setSelectedMapPointId((current) => (visibleMapPoints.some((point) => point.id === current) ? current : null));
    setSelectedReportMapPointId((current) =>
      visibleMapPoints.some((point) => point.id === current) ? current : null
    );
  }, [visibleMapPoints]);

  useEffect(() => {
    setMapReportPage(1);
  }, [activeMapDiaryDateKey]);

  const showAlert = (text) => {
    if (!text) return;
    setAlert({ text, id: Date.now() });
  };

  const clearSession = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_SAVED_AT_STORAGE_KEY);
    setSession(null);
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
    setRecordHistory([]);
    setLatestUserResult(null);
    setLookupSearchMode("clave");
    setLookupQuery("");
    setLookupResult(null);
    setLookupFeedback("");
    setPadronRequestResult(null);
    setPadronRequestForm(defaultPadronRequestForm);
    setPadronRequestTemplates([]);
    setMapPoints([]);
    setSelectedMapPointId(null);
    setMapStatus("Sincronizado");
    setMapDraft(emptyMapDraft);
    setMapFocusRequest(null);
    setLookupHistory(loadStoredLookupHistory());
    setDraftForm(null);
    setDraftSaveState("idle");
    setDraftSavedAt(null);
    setNotifiedRecordAlerts(loadStoredRecordNotifications());
    setPadronMeta(null);
    setPadronImportSummary(null);
    setPadronFile(null);
    setWorkspaceView("records");
    resetForm();
  };

  const apiFetch = async (path, options = {}) => {
    const headers = new Headers(options.headers ?? {});

    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }

    return fetch(`${API_URL}${path}`, {
      ...options,
      cache: options.cache ?? "no-store",
      headers
    });
  };

  const persistLookupHistory = (nextHistory) => {
    window.localStorage.setItem(LOOKUP_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    setLookupHistory(nextHistory);
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

  useEffect(() => {
    return () => {
      if (localSelectedPhotoUrl) {
        URL.revokeObjectURL(localSelectedPhotoUrl);
      }
    };
  }, [localSelectedPhotoUrl]);

  useEffect(() => {
    if (!alert) return undefined;

    const timer = window.setTimeout(() => {
      setAlert(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [alert]);

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
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await apiFetch(
        `/inmuebles?q=${encodeURIComponent(query)}&archived=${view === "archived"}`
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

      const list = Array.isArray(data) ? data : [];
      setRecords(list);
      setEmptyRecordsMessage(
        list.length ? "" : view === "archived" ? "No hay fichas archivadas." : "No hay registros para mostrar."
      );
    } catch (_error) {
      if (!silent) {
        setRecords([]);
        setEmptyRecordsMessage("");
        showAlert("No fue posible cargar los registros.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated && workspaceView === "records") {
      loadRecords(search, recordView);
    }
  }, [isAuthenticated, recordView, workspaceView]);

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
          body: `${record.clave_catastral} · ${record.barrio_colonia || "Sin ubicacion"} · ${meta.helper}`,
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

  const loadUsers = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingUsers(true);
    }

    try {
      const response = await apiFetch("/users");
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

        throw new Error(data.message || "No fue posible cargar la informacion del padron.");
      }

      setPadronMeta(data.meta ?? null);
      setPadronImportSummary(data.meta?.last_import_summary ?? null);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar la informacion del padron.");
      }
    } finally {
      if (!silent) {
        setLoadingPadronMeta(false);
      }
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
      if (!silent) {
        showAlert(error.message || "No fue posible cargar las plantillas de peticiones.");
      }
    } finally {
      if (!silent) {
        setLoadingPadronRequestMeta(false);
      }
    }
  };

  const loadMapPoints = async ({ silent = false } = {}) => {
    if (!isAuthenticated) return;

    if (!silent) {
      setLoadingMapPoints(true);
    }

    try {
      const response = await apiFetch("/map-points");
      const data = await response.json();

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
      setSelectedReportMapPointId((current) => (nextPoints.some((point) => point.id === current) ? current : null));
      setMapStatus("Sincronizado");
      setReportMapStatus("Sincronizado");
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar los puntos del mapa.");
      }
      setMapStatus("Sin conexion");
    } finally {
      if (!silent) {
        setLoadingMapPoints(false);
      }
    }
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
      });
      const data = await response.json();

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
      Object.entries(auditFilters).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          params.set(key, String(value).trim());
        }
      });

      const response = await apiFetch(`/users/audit-logs?${params.toString()}`);
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

  const loadRecordHistory = async (recordId) => {
    if (!isAuthenticated || !recordId) {
      setRecordHistory([]);
      return;
    }

    setLoadingRecordHistory(true);

    try {
      const response = await apiFetch(`/inmuebles/${recordId}/history?limit=25`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar el historial de la ficha.");
      }

      setRecordHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      setRecordHistory([]);
      showAlert(error.message || "No fue posible cargar el historial de la ficha.");
    } finally {
      setLoadingRecordHistory(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      return;
    }

    if (workspaceView === "users") {
      loadUsers();
    }

    if (workspaceView === "padron") {
      loadPadronMeta();
    }

    if (workspaceView === "requests") {
      loadPadronRequestMeta();
    }

    if (workspaceView === "logs") {
      loadAuditLogs();
    }
  }, [auditFilters, isAuthenticated, isAdmin, workspaceView]);

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
      return;
    }

    loadRecords("", "active", { silent: true });
    loadMapPoints({ silent: true });
    loadUsers({ silent: true });
    loadPadronMeta({ silent: true });
    loadAuditLogs({ silent: true });
  }, [isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (isAuthenticated && ["map", "mapReports"].includes(workspaceView)) {
      loadMapPoints();
    }
  }, [isAuthenticated, workspaceView]);

  useEffect(() => {
    if (workspaceView === "mapReports" && isAdmin) {
      loadMapPointContexts(visibleMapPoints);
    }
  }, [isAdmin, visibleMapPoints, workspaceView]);

  useEffect(() => {
    setMapReportPage(1);
  }, [workspaceView]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(mapReportData.zones.length / 5));
    setMapReportPage((current) => Math.min(current, totalPages));
  }, [mapReportData.zones.length]);

  useEffect(() => {
    if (isAuthenticated && isTransport && workspaceView !== "transport") {
      setWorkspaceView("transport");
      return;
    }

    if (isAuthenticated && !isAdmin && !isTransport && !["records", "lookup", "map"].includes(workspaceView)) {
      setWorkspaceView("records");
    }
  }, [isAuthenticated, isAdmin, isTransport, workspaceView]);

  useEffect(() => {
    setShowMobileModuleMenu(false);
  }, [workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || workspaceView !== "map") {
      return undefined;
    }

    const refreshMapPoints = () => {
      if (document.visibilityState === "visible") {
        loadMapPoints({ silent: true });
      }
    };

    const handleWindowFocus = () => refreshMapPoints();
    const intervalId = window.setInterval(refreshMapPoints, 12000);
    document.addEventListener("visibilitychange", refreshMapPoints);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshMapPoints);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isAuthenticated, workspaceView]);

  useEffect(() => {
    if (!isAdmin && recordView === "archived") {
      setRecordView("active");
    }
  }, [isAdmin, recordView]);

  useEffect(() => {
    if (workspaceView !== "records" || !form.id) {
      setRecordHistory([]);
      return;
    }

    loadRecordHistory(form.id);
  }, [form.id, workspaceView]);

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
    if (form.id) {
      setDraftSaveState("idle");
      return undefined;
    }

    if (!hasDraftContent(form)) {
      setDraftSaveState("idle");
      return undefined;
    }

    setDraftSaveState("saving");
    const timer = window.setTimeout(() => {
      const nextDraft = { ...emptyForm, ...form, id: null };
      const savedAt = new Date().toISOString();
      setDraftForm(nextDraft);
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
      window.localStorage.setItem(DRAFT_SAVED_AT_STORAGE_KEY, savedAt);
      setDraftSavedAt(savedAt);
      setDraftSaveState("saved");
    }, 420);

    return () => window.clearTimeout(timer);
  }, [form]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const applyRecord = (record) => {
    setForm({ ...emptyForm, ...normalizeRecord(record) });
    setSelectedFile(null);
    setAvisoHtml("");
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!search.trim()) {
      loadRecords("", recordView);
      return;
    }

    if (recordView === "archived") {
      loadRecords(search, "archived");
      return;
    }

    try {
      const response = await apiFetch(`/inmuebles/clave/${encodeURIComponent(search)}`);
      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        setRecords([]);
        setEmptyRecordsMessage("No se encontraron coincidencias.");
        showAlert("No se encontro esa clave catastral.");
        return;
      }

      const data = await response.json();
      setRecords([data]);
      setEmptyRecordsMessage("");
      applyRecord(data);
    } catch (_error) {
      showAlert("No fue posible completar la busqueda.");
    }
  };

  const handleSearchInputChange = (event) => {
    const value = event.target.value;
    setSearch(value);

    if (!value.trim()) {
      loadRecords("", recordView);
    }
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

  const handleRecordFilterChange = (event) => {
    const { name, value } = event.target;
    setRecordFilters((current) => ({ ...current, [name]: value }));
  };

  const clearRecordFilters = () => {
    setRecordFilters({
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    setRecordQuickFilter("all");
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
      const response = await apiFetch(
        `/claves/search?clave=${encodeURIComponent(normalizedLookupQuery)}&field=${encodeURIComponent(lookupSearchMode)}`
      );
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
                        <td>${escapeHtml(row.clave_catastral || "--")}</td>
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
            row.clave_catastral || "--",
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

      document.save(`peticion-padron-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Peticion descargada en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar la peticion en PDF.");
    }
  };

  const handleMapDraftChange = (event) => {
    const { name, value } = event.target;
    setMapDraft((current) => ({ ...current, [name]: value }));
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      showAlert("Este dispositivo no soporta geolocalizacion.");
      setMapStatus("Sin GPS");
      return;
    }

    setLocatingUser(true);
    setMapStatus("Buscando");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextDraft = {
          latitude: Number(position.coords.latitude).toFixed(6),
          longitude: Number(position.coords.longitude).toFixed(6),
          accuracy_meters: Math.round(position.coords.accuracy || 0),
          point_type: mapDraft.point_type,
          description: mapDraft.description,
          reference: mapDraft.reference
        };

        setMapDraft(nextDraft);
        setMapStatus("GPS listo");
        setLocatingUser(false);
        setMapFocusRequest({
          latitude: Number(nextDraft.latitude),
          longitude: Number(nextDraft.longitude),
          zoom: 18.5,
          key: Date.now()
        });
      },
      (error) => {
        setLocatingUser(false);
        setMapStatus("Sin permiso");
        showAlert(
          error.code === error.PERMISSION_DENIED
            ? "El navegador bloqueo la ubicacion. Habilita el permiso para usar el mapa."
            : "No fue posible obtener la ubicacion actual."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  const resetMapDraft = () => {
    setMapDraft({ ...emptyMapDraft });
  };

  const resetReportMapDraft = () => {
    setEditingReportMapPointId(null);
    setSelectedReportMapPointId(null);
    setReportMapDraft({ ...emptyMapReportDraft });
  };

  const handleSaveMapPoint = async (event) => {
    event.preventDefault();

    const latitude = Number(mapDraft.latitude);
    const longitude = Number(mapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showAlert("Define la ubicacion del punto usando GPS o tocando el mapa.");
      return;
    }

    setSavingMapPoint(true);

    try {
      const response = await apiFetch("/map-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy_meters: Number(mapDraft.accuracy_meters) || null,
          point_type: mapDraft.point_type,
          description: mapDraft.description,
          reference: mapDraft.reference
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

      setMapPoints((current) => [data, ...current]);
      setMapDiaryDateKey(getMapDiaryDateKey(data.created_at) || getMapDiaryDateKey(new Date()));
      setSelectedMapPointId(data.id);
      setMapStatus("Punto guardado");
      setMapFocusRequest({
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        zoom: 19,
        key: Date.now()
      });
      showAlert("Punto de campo guardado correctamente.");
      resetMapDraft();
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el punto.");
    } finally {
      setSavingMapPoint(false);
    }
  };

  const handleReportMapDraftChange = (event) => {
    const { name, value, type, checked } = event.target;
    setReportMapDraft((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleMapReportStaffChange = (event) => {
    const { name, value } = event.target;
    setMapReportStaff((current) => ({
      ...current,
      [name]: value
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

  const handleEditReportMapPoint = (pointId) => {
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) {
      return;
    }

    setSelectedReportMapPointId(point.id);
    setEditingReportMapPointId(point.id);
    setReportMapDraft(buildMapReportDraftFromPoint(point));
    setReportMapStatus("Edicion activa");
    setReportMapFocusRequest({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      zoom: 19,
      key: Date.now()
    });
  };

  const handleSelectReportMapPoint = (pointId) => {
    setSelectedReportMapPointId(pointId);
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) return;

    setReportMapFocusRequest({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      zoom: 18.5,
      key: Date.now()
    });
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
      const response = await apiFetch(isEditing ? `/map-points/${editingReportMapPointId}` : "/map-points", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy_meters: Number(reportMapDraft.accuracy_meters) || null,
          point_type: reportMapDraft.point_type,
          description: reportMapDraft.description,
          reference: reportMapDraft.reference,
          marker_color: reportMapDraft.marker_color,
          is_terminal_point: reportMapDraft.is_terminal_point
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

      setMapPoints((current) =>
        isEditing ? current.map((point) => (point.id === data.id ? data : point)) : [data, ...current]
      );
      setMapDiaryDateKey(getMapDiaryDateKey(data.created_at) || getMapDiaryDateKey(new Date()));
      setSelectedReportMapPointId(data.id);
      setEditingReportMapPointId(null);
      setReportMapStatus(isEditing ? "Punto actualizado" : "Punto agregado");
      setReportMapFocusRequest({
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        zoom: 19,
        key: Date.now()
      });
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
      link.download = `reporte-detallado-puntos-campo-${new Date().toISOString().slice(0, 10)}.xlsx`;
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

    try {
      const response = await apiFetch(`/map-points/${pointId}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible eliminar el punto.");
      }

      setMapPoints((current) => current.filter((point) => point.id !== pointId));
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

  const handlePrintMapFieldReport = async () => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const mapImageDataUrl = await captureReportMapImage();
    const totalsMarkup = Object.entries(mapReportData.totalsByType)
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
          <span class="field-report-kicker">Resumen ejecutivo</span>
          <h2>Levantamiento consolidado de puntos de campo</h2>
          <p>Vista institucional del trabajo levantado, lista para seguimiento y revision administrativa.</p>
          <div class="field-report-cover-metrics">
            <div>
              <strong>Total de puntos</strong>
              <span>${mapReportData.totalPoints}</span>
            </div>
            <div>
              <strong>Total de zonas</strong>
              <span>${mapReportData.totalZones}</span>
            </div>
            <div>
              <strong>Cajas de registro</strong>
              <span>${totalCajaRegistro}</span>
            </div>
          </div>
          <div class="field-report-staff">
            <div>
              <strong>Tecnico de campo 1</strong>
              <span>${escapeHtml(mapReportStaff.field_technicians || "--")}</span>
            </div>
            <div>
              <strong>Tecnico de campo 2</strong>
              <span>${escapeHtml(mapReportStaff.field_technician_secondary || "--")}</span>
            </div>
            <div>
              <strong>Ingeniero de datos</strong>
              <span>${escapeHtml(mapReportStaff.data_engineer || "--")}</span>
            </div>
          </div>
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

    const zonesMarkup = mapReportData.zones
      .map(
        (zone, index) => `
          <section class="field-report-zone">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Zona ${index + 1}</span>
                <h3>${zone.zone}</h3>
                <p>Referencia sugerida: ${zone.nearbyReferencesLabel || "Sin contexto cercano"}</p>
                <p>Ubicacion completa: ${zone.primaryLocationLabel || "Sin direccion ampliada"}</p>
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
                  <th>Zona</th>
                  <th>Referencia cercana</th>
                  <th>Referencia</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${zone.items
                  .map(
                    (point, pointIndex) => `
                      <tr>
                        <td>${pointIndex + 1}</td>
                        <td>${getMapPointTypeLabel(point.point_type)}</td>
                        <td>${point.is_terminal_point ? "Pin final" : point.marker_color || "#1576d1"}</td>
                        <td>${formatCoordinate(point.latitude)}</td>
                        <td>${formatCoordinate(point.longitude)}</td>
                        <td>${point.accuracy_meters ? `${point.accuracy_meters} m` : "--"}</td>
                        <td>${point.suggested_zone || zone.zone}</td>
                        <td>${point.suggested_reference || "--"}</td>
                        <td>${point.reference_note || point.description || "--"}</td>
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
      "Reporte de levantamiento de campo",
      `
        <div class="field-report-shell">
          <header class="field-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h1>Reporte de levantamiento de campo</h1>
                <p>Consolidado institucional de coordenadas, totales y zonas registradas por el equipo tecnico.</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Total de puntos: ${mapReportData.totalPoints}</span>
              <span>Total de zonas: ${mapReportData.totalZones}</span>
            </div>
            <div class="field-report-staff">
              <div>
                <strong>Tecnico de campo 1</strong>
                <span>${escapeHtml(mapReportStaff.field_technicians || "--")}</span>
              </div>
              <div>
                <strong>Tecnico de campo 2</strong>
                <span>${escapeHtml(mapReportStaff.field_technician_secondary || "--")}</span>
              </div>
              <div>
                <strong>Ingeniero de datos</strong>
                <span>${escapeHtml(mapReportStaff.data_engineer || "--")}</span>
              </div>
            </div>
          </header>
          ${portadaMarkup}
          <section class="field-report-summary">
            ${totalsMarkup || '<div class="field-report-total-chip"><strong>Sin puntos</strong><span>0</span></div>'}
          </section>
          ${zonesMarkup || '<p class="field-report-empty">No hay puntos guardados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body"
      }
    );
  };

  const handleDownloadMapFieldPdf = async () => {
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
      const mapImageDataUrl = await captureReportMapImage();
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
      document.text("Reporte de levantamiento de campo", 38, 16);
      document.setFontSize(9.5);
      document.setTextColor(64, 91, 117);
      document.text("Aguas de Choluteca, S.A. de C.V.", 38, 22);

      document.setTextColor(22, 50, 74);
      document.setFont("helvetica", "normal");
      document.text(`Generado: ${generatedAt}`, 14, 36);
      document.text(`Total de puntos: ${mapReportData.totalPoints}`, 86, 36);
      document.text(`Total de zonas: ${mapReportData.totalZones}`, 138, 36);
      document.text(`Tecnico de campo 1: ${mapReportStaff.field_technicians || "--"}`, 14, 42);
      document.text(`Tecnico de campo 2: ${mapReportStaff.field_technician_secondary || "--"}`, 14, 48);
      document.text(`Ingeniero de datos: ${mapReportStaff.data_engineer || "--"}`, 138, 42);
      document.text(`Cajas de registro: ${totalCajaRegistro}`, 14, 54);

      if (mapImageDataUrl) {
        document.setFillColor(237, 245, 252);
        document.roundedRect(154, 48, 104, 48, 3, 3, "F");
        document.addImage(mapImageDataUrl, "PNG", 156, 50, 100, 44);
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
        body: Object.entries(mapReportData.totalsByType).length
          ? Object.entries(mapReportData.totalsByType)
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

      for (let index = 0; index < mapReportData.zones.length; index += 1) {
        const zone = mapReportData.zones[index];

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
        document.text(`Zona ${index + 1}: ${zone.zone}`, 18, currentY + 6);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.text(`Referencia sugerida: ${zone.nearbyReferencesLabel || "Sin contexto cercano"}`, 18, currentY + 11);
        document.text(`Ubicacion completa: ${zone.primaryLocationLabel || "Sin direccion ampliada"}`, 128, currentY + 11);

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
            "Fecha"
          ]],
          body: zone.items.map((point, pointIndex) => [
            String(pointIndex + 1),
            getMapPointTypeLabel(point.point_type),
            point.is_terminal_point ? "Pin final" : point.marker_color || "#1576d1",
            formatCoordinate(point.latitude),
            formatCoordinate(point.longitude),
            point.accuracy_meters ? `${point.accuracy_meters} m` : "--",
            point.suggested_reference || "--",
            point.reference_note || point.description || "--",
            formatDateTime(point.created_at)
          ]),
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
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 24 },
            2: { cellWidth: 18 },
            3: { cellWidth: 20 },
            4: { cellWidth: 20 },
            5: { cellWidth: 18 },
            6: { cellWidth: 38 },
            7: { cellWidth: 58 },
            8: { cellWidth: 26 }
          }
        });

        currentY = (document.lastAutoTable?.finalY ?? currentY + 20) + 7;
        addPdfPageFooter();
      }

      document.save(`reporte-campo-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Reporte PDF descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte PDF.");
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
    setSelectedRecordId(record.id ?? null);
    setRecordQuickFilter("all");
    setRecordFilters({
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    applyRecord(record);
    focusSheet();
  };

  const handleCopyClave = async (record, event) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(record.clave_catastral || "");
      showAlert(`Clave ${record.clave_catastral} copiada.`);
    } catch {
      showAlert("No se pudo copiar la clave.");
    }
  };

  const handleQuickEdit = (record, event) => {
    event.stopPropagation();
    handleSelectRecord(record);
    setActiveSection("abonado");
  };

  const moveRecordSection = (direction) => {
    const nextIndex = currentSectionIndex + direction;
    if (nextIndex < 0 || nextIndex >= sectionDefinitions.length) {
      return;
    }

    setActiveSection(sectionDefinitions[nextIndex].key);
    focusSheet();
  };

  const resetForm = () => {
    setSelectedRecordId(null);
    setRecordQuickFilter("all");
    setRecordFilters({
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
    setAvisoHtml("");
    setActiveSection("abonado");
    setDraftSaveState("idle");
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_SAVED_AT_STORAGE_KEY);
    focusSheet();
  };

  const restoreDraft = () => {
    if (!draftForm) {
      showAlert("No hay borrador pendiente.");
      return;
    }

    setSelectedRecordId(null);
    setRecordQuickFilter("all");
    setRecordFilters({
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    setForm({ ...emptyForm, ...draftForm, id: null });
    setSelectedFile(null);
    setAvisoHtml("");
    setActiveSection("abonado");
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

  const handleAuditFilterChange = (event) => {
    const { name, value } = event.target;
    setAuditFilters((current) => ({ ...current, [name]: value }));
  };

  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;
    setPasswordFeedback("");
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible iniciar sesion.");
      }

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
      setAuthFx({ mode: "login", text: "Abriendo sesion..." });
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
      setAlert(null);
    } catch (error) {
      showAlert(error.message);
    } finally {
      setAuthFx(null);
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setAuthFx({ mode: "logout", text: "Cerrando sesion..." });
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // The local session should still be removed even if the request fails.
    } finally {
      await pause(450);
      clearSession();
      setAuthFx(null);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordFeedback("");

    if (!passwordForm.current_password.trim()) {
      setPasswordFeedback("Ingresa la contrasena actual.");
      return;
    }

    if (passwordForm.new_password.trim().length < 8) {
      setPasswordFeedback("La nueva contrasena debe tener al menos 8 caracteres.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordFeedback("La confirmacion de la nueva contrasena no coincide.");
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

        throw new Error(data.message || "No se pudo actualizar la contrasena.");
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
      showAlert("Contrasena actualizada correctamente.");
      loadAuditLogs();
    } catch (error) {
      setPasswordFeedback(error.message || "No se pudo actualizar la contrasena.");
      showAlert(error.message || "No se pudo actualizar la contrasena.");
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

      const response = await apiFetch("/claves/upload", {
        method: "POST",
        body: payload
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo actualizar el padron maestro.");
      }

      setPadronMeta(data.meta ?? null);
      setPadronImportSummary(data.import_summary ?? data.meta?.last_import_summary ?? null);
      setPadronFile(null);
      showAlert(`Padron maestro actualizado con ${data.meta?.total_records ?? 0} claves.`);
    } catch (error) {
      showAlert(error.message || "No se pudo actualizar el padron maestro.");
    } finally {
      setUploadingPadron(false);
    }
  };

  const handleReprocessPadron = async () => {
    setReprocessingPadron(true);

    try {
      const response = await apiFetch("/claves/reprocess", {
        method: "POST"
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo reprocesar el padron maestro.");
      }

      setPadronMeta(data.meta ?? null);
      setPadronImportSummary(data.import_summary ?? data.meta?.last_import_summary ?? null);
      showAlert(`Padron maestro reprocesado con ${data.meta?.total_records ?? 0} claves.`);
    } catch (error) {
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

  const handleDownloadPadron = async () => {
    try {
      const response = await apiFetch("/claves/download");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo descargar el padron maestro.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fallbackName = `padron-maestro-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);

      link.href = downloadUrl;
      link.download = fileNameMatch?.[1] || fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showAlert("Descarga del padron iniciada.");
    } catch (error) {
      showAlert(error.message || "No se pudo descargar el padron maestro.");
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

  const handleArchiveRecord = async () => {
    if (!form.id) {
      showAlert("Primero selecciona o guarda una ficha.");
      return;
    }

    const reason = window.prompt("Motivo de archivo (opcional):", form.archived_reason || "");
    if (reason === null) return;

    try {
      const response = await apiFetch(`/inmuebles/${form.id}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ archived_reason: reason })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo archivar la ficha.");
      }

      resetForm();
      setRecordView("archived");
      showAlert(`Ficha ${data.clave_catastral} archivada.`);
      loadRecords(search, "archived");
    } catch (error) {
      showAlert(error.message);
    }
  };

  const handleRestoreRecord = async (recordId) => {
    try {
      const response = await apiFetch(`/inmuebles/${recordId}/restore`, {
        method: "POST"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo restaurar la ficha.");
      }

      setRecordView("active");
      applyRecord(data);
      showAlert(`Ficha ${data.clave_catastral} restaurada.`);
      loadRecords(search, "active");
    } catch (error) {
      showAlert(error.message);
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

  const saveRecord = async (event) => {
    event.preventDefault();
    const nextSaveIntent = event?.nativeEvent?.submitter?.dataset?.intent || saveIntent;
    const blockingIssues = recordValidationIssues.filter((issue) => issue.field !== "foto_path");
    if (blockingIssues.length) {
      setActiveSection(blockingIssues[0].section);
      setSaveIntent(saveIntentOptions.stay);
      showAlert(blockingIssues[0].text);
      return;
    }

    setSaving(true);

    const isEdit = Boolean(form.id);
    const url = isEdit ? `${API_URL}/inmuebles/${form.id}` : `${API_URL}/inmuebles`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const response = await apiFetch(url.replace(API_URL, ""), {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo guardar el registro.");
      }

      let updated = data;

      if (selectedFile && data.id) {
        const upload = new FormData();
        const optimizedPhoto = await optimizeImageForUpload(selectedFile);
        upload.append("foto", optimizedPhoto);

        const uploadResponse = await apiFetch(`/inmuebles/${data.id}/foto`, {
          method: "POST",
          body: upload
        });
        updated = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(updated.message || "No se pudo subir la fotografia.");
        }
      }

      if (!isEdit && nextSaveIntent === saveIntentOptions.new) {
        showAlert(`Ficha ${updated.clave_catastral} guardada. Lista para registrar otra.`);
        resetForm();
      } else {
        applyRecord(updated);
      }

      setDraftForm(null);
      setDraftSaveState("idle");
      setDraftSavedAt(null);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      window.localStorage.removeItem(DRAFT_SAVED_AT_STORAGE_KEY);
      setEmptyRecordsMessage("");
      loadRecords(search);
    } catch (error) {
      showAlert(error.message);
    } finally {
      setSaveIntent(saveIntentOptions.stay);
      setSaving(false);
    }
  };

  const generateAviso = async () => {
    setLoadingAviso(true);
    try {
      const response = form.id
        ? await apiFetch(`/inmuebles/${form.id}/aviso`)
        : await apiFetch(`/inmuebles/aviso-preview`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(form)
          });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No fue posible generar el aviso.");
      }

      setAvisoHtml(data.aviso_html);
      const avisoWindow = window.open("", "_blank", "width=980,height=1200");
      if (avisoWindow) {
        const initialData = {
          fecha_aviso: normalizeDateField(data.fecha_aviso || form.fecha_aviso || ""),
          barrio_colonia: data.barrio_colonia || form.barrio_colonia || "",
          clave_catastral: data.clave_catastral || form.clave_catastral || "",
          firmante_aviso: data.firmante_aviso || form.firmante_aviso || "",
          cargo_firmante: data.cargo_firmante || form.cargo_firmante || ""
        };

        avisoWindow.document.write(`
          <html lang="es">
            <head>
              <title>Aviso ${data.clave_catastral || form.clave_catastral || ""}</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  background: #f5f1e8;
                  color: #1b2f35;
                }
                .page {
                  max-width: 860px;
                  margin: 24px auto;
                  background: #fffdf9;
                  border: 1px solid #d8cfbc;
                  border-radius: 24px;
                  box-shadow: 0 18px 45px rgba(18, 52, 59, 0.12);
                  padding: 36px 46px;
                }
                .workspace {
                  max-width: 1180px;
                  margin: 24px auto;
                  display: grid;
                  grid-template-columns: 320px minmax(0, 1fr);
                  gap: 18px;
                  padding: 0 16px;
                }
                .editor {
                  background: #fffdf9;
                  border: 1px solid #d8cfbc;
                  border-radius: 24px;
                  box-shadow: 0 18px 45px rgba(18, 52, 59, 0.08);
                  padding: 20px;
                  align-self: start;
                  position: sticky;
                  top: 18px;
                }
                .editor h2 {
                  margin: 0 0 14px;
                  font-size: 18px;
                }
                .editor label {
                  display: grid;
                  gap: 6px;
                  margin-bottom: 12px;
                  font-size: 14px;
                  font-weight: 700;
                }
                .editor input, .editor textarea {
                  width: 100%;
                  border: 1px solid #cfc6b6;
                  border-radius: 14px;
                  padding: 10px 12px;
                  font: inherit;
                  font-weight: 400;
                }
                .editor p {
                  font-size: 13px;
                  color: #5f6668;
                  margin-top: 8px;
                }
                .toolbar {
                  max-width: 1180px;
                  margin: 18px auto 0;
                  display: flex;
                  justify-content: flex-end;
                  gap: 10px;
                  padding: 0 16px;
                }
                .toolbar button {
                  border: none;
                  border-radius: 999px;
                  padding: 10px 16px;
                  cursor: pointer;
                  background: #b7652b;
                  color: white;
                  font: inherit;
                }
                .toolbar button.secondary {
                  background: #d7e1e3;
                  color: #12343b;
                }
                .logo-wrap {
                  display: flex;
                  justify-content: center;
                  margin-bottom: 10px;
                }
                .logo-wrap img {
                  width: 110px;
                  height: 110px;
                  object-fit: contain;
                }
                .aviso {
                  max-width: 720px;
                  margin: 0 auto;
                }
                .aviso-header, .aviso-title, .aviso-signature, .aviso-copy {
                  text-align: center;
                }
                .aviso-header p, .aviso-title, .aviso-copy {
                  margin: 0 0 12px;
                }
                .aviso-date, .aviso-saludo {
                  margin: 0 0 16px;
                }
                .aviso-body {
                  text-align: justify;
                  line-height: 1.65;
                  margin: 0 0 16px;
                }
                .aviso-list {
                  margin: 0 0 18px 24px;
                  padding: 0;
                }
                .aviso-list li {
                  margin-bottom: 8px;
                  line-height: 1.55;
                }
                .aviso-signature {
                  margin-top: 34px;
                }
                .aviso-signature p {
                  margin: 0 0 8px;
                }
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 14mm;
                  }
                  body {
                    background: white;
                  }
                  .toolbar {
                    display: none;
                  }
                  .workspace {
                    display: block;
                    margin: 0;
                    padding: 0;
                  }
                  .editor {
                    display: none;
                  }
                  .page {
                    margin: 0;
                    box-shadow: none;
                    border: none;
                    border-radius: 0;
                    padding: 0;
                    max-width: none;
                  }
                }
              </style>
            </head>
            <body>
              <div class="toolbar">
                <button class="secondary" onclick="window.close()">Cerrar</button>
                <button onclick="window.print()">Imprimir aviso</button>
              </div>
              <div class="workspace">
                <aside class="editor">
                  <h2>Editar Aviso</h2>
                  <label>
                    Fecha del aviso
                    <input id="fecha_aviso" type="date" />
                  </label>
                  <label>
                    Ubicacion del inmueble
                    <input id="barrio_colonia" type="text" />
                  </label>
                  <label>
                    Clave catastral
                    <input id="clave_catastral" type="text" />
                  </label>
                  <label>
                    Firmante
                    <input id="firmante_aviso" type="text" />
                  </label>
                  <label>
                    Cargo
                    <input id="cargo_firmante" type="text" />
                  </label>
                  <p>Los cambios se reflejan inmediatamente en el documento antes de imprimir.</p>
                </aside>
                <main class="page">
                  <div class="logo-wrap">
                    <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" />
                  </div>
                  <section id="aviso-preview"></section>
                </main>
              </div>
              <script>
                const state = ${JSON.stringify(initialData)};
                const formatSpanishDate = (value) => {
                  if (!value) return "__________";
                  const normalized = String(value).slice(0, 10);
                  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(normalized)) return "__________";
                  const date = new Date(normalized + "T00:00:00");
                  if (Number.isNaN(date.getTime())) return "__________";
                  return new Intl.DateTimeFormat("es-HN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  }).format(date);
                };
                const renderAviso = () => {
                  const fecha = formatSpanishDate(state.fecha_aviso);
                  const barrio = state.barrio_colonia || "__________";
                  const clave = state.clave_catastral || "__________";
                  const firmante = state.firmante_aviso || "______________________";
                  const cargo = state.cargo_firmante || "______________________";
                  document.getElementById("aviso-preview").innerHTML = \`
                    <section class="aviso">
                      <div class="aviso-header">
                        <p><strong>AGUAS DE CHOLUTECA</strong></p>
                        <p>Departamento de Comercializacion</p>
                      </div>
                      <h2 class="aviso-title">AVISO IMPORTANTE AL ABONADO</h2>
                      <p class="aviso-date">Fecha: Choluteca, \${fecha}</p>
                      <p class="aviso-saludo">Estimado(a) Señor(a):</p>
                      <p class="aviso-body">
                        Por medio de la presente, se le informa que, como resultado del reciente levantamiento de información realizado por la Unidad Técnica de Catastro, se ha identificado que el inmueble ubicado en \${barrio}, con Clave Catastral \${clave}, no se encuentra registrado en la base de datos de la empresa, pese a contar con servicios activos.
                      </p>
                      <p class="aviso-body">
                        Con el propósito de regularizar su situación, evitar circunstancias legales y establecer un acuerdo acorde al caso, se le solicita presentarse al Departamento de Comercialización de Aguas de Choluteca, en un plazo máximo de siete (7) días calendario a partir de la recepción del presente aviso, debiendo presentar la siguiente documentación:
                      </p>
                      <ul class="aviso-list">
                        <li>Copia de Escritura pública del Inmueble.</li>
                        <li>Copia de Constancia Catastral vigente.</li>
                        <li>Copia de Documento Nacional de Identificación (DNI).</li>
                        <li>Constancia de solvencia municipal.</li>
                      </ul>
                      <p class="aviso-body">
                        En caso de no presentarse dentro del plazo indicado, la empresa procederá conforme a los lineamientos administrativos establecidos por la ley que implican recargos y multas.
                      </p>
                      <p class="aviso-body">Sin otro particular, agradecemos su pronta colaboración.</p>
                      <p class="aviso-body">Atentamente,</p>
                      <div class="aviso-signature">
                        <p><strong>\${firmante}</strong></p>
                        <p>\${cargo}</p>
                        <p>Aguas de Choluteca</p>
                      </div>
                      <p class="aviso-copy">C.c. Archivo</p>
                    </section>
                  \`;
                };
                const bindField = (id) => {
                  const input = document.getElementById(id);
                  input.value = state[id] || "";
                  input.addEventListener("input", (event) => {
                    state[id] = event.target.value;
                    renderAviso();
                  });
                };
                ["fecha_aviso", "barrio_colonia", "clave_catastral", "firmante_aviso", "cargo_firmante"].forEach(bindField);
                renderAviso();
              </script>
            </body>
          </html>
        `);
        avisoWindow.document.close();
      }
    } catch (error) {
      showAlert(error.message);
    } finally {
      setLoadingAviso(false);
    }
  };

  const handlePrintFicha = async () => {
    let photoMarkup = "";

    try {
      if (selectedFile) {
        const dataUrl = await fileToDataUrl(selectedFile);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      } else if (selectedPhotoUrl) {
        const dataUrl = await urlToDataUrl(selectedPhotoUrl);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      }
    } catch (_error) {
      showAlert("La ficha se imprimira sin foto porque no fue posible cargarla a tiempo.");
    }

    await printDocument(
      `Ficha ${form.clave_catastral || "inmueble"}`,
      `
        <div class="print-header">
          <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
          <p>Aguas de Choluteca, S.A. de C.V.</p>
          <p>Barrio El Centro Antiguo Local de Cooperativa Guadalupe.</p>
          <p>Tel: 2782-5075 Fax: 2780-3985</p>
          <h2 class="print-title">Ficha Tecnica de Informacion Catastral</h2>
          <div class="print-key">CLAVE CATASTRAL: ${form.clave_catastral || "--"}</div>
        </div>
        <div class="print-layout">
          <div class="print-top-layout">
            <div class="print-main-column">
              <section class="print-section">
                <h3>Informacion del abonado</h3>
                <div class="print-grid">
                  <div class="print-field"><strong>Abonado</strong>${form.abonado || "--"}</div>
                  <div class="print-field"><strong>Catastral</strong>${form.nombre_catastral || "--"}</div>
                  <div class="print-field"><strong>Inquilino</strong>${form.inquilino || "--"}</div>
                  <div class="print-field"><strong>Barrio/Colonia</strong>${form.barrio_colonia || "--"}</div>
                  <div class="print-field"><strong>Identidad</strong>${form.identidad || "--"}</div>
                  <div class="print-field"><strong>Telefono</strong>${form.telefono || "--"}</div>
                </div>
              </section>
              <section class="print-section">
                <h3>Identificacion del inmueble</h3>
                <p>${form.accion_inspeccion || "--"}</p>
              </section>
              <section class="print-section">
                <h3>Datos del inmueble</h3>
                <div class="print-grid">
                  <div class="print-field"><strong>Situacion</strong>${form.situacion_inmueble || "--"}</div>
                  <div class="print-field"><strong>Tendencia</strong>${form.tendencia_inmueble || "--"}</div>
                  <div class="print-field"><strong>Uso del suelo</strong>${form.uso_suelo || "--"}</div>
                  <div class="print-field"><strong>Actividad</strong>${form.actividad || "--"}</div>
                  <div class="print-field"><strong>Codigo del sector</strong>${form.codigo_sector || "--"}</div>
                  <div class="print-field"><strong>Comentarios</strong>${form.comentarios || "--"}</div>
                </div>
              </section>
              <section class="print-section">
                <h3>Datos de los servicios</h3>
                <div class="print-grid">
                  <div class="print-field"><strong>Agua potable</strong>${form.conexion_agua || "--"}</div>
                  <div class="print-field"><strong>Alcantarillado</strong>${form.conexion_alcantarillado || "--"}</div>
                  <div class="print-field"><strong>Desechos</strong>${form.recoleccion_desechos || "--"}</div>
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
            <h3>Firmas</h3>
            <div class="print-roles">
              <div class="print-signature-line">
                <strong>${form.levantamiento_datos || "--"}</strong><br />
                LEVANTAMIENTO DE DATOS
              </div>
              <div class="print-signature-line">
                <strong>${form.analista_datos || "--"}</strong><br />
                ANALISTA DE DATOS
              </div>
            </div>
          </section>
        </div>
      `,
      {
        bodyClassName: "print-ficha",
        pageSize: "Letter landscape",
        pageMargin: "8mm 8mm 8mm 12mm",
        windowFeatures: "width=1400,height=900"
      }
    );
  };

  const handlePrintAviso = async () => {
    if (!avisoHtml) {
      showAlert("Genera el aviso antes de imprimir.");
      return;
    }

    await printDocument(
      `Aviso ${form.clave_catastral || "inmueble"}`,
      `<div class="print-header"><img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" /></div>${avisoHtml}`
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="login-shell">
        {authFx ? (
          <div className={`auth-fx auth-fx-${authFx.mode}`}>
            <div className="auth-fx-card">
              <span className="auth-fx-dot" />
              <strong>{authFx.text}</strong>
            </div>
          </div>
        ) : null}
        {alert ? (
          <div className="app-alert login-alert" role="alert">
            <strong>Atencion</strong>
            <span>{alert.text}</span>
          </div>
        ) : null}
        <div className="login-layout">
          <section className="login-intro-card">
            <div className="login-intro-orb login-intro-orb-primary" />
            <div className="login-intro-orb login-intro-orb-secondary" />
            <div className="login-intro-topline">
              <span className="login-chip">
                <Icon name="history" />
                Operacion trazable
              </span>
              <span className="login-chip">
                <Icon name="auth" />
                Acceso protegido
              </span>
            </div>
            <div className="login-brand">
              <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="login-logo" />
              <div>
                <p className="eyebrow">Aguas de Choluteca</p>
                <h1>Control de inmuebles clandestinos</h1>
              </div>
            </div>
            <p className="lead">
              Registro, consulta y seguimiento en una interfaz ligera para trabajo de campo y oficina.
            </p>
            <div className="login-intro-notes">
              <div className="login-intro-note">
                <strong>Fichas y avisos</strong>
                <span>Consulta y captura en un solo flujo.</span>
              </div>
              <div className="login-intro-note">
                <strong>Bitacora activa</strong>
                <span>Cada accion queda asociada al usuario.</span>
              </div>
            </div>
          </section>

          <div className="login-card">
            <div className="login-card-head">
              <p className="eyebrow">Acceso seguro</p>
              <div className="login-card-title">
                <span className="login-card-title-icon"><Icon name="auth" /></span>
                <h2>Iniciar sesion</h2>
              </div>
              <p className="lead">Ingresa con tu usuario o correo para continuar.</p>
              <div className="login-card-badges">
                <span className="login-card-badge">
                  <Icon name="success" />
                  Sesion cifrada
                </span>
                <span className="login-card-badge">
                  <Icon name="history" />
                  Registro auditado
                </span>
              </div>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              <label className="login-field">
                <span>Usuario o correo</span>
                <div className="login-input-shell">
                  <span className="login-input-icon"><Icon name="users" /></span>
                  <input
                    name="username"
                    value={loginForm.username}
                    onChange={handleLoginChange}
                    autoComplete="username"
                  />
                </div>
              </label>
              <label className="login-field">
                <span>Contrasena</span>
                <div className="login-input-shell">
                  <span className="login-input-icon"><Icon name="auth" /></span>
                  <input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    autoComplete="current-password"
                  />
                </div>
              </label>
              <button type="submit" disabled={loginLoading}>
                <Icon name="auth" />
                {loginLoading ? "Ingresando..." : "Entrar"}
              </button>
            </form>
            <div className="login-footnote">
              <span className="login-footnote-line" />
              <p>Solo usuarios autorizados pueden continuar.</p>
            </div>
          </div>
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
                <h2><Icon name="dashboard" className="title-icon" />Tablero de mando</h2>
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
      label: "Resumen ejecutivo",
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
    <div className="page-shell">
      {authFx ? (
        <div className={`auth-fx auth-fx-${authFx.mode}`}>
          <div className="auth-fx-card">
            <span className="auth-fx-dot" />
            <strong>{authFx.text}</strong>
          </div>
        </div>
      ) : null}
      {alert ? (
        <div className="app-alert no-print" role="alert">
          <strong>Atencion</strong>
          <span>{alert.text}</span>
        </div>
      ) : null}
      {passwordModalVisible ? (
        <div className={`password-modal-backdrop ${mustChangePassword ? "is-forced" : ""}`}>
          <div className="password-modal-card">
            <div className="password-modal-head">
              <p className="eyebrow">{mustChangePassword ? "Accion requerida" : "Seguridad de acceso"}</p>
              <h2>{mustChangePassword ? "Cambia tu contrasena temporal" : "Cambiar contrasena"}</h2>
              <p className="lead">
                {mustChangePassword
                  ? "Antes de continuar, define una nueva contrasena personal para proteger tu cuenta."
                  : "Actualiza tu contrasena cuando lo necesites."}
              </p>
            </div>
            <form className="password-form" onSubmit={handleChangePassword}>
              {passwordFeedback ? <p className="password-feedback">{passwordFeedback}</p> : null}
              <label>
                <span>Contrasena actual</span>
                <input
                  name="current_password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordFormChange}
                  required
                />
              </label>
              <label>
                <span>Nueva contrasena</span>
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
                <span>Confirmar nueva contrasena</span>
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
                  {changingPassword ? "Actualizando..." : "Guardar nueva contrasena"}
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
      <header className={`hero no-print ${isAdmin ? "hero-admin" : ""} ${workspaceView !== "dashboard" ? "hero-module" : ""}`}>
        <div className={`hero-panel ${headerMeta.panelClass} ${workspaceView !== "dashboard" ? "module-hero-panel" : ""}`}>
          <div className="hero-topline">
            <span className="hero-topline-item">
              <Icon name="records" />
              {headerMeta.toplineLabel}
            </span>
            <span className="hero-topline-item">
              <Icon name="users" />
              {session?.user?.full_name || session?.user?.username || "Sesion activa"}
            </span>
          </div>
          <div className="hero-brand">
            <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="hero-logo" />
            <div>
              <p className="eyebrow">Aguas de Choluteca</p>
              <h1>{headerMeta.title}</h1>
              <p className="lead">{headerMeta.lead}</p>
              <div className="hero-status-row">
                {["lookup", "padron"].includes(workspaceView) ? (
                  <span className={`hero-status-pill ${lookupResult?.exists ? "is-live" : ""}`}>
                    {workspaceView === "padron"
                      ? uploadingPadron
                        ? "Actualizando padron"
                        : "Padron disponible"
                      : lookupResult
                        ? lookupResult.exists
                          ? "Coincidencia encontrada"
                          : "Sin coincidencias"
                        : "Listo para consultar"}
                  </span>
                ) : (
                  <span className={`hero-status-pill ${isDirty ? "is-live" : ""}`}>
                    {isDirty ? "Cambios sin guardar" : "Todo guardado"}
                  </span>
                )}
                {!["lookup", "padron"].includes(workspaceView) && draftSavedAt ? (
                  <span className="hero-status-pill subtle">
                    Borrador: {formatDateTime(draftSavedAt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className={`hero-strip ${workspaceView !== "dashboard" ? "hero-strip-module" : ""}`}>
            {headerStats.map((stat) => (
              <div className="hero-stat" key={stat.label}>
                <span className="hero-stat-icon"><Icon name={stat.icon} /></span>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={`search-card ${headerMeta.cardClass}`}>
          <div className="search-card-head">
            <label htmlFor="search">{workspaceView === "dashboard" ? "Espacios de trabajo" : "Navegacion del modulo"}</label>
            <span className="search-card-kicker">{workspaceView === "dashboard" ? headerMeta.kicker : currentModuleNavigation?.label || headerMeta.kicker}</span>
          </div>
          {workspaceView === "dashboard" ? (
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
          ) : (
            <div className="module-nav-wrap">
              <div className="module-topbar">
                <div className="module-topbar-copy">
                  <div className="module-topbar-badges">
                    <span className="module-badge">
                      <Icon name={currentModuleNavigation?.icon || "records"} />
                      {currentModuleNavigation?.group === "operacion"
                        ? "Operacion"
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
                Centro ejecutivo para arrancar el dia con una lectura clara de fichas, campo, usuarios y actividad reciente.
              </p>
              <div className="dashboard-summary-chips">
                <span className="panel-pill">Admin en linea: {onlineUsers.length}</span>
                <span className="panel-pill">Jornada activa: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
                <span className="panel-pill">Bitacora: {mapDiaryGroups.length} dias</span>
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
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("users")}>
                  <Icon name="users" />
                  Ver usuarios
                </button>
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("logs")}>
                  <Icon name="logs" />
                  Revisar actividad
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesion
                </button>
              </div>
            </div>
          ) : workspaceView === "records" ? (
            <form onSubmit={handleSearch}>
              <div className="search-row">
                <input
                  id="search"
                  value={search}
                  onChange={handleSearchInputChange}
                  placeholder="Ej. 10-22-23"
                />
                <button type="submit"><Icon name="search" />Buscar</button>
              </div>
              <div className="search-actions">
                <button type="button" className="button-secondary" onClick={() => loadRecords(search)}>
                  <Icon name="refresh" />
                  Refrescar listado
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowPasswordModal(true)}
                >
                  <Icon name="auth" />
                  Cambiar contrasena
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesion
                </button>
              </div>
            </form>
          ) : workspaceView === "lookup" ? (
            <div className="workspace-summary">
              <p className="workspace-title">
                Consulta el padron maestro sin entrar al modulo de fichas. Acepta clave base `00-00-00` o `000-00-00`,
                y clave completa `00-00-00-00` o `000-00-00-00`.
              </p>
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
          ) : workspaceView === "map" ? (
            <div className="workspace-summary">
              <p className="workspace-title">
                Modulo independiente para geolocalizar puntos tecnicos en campo y dejar registro de cajas de aguas negras.
              </p>
              <div className="map-diary-summary">
                <span className="panel-pill">Bitacora: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
                <span className="helper-text">{visibleMapPoints.length} puntos de {mapDiaryGroups.length} jornadas registradas.</span>
              </div>
              <div className="search-actions">
                <button type="button" className="button-secondary" onClick={handleLocateUser} disabled={locatingUser}>
                  <Icon name="map" />
                  {locatingUser ? "Ubicando..." : "Mi ubicacion"}
                </button>
                <button type="button" className="button-secondary" onClick={() => loadMapPoints()} disabled={loadingMapPoints}>
                  <Icon name="refresh" />
                  {loadingMapPoints ? "Actualizando..." : "Refrescar puntos"}
                </button>
                <button type="button" className="button-secondary" onClick={handleDownloadMapReport}>
                  <Icon name="records" />
                  Descargar reporte detallado
                </button>
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
          ) : workspaceView === "padron" ? (
            <div className="workspace-summary">
              <p className="workspace-title">
                Sube un nuevo Excel maestro para reemplazar el padron usado por <strong>Buscar clave</strong>.
              </p>
              <div className="search-actions">
                <button type="button" className="button-secondary" onClick={loadPadronMeta}>
                  <Icon name="refresh" />
                  Ver estado actual
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesion
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contrasena
                </button>
              </div>
            </div>
          ) : workspaceView === "mapReports" ? (
            <div className="workspace-summary">
              <p className="workspace-title">
                Reporte administrativo compacto de puntos levantados en campo, agrupados por zona y listo para impresion institucional.
              </p>
              <div className="map-diary-summary">
                <span className="panel-pill">Bitacora: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
                <span className="helper-text">{visibleMapPoints.length} puntos y {mapReportData.totalZones} zonas en la jornada seleccionada.</span>
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
                  Ir a pagina 1
                </button>
                <button type="button" className="button-secondary" onClick={handleDownloadMapFieldPdf}>
                  <Icon name="records" />
                  Descargar PDF
                </button>
                <button type="button" className="button-secondary" onClick={handlePrintMapFieldReport}>
                  <Icon name="records" />
                  Imprimir reporte
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesion
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contrasena
                </button>
              </div>
            </div>
          ) : (
            <div className="workspace-summary">
              <p className="workspace-title">
                {workspaceView === "users"
                  ? "Alta de usuarios con envio por correo y perfiles de acceso."
                  : "Bitacora operativa con eventos de acceso, cambios y archivado."}
              </p>
              <div className="search-actions">
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
                  Cerrar sesion
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contrasena
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {workspaceView === "dashboard" ? (
      <main className="dashboard-layout">
        <section className="dashboard-main">
          <section className="preview-panel dashboard-widget-toolbar">
            <div className="dashboard-widget-toolbar-head">
              <div>
                <p className="sheet-kicker">Diseno del tablero</p>
                <h2><Icon name="dashboard" className="title-icon" />Widgets personalizables</h2>
                <p className="workspace-title">
                  Reordena, oculta o restaura bloques del dashboard para que cada administrador vea primero lo que mas usa.
                </p>
              </div>
              <button type="button" className="button-secondary" onClick={resetDashboardWidgets}>
                <Icon name="refresh" />
                Restaurar tablero
              </button>
            </div>
            <div className="dashboard-widget-chip-row">
              {dashboardWidgetItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`dashboard-widget-chip ${dashboardWidgetPrefs.hidden.includes(item.key) ? "is-hidden" : "is-visible"}`}
                  onClick={() => toggleDashboardWidgetVisibility(item.key)}
                >
                  <strong>{item.label}</strong>
                  <small>{dashboardWidgetPrefs.hidden.includes(item.key) ? "Mostrar" : "Visible"}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="dashboard-widget-grid">
            {visibleDashboardWidgetItems.map((item, index) => (
              <article key={item.key} className={`dashboard-widget-shell ${item.className || ""}`}>
                <div className="dashboard-widget-shell-head">
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.helper}</span>
                  </div>
                  <div className="dashboard-widget-shell-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => moveDashboardWidget(item.key, -1)}
                      disabled={index === 0}
                    >
                      <Icon name="arrowLeft" />
                      Subir
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => moveDashboardWidget(item.key, 1)}
                      disabled={index === visibleDashboardWidgetItems.length - 1}
                    >
                      Bajar
                      <Icon name="arrowRight" />
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => toggleDashboardWidgetVisibility(item.key)}
                    >
                      <Icon name="more" />
                      Ocultar
                    </button>
                  </div>
                </div>
                {item.content}
              </article>
            ))}
          </section>
          {false ? (
            <>
          <section className="dashboard-spotlight-grid">
            <article className="preview-panel dashboard-spotlight-panel">
              <div className="dashboard-panel-head dashboard-spotlight-head">
                <div>
                  <p className="sheet-kicker">Vision ejecutiva</p>
                  <h2><Icon name="dashboard" className="title-icon" />Tablero de mando</h2>
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

          <section className="dashboard-dual-grid">
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
          </section>
            </>
          ) : null}
        </section>
      </main>
      ) : workspaceView === "transport" ? (
      <main className="layout transport-layout-page">
        <section className="preview-panel transport-preview-panel">
          <TransportWorkspace
            apiFetch={apiFetch}
            clearSession={clearSession}
            isActive={workspaceView === "transport" && isAuthenticated}
            isAdmin={isAdmin}
            session={session}
            showAlert={showAlert}
          />
        </section>
      </main>
      ) : workspaceView === "records" ? (
      <main className="layout">
        <aside className="sidebar no-print">
          <div className="panel-header">
            <h2>Registros</h2>
            <div className="sidebar-actions">
              <button
                type="button"
                className={recordView === "active" ? "button-secondary active-filter" : "button-secondary"}
                onClick={() => setRecordView("active")}
              >
                Activas
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className={recordView === "archived" ? "button-secondary active-filter" : "button-secondary"}
                  onClick={() => setRecordView("archived")}
                >
                  Archivadas
                </button>
              ) : null}
              {draftForm ? (
                <button type="button" className="button-secondary" onClick={restoreDraft}>
                  Borrador
                </button>
              ) : null}
              <button type="button" className="button-secondary" onClick={resetForm}>
                Nuevo
              </button>
            </div>
          </div>

          {loading ? <p className="helper-text">Cargando...</p> : null}
          {emptyRecordsMessage ? <p className="helper-text">{emptyRecordsMessage}</p> : null}
          <div className="record-filter-strip">
            {recordQuickFilterOptions.map((option) => {
              const count =
                option.key === "today"
                  ? recordsUpdatedToday
                  : option.key === "no_photo"
                    ? pendingPhotoRecords
                    : option.key === "alert"
                      ? alertRecords.length
                    : safeRecords.length;

              return (
                <button
                  key={option.key}
                  type="button"
                  className={`record-filter-chip ${recordQuickFilter === option.key ? "is-active" : ""}`}
                  onClick={() => setRecordQuickFilter(option.key)}
                >
                  <span>{option.label}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
          <div className="record-filter-panel">
            <label className="record-filter-field">
              <span>Barrio o colonia</span>
              <select name="barrio" value={recordFilters.barrio} onChange={handleRecordFilterChange}>
                <option value="">Todos</option>
                {availableRecordBarrios.map((barrio) => (
                  <option key={barrio} value={barrio}>
                    {barrio}
                  </option>
                ))}
              </select>
            </label>
            <label className="record-filter-field">
              <span>Responsable</span>
              <select name="responsible" value={recordFilters.responsible} onChange={handleRecordFilterChange}>
                <option value="">Todos</option>
                {availableRecordResponsibles.map((responsible) => (
                  <option key={responsible} value={responsible}>
                    {responsible}
                  </option>
                ))}
              </select>
            </label>
            <label className="record-filter-field">
              <span>Desde</span>
              <input type="date" name="date_from" value={recordFilters.date_from} onChange={handleRecordFilterChange} />
            </label>
            <label className="record-filter-field">
              <span>Hasta</span>
              <input type="date" name="date_to" value={recordFilters.date_to} onChange={handleRecordFilterChange} />
            </label>
            <label className="record-filter-field">
              <span>Estado operativo</span>
              <select name="status" value={recordFilters.status} onChange={handleRecordFilterChange}>
                {recordStatusFilterOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button-secondary record-filter-clear" onClick={clearRecordFilters}>
              <Icon name="refresh" />
              Limpiar filtros
            </button>
          </div>

        <div className="record-list-head">
          <span>Exp.</span>
          <span>
            {recordQuickFilter === "all"
              ? "Fichas activas"
              : recordQuickFilter === "today"
                ? "Movimiento de hoy"
                : recordQuickFilter === "no_photo"
                  ? "Pendientes de foto"
                  : "Plazo en alerta"}
          </span>
          <span>Vista</span>
        </div>

        <div className="record-list">
          {draftForm ? (
            <button
              type="button"
              className={`record-card draft-card ${!form.id ? "active" : ""}`}
              onClick={restoreDraft}
            >
              <div className="record-card-shell">
                <span className="record-number">D</span>
                <div className="record-card-body">
                  <div className="record-card-top">
                    <div className="record-main">
                      <strong>{draftForm.clave_catastral || "Borrador nuevo"}</strong>
                      <span className="record-location">{draftForm.barrio_colonia || "Continua la ficha en proceso"}</span>
                    </div>
                    <span className="record-badge">Borrador</span>
                  </div>
                  <div className="record-ledger">
                    <div className="record-ledger-row">
                      <span className="record-ledger-label">Titular</span>
                      <span className="record-ledger-value">Sin guardar</span>
                    </div>
                    <div className="record-ledger-row">
                      <span className="record-ledger-label">Estado</span>
                      <span className="record-ledger-value">Edicion local</span>
                    </div>
                  </div>
                  <small>{draftForm.comentarios || "Datos aun no guardados"}</small>
                  <div className="record-quick-actions">
                    <span className="record-quick-chip muted">Autosave activo</span>
                  </div>
                </div>
              </div>
            </button>
          ) : null}
          {visibleRecordGroups.map((group) => (
            <section key={group.label} className="record-month-group">
              <div className="record-month-heading">{group.label}</div>
              {group.items.map((record, index) => {
                const globalIndex = safeRecords.findIndex((item) => item.id === record.id) + 1;
                const deadlineMeta = recordDeadlineMetaById[record.id] ?? null;

                return (
                  <button
                    type="button"
                    key={record.id ?? record.clave_catastral}
                    className={`record-card ${form.id === record.id ? "active" : ""}`}
                    onClick={() => handleSelectRecord(record)}
                  >
                    <div className="record-card-shell">
                      <span className="record-number">{globalIndex || index + 1}</span>
                      <div className="record-card-body">
                        <div className="record-card-top">
                          <div className="record-main">
                            <strong>{record.clave_catastral}</strong>
                            <span className="record-location">{record.barrio_colonia || "Sin ubicacion"}</span>
                          </div>
                          <div className="record-status-stack">
                            <span className="record-badge">{recordView === "archived" ? "Log" : "Ficha"}</span>
                            {deadlineMeta ? (
                              <span className={`record-badge deadline-badge ${deadlineMeta.tone}`}>
                                {deadlineMeta.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="record-ledger">
                          <div className="record-ledger-row">
                            <span className="record-ledger-label">Titular</span>
                            <span className="record-ledger-value">
                              {record.inquilino || record.abonado || "Sin nombre"}
                            </span>
                          </div>
                          <div className="record-ledger-row">
                            <span className="record-ledger-label">
                              {recordView === "archived" ? "Archivo" : "Ultimo mov."}
                            </span>
                            <span className="record-ledger-value">
                              {recordView === "archived"
                                ? formatSpanishDate(record.archived_at)
                                : formatDateTime(record.updated_at || record.created_at)}
                            </span>
                          </div>
                        </div>
                        <small>
                          {recordView === "archived"
                            ? `Archivada${record.archived_reason ? `: ${record.archived_reason}` : ""}`
                            : deadlineMeta
                              ? `${deadlineMeta.helper} · Limite ${deadlineMeta.deadlineLabel}`
                              : record.comentarios || "Sin comentario"}
                        </small>
                        <div className="record-quick-actions">
                          <button type="button" className="record-quick-chip" onClick={(event) => handleQuickEdit(record, event)}>
                            Abrir
                          </button>
                          <button type="button" className="record-quick-chip" onClick={(event) => handleCopyClave(record, event)}>
                            Copiar clave
                          </button>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
        </aside>

        <section className="content">
          <form ref={sheetRef} className={`sheet no-print ${selectedRecordId ? "sheet-selected" : ""}`} onSubmit={saveRecord}>
            {selectedRecordId ? (
              <div className="sheet-selection-flag">Ficha seleccionada</div>
            ) : null}
            <div className="sheet-topbar">
              <div className="sheet-brand">
                <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="brand-logo" />
                <div>
                  <p className="sheet-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                  <p>Barrio El Centro Antiguo Local de Cooperativa Guadalupe.</p>
                  <p>Tel: 2782-5075 Fax: 2780-3985</p>
                </div>
              </div>
              <div className="sheet-draft-status no-print">
                <span className={`record-quick-chip ${draftSaveState === "saving" ? "" : "muted"}`}>
                  {draftSaveState === "saving" ? "Guardando borrador..." : draftForm ? "Borrador activo" : "Sin borrador"}
                </span>
                {selectedRecordDeadlineMeta ? (
                  <span className={`record-badge deadline-badge ${selectedRecordDeadlineMeta.tone}`}>
                    {selectedRecordDeadlineMeta.label} · {selectedRecordDeadlineMeta.helper}
                  </span>
                ) : null}
                {draftSavedAt ? <small>Ultimo autosave {formatDateTime(draftSavedAt)}</small> : null}
              </div>

              <div className="clave-box">
                <label>Clave Catastral</label>
                <input
                  name="clave_catastral"
                  value={form.clave_catastral}
                  onChange={handleChange}
                  placeholder="00-00-00"
                  required
                />
              </div>
            </div>

            <div className="sheet-title">FICHA TECNICA DE INFORMACION CATASTRAL</div>

            <div className="section-tabs-wrap">
              <div className="section-tabs-head">
                <span className="section-tabs-kicker">Secciones de la ficha</span>
                <strong>
                  Paso {sectionDefinitions.findIndex((section) => section.key === activeSection) + 1} de {sectionDefinitions.length}
                </strong>
              </div>
              <div className="section-tabs">
                {sectionDefinitions.map((section, index) => (
                  <button
                    key={section.key}
                    type="button"
                    className={activeSection === section.key ? "tab active" : "tab"}
                    onClick={() => setActiveSection(section.key)}
                  >
                    <span className="tab-step">{index + 1}</span>
                    <span className="tab-label-desktop">{section.label}</span>
                    <span className="tab-label-mobile">{section.mobileLabel}</span>
                  </button>
                ))}
              </div>
              <div className="section-flow-bar no-print">
                <button type="button" className="button-secondary" onClick={() => moveRecordSection(-1)} disabled={!previousSection}>
                  <Icon name="arrowLeft" />
                  {previousSection ? previousSection.mobileLabel : "Inicio"}
                </button>
                <div className="section-flow-hint">
                  <strong>{sectionDefinitions[currentSectionIndex]?.label}</strong>
                  <small>
                    {nextSection ? `Sigue: ${nextSection.label}` : "Ultimo paso, revisa y guarda"}
                  </small>
                </div>
                <button type="button" className="button-secondary" onClick={() => moveRecordSection(1)} disabled={!nextSection}>
                  {nextSection ? nextSection.mobileLabel : "Listo"}
                  <Icon name="arrowRight" />
                </button>
              </div>
            </div>

            {activeSection === "abonado" ? (
              <section className="sheet-section">
                <h3>Informacion del abonado</h3>
                {fieldGroups.slice(0, 2).map((group, index) => (
                  <div className="form-grid" key={index}>
                    {group.map((field) => (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <input name={field.key} value={form[field.key]} onChange={handleChange} />
                      </label>
                    ))}
                  </div>
                ))}
              </section>
            ) : null}

            {activeSection === "inmueble" ? (
              <>
                <section className="sheet-section">
                  <h3>Identificacion del inmueble</h3>
                  <label>
                    <span>Accion</span>
                    <textarea
                      name="accion_inspeccion"
                      value={form.accion_inspeccion}
                      onChange={handleChange}
                      rows="4"
                    />
                  </label>
                </section>

                <section className="sheet-section">
                  <h3>Datos del inmueble</h3>
                  {fieldGroups.slice(2, 4).map((group, index) => (
                    <div className="form-grid" key={index}>
                      {group.map((field) => (
                        <label key={field.key}>
                          <span>{field.label}</span>
                          <input name={field.key} value={form[field.key]} onChange={handleChange} />
                        </label>
                      ))}
                    </div>
                  ))}
                </section>
              </>
            ) : null}

            {activeSection === "servicios" ? (
              <section className="sheet-section">
                <h3>Datos de los servicios</h3>
                <div className="form-grid">
                  {fieldGroups[4].map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <select name={field.key} value={form[field.key]} onChange={handleChange}>
                        <option value="Si">Si</option>
                        <option value="No">No</option>
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {activeSection === "aviso" ? (
              <section className="sheet-section two-columns compact-columns">
                <div>
                  <h3>Fotografia del inmueble</h3>
                  <label className="file-input">
                    <span>Seleccionar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {selectedFile ? (
                    <p className="helper-text">
                      Archivo listo: {selectedFile.name}. Se optimizara automaticamente al guardar.
                    </p>
                  ) : null}
                  {localSelectedPhotoUrl || selectedPhotoUrl ? (
                    <img
                      src={localSelectedPhotoUrl || selectedPhotoUrl}
                      alt="Fotografia del inmueble"
                      className="photo-preview"
                    />
                  ) : (
                    <div className="photo-placeholder">Sin fotografia cargada</div>
                  )}
                </div>

                <div>
                  <h3>Datos para aviso</h3>
                  <div className="stack-fields">
                    <label>
                      <span>Fecha del aviso</span>
                      <input type="date" name="fecha_aviso" value={form.fecha_aviso || ""} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Firmante</span>
                      <input name="firmante_aviso" value={form.firmante_aviso} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Cargo</span>
                      <input name="cargo_firmante" value={form.cargo_firmante} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Levantamiento de datos</span>
                      <input name="levantamiento_datos" value={form.levantamiento_datos} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Analista de datos</span>
                      <input name="analista_datos" value={form.analista_datos} onChange={handleChange} />
                    </label>
                  </div>
                </div>
              </section>
            ) : null}

            {recordValidationIssues.length ? (
              <div className="record-validation-card no-print">
                <div className="record-validation-head">
                  <strong>Revision previa</strong>
                  <span>{recordValidationIssues.length} puntos por revisar</span>
                </div>
                <div className="record-validation-list">
                  {recordValidationIssues.map((issue) => (
                    <button
                      key={`${issue.field}-${issue.text}`}
                      type="button"
                      className={`record-validation-item ${issue.field === "foto_path" ? "is-soft" : ""}`}
                      onClick={() => setActiveSection(issue.section)}
                    >
                      <Icon name={issue.field === "foto_path" ? "activity" : "records"} />
                      <span>{issue.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="record-validation-card no-print is-ready">
                <div className="record-validation-head">
                  <strong>Ficha lista para guardar</strong>
                  <span>Las validaciones principales estan completas.</span>
                </div>
              </div>
            )}

            <div className="action-row">
              <button
                type="submit"
                data-intent={saveIntentOptions.stay}
                disabled={saving}
                onClick={() => setSaveIntent(saveIntentOptions.stay)}
              >
                {saving ? "Guardando..." : form.id ? "Actualizar ficha" : "Guardar ficha"}
              </button>
              {!form.id ? (
                <button
                  type="submit"
                  data-intent={saveIntentOptions.new}
                  className="button-secondary"
                  disabled={saving}
                  onClick={() => setSaveIntent(saveIntentOptions.new)}
                >
                  {saving ? "Guardando..." : "Guardar y nueva"}
                </button>
              ) : null}
              {form.id ? (
                <button type="button" className="button-danger" onClick={handleArchiveRecord}>
                  Archivar ficha
                </button>
              ) : null}
              {recordView === "archived" && form.id ? (
                <button type="button" className="button-secondary" onClick={() => handleRestoreRecord(form.id)}>
                  Restaurar ficha
                </button>
              ) : null}
              {recordView === "archived" && form.id && isAdmin ? (
                <button type="button" className="button-danger" onClick={() => setPendingDeleteRecord(form)}>
                  Eliminar archivada
                </button>
              ) : null}
              <button type="button" className="button-secondary" onClick={resetForm}>
                Limpiar
              </button>
            </div>
          </form>

          <section className="preview-panel">
            <div className="preview-actions no-print">
              <button type="button" className="button-secondary" onClick={handlePrintFicha}>
                Imprimir ficha
              </button>
              <button type="button" onClick={generateAviso} disabled={loadingAviso}>
                {loadingAviso ? "Generando aviso..." : "Generar aviso"}
              </button>
              <button type="button" className="button-secondary" onClick={handlePrintAviso}>
                Imprimir aviso
              </button>
            </div>

            <h2>Ficha visual</h2>
            <article className="document-sheet">
              <header className="document-header">
                <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="document-logo" />
                <p>Aguas de Choluteca, S.A. de C.V.</p>
                <p>Barrio El Centro Antiguo Local de Cooperativa Guadalupe.</p>
                <p>Tel: 2782-5075 Fax: 2780-3985</p>
                <h3>FICHA TECNICA DE INFORMACION CATASTRAL</h3>
                <div className="document-key">Clave Catastral: {form.clave_catastral || "--"}</div>
              </header>

              <section className="document-block">
                <h4>Informacion del abonado</h4>
                <div className="document-grid">
                  <div><strong>Abonado</strong><span>{form.abonado || "--"}</span></div>
                  <div><strong>Catastral</strong><span>{form.nombre_catastral || "--"}</span></div>
                  <div><strong>Inquilino</strong><span>{form.inquilino || "--"}</span></div>
                  <div><strong>Barrio/Colonia</strong><span>{form.barrio_colonia || "--"}</span></div>
                  <div><strong>Identidad</strong><span>{form.identidad || "--"}</span></div>
                  <div><strong>Telefono</strong><span>{form.telefono || "--"}</span></div>
                </div>
              </section>

              <section className="document-block">
                <h4>Identificacion del inmueble</h4>
                <p>{form.accion_inspeccion || "Sin detalle de inspeccion."}</p>
              </section>

              <section className="document-block">
                <h4>Datos del inmueble</h4>
                <div className="document-grid">
                  <div><strong>Situacion</strong><span>{form.situacion_inmueble || "--"}</span></div>
                  <div><strong>Tendencia</strong><span>{form.tendencia_inmueble || "--"}</span></div>
                  <div><strong>Uso del suelo</strong><span>{form.uso_suelo || "--"}</span></div>
                  <div><strong>Actividad</strong><span>{form.actividad || "--"}</span></div>
                  <div><strong>Codigo del sector</strong><span>{form.codigo_sector || "--"}</span></div>
                  <div><strong>Comentarios</strong><span>{form.comentarios || "--"}</span></div>
                </div>
              </section>

              <section className="document-block">
                <h4>Datos de los servicios</h4>
                <div className="document-grid">
                  <div><strong>Agua potable</strong><span>{form.conexion_agua || "--"}</span></div>
                  <div><strong>Alcantarillado</strong><span>{form.conexion_alcantarillado || "--"}</span></div>
                  <div><strong>Desechos</strong><span>{form.recoleccion_desechos || "--"}</span></div>
                </div>
                {localSelectedPhotoUrl || selectedPhotoUrl ? (
                  <div className="document-photo-wrap">
                    <img
                      src={localSelectedPhotoUrl || selectedPhotoUrl}
                      alt="Fotografia del inmueble"
                      className="document-photo"
                    />
                  </div>
                ) : null}
              </section>

              <section className="document-block">
                <div className="document-signatures">
                  <div>
                    <strong>{form.levantamiento_datos || "--"}</strong>
                    <span>LEVANTAMIENTO DE DATOS</span>
                  </div>
                  <div>
                    <strong>{form.analista_datos || "--"}</strong>
                    <span>ANALISTA DE DATOS</span>
                  </div>
                </div>
              </section>
            </article>

            <article className="document-sheet record-history-sheet no-print">
              <div className="admin-section-head">
                <div>
                  <p className="sheet-kicker">Trazabilidad de la ficha</p>
                  <h2><Icon name="history" className="title-icon" />Historial por ficha</h2>
                </div>
                {form.id ? <span className="panel-pill">#{form.id}</span> : null}
              </div>
              {loadingRecordHistory ? (
                <p className="helper-text">Cargando historial de la ficha...</p>
              ) : form.id ? (
                recordHistory.length ? (
                  <div className="record-history-list">
                    {recordHistory.map((log) => (
                      <div key={log.id} className="record-history-item">
                        <div className="record-history-topline">
                          <span className="record-badge">{actionLabel(log.action)}</span>
                          <small>{formatDateTime(log.created_at)}</small>
                        </div>
                        <strong>{log.actor_name || log.actor_email || "Sistema"}</strong>
                        <p>{log.summary || "Movimiento registrado"}</p>
                        {(() => {
                          const photoPath =
                            log.details_json?.foto_path ||
                            (log.action === "inmueble.photo_attached" ? form.foto_path : "");

                          if (!photoPath) return null;

                          return (
                            <img
                              src={buildPhotoUrl(photoPath, log.created_at || form.updated_at || Date.now())}
                              alt="Fotografia registrada en el historial"
                              className="record-history-photo"
                              loading="lazy"
                            />
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <h3>Sin movimientos registrados</h3>
                    <p>Esta ficha todavia no tiene eventos auditados para mostrar.</p>
                  </div>
                )
              ) : (
                <div className="empty-state">
                  <h3>Selecciona una ficha</h3>
                  <p>Cuando abras una ficha guardada, aqui veras quien la creo, edito, archivo o restauro.</p>
                </div>
              )}
            </article>
          </section>
        </section>
      </main>
      ) : workspaceView === "lookup" ? (
        <main className="lookup-layout">
          <section className="lookup-shell no-print">
            <div className="lookup-card">
              <div className="lookup-card-head">
                <div>
                  <p className="sheet-kicker">Padron maestro</p>
                  <h2><Icon name="search" className="title-icon" />Buscar clave</h2>
                  <p className="lookup-card-description">
                    Consulta rapida para campo por clave, nombre o abonado, con lectura clara de saldo y servicios.
                  </p>
                </div>
                <span className="panel-pill">Consulta separada</span>
              </div>

              <div className="lookup-info-strip">
                <div className="lookup-info-chip">
                  <Icon name="search" />
                  <div>
                    <strong>Consulta rapida</strong>
                    <span>Resultados sin salir del flujo de campo</span>
                  </div>
                </div>
                <div className="lookup-info-chip">
                  <Icon name="activity" />
                  <div>
                    <strong>Lectura de saldo</strong>
                    <span>Sin interes, interes y total con estado visual</span>
                  </div>
                </div>
                <div className="lookup-info-chip">
                  <Icon name="success" />
                  <div>
                    <strong>Servicios claros</strong>
                    <span>Si y No traducidos para lectura inmediata</span>
                  </div>
                </div>
              </div>

              <form className="lookup-form" onSubmit={handleLookupSearch}>
                <div className="lookup-mode-switch" role="tablist" aria-label="Tipo de busqueda">
                  {LOOKUP_SEARCH_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      role="tab"
                      aria-selected={lookupSearchMode === mode.value}
                      className={lookupSearchMode === mode.value ? "is-active" : ""}
                      onClick={() => handleLookupSearchModeChange(mode.value)}
                    >
                      <span>{mode.label}</span>
                      <small>{mode.helper}</small>
                    </button>
                  ))}
                </div>

                <label className="lookup-field">
                  <span>{lookupInputLabel}</span>
                  <input
                    className={lookupSearchMode === "clave" ? "" : "is-textual"}
                    value={lookupQuery}
                    onChange={handleLookupInputChange}
                    inputMode={lookupModeConfig.inputMode}
                    autoComplete="off"
                    placeholder={lookupInputPlaceholder}
                    maxLength={lookupSearchMode === "clave" ? 11 : lookupSearchMode === "abonado" ? 18 : 96}
                  />
                </label>
                {lookupSearchMode === "clave" ? (
                  <>
                    <div className="lookup-prefix-toggle" role="group" aria-label="Tipo de prefijo">
                      <button
                        type="button"
                        className={lookupPrefixMode === "auto" ? "is-active" : ""}
                        onClick={() => handleLookupPrefixModeChange("auto")}
                      >
                        Auto
                      </button>
                      <button
                        type="button"
                        className={lookupPrefixMode === "two" ? "is-active" : ""}
                        onClick={() => handleLookupPrefixModeChange("two")}
                      >
                        Prefijo 2
                      </button>
                      <button
                        type="button"
                        className={lookupPrefixMode === "three" ? "is-active" : ""}
                        onClick={() => handleLookupPrefixModeChange("three")}
                      >
                        Prefijo 3
                      </button>
                    </div>
                    <div className="lookup-guide-sheet">
                      <span>{lookupPrefixMode === "three" ? "###" : "##"}</span>
                      <span>##</span>
                      <span>##</span>
                      <span className="is-optional">##</span>
                    </div>
                  </>
                ) : null}
                <div className="lookup-helper-row">
                  <span className="helper-text">
                    {lookupSearchMode === "clave"
                      ? "Base de 3 bloques: trae todas las coincidencias. Se acepta primer bloque de 2 o 3 digitos."
                      : lookupSearchMode === "nombre"
                        ? "Busca por inquilino, propietario o nombre asociado dentro del padron maestro."
                        : "Puedes escribir una parte del numero de abonado para encontrar coincidencias rapido."}
                  </span>
                  <div className="lookup-example-chips">
                    {lookupSearchMode === "clave" ? (
                      <>
                        <button
                          type="button"
                          className="record-quick-chip"
                          onClick={() => {
                            setLookupPrefixMode("auto");
                            setLookupQuery("10-10-10");
                          }}
                        >
                          10-10-10
                        </button>
                        <button
                          type="button"
                          className="record-quick-chip"
                          onClick={() => {
                            setLookupPrefixMode("three");
                            setLookupQuery("100-10-10");
                          }}
                        >
                          100-10-10
                        </button>
                        <button
                          type="button"
                          className="record-quick-chip"
                          onClick={() => {
                            setLookupPrefixMode("auto");
                            setLookupQuery("10-10-10-01");
                          }}
                        >
                          10-10-10-01
                        </button>
                        <button
                          type="button"
                          className="record-quick-chip"
                          onClick={() => {
                            setLookupPrefixMode("three");
                            setLookupQuery("100-10-10-01");
                          }}
                        >
                          100-10-10-01
                        </button>
                      </>
                    ) : lookupSearchMode === "nombre" ? (
                      <>
                        <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("Juan")}>
                          Juan
                        </button>
                        <button
                          type="button"
                          className="record-quick-chip"
                          onClick={() => setLookupQuery("Aguilera")}
                        >
                          Aguilera
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("16523")}>
                          16523
                        </button>
                        <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("100")}>
                          100
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {lookupHistory.length ? (
                  <div className="lookup-recent-strip">
                    <div className="lookup-recent-head">
                      <strong>Recientes en este equipo</strong>
                      <small>Repite una consulta sin volver a escribir</small>
                    </div>
                    <div className="lookup-recent-list">
                      {lookupHistory.slice(0, 6).map((item) => (
                        <div
                          key={`${item.mode}-${item.normalized_query}-${item.searched_at}`}
                          className="lookup-recent-item"
                        >
                          <button
                            type="button"
                            className="lookup-recent-chip"
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
                            }}
                          >
                            <span>{item.normalized_query || item.query}</span>
                            <small>{item.mode === "clave" ? "Clave" : item.mode === "nombre" ? "Nombre" : "Abonado"}</small>
                          </button>
                          <button
                            type="button"
                            className="lookup-recent-remove"
                            onClick={() => handleRemoveLookupHistoryItem(item)}
                            aria-label={`Eliminar busqueda temporal ${item.normalized_query || item.query}`}
                            title="Eliminar busqueda temporal"
                          >
                            <Icon name="waste" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {lookupFeedback ? <p className="lookup-feedback">{lookupFeedback}</p> : null}
                <div className="search-actions lookup-actions">
                  <button type="submit" disabled={lookupLoading}>
                    <Icon name="search" />
                    {lookupLoading
                      ? "Consultando..."
                      : lookupSearchMode === "clave"
                        ? "Consultar clave"
                        : lookupSearchMode === "nombre"
                          ? "Buscar nombre"
                          : "Buscar abonado"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setLookupQuery("");
                      setLookupResult(null);
                      setLookupFeedback("");
                    }}
                  >
                    <Icon name="refresh" />
                    Limpiar
                  </button>
                </div>
              </form>
            </div>

            <div className="lookup-results">
              {lookupResult ? (
                <article className={`lookup-result-card ${lookupResult.exists ? "is-found" : "is-missing"}`}>
                  <div className="lookup-result-head">
                    <div>
                      <p className="eyebrow">
                        {lookupResult.field === "clave"
                          ? lookupResult.mode === "base"
                            ? "Busqueda por base"
                            : "Busqueda exacta"
                          : lookupResult.field === "nombre"
                            ? "Busqueda por nombre"
                            : "Busqueda por abonado"}
                      </p>
                      <h3>{lookupResult.normalized_query}</h3>
                    </div>
                    <span className={`lookup-status-pill ${lookupResult.exists ? "is-found" : "is-missing"}`}>
                      {lookupResult.exists ? "Si registrada" : "Sin registro"}
                    </span>
                  </div>

                  <p className="lookup-result-message">
                    {lookupResult.exists
                      ? lookupResult.field === "clave"
                        ? lookupResult.mode === "base"
                          ? `Se encontraron ${lookupResult.total_matches} coincidencias asociadas a esa clave base.`
                          : "La clave consultada si existe en el sistema maestro."
                        : `Se encontraron ${lookupResult.total_matches} coincidencias asociadas a esa consulta.`
                      : "No existe registro en el sistema. Posible clandestino."}
                  </p>

                  {lookupResult.exists ? (
                    <>
                      <div className="lookup-summary-strip">
                        <div className="lookup-summary-card">
                          <span>Coincidencias</span>
                          <strong>{lookupResult.total_matches}</strong>
                        </div>
                        <div className="lookup-summary-card">
                          <span>Modo</span>
                          <strong>
                            {lookupResult.field === "clave"
                              ? lookupResult.mode === "base"
                                ? "Base"
                                : "Exacta"
                              : lookupResult.field === "nombre"
                                ? "Nombre"
                                : "Abonado"}
                          </strong>
                        </div>
                        <div className="lookup-summary-card">
                          <span>Consulta</span>
                          <strong>{lookupResult.normalized_query}</strong>
                        </div>
                      </div>
                      <div className="lookup-match-list">
                      {lookupResult.matches.map((match) => (
                        (() => {
                          const totalMeta = getLookupTotalMeta(match.total);
                          return (
                            <article key={`${match.clave_catastral}-${match.inquilino}-${match.nombre}`} className="lookup-match-card">
                              <div className="lookup-match-top">
                                <div className="lookup-match-headline">
                                  <strong>{match.clave_catastral}</strong>
                                  <span className="lookup-abonado-pill">Abonado {match.abonado || "--"}</span>
                                </div>
                                <span className={`lookup-match-status ${totalMeta.tone}`}>
                                  <Icon name={totalMeta.icon} />
                                  {totalMeta.helper}
                                </span>
                              </div>
                              <div className="lookup-match-grid">
                                <div className="lookup-match-field">
                                  <span className="lookup-match-label">Nombre</span>
                                  <span>{match.inquilino || "Sin nombre asociado"}</span>
                                </div>
                                <div className="lookup-match-field">
                                  <span className="lookup-match-label">Abonado</span>
                                  <span>{match.abonado || "--"}</span>
                                </div>
                                <div className="lookup-match-field">
                                  <span className="lookup-match-label">Zona</span>
                                  <span>{match.barrio_colonia || "--"}</span>
                                </div>
                                <div className="lookup-match-field">
                                  <span className="lookup-match-label">Sin interes</span>
                                  <strong className="lookup-match-amount">
                                    {formatLookupAmount(match.valor)}
                                  </strong>
                                </div>
                                <div className="lookup-match-field">
                                  <span className="lookup-match-label">Interes</span>
                                  <strong className="lookup-match-amount">
                                    {formatLookupAmount(match.intereses)}
                                  </strong>
                                </div>
                                <div className="lookup-match-field">
                                  <span className="lookup-match-label">Con interes</span>
                                  <strong className={`lookup-match-total ${totalMeta.tone}`}>
                                    {totalMeta.text}
                                  </strong>
                                </div>
                              </div>
                              <div className="lookup-service-grid">
                                {[
                                  { label: "Agua", value: match.agua, icon: "water" },
                                  { label: "Alcantarillado", value: match.alcantarillado, icon: "sewer" },
                                  { label: "Barrido", value: match.barrido, icon: "broom" },
                                  { label: "Recoleccion", value: match.recoleccion, icon: "refresh" },
                                  { label: "Desechos peligrosos", value: match.desechos_peligrosos, icon: "waste" }
                                ].map((service) => {
                                  const serviceMeta = getLookupServiceMeta(service.value);
                                  return (
                                    <div key={service.label} className={`lookup-service-pill ${serviceMeta.tone}`}>
                                      <div className="lookup-service-pill-top">
                                        <span className="lookup-service-icon">
                                          <Icon name={service.icon} />
                                        </span>
                                        <span>{service.label}</span>
                                      </div>
                                      <strong>{serviceMeta.label}</strong>
                                    </div>
                                  );
                                })}
                              </div>
                            </article>
                          );
                        })()
                      ))}
                      </div>
                    </>
                  ) : null}
                </article>
              ) : (
                <article className="lookup-empty-card">
                  <h3>Consulta rapida de padron</h3>
                  <p>
                    Usa esta pantalla para validar en campo por clave, nombre o abonado sin entrar al modulo de
                    registro de clandestinos.
                  </p>
                </article>
              )}
            </div>
          </section>
        </main>
      ) : workspaceView === "padron" ? (
        <main className="lookup-layout">
          <section className="lookup-shell no-print">
            <form className="lookup-card" onSubmit={handleUploadPadron}>
              <div className="lookup-card-head">
                <div>
                  <p className="sheet-kicker">Padron maestro</p>
                  <h2><Icon name="refresh" className="title-icon" />Actualizar padron de consulta</h2>
                </div>
                <span className="panel-pill">{padronMeta?.total_records ?? 0} claves</span>
              </div>

              <div className="admin-result-grid padron-admin-grid">
                <div className="document-block">
                  <h4>Archivo activo</h4>
                  <p><strong>Archivo:</strong> {padronMeta?.file_name || "Sin registro"}</p>
                  <p><strong>Fuente guardada:</strong> {padronMeta?.source_file_available ? (padronMeta?.source_file_name || "Disponible") : "No disponible"}</p>
                  <p><strong>Hoja:</strong> {padronMeta?.sheet_name || "--"}</p>
                  <p><strong>Ultima actualizacion:</strong> {formatDateTime(padronMeta?.updated_at)}</p>
                  <p><strong>Estado actual:</strong> {loadingPadronMeta ? "Consultando..." : "Sincronizado"}</p>
                  <p className="helper-text">`Cambiadas` compara la misma clave contra el padrón anterior y detecta cambios en el nombre asociado.</p>
                  <div className="padron-summary-strip">
                    <div className="log-summary-card">
                      <span>Nuevas</span>
                      <strong>{padronImportSummary?.added ?? 0}</strong>
                    </div>
                    <div className="log-summary-card">
                      <span>Removidas</span>
                      <strong>{padronImportSummary?.removed ?? 0}</strong>
                    </div>
                    <div className="log-summary-card">
                      <span>Cambiadas</span>
                      <strong>{padronImportSummary?.changed ?? 0}</strong>
                    </div>
                  </div>
                </div>
                <div className="document-block">
                  <h4>Nuevo archivo</h4>
                  <label className="file-input">
                    <span>Seleccionar Excel maestro</span>
                    <input
                      type="file"
                      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handlePadronFileChange}
                    />
                  </label>
                  <p className="helper-text">
                    Sube el padrón maestro en Excel y el módulo <strong>Buscar clave</strong> usará la nueva versión de inmediato.
                  </p>
                  {padronFile ? <p><strong>Archivo listo:</strong> {padronFile.name}</p> : null}
                </div>
              </div>

              <div className="search-actions lookup-actions">
                <button type="submit" disabled={uploadingPadron}>
                  <Icon name="refresh" />
                  {uploadingPadron ? "Actualizando..." : "Actualizar padron maestro"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleReprocessPadron}
                  disabled={reprocessingPadron || uploadingPadron || !padronMeta?.source_file_available}
                >
                  <Icon name="refresh" />
                  {reprocessingPadron ? "Reprocesando..." : "Reprocesar ultimo Excel"}
                </button>
                <button type="button" className="button-secondary" onClick={handleDownloadPadron}>
                  <Icon name="records" />
                  Descargar Excel actual
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setPadronFile(null);
                    loadPadronMeta();
                  }}
                  disabled={loadingPadronMeta}
                >
                  <Icon name="records" />
                  {loadingPadronMeta ? "Consultando..." : "Ver estado actual"}
                </button>
              </div>
            </form>
          </section>
        </main>
      ) : workspaceView === "map" ? (
        <main className="map-layout no-print">
          <section className="map-shell">
            <article className="map-stage-card">
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Geolocalizacion de campo</p>
                  <h2><Icon name="map" className="title-icon" />Mapa de campo</h2>
                </div>
                <span className="panel-pill">{visibleMapPoints.length} puntos</span>
              </div>
              <div className="map-toolbar">
                <span className={`map-status-chip ${mapStatus === "Sin conexion" ? "is-offline" : ""}`}>
                  <Icon name={mapStatus === "GPS listo" ? "success" : mapStatus === "Sin conexion" ? "activity" : "map"} />
                  {mapStatus}
                </span>
                <span className="helper-text">Toca el mapa para fijar coordenadas o usa tu ubicacion actual.</span>
              </div>
              <div className="map-diary-strip">
                <div className="map-diary-strip-head">
                  <strong>Bitacora por dia</strong>
                  <span>{formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
                </div>
                <div className="map-diary-tabs">
                  {mapDiaryGroups.length ? (
                    mapDiaryGroups.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        className={`map-diary-tab ${activeMapDiaryDateKey === group.key ? "is-active" : ""}`}
                        onClick={() => setMapDiaryDateKey(group.key)}
                      >
                        <strong>{formatMapDiaryLabel(group.key)}</strong>
                        <span>{group.total} puntos</span>
                      </button>
                    ))
                  ) : (
                    <span className="map-diary-empty">Todavia no hay jornadas registradas.</span>
                  )}
                </div>
              </div>
              <FieldMap
                apiUrl={API_URL}
                isActive={workspaceView === "map"}
                mapDraft={mapDraft}
                mapFocusRequest={mapFocusRequest}
                mapPoints={visibleMapPoints}
                onDraftChange={setMapDraft}
                onSelectPoint={handleSelectMapPoint}
                onStatusChange={setMapStatus}
                selectedMapPointId={selectedMapPointId}
              />
            </article>

            <aside className="map-side-panel">
              <form className="map-form-card" onSubmit={handleSaveMapPoint}>
                <div className="lookup-card-head map-card-head">
                  <div>
                    <p className="sheet-kicker">Nuevo punto</p>
                    <h3>Registrar ubicacion</h3>
                  </div>
                  <button type="button" className="button-secondary" onClick={resetMapDraft}>
                    <Icon name="refresh" />
                    Limpiar
                  </button>
                </div>

                <div className="map-coordinates-grid">
                  <label>
                    <span>Latitud</span>
                    <input name="latitude" value={mapDraft.latitude} onChange={handleMapDraftChange} placeholder="13.301700" />
                  </label>
                  <label>
                    <span>Longitud</span>
                    <input name="longitude" value={mapDraft.longitude} onChange={handleMapDraftChange} placeholder="-87.188900" />
                  </label>
                  <label>
                    <span>Precision (m)</span>
                    <input
                      name="accuracy_meters"
                      value={mapDraft.accuracy_meters}
                      onChange={handleMapDraftChange}
                      inputMode="decimal"
                      placeholder="5"
                    />
                  </label>
                  <label>
                    <span>Tipo de punto</span>
                    <select name="point_type" value={mapDraft.point_type} onChange={handleMapDraftChange}>
                      {MAP_POINT_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  <span>Referencia</span>
                  <input
                    name="reference"
                    value={mapDraft.reference}
                    onChange={handleMapDraftChange}
                    placeholder="Frente a poste, esquina noroeste, casa verde..."
                  />
                </label>
                <label>
                  <span>Descripcion tecnica</span>
                  <textarea
                    name="description"
                    value={mapDraft.description}
                    onChange={handleMapDraftChange}
                    rows="4"
                    placeholder="Detalle de la caja, descarga o punto observado."
                  />
                </label>
                <div className="map-form-actions">
                  <button type="button" className="button-secondary" onClick={handleLocateUser} disabled={locatingUser}>
                    <Icon name="map" />
                    {locatingUser ? "Ubicando..." : "Usar mi ubicacion"}
                  </button>
                  <button type="submit" disabled={savingMapPoint}>
                    <Icon name="plus" />
                    {savingMapPoint ? "Guardando..." : "Guardar punto"}
                  </button>
                </div>
              </form>

              {selectedMapPoint ? (
                <article className="map-detail-card">
                  <div className="lookup-card-head map-card-head">
                    <div>
                      <p className="sheet-kicker">Punto seleccionado</p>
                      <h3>{getMapPointTypeLabel(selectedMapPoint.point_type)}</h3>
                    </div>
                    <span className="panel-pill">#{selectedMapPoint.id}</span>
                  </div>
                  <p className="map-detail-copy">
                    {selectedMapPoint.reference_note || selectedMapPoint.description || "Sin referencia adicional."}
                  </p>
                  <div className="map-point-coords">
                    <span>{formatCoordinate(selectedMapPoint.latitude)}</span>
                    <span>{formatCoordinate(selectedMapPoint.longitude)}</span>
                    <span>{selectedMapPoint.accuracy_meters ? `±${selectedMapPoint.accuracy_meters} m` : "Sin precision"}</span>
                  </div>
                  <div className="map-point-actions">
                    <button type="button" className="button-secondary" onClick={(event) => handleOpenPointInMaps(selectedMapPoint, event)}>
                      <Icon name="map" />
                      Ver en Maps
                    </button>
                    <button type="button" className="button-secondary" onClick={(event) => handleCopyCoordinates(selectedMapPoint, event)}>
                      <Icon name="copy" />
                      Copiar coords
                    </button>
                  </div>
                </article>
              ) : null}

              <article className="map-list-card">
                <div className="lookup-card-head map-card-head">
                  <div>
                    <p className="sheet-kicker">Registro tecnico</p>
                    <h3>Puntos guardados</h3>
                  </div>
                  <div className="map-list-head-actions">
                    <span className="panel-pill">{visibleMapPoints.length}</span>
                    <button type="button" className="button-secondary" onClick={handleDownloadMapReport}>
                      <Icon name="records" />
                      Reporte detallado
                    </button>
                  </div>
                </div>
                <p className="helper-text">Mostrando la jornada del {formatMapDiaryLabel(activeMapDiaryDateKey)}.</p>
                {loadingMapPoints ? <p className="helper-text">Cargando puntos...</p> : null}
                <div className="map-point-list">
                  {visibleMapPoints.length ? (
                    visibleMapPoints.map((point) => (
                      <article
                        key={point.id}
                        className={`map-point-card ${selectedMapPointId === point.id ? "is-active" : ""}`}
                      >
                        <button type="button" className="map-point-main" onClick={() => handleSelectMapPoint(point.id)}>
                          <div className="map-point-top">
                            <strong>{getMapPointTypeLabel(point.point_type)}</strong>
                            <span className="map-point-meta">{formatDateTime(point.created_at)}</span>
                          </div>
                          <p>{point.reference_note || point.description || "Sin referencia adicional."}</p>
                          <div className="map-point-coords">
                            <span>{formatCoordinate(point.latitude)}</span>
                            <span>{formatCoordinate(point.longitude)}</span>
                            <span>{point.accuracy_meters ? `±${point.accuracy_meters} m` : "Sin precision"}</span>
                          </div>
                        </button>
                        <div className="map-point-actions">
                          <button type="button" className="record-quick-chip" onClick={(event) => handleOpenPointInMaps(point, event)}>
                            Ver en Maps
                          </button>
                          <button type="button" className="record-quick-chip" onClick={(event) => handleCopyCoordinates(point, event)}>
                            Copiar coords
                          </button>
                        {isAdmin ? (
                          <button type="button" className="record-quick-chip" onClick={() => handleDeleteMapPoint(point.id)}>
                            Eliminar
                          </button>
                        ) : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <h3>Sin puntos aun</h3>
                      <p>Usa el GPS o toca el mapa para comenzar a registrar ubicaciones tecnicas.</p>
                    </div>
                  )}
                </div>
              </article>
            </aside>
          </section>
        </main>
      ) : (
        <main className={`admin-layout ${["logs", "mapReports", "requests"].includes(workspaceView) ? "admin-layout-logs" : ""}`}>
          {workspaceView === "users" ? (
          <aside className="sidebar no-print">
            {workspaceView === "users" ? (
              <>
                <div className="panel-header">
                  <h2>Usuarios</h2>
                  <span className="panel-pill">{safeUsers.length}</span>
                </div>
                {loadingUsers ? <p className="helper-text">Cargando usuarios...</p> : null}
                <div className="record-list">
                  {safeUsers.map((user) => (
                    <article
                      key={user.id}
                      className={`record-card info-card ${selectedUser?.id === user.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedUserId(user.id)}
                    >
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
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="panel-header">
                  <h2>Actividad reciente</h2>
                  <span className="panel-pill">{safeAuditLogs.length}</span>
                </div>
                {loadingLogs ? <p className="helper-text">Cargando historial...</p> : null}
                <div className="record-list">
                  {safeAuditLogs.map((log) => (
                    <article key={log.id} className="record-card info-card">
                      <div className="record-card-top">
                        <strong>{actionLabel(log.action)}</strong>
                        <span className="record-badge">{log.entity_type}</span>
                      </div>
                      <span>{log.summary || "Movimiento registrado"}</span>
                      <small>{formatDateTime(log.created_at)}</small>
                    </article>
                  ))}
                </div>
              </>
            )}
          </aside>
          ) : null}

          <section className={`admin-content ${["logs", "mapReports", "requests"].includes(workspaceView) ? "admin-content-logs" : ""}`}>
            {workspaceView === "mapReports" ? (
              <section className="preview-panel log-panel-full">
                <div className="log-shell">
                  <div className="log-hero">
                    <div className="admin-section-head">
                      <div>
                        <p className="sheet-kicker">Reporte administrativo</p>
                        <h2><Icon name="records" className="title-icon" />Levantamiento de campo</h2>
                        <p className="workspace-title">
                          Coordenadas, totales y zonas consolidadas para una lectura institucional mas compacta y lista para impresion.
                        </p>
                      </div>
                      <span className="panel-pill">{mapReportData.totalPoints} puntos</span>
                    </div>
                    <div className="map-diary-strip map-diary-strip-report">
                      <div className="map-diary-strip-head">
                        <strong>Jornadas de bitacora</strong>
                        <span>{formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
                      </div>
                      <div className="map-diary-tabs">
                        {mapDiaryGroups.length ? (
                          mapDiaryGroups.map((group) => (
                            <button
                              key={group.key}
                              type="button"
                              className={`map-diary-tab ${activeMapDiaryDateKey === group.key ? "is-active" : ""}`}
                              onClick={() => {
                                setMapDiaryDateKey(group.key);
                                setMapReportPage(1);
                              }}
                            >
                              <strong>{formatMapDiaryLabel(group.key)}</strong>
                              <span>{group.total} puntos</span>
                            </button>
                          ))
                        ) : (
                          <span className="map-diary-empty">Todavia no hay jornadas registradas.</span>
                        )}
                      </div>
                    </div>
                    <div className="log-summary-strip map-report-summary-strip">
                      <div className="log-summary-card">
                        <span>Total general</span>
                        <strong>{mapReportData.totalPoints}</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Zonas detectadas</span>
                        <strong>{mapReportData.totalZones}</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Contexto cercano</span>
                        <strong>{loadingMapContexts ? "Buscando" : "Listo"}</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Formato</span>
                        <strong>Oficina compacta</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Paginado</span>
                        <strong>{mapReportPagination.currentPage} / {mapReportPagination.totalPages}</strong>
                      </div>
                    </div>
                  </div>
                  <article className="document-sheet log-sheet map-report-sheet">
                    <div className="map-report-office-head">
                      <div className="map-report-brand">
                        <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="brand-logo" />
                        <div>
                          <p className="sheet-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                          <h3>Centro de reportes de campo</h3>
                          <p className="helper-text">Resumen imprimible por zona, con coordenadas y totales del levantamiento.</p>
                        </div>
                      </div>
                      <button type="button" onClick={handlePrintMapFieldReport}>
                        <Icon name="records" />
                        Imprimir formato de oficina
                      </button>
                    </div>
                    <div className="map-report-download-row">
                      <button type="button" className="button-secondary" onClick={handleDownloadMapFieldPdf}>
                        <Icon name="records" />
                        Descargar PDF institucional
                      </button>
                    </div>
                    <div className="map-report-staff-grid">
                      <label className="map-report-staff-card">
                        <span>Tecnico de campo 1</span>
                        <input
                          name="field_technicians"
                          value={mapReportStaff.field_technicians}
                          onChange={handleMapReportStaffChange}
                          placeholder="Nombres del personal de campo"
                        />
                      </label>
                      <label className="map-report-staff-card">
                        <span>Tecnico de campo 2</span>
                        <input
                          name="field_technician_secondary"
                          value={mapReportStaff.field_technician_secondary}
                          onChange={handleMapReportStaffChange}
                          placeholder="Segundo tecnico de campo"
                        />
                      </label>
                      <label className="map-report-staff-card">
                        <span>Ingeniero de datos</span>
                        <input
                          name="data_engineer"
                          value={mapReportStaff.data_engineer}
                          onChange={handleMapReportStaffChange}
                          placeholder="Responsable de datos"
                        />
                      </label>
                    </div>
                    <div className="map-report-pagination">
                      <div className="map-report-pagination-copy">
                        <strong>Pagina {mapReportPagination.currentPage} de {mapReportPagination.totalPages}</strong>
                        <span>Mostrando {mapReportPagination.zones.length} zonas por vista para mantener el reporte legible.</span>
                      </div>
                      <div className="map-report-pagination-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => setMapReportPage((current) => Math.max(1, current - 1))}
                          disabled={mapReportPagination.currentPage === 1}
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() =>
                            setMapReportPage((current) => Math.min(mapReportPagination.totalPages, current + 1))
                          }
                          disabled={mapReportPagination.currentPage === mapReportPagination.totalPages}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                    <div className="map-report-type-grid">
                      {Object.entries(mapReportData.totalsByType).length ? (
                        Object.entries(mapReportData.totalsByType).map(([label, total]) => (
                          <div key={label} className="document-block map-report-type-card">
                            <h4>{label}</h4>
                            <strong>{total}</strong>
                          </div>
                        ))
                      ) : (
                        <div className="document-block map-report-type-card">
                          <h4>Sin puntos</h4>
                          <strong>0</strong>
                        </div>
                      )}
                    </div>
                    <div className="map-report-editor-grid">
                      <article className="document-block map-report-map-panel">
                        <div className="lookup-card-head map-card-head">
                          <div>
                            <p className="sheet-kicker">Edicion visual</p>
                            <h3>Mapa de reportes</h3>
                            <p className="helper-text">
                              Haz doble click sobre un punto para editarlo o toca el mapa para preparar uno nuevo.
                            </p>
                          </div>
                          <span className="panel-pill">{reportMapStatus}</span>
                        </div>
                        <div ref={reportMapCaptureRef} className="map-report-capture-shell">
                          <FieldMap
                            apiUrl={API_URL}
                            isActive={workspaceView === "mapReports"}
                            mapDraft={reportMapDraft}
                            mapFocusRequest={reportMapFocusRequest}
                            mapPoints={visibleMapPoints}
                            onDraftChange={setReportMapDraft}
                            onEditPoint={handleEditReportMapPoint}
                            onSelectPoint={handleSelectReportMapPoint}
                            onStatusChange={setReportMapStatus}
                            selectedMapPointId={selectedReportMapPointId}
                          />
                        </div>
                        <div className="map-report-legend">
                          {MAP_MARKER_COLORS.map((option) => (
                            <span key={option.value}>
                              <i style={{ "--legend-color": option.value }} />
                              {option.label}
                            </span>
                          ))}
                          <span className="is-pin">
                            <i />
                            Pin final
                          </span>
                        </div>
                      </article>
                      <form className="document-block map-report-editor-card" onSubmit={handleSaveReportMapPoint}>
                        <div className="lookup-card-head map-card-head">
                          <div>
                            <p className="sheet-kicker">{editingReportMapPointId ? "Edicion activa" : "Nuevo punto"}</p>
                            <h3>{editingReportMapPointId ? "Ajustar punto del reporte" : "Agregar punto al reporte"}</h3>
                          </div>
                          <button type="button" className="button-secondary" onClick={resetReportMapDraft}>
                            <Icon name="refresh" />
                            Limpiar
                          </button>
                        </div>
                        {selectedReportMapPoint ? (
                          <p className="helper-text map-report-editor-helper">
                            Punto seleccionado: {getMapPointTypeLabel(selectedReportMapPoint.point_type)} en{" "}
                            {formatCoordinate(selectedReportMapPoint.latitude)}, {formatCoordinate(selectedReportMapPoint.longitude)}
                          </p>
                        ) : null}
                        <div className="map-coordinates-grid">
                          <label>
                            <span>Latitud</span>
                            <input
                              name="latitude"
                              value={reportMapDraft.latitude}
                              onChange={handleReportMapDraftChange}
                              placeholder="13.301700"
                            />
                          </label>
                          <label>
                            <span>Longitud</span>
                            <input
                              name="longitude"
                              value={reportMapDraft.longitude}
                              onChange={handleReportMapDraftChange}
                              placeholder="-87.188900"
                            />
                          </label>
                          <label>
                            <span>Precision (m)</span>
                            <input
                              name="accuracy_meters"
                              value={reportMapDraft.accuracy_meters}
                              onChange={handleReportMapDraftChange}
                              placeholder="5"
                            />
                          </label>
                          <label>
                            <span>Tipo de punto</span>
                            <select name="point_type" value={reportMapDraft.point_type} onChange={handleReportMapDraftChange}>
                              {MAP_POINT_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="map-report-color-grid">
                          <span>Color del punto</span>
                          <div className="map-report-color-options">
                            {MAP_MARKER_COLORS.map((option) => (
                              <label key={option.value} className="map-report-color-option">
                                <input
                                  type="radio"
                                  name="marker_color"
                                  value={option.value}
                                  checked={reportMapDraft.marker_color === option.value}
                                  onChange={handleReportMapDraftChange}
                                />
                                <span className="map-report-color-chip" style={{ "--chip-color": option.value }} />
                                <strong>{option.label}</strong>
                              </label>
                            ))}
                          </div>
                        </div>
                        <label className="map-report-pin-toggle">
                          <input
                            type="checkbox"
                            name="is_terminal_point"
                            checked={reportMapDraft.is_terminal_point}
                            onChange={handleReportMapDraftChange}
                          />
                          <span>Marcar como pin final del recorrido</span>
                        </label>
                        <label>
                          <span>Referencia</span>
                          <input
                            name="reference"
                            value={reportMapDraft.reference}
                            onChange={handleReportMapDraftChange}
                            placeholder="Casa amarilla, esquina, tienda cercana..."
                          />
                        </label>
                        <label>
                          <span>Descripcion</span>
                          <textarea
                            name="description"
                            value={reportMapDraft.description}
                            onChange={handleReportMapDraftChange}
                            rows="4"
                            placeholder="Detalle operativo del punto para el reporte"
                          />
                        </label>
                        <div className="map-form-actions">
                          <button type="submit" disabled={savingReportMapPoint}>
                            <Icon name={editingReportMapPointId ? "records" : "plus"} />
                            {savingReportMapPoint
                              ? "Guardando..."
                              : editingReportMapPointId
                                ? "Actualizar punto"
                                : "Agregar punto"}
                          </button>
                          <button type="button" className="button-secondary" onClick={resetReportMapDraft}>
                            <Icon name="refresh" />
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                    <div className="map-report-zone-list">
                      {mapReportPagination.zones.length ? (
                        mapReportPagination.zones.map((zone, zoneIndex) => (
                          <section key={zone.zone} className="document-block map-report-zone-card">
                            <div className="map-report-zone-top">
                              <div>
                                <span className="sheet-kicker">Zona {(mapReportPagination.currentPage - 1) * mapReportPagination.pageSize + zoneIndex + 1}</span>
                                <h4>{zone.zone}</h4>
                                <p className="helper-text map-report-reference-line">
                                  Referencia sugerida: {zone.nearbyReferencesLabel || "Sin contexto cercano"}
                                </p>
                                <p className="helper-text map-report-location-line">
                                  Ubicacion completa: {zone.primaryLocationLabel || "Sin direccion ampliada"}
                                </p>
                              </div>
                              <div className="map-report-zone-metrics">
                                <span>Total: {zone.total}</span>
                                <span>Precision prom.: {zone.averageAccuracy ?? "--"} m</span>
                              </div>
                            </div>
                            <p className="helper-text">Tipos: {zone.pointTypesLabel || "--"}</p>
                            <div className="map-report-table-wrap">
                              <table className="map-report-table">
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Tipo</th>
                                    <th>Latitud</th>
                                    <th>Longitud</th>
                                    <th>Precision</th>
                                    <th>Zona</th>
                                    <th>Referencia cercana</th>
                                    <th>Referencia</th>
                                    <th>Fecha</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {zone.items.map((point, pointIndex) => (
                                    <tr
                                      key={point.id}
                                      className={selectedReportMapPointId === point.id ? "is-selected" : ""}
                                      onClick={() => handleSelectReportMapPoint(point.id)}
                                      onDoubleClick={() => handleEditReportMapPoint(point.id)}
                                    >
                                      <td>{pointIndex + 1}</td>
                                      <td>
                                        <div className="map-report-point-cell">
                                          <span
                                            className={`map-report-point-dot ${point.is_terminal_point ? "is-pin" : ""}`}
                                            style={{ "--point-color": point.marker_color || "#1576d1" }}
                                          />
                                          <span>{getMapPointTypeLabel(point.point_type)}</span>
                                        </div>
                                      </td>
                                      <td>{formatCoordinate(point.latitude)}</td>
                                      <td>{formatCoordinate(point.longitude)}</td>
                                      <td>{point.accuracy_meters ? `${point.accuracy_meters} m` : "--"}</td>
                                      <td>{point.suggested_zone || zone.zone}</td>
                                      <td>{point.suggested_reference || "--"}</td>
                                      <td>{point.reference_note || point.description || "--"}</td>
                                      <td>{formatDateTime(point.created_at)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        ))
                      ) : (
                        <div className="empty-state">
                          <h3>Sin puntos para reportar</h3>
                          <p>Cuando los tecnicos registren puntos en mapa de campo, este centro administrativo podra consolidarlos.</p>
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              </section>
            ) : workspaceView === "requests" ? (
              <section className="preview-panel log-panel-full">
                <div className="log-shell">
                  <div className="log-hero">
                    <div className="admin-section-head">
                      <div>
                        <p className="sheet-kicker">Peticiones al padron</p>
                        <h2><Icon name="dashboard" className="title-icon" />Centro de solicitudes administrativas</h2>
                        <p className="workspace-title">
                          Genera listados institucionales desde el padron maestro con estructura clara, agrupacion por barrio y salida lista para impresion o PDF.
                        </p>
                      </div>
                      <span className="panel-pill">{padronRequestResult?.summary?.total_registros ?? 0} filas</span>
                    </div>
                    <div className="log-summary-strip map-report-summary-strip">
                      <div className="log-summary-card">
                        <span>Plantillas</span>
                        <strong>{padronRequestTemplates.length || 0}</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Registros</span>
                        <strong>{padronRequestResult?.summary?.total_registros ?? 0}</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Barrios</span>
                        <strong>{padronRequestResult?.summary?.total_barrios ?? 0}</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Estado</span>
                        <strong>{loadingPadronRequest ? "Generando" : loadingPadronRequestMeta ? "Cargando" : "Listo"}</strong>
                      </div>
                    </div>
                  </div>
                  <article className="document-sheet log-sheet request-sheet">
                    <div className="map-report-office-head request-office-head">
                      <div className="map-report-brand">
                        <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="brand-logo" />
                        <div>
                          <p className="sheet-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                          <h3>Centro de peticiones al padron</h3>
                          <p className="helper-text">Listados administrados por solicitud, con formato de oficina y detalle agrupado.</p>
                        </div>
                      </div>
                      <div className="request-download-row">
                        <button type="button" onClick={handleRunPadronRequest} disabled={loadingPadronRequest}>
                          <Icon name="refresh" />
                          {loadingPadronRequest ? "Generando..." : "Generar peticion"}
                        </button>
                        <button type="button" className="button-secondary" onClick={handlePrintPadronRequest}>
                          <Icon name="records" />
                          Imprimir
                        </button>
                        <button type="button" className="button-secondary" onClick={handleDownloadPadronRequestPdf}>
                          <Icon name="records" />
                          Descargar PDF
                        </button>
                      </div>
                    </div>

                    <div className="request-editor-grid">
                      <form className="document-block request-editor-card" onSubmit={handleRunPadronRequest}>
                        <div className="admin-section-head">
                          <div>
                            <p className="sheet-kicker">Constructor</p>
                            <h3>Configurar solicitud</h3>
                          </div>
                          <span className="panel-pill">{padronRequestForm.preset_id || "custom"}</span>
                        </div>
                        <label>
                          <span>Plantilla</span>
                          <select
                            name="preset_id"
                            value={padronRequestForm.preset_id}
                            onChange={handlePadronRequestPresetChange}
                          >
                            {padronRequestTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Titulo del reporte</span>
                          <input
                            name="title"
                            value={padronRequestForm.title}
                            onChange={handlePadronRequestFormChange}
                            placeholder="Titulo institucional de la peticion"
                          />
                        </label>
                        <label>
                          <span>Descripcion</span>
                          <textarea
                            name="description"
                            rows="3"
                            value={padronRequestForm.description}
                            onChange={handlePadronRequestFormChange}
                            placeholder="Resumen de lo que necesita el solicitante"
                          />
                        </label>
                        <label>
                          <span>Palabras clave</span>
                          <textarea
                            name="keywords"
                            rows="3"
                            value={padronRequestForm.keywords}
                            onChange={handlePadronRequestFormChange}
                            placeholder="clinica, hospital, odont, laborat"
                          />
                        </label>
                        <p className="helper-text">
                          Usa comas para separar criterios. Esta primera plantilla viene pensada para salud, pero puedes reutilizarla para futuras peticiones.
                        </p>
                        <p className="helper-text">
                          La columna <strong>Tarifa</strong> se toma del valor base registrado en el padron maestro.
                        </p>
                        <div className="map-form-actions">
                          <button type="submit" disabled={loadingPadronRequest}>
                            <Icon name="records" />
                            {loadingPadronRequest ? "Procesando..." : "Preparar listado"}
                          </button>
                        </div>
                      </form>

                      <article className="document-block request-preview-card">
                        <div className="admin-section-head">
                          <div>
                            <p className="sheet-kicker">Resumen ejecutivo</p>
                            <h3>{padronRequestResult?.request?.title || "Sin peticion generada"}</h3>
                          </div>
                          <span className="panel-pill">{padronRequestResult?.summary?.total_barrios ?? 0} barrios</span>
                        </div>
                        <div className="request-summary-grid">
                          <div className="request-summary-card">
                            <span>Registros</span>
                            <strong>{padronRequestResult?.summary?.total_registros ?? 0}</strong>
                          </div>
                          <div className="request-summary-card">
                            <span>Tarifa acumulada</span>
                            <strong>{formatCurrency(padronRequestResult?.summary?.tarifa_total ?? 0)}</strong>
                          </div>
                          <div className="request-summary-card">
                            <span>Total con interes</span>
                            <strong>{formatCurrency(padronRequestResult?.summary?.total_con_interes ?? 0)}</strong>
                          </div>
                        </div>
                        <p className="helper-text request-keyword-line">
                          Palabras clave activas: {(padronRequestResult?.request?.keywords || []).join(", ") || "--"}
                        </p>
                        <p className="workspace-title">{padronRequestResult?.request?.description || "Genera una peticion para ver el resumen detallado."}</p>
                      </article>
                    </div>

                    <div className="request-zone-list">
                      {padronRequestResult?.summary?.barrios?.length ? (
                        padronRequestResult.summary.barrios.map((barrio, index) => (
                          <section key={barrio.barrio_colonia} className="document-block request-zone-card">
                            <div className="map-report-zone-top">
                              <div>
                                <span className="sheet-kicker">Barrio {index + 1}</span>
                                <h4>{barrio.barrio_colonia}</h4>
                              </div>
                              <div className="map-report-zone-metrics">
                                <span>{barrio.total_registros} registros</span>
                                <span>Tarifa {formatCurrency(barrio.tarifa_total)}</span>
                                <span>Total {formatCurrency(barrio.total_con_interes)}</span>
                              </div>
                            </div>
                            <div className="map-report-table-wrap">
                              <table className="map-report-table request-table">
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
                                  {barrio.rows.map((row, rowIndex) => (
                                    <tr key={`${row.clave_catastral}-${row.abonado}-${rowIndex}`}>
                                      <td>{rowIndex + 1}</td>
                                      <td>{row.nombre || "--"}</td>
                                      <td>{row.abonado || "--"}</td>
                                      <td>{row.clave_catastral || "--"}</td>
                                      <td>{row.barrio_colonia || "--"}</td>
                                      <td>{formatCurrency(row.tarifa || 0)}</td>
                                      <td>{formatCurrency(row.total || 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        ))
                      ) : (
                        <div className="empty-state">
                          <h3>Sin peticion generada</h3>
                          <p>Selecciona una plantilla o define palabras clave para construir un listado listo para entregar.</p>
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              </section>
            ) : workspaceView === "users" ? (
              <>
                <form className="sheet no-print" onSubmit={handleCreateUser}>
                  <div className="admin-section-head">
                    <div>
                      <p className="sheet-kicker">Administracion de usuarios</p>
                      <h2><Icon name="users" className="title-icon" />Crear nuevo acceso</h2>
                    </div>
                    <span className="panel-pill">Correo transaccional</span>
                  </div>
                  <section className="sheet-section">
                    <h3>Datos del usuario</h3>
                    <div className="form-grid">
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
                          <option value="transport">Transporte</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </label>
                    </div>
                  </section>
                  <div className="action-row">
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

                <section className="preview-panel">
                  <div className="admin-section-head">
                    <div>
                      <p className="sheet-kicker">Detalle del usuario</p>
                      <h2><Icon name="success" className="title-icon" />Informacion del acceso</h2>
                    </div>
                    {selectedUser ? <span className="panel-pill">{selectedUser.username}</span> : null}
                  </div>
                  <article className="document-sheet">
                    {selectedUser ? (
                      <div className="admin-result-grid">
                        <div className="document-block">
                          <h4>Datos generales</h4>
                          <p className="user-detail-line"><strong>Nombre:</strong> <span className="user-name">{selectedUser.full_name}</span></p>
                          <p className="user-detail-line"><strong>Correo:</strong> <span className="user-email">{selectedUser.email}</span></p>
                          <p className="user-detail-line"><strong>Usuario:</strong> <span className="user-meta-inline">{selectedUser.username}</span></p>
                          <p><strong>Perfil:</strong> {roleLabel(selectedUser.role)}</p>
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
                    ) : (
                      <div className="empty-state">
                        <h3>Sin usuario seleccionado</h3>
                        <p>
                          Selecciona un usuario del listado para ver su informacion detallada y administrar su acceso.
                        </p>
                      </div>
                    )}
                  </article>
                </section>
              </>
            ) : (
              <section className="preview-panel log-panel-full">
                <div className="log-shell">
                  <div className="log-hero">
                    <div className="admin-section-head">
                      <div>
                        <p className="sheet-kicker">Bitacora profesional</p>
                        <h2><Icon name="history" className="title-icon" />Historial de actividad</h2>
                        <p className="workspace-title">
                          Un seguimiento continuo de accesos, altas y movimientos relevantes del sistema.
                        </p>
                      </div>
                      <span className="panel-pill">{safeAuditLogs.length} eventos</span>
                    </div>
                    <form className="log-filters" onSubmit={(event) => event.preventDefault()}>
                      <label>
                        <span>Accion</span>
                        <select name="action" value={auditFilters.action} onChange={handleAuditFilterChange}>
                          <option value="">Todas</option>
                          <option value="auth.login">Inicio de sesion</option>
                          <option value="auth.logout">Cierre de sesion</option>
                          <option value="user.created">Usuario creado</option>
                          <option value="padron.updated">Padron actualizado</option>
                          <option value="inmueble.created">Ficha creada</option>
                          <option value="inmueble.updated">Ficha actualizada</option>
                          <option value="inmueble.archived">Ficha archivada</option>
                          <option value="inmueble.restored">Ficha restaurada</option>
                          <option value="inmueble.deleted">Ficha eliminada</option>
                        </select>
                      </label>
                      <label>
                        <span>Entidad</span>
                        <select name="entity_type" value={auditFilters.entity_type} onChange={handleAuditFilterChange}>
                          <option value="">Todas</option>
                          <option value="user">Usuario</option>
                          <option value="inmueble">Ficha</option>
                          <option value="padron">Padron</option>
                        </select>
                      </label>
                      <label>
                        <span>Actor</span>
                        <input name="actor" value={auditFilters.actor} onChange={handleAuditFilterChange} placeholder="Nombre o correo" />
                      </label>
                      <label>
                        <span>Buscar</span>
                        <input name="search" value={auditFilters.search} onChange={handleAuditFilterChange} placeholder="Resumen, id o detalle" />
                      </label>
                      <label>
                        <span>Desde</span>
                        <input type="date" name="date_from" value={auditFilters.date_from} onChange={handleAuditFilterChange} />
                      </label>
                      <label>
                        <span>Hasta</span>
                        <input type="date" name="date_to" value={auditFilters.date_to} onChange={handleAuditFilterChange} />
                      </label>
                      <div className="log-filter-actions">
                        <button type="button" className="button-secondary" onClick={handleExportAuditLogs}>
                          <Icon name="records" />
                          Exportar CSV
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() =>
                            setAuditFilters({
                              action: "",
                              entity_type: "",
                              actor: "",
                              search: "",
                              date_from: "",
                              date_to: ""
                            })
                          }
                        >
                          <Icon name="refresh" />
                          Limpiar filtros
                        </button>
                      </div>
                    </form>
                    <div className="log-summary-strip">
                      <div className="log-summary-card">
                        <span>Vista</span>
                        <strong>Centralizada</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Orden</span>
                        <strong>Mas reciente primero</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Control</span>
                        <strong>Trazabilidad activa</strong>
                      </div>
                    </div>
                  </div>
                  <article className="document-sheet log-sheet log-sheet-minimal">
                    {safeAuditLogs.length ? (
                      safeAuditLogs.map((log) => (
                        <div key={log.id} className="log-row">
                          <div className="log-pin">
                            <Icon name={actionIconName(log.action)} />
                          </div>
                          <div className="log-meta">
                            <div className="log-topline">
                              <span className="record-badge">{actionLabel(log.action)}</span>
                              <small>{formatDateTime(log.created_at)}</small>
                            </div>
                            <strong>{log.summary || "Movimiento registrado"}</strong>
                          </div>
                          <div className="log-detail">
                            <div className="log-chips">
                              <span className="log-chip">Actor: {log.actor_name || log.actor_email || "Sistema"}</span>
                              <span className="log-chip">Entidad: {log.entity_type} #{log.entity_id || "--"}</span>
                            </div>
                            {log.details_json ? (
                              <pre>{JSON.stringify(log.details_json, null, 2)}</pre>
                            ) : (
                              <p>Sin detalle adicional.</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <h3>Sin eventos registrados</h3>
                        <p>Las altas de usuarios, accesos y cambios de fichas apareceran aqui automaticamente.</p>
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
