import { useEffect, useMemo, useRef, useState } from "react";
import FieldMap from "./components/FieldMap";
import FieldAnalyticsPanel from "./components/FieldAnalyticsPanel";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
const RECORDS_PAGE_SIZE = 10;

const getPadronStatusLabel = (status) => {
  if (status === "varios_padrones") return "Varios padrones";
  if (status === "reportada") return "Reportada";
  return "Clandestina";
};

const getPadronStatusDescription = (status) => {
  if (status === "varios_padrones") {
    return "Esta ficha aparece en Alcaldía y Aguas. Queda separada del listado de clandestinas.";
  }

  if (status === "reportada") {
    return "Esta ficha ya fue procesada y se guarda en reportadas para limpiar el listado operativo.";
  }

  return "Esta ficha no ha sido validada en varios padrones o no aparece en Aguas.";
};

const clampPrintCopies = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(5, Math.max(0, parsed));
};

const formatPercent = (value, total) => {
  if (!total) return "0%";
  return `${Math.round((Number(value || 0) / Number(total)) * 100)}%`;
};

const EXECUTIVE_REPORT_CREDIT =
  "Supervisado, desarrollado, implementado y documentado por el Ingeniero Juan Ramón Ordóñez Bonilla, con seguimiento directo del trabajo realizado en campo.";

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

const getWorkspaceViewByRole = (role) => (role === "admin" ? "dashboard" : "records");

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
  const [aiLoadingAction, setAiLoadingAction] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [activeSection, setActiveSection] = useState("abonado");
  const [recordView, setRecordView] = useState("active");
  const [recordQuickFilter, setRecordQuickFilter] = useState("clandestino");
  const [recordPage, setRecordPage] = useState(1);
  const [showRecordAdvancedFilters, setShowRecordAdvancedFilters] = useState(false);
  const [showRecordPreview, setShowRecordPreview] = useState(false);
  const [recordFilters, setRecordFilters] = useState({
    clave: "",
    barrio: "",
    responsible: "",
    date_from: "",
    date_to: "",
    status: "all"
  });
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [processingRecordId, setProcessingRecordId] = useState(null);
  const [lastProcessedRecord, setLastProcessedRecord] = useState(null);
  const [showPrintBatchModal, setShowPrintBatchModal] = useState(false);
  const [batchPrintCopies, setBatchPrintCopies] = useState({});
  const [batchPrinting, setBatchPrinting] = useState(false);
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
  const [editingMapPointId, setEditingMapPointId] = useState(null);
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
  const [alcaldiaMeta, setAlcaldiaMeta] = useState(null);
  const [alcaldiaImportSummary, setAlcaldiaImportSummary] = useState(null);
  const [alcaldiaFile, setAlcaldiaFile] = useState(null);
  const [uploadingAlcaldia, setUploadingAlcaldia] = useState(false);
  const [loadingAlcaldiaMeta, setLoadingAlcaldiaMeta] = useState(false);
  const [loadingAlcaldiaComparison, setLoadingAlcaldiaComparison] = useState(false);
  const [alcaldiaComparison, setAlcaldiaComparison] = useState(null);
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
      const key = getMapDiaryDateKey(point);
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
    () => safeMapPoints.filter((point) => getMapDiaryDateKey(point) === activeMapDiaryDateKey),
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
          dashboard: {
            panelClass: "hero-panel-dashboard",
            cardClass: "search-card-dashboard",
            toplineLabel: "Centro administrativo",
            title: "Tablero de control",
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
          requests: {
            panelClass: "hero-panel-users",
            cardClass: "search-card-users",
            toplineLabel: "Peticiones institucionales",
            title: "Solicitudes al padrón maestro",
            lead: "Generación de listados administrativos filtrados desde el padrón, listos para impresión y PDF.",
            kicker: "Análisis ejecutivo"
          },
          logs: {
            panelClass: "hero-panel-logs",
            cardClass: "search-card-logs",
            toplineLabel: "Bitácora profesional",
            title: "Historial de actividad",
            lead: "Seguimiento continuo de movimientos relevantes con una lectura más limpia y trazable.",
            kicker: "Trazabilidad"
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
  const headerStats = useMemo(() => {
    if (workspaceView === "dashboard") {
      return [
        {
          icon: "records",
          label: "Fichas activas",
          value: String(safeRecords.length)
        },
        {
          icon: "map",
          label: "Puntos GPS",
          value: String(safeMapPoints.length)
        },
        {
          icon: "users",
          label: "Usuarios en línea",
          value: String(onlineUsers.length)
        },
        {
          icon: "warning",
          label: "Alertas",
          value: String(alertRecords.length)
        }
      ];
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
          value: String(safeMapPoints.length)
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
    onlineUsers.length,
    padronMeta,
    loadingMapPoints,
    visibleMapPoints.length,
    safeRecords.length,
    safeMapPoints.length,
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
  const visibleRecordGroups = useMemo(() => {
    const groups = [];

    recordPagination.records.forEach((record) => {
      const label = formatMonthGroup(getRecordGroupDate(record, recordView));
      const currentGroup = groups[groups.length - 1];

      if (!currentGroup || currentGroup.label !== label) {
        groups.push({ label, items: [record] });
        return;
      }

      currentGroup.items.push(record);
    });

    return groups;
  }, [recordPagination.records, recordView]);
  const recordValidationIssues = useMemo(
    () => getRecordValidationIssues(form, Boolean(form.foto_path), selectedFile),
    [form, selectedFile]
  );
  const selectedRecordDeadlineMeta = useMemo(
    () => (form.id ? recordDeadlineMetaById[form.id] ?? null : null),
    [form.id, recordDeadlineMetaById]
  );
  const mapReportData = useMemo(() => {
    try {
      const points = [...visibleMapPoints].sort((left, right) => {
        const leftContext = mapPointContexts[getMapPointContextKey(left)] ?? null;
        const rightContext = mapPointContexts[getMapPointContextKey(right)] ?? null;
        const leftZone = String(leftContext?.zone || deriveMapPointZone(left) || "Zona no especificada");
        const rightZone = String(rightContext?.zone || deriveMapPointZone(right) || "Zona no especificada");
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
        const zone = String(context?.zone || deriveMapPointZone(point) || "Zona no especificada");
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
    } catch (error) {
      console.error("mapReportData failed", error);
      return {
        totalPoints: Array.isArray(visibleMapPoints) ? visibleMapPoints.length : 0,
        totalZones: 0,
        totalsByType: {},
        zones: []
      };
    }
  }, [mapPointContexts, visibleMapPoints]);
  const adminWorkspaceItems = useMemo(
    () =>
      isAdmin
        ? [
            { key: "dashboard", section: "vision", label: "Tablero", icon: "dashboard", meta: "Vista ejecutiva", tone: "is-vision" },
            { key: "executiveReport", section: "vision", label: "Operaciones realizadas", icon: "records", meta: "PDF general", tone: "is-report" },
            { key: "records", section: "operacion", label: "Fichas", icon: "records", meta: `${safeRecords.length} visibles`, tone: "is-records" },
            { key: "lookup", section: "operacion", label: "Buscar clave", icon: "search", meta: "Consulta rápida", tone: "is-lookup" },
            { key: "map", section: "operacion", label: "Mapa de campo", icon: "map", meta: `${safeMapPoints.length} puntos`, tone: "is-map" },
            { key: "mapReports", section: "control", label: "Reportes campo", icon: "records", meta: `${mapReportData.totalZones} zonas`, tone: "is-report" },
            { key: "mapAnalytics", section: "control", label: "Estadísticas campo", icon: "dashboard", meta: `${mapReportData.totalPoints} puntos`, tone: "is-report" },
            { key: "requests", section: "control", label: "Peticiones", icon: "dashboard", meta: `${padronRequestResult?.summary?.total_registros ?? 0} filas`, tone: "is-report" },
            { key: "users", section: "control", label: "Usuarios", icon: "users", meta: `${safeUsers.length} registrados`, tone: "is-users" },
            { key: "padron", section: "control", label: "Padrón", icon: "refresh", meta: `${padronMeta?.total_records ?? 0} claves`, tone: "is-padron" },
            { key: "logs", section: "control", label: "Historial", icon: "logs", meta: `${safeAuditLogs.length} eventos`, tone: "is-logs" }
          ]
        : [],
    [
      isAdmin,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalPoints,
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
            { key: "records", label: "Fichas", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "executiveReport", label: "Operaciones realizadas", icon: "records", group: "control", helper: "Informe general PDF" },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rápida" },
            { key: "map", label: "Mapa de campo", icon: "map", group: "operacion", helper: `${visibleMapPoints.length} puntos hoy` },
            { key: "mapReports", label: "Reportes campo", icon: "records", group: "control", helper: `${mapReportData.totalZones} zonas` },
            { key: "mapAnalytics", label: "Estadísticas campo", icon: "dashboard", group: "control", helper: `${mapReportData.totalPoints} puntos` },
            { key: "requests", label: "Peticiones", icon: "dashboard", group: "control", helper: `${padronRequestResult?.summary?.total_registros ?? 0} filas` },
            { key: "padron", label: "Padrón", icon: "refresh", group: "control", helper: `${padronMeta?.total_records ?? 0} claves` },
            { key: "logs", label: "Historial", icon: "logs", group: "control", helper: `${safeAuditLogs.length} eventos` },
            { key: "users", label: "Usuarios", icon: "users", group: "administracion", helper: `${safeUsers.length} registrados` }
          ]
        : [
            { key: "records", label: "Fichas", icon: "records", group: "operacion", helper: `${safeRecords.length} visibles` },
            { key: "lookup", label: "Buscar clave", icon: "search", group: "operacion", helper: "Consulta rápida" },
            { key: "map", label: "Mapa", icon: "map", group: "operacion", helper: `${visibleMapPoints.length} puntos hoy` },
            { key: "executiveReport", label: "Operaciones realizadas", icon: "records", group: "control", helper: "Informe general PDF" }
          ]),
    [
      isAdmin,
      padronRequestResult?.summary?.total_registros,
      mapReportData.totalPoints,
      mapReportData.totalZones,
      padronMeta?.total_records,
      safeAuditLogs.length,
      safeRecords.length,
      safeUsers.length,
      visibleMapPoints.length,
    ]
  );
  const mobilePrimaryModuleKeys = useMemo(
    () => ["records", "lookup", "map"],
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
    const labelByKey = {
      executiveReport: "Operaciones",
      mapReports: "Reportes",
      mapAnalytics: "Estadisticas",
      padron: "Padron"
    };
    const badgeByKey = {
      records: safeRecords.length,
      padron: padronMeta?.total_records ?? 0,
      logs: safeAuditLogs.length,
      users: safeUsers.length,
      map: visibleMapPoints.length,
      mapReports: mapReportData.totalZones,
      mapAnalytics: mapReportData.totalPoints,
      requests: padronRequestResult?.summary?.total_registros ?? 0
    };
    const normalizeItem = (item) => ({
      ...item,
      label: labelByKey[item.key] || item.label,
      badge: badgeByKey[item.key] ?? null
    });
    const items = moduleNavigationItems.map(normalizeItem);
    const dashboardItem = isAdmin
      ? { key: "dashboard", label: "Tablero", icon: "dashboard", helper: "Control", badge: null }
      : null;

    return [
      {
        key: "principal",
        title: "Principal",
        items: [dashboardItem, ...items.filter((item) => ["records", "lookup"].includes(item.key))].filter(Boolean)
      },
      {
        key: "campo",
        title: "Campo",
        items: items.filter((item) => ["map", "mapReports", "requests"].includes(item.key))
      },
      {
        key: "gestion",
        title: "Gestion",
        items: items.filter((item) => ["executiveReport", "padron", "mapAnalytics", "logs", "users"].includes(item.key))
      }
    ].filter((section) => section.items.length);
  }, [
    isAdmin,
    mapReportData.totalPoints,
    mapReportData.totalZones,
    moduleNavigationItems,
    padronMeta?.total_records,
    padronRequestResult?.summary?.total_registros,
    safeAuditLogs.length,
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
  const recordsUpdatedToday = useMemo(
    () =>
      safeRecords.filter((record) => getMapDiaryDateKey(record.updated_at || record.created_at) === todayDateKey)
        .length,
    [safeRecords, todayDateKey]
  );
  const mapPointsToday = useMemo(
    () => safeMapPoints.filter((point) => getMapDiaryDateKey(point) === todayDateKey).length,
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
  const dashboardActivity = useMemo(() => safeAuditLogs.slice(0, 5), [safeAuditLogs]);
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
      { key: "padron", label: "Padrón", helper: "Gestión del maestro", icon: "refresh" },
      { key: "users", label: "Usuarios", helper: "Accesos y roles", icon: "users" }
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
        actionLabel: "Revisar padrón"
      });
    }

    if (alertRecords.length) {
      items.push({
        tone: "is-warning",
        title: "Fichas con plazo crítico",
        detail: `${alertRecords.length} fichas están en alerta o vencidas por regla de 7 días hábiles.`,
        icon: "warning",
        actionView: "records",
        actionLabel: "Ver alertas"
      });
    }

    if (pendingPhotoRecords >= 3) {
      items.push({
        tone: "is-warning",
        title: "Fichas sin foto",
        detail: `${pendingPhotoRecords} fichas visibles aún no tienen evidencia fotográfica asociada.`,
        icon: "records",
        actionView: "records",
        actionLabel: "Completar fichas"
      });
    }

    if (onlineUsers.length >= 4) {
      items.push({
        tone: "is-live",
        title: "Operación intensiva",
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
        detail: "El tablero está listo para arrancar captura, consulta o control administrativo.",
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
      const zone = String(context?.zone || deriveMapPointZone(point) || "Zona no especificada");
      acc[zone] = (acc[zone] ?? 0) + 1;
      return acc;
    }, {});
    const gpsZoneDetails = safeMapPoints.reduce((acc, point) => {
      const context = mapPointContexts[getMapPointContextKey(point)] ?? null;
      const zone = String(context?.zone || deriveMapPointZone(point) || "Zona no especificada");
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
      const zone = String(record.barrio_colonia || "Sin barrio").trim() || "Sin barrio";
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
          return String(context?.zone || deriveMapPointZone(point) || "Zona no especificada");
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
    window.localStorage.setItem(DASHBOARD_WIDGET_STORAGE_KEY, JSON.stringify(dashboardWidgetPrefs));
  }, [dashboardWidgetPrefs]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setShowMobileModuleMenu(false);
      setShowRecordAdvancedFilters(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    setRecordPage(1);
  }, [search, recordView, recordQuickFilter, recordFilters]);

  useEffect(() => {
    setRecordPage((current) => Math.min(current, recordPagination.totalPages));
  }, [recordPagination.totalPages]);

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
  const printBatchRecords = useMemo(
    () => filteredRecords.filter((record) => recordView === "archived" || record.estado_padron !== "reportada"),
    [filteredRecords, recordView]
  );

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

  const loadAlcaldiaComparison = async () => {
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
      showAlert(`Comparacion lista: ${data.summary?.candidate_clandestine ?? 0} claves de alcaldia no aparecen en Aguas.`);
    } catch (error) {
      showAlert(error.message || "No fue posible comparar los padrones.");
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
      loadAlcaldiaMeta();
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
      return undefined;
    }

    const refreshDashboard = () => {
      if (document.visibilityState !== "visible") return;
      loadRecords("", "active", { silent: true });
      loadMapPoints({ silent: true });
      loadUsers({ silent: true });
      loadAuditLogs({ silent: true });
    };

    refreshDashboard();
    loadPadronMeta({ silent: true });
    loadAlcaldiaMeta({ silent: true });

    const intervalId = window.setInterval(refreshDashboard, 15000);
    document.addEventListener("visibilitychange", refreshDashboard);
    window.addEventListener("focus", refreshDashboard);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshDashboard);
      window.removeEventListener("focus", refreshDashboard);
    };
  }, [isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (isAuthenticated && ["map", "mapReports", "mapAnalytics"].includes(workspaceView)) {
        loadMapPoints();
      }
  }, [isAuthenticated, workspaceView]);

  useEffect(() => {
    if (["mapReports", "mapAnalytics"].includes(workspaceView) && isAdmin) {
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
    if (isAuthenticated && !isAdmin && !["records", "lookup", "map"].includes(workspaceView)) {
      setWorkspaceView("records");
    }
  }, [isAuthenticated, isAdmin, workspaceView]);

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
    setLastProcessedRecord(null);
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const value = search.trim();
    setRecordFilters((current) => ({ ...current, clave: value }));
    setRecordPage(1);

    if (!value) {
      loadRecords("", recordView);
    }
  };

  const handleSearchInputChange = (event) => {
    const value = event.target.value;
    setSearch(value);
    setRecordFilters((current) => ({ ...current, clave: value }));

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
    setSearch("");
    setRecordFilters({
      clave: "",
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
      const lookupUrl =
        lookupSearchMode === "alcaldia"
          ? `/claves/alcaldia/search?field=texto&clave=${encodeURIComponent(normalizedLookupQuery)}`
          : `/claves/search?clave=${encodeURIComponent(normalizedLookupQuery)}&field=${encodeURIComponent(lookupSearchMode)}`;
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
    setEditingMapPointId(null);
    setMapDraft({ ...emptyMapDraft });
  };

  const findAlcaldiaMatchForForm = async (candidateForm = form) => {
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

    for (const query of textQueries) {
      const match = await tryQuery(query, "texto");
      if (match) return match;
    }

    return null;
  };

  const applyAlcaldiaMatchToForm = (match) => {
    if (!match) return null;

    const nextState = match.exists_in_aguas ? "varios_padrones" : "clandestino";
    const nextPatch = {
      estado_padron: nextState,
      clave_alcaldia: match.clave_catastral || "",
      nombre_alcaldia: match.nombre || "",
      barrio_alcaldia: match.caserio || match.direccion || "",
      nombre_catastral: match.nombre || form.nombre_catastral,
      barrio_colonia: form.barrio_colonia || match.caserio || match.direccion || "",
      identidad: form.identidad || match.identificador || "",
      comentarios: match.exists_in_aguas ? "Aparece en varios padrones" : form.comentarios || "Clandestino"
    };
    setForm((current) => ({ ...current, ...nextPatch }));
    return nextPatch;
  };

  const handleValidateFormPadron = async () => {
    try {
      const match = await findAlcaldiaMatchForForm(form);
      if (!match) {
        showAlert("No se encontro coincidencia en el padron de Alcaldia.");
        return;
      }

      applyAlcaldiaMatchToForm(match);
      showAlert(
        match.exists_in_aguas
          ? "Esta ficha aparece en Alcaldia y Aguas. Quedo marcada en varios padrones."
          : "Esta ficha aparece en Alcaldia y no en Aguas. Quedo marcada como clandestina."
      );
    } catch (error) {
      showAlert(error.message || "No fue posible validar contra Alcaldia.");
    }
  };

  const handleValidatePrintRecord = async (record) => {
    if (!record?.id) return;

    setProcessingRecordId(record.id);
    try {
      const match = await findAlcaldiaMatchForForm(record);
      if (!match) {
        showAlert(`No se encontro coincidencia en Alcaldia para ${record.clave_catastral}.`);
        return;
      }

      const nextState = match.exists_in_aguas ? "varios_padrones" : "clandestino";
      const payload = {
        ...record,
        estado_padron: nextState,
        clave_alcaldia: match.clave_catastral || "",
        nombre_alcaldia: match.nombre || record.nombre_alcaldia || "",
        barrio_alcaldia: match.caserio || match.direccion || record.barrio_alcaldia || "",
        nombre_catastral: match.nombre || record.nombre_catastral,
        barrio_colonia: record.barrio_colonia || match.caserio || match.direccion || "",
        identidad: record.identidad || match.identificador || "",
        comentarios: match.exists_in_aguas ? "Aparece en varios padrones" : record.comentarios || "Clandestino"
      };

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
        match.exists_in_aguas
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
      const isEditing = Boolean(editingMapPointId);
      const editingPoint = safeMapPoints.find((point) => point.id === editingMapPointId) ?? null;
      const response = await apiFetch(isEditing ? `/map-points/${editingMapPointId}` : "/map-points", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy_meters: Number(mapDraft.accuracy_meters) || null,
          point_type: mapDraft.point_type,
          description: mapDraft.description,
          reference: mapDraft.reference,
          marker_color: editingPoint?.marker_color || "#1576d1",
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
      setMapDiaryDateKey(getMapDiaryDateKey(data.created_at) || getMapDiaryDateKey(new Date()));
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

  const handleEditMapPoint = (pointId, event) => {
    event?.stopPropagation();
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) return;

    setSelectedMapPointId(point.id);
    setEditingMapPointId(point.id);
    setMapDraft({
      latitude: formatCoordinate(point.latitude),
      longitude: formatCoordinate(point.longitude),
      accuracy_meters: point.accuracy_meters ?? "",
      point_type: point.point_type || "caja_registro",
      description: point.description || "",
      reference: point.reference_note || ""
    });
    setMapStatus("Edicion activa");
    setMapFocusRequest({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      zoom: 19,
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
          <span class="field-report-kicker">Resumen de operaciones</span>
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
        bodyClassName: "field-report-body",
        showPageFooter: true
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

    setSelectedRecordId(null);
    setLastProcessedRecord(null);
    setRecordQuickFilter("all");
    setRecordFilters({
      clave: nextForm.clave_catastral || "",
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    setForm(nextForm);
    setSelectedFile(null);
    setAvisoHtml("");
    setActiveSection("abonado");
    setWorkspaceView("records");
    showAlert(alertMessage);
    focusSheet();
  };

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
      setWorkspaceView("records");
      setSelectedRecordId(nextRecord.id ?? null);
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
      setAvisoHtml("");
      setActiveSection("abonado");
      applyRecord(nextRecord);
      showAlert(`Ficha cargada para la clave ${nextRecord.clave_catastral}.`);
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
      { label: "Recoleccion", value: match?.recoleccion, icon: "refresh" },
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

  const openPrintBatchModal = () => {
    const currentRecordVisible = form.id && safeRecords.some((record) => record.id === form.id);
    setBatchPrintCopies(
      currentRecordVisible
        ? {
            [form.id]: {
              ficha: 1,
              aviso: 0
            }
          }
        : {}
    );
    setShowPrintBatchModal(true);
  };

  const updateBatchPrintCopies = (recordId, documentType, value) => {
    const nextValue = clampPrintCopies(value);
    setBatchPrintCopies((current) => ({
      ...current,
      [recordId]: {
        ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
        aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
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
      printBatchRecords.forEach((record) => {
        nextCopies[record.id] = {
          ficha: documentType === "ficha" ? 1 : clampPrintCopies(nextCopies[record.id]?.ficha ?? 0),
          aviso: documentType === "aviso" ? 1 : clampPrintCopies(nextCopies[record.id]?.aviso ?? 0)
        };
      });
      return nextCopies;
    });
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
    setLastProcessedRecord(null);
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
    setLastProcessedRecord(null);
    setRecordQuickFilter("all");
    setRecordFilters({
      clave: "",
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

  const handleAlcaldiaFileChange = (event) => {
    setAlcaldiaFile(event.target.files?.[0] ?? null);
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
        throw new Error(data.message || "No fue posible iniciar sesión.");
      }

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
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
      setAuthFx({ mode: "logout", text: "Cerrando sesión..." });
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

  const handleUploadAlcaldia = async (event) => {
    event.preventDefault();

    if (!alcaldiaFile) {
      showAlert("Selecciona un archivo Excel del padron de alcaldia.");
      return;
    }

    setUploadingAlcaldia(true);

    try {
      const payload = new FormData();
      payload.append("padron", alcaldiaFile);

      const response = await apiFetch("/claves/alcaldia/upload", {
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

        throw new Error(data.message || "No se pudo actualizar el padron de alcaldia.");
      }

      setAlcaldiaMeta(data.meta ?? null);
      setAlcaldiaImportSummary(data.import_summary ?? data.meta?.last_import_summary ?? null);
      setAlcaldiaFile(null);
      setAlcaldiaComparison(null);
      showAlert(`Padron de alcaldia actualizado con ${data.meta?.total_records ?? 0} claves.`);
    } catch (error) {
      showAlert(error.message || "No se pudo actualizar el padron de alcaldia.");
    } finally {
      setUploadingAlcaldia(false);
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
      const fallbackName = `padron-maestro-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);

      link.href = downloadUrl;
      link.download = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || fallbackName);
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

      const archivedRecord = normalizeRecord(data);
      setRecords((current) => current.filter((record) => record.id !== archivedRecord.id));
      resetForm();
      setRecordView("active");
      showAlert(`Ficha ${archivedRecord.clave_catastral} archivada.`);
      loadRecords(search, "active", { silent: true });
    } catch (error) {
      showAlert(error.message);
    }
  };

  const handleMarkRecordReported = async (record = form, event = null) => {
    event?.stopPropagation();
    if (!record?.id) {
      showAlert("Primero selecciona o guarda una ficha para marcarla como reportada.");
      return;
    }

    if (processingRecordId) {
      return;
    }

    const payload = {
      ...emptyForm,
      ...normalizeRecord(record),
      estado_padron: "reportada",
      comentarios: record.comentarios || "Clandestino procesado"
    };

    setProcessingRecordId(record.id);

    try {
      const response = await apiFetch(`/inmuebles/${record.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo marcar la ficha como reportada.");
      }

      const normalized = normalizeRecord(data);
      setRecords((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
      if (form.id === normalized.id) {
        setSelectedRecordId(null);
        setForm(emptyForm);
        setSelectedFile(null);
        setAvisoHtml("");
        setActiveSection("abonado");
      }
      setLastProcessedRecord({
        id: normalized.id,
        clave_catastral: normalized.clave_catastral,
        barrio_colonia: normalized.barrio_colonia,
        processed_at: new Date().toISOString()
      });
      setRecordQuickFilter((current) => (current === "reportada" ? current : "clandestino"));
      showAlert(`Ficha ${normalized.clave_catastral} procesada y retirada del formulario activo.`);
      loadRecords(search, recordView, { silent: true });
    } catch (error) {
      showAlert(error.message || "No se pudo marcar la ficha como reportada.");
    } finally {
      setProcessingRecordId(null);
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
      let payload = form;
      try {
        const match = form.estado_padron === "reportada" ? null : await findAlcaldiaMatchForForm(form);
        if (match) {
          const nextState = match.exists_in_aguas ? "varios_padrones" : "clandestino";
          payload = {
            ...form,
            estado_padron: nextState,
            clave_alcaldia: match.clave_catastral || "",
            nombre_alcaldia: match.nombre || form.nombre_alcaldia || "",
            barrio_alcaldia: match.caserio || match.direccion || form.barrio_alcaldia || "",
            nombre_catastral: match.nombre || form.nombre_catastral,
            barrio_colonia: form.barrio_colonia || match.caserio || match.direccion || "",
            identidad: form.identidad || match.identificador || "",
            comentarios: match.exists_in_aguas ? "Aparece en varios padrones" : form.comentarios || "Clandestino"
          };
          setForm(payload);
        }
      } catch {
        payload = form;
      }

      const response = await apiFetch(url.replace(API_URL, ""), {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
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
                  max-width: 184mm;
                  margin: 0 auto;
                  padding: 6mm 4mm 0;
                  font-family: Arial, Helvetica, sans-serif;
                  font-size: 12.4px;
                  line-height: 1.55;
                  color: #101827;
                }
                .aviso-header, .aviso-title, .aviso-signature, .aviso-copy {
                  text-align: center;
                }
                .aviso-header p, .aviso-title, .aviso-copy {
                  margin: 0 0 10px;
                }
                .aviso-header p {
                  font-size: 12px;
                  line-height: 1.35;
                }
                .aviso-header strong {
                  font-size: 15px;
                  letter-spacing: 0.02em;
                }
                .aviso-title {
                  margin-top: 10px;
                  margin-bottom: 18px;
                  font-size: 22px;
                  line-height: 1.18;
                  letter-spacing: 0;
                }
                .aviso-date, .aviso-saludo {
                  margin: 0 0 16px;
                }
                .aviso-body {
                  text-align: justify;
                  line-height: 1.58;
                  font-size: 12.4px;
                  margin: 0 0 16px;
                }
                .aviso-list {
                  margin: 10px 0 20px 34px;
                  padding-left: 12px;
                }
                .aviso-list li {
                  margin-bottom: 8px;
                  line-height: 1.58;
                  font-size: 12.4px;
                }
                .aviso-signature {
                  margin-top: 48px;
                }
                .aviso-signature p {
                  margin: 0 0 9px;
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

  const requestRecordAiAssistance = async (action) => {
    if (!form.clave_catastral && !form.barrio_colonia && !form.comentarios) {
      showAlert("Completa algunos datos de la ficha antes de usar IA.");
      return;
    }

    setAiLoadingAction(action);
    setAiSuggestion(null);

    try {
      const response = await apiFetch("/ai/record-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          record: form
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible generar la asistencia con IA.");
      }

      if (action === "comment") {
        setForm((current) => ({ ...current, comentarios: data.text }));
        setActiveSection("inmueble");
        showAlert("Comentario tecnico generado con IA.");
        return;
      }

      setAiSuggestion(data);
      showAlert(action === "notice" ? "Texto de aviso generado con IA." : "Resumen generado con IA.");
    } catch (error) {
      showAlert(error.message || "No fue posible usar la API de IA.");
    } finally {
      setAiLoadingAction("");
    }
  };

  const copyAiSuggestion = async () => {
    if (!aiSuggestion?.text) return;

    try {
      await navigator.clipboard.writeText(aiSuggestion.text);
      showAlert("Texto de IA copiado.");
    } catch {
      showAlert("No fue posible copiar el texto.");
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
        targetRecord.barrio_colonia
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
    const fichaBarrio = targetRecord.barrio_colonia || targetRecord.barrio_alcaldia || alcaldiaFichaMatch?.caserio || alcaldiaFichaMatch?.direccion || "--";
    const alcaldiaBarrio = targetRecord.barrio_alcaldia || alcaldiaFichaMatch?.caserio || alcaldiaFichaMatch?.direccion || "--";
    const fichaDireccion = alcaldiaFichaMatch?.direccion || targetRecord.barrio_alcaldia || targetRecord.barrio_colonia || "--";
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
    await printDocument(document.title, document.body, document.options);
  };

  const buildAvisoPrintMarkup = (record = form) => {
    const targetRecord = { ...emptyForm, ...normalizeRecord(record) };
    const fecha = targetRecord.fecha_aviso ? formatSpanishDate(targetRecord.fecha_aviso) : "__________";
    const barrio = targetRecord.barrio_colonia || "__________";
    const clave = targetRecord.clave_catastral || "__________";
    const firmante = targetRecord.firmante_aviso || "Jefatura de Comercializacion";
    const cargo = targetRecord.cargo_firmante || "Aguas de Choluteca";

    return `
      <div class="print-header"><img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" /></div>
      <section class="aviso">
        <div class="aviso-header">
          <p><strong>AGUAS DE CHOLUTECA</strong></p>
          <p>Departamento de Comercializacion</p>
        </div>
        <h2 class="aviso-title">AVISO IMPORTANTE AL ABONADO</h2>
        <p class="aviso-date">Fecha: Choluteca, ${escapeHtml(fecha)}</p>
        <p class="aviso-saludo">Estimado(a) Senor(a):</p>
        <p class="aviso-body">
          Por medio de la presente, se le informa que, como resultado del reciente levantamiento de informacion realizado por la Unidad Tecnica de Catastro, se ha identificado que el inmueble ubicado en ${escapeHtml(barrio)}, con Clave Catastral ${escapeHtml(clave)}, no se encuentra registrado en la base de datos de la empresa, pese a contar con servicios activos.
        </p>
        <p class="aviso-body">
          Con el proposito de regularizar su situacion, evitar circunstancias legales y establecer un acuerdo acorde al caso, se le solicita presentarse al Departamento de Comercializacion de Aguas de Choluteca, en un plazo maximo de siete (7) dias calendario a partir de la recepcion del presente aviso, debiendo presentar la siguiente documentacion:
        </p>
        <ul class="aviso-list">
          <li>Copia de Escritura publica del Inmueble.</li>
          <li>Copia de Constancia Catastral vigente.</li>
          <li>Copia de Documento Nacional de Identificacion (DNI).</li>
          <li>Constancia de solvencia municipal.</li>
        </ul>
        <p class="aviso-body">
          En caso de no presentarse dentro del plazo indicado, la empresa procedera conforme a los lineamientos administrativos establecidos por la ley que implican recargos y multas.
        </p>
        <p class="aviso-body">Sin otro particular, agradecemos su pronta colaboracion.</p>
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

  const handlePrintBatch = async () => {
    if (!batchPrintSelection.fichas && !batchPrintSelection.avisos) {
      showAlert("Selecciona al menos una ficha o aviso para imprimir.");
      return;
    }

    setBatchPrinting(true);
    setShowPrintBatchModal(false);

    try {
      const fichaPages = [];
      for (const item of batchPrintSelection.entries) {
        for (let copy = 0; copy < item.ficha; copy += 1) {
          const fichaDocument = await buildFichaPrintDocument(item.record);
          fichaPages.push(`<section class="print-batch-page">${fichaDocument.body}</section>`);
        }
      }

      if (fichaPages.length) {
        await printDocument(`Lote de fichas (${fichaPages.length})`, fichaPages.join(""), {
          bodyClassName: "print-ficha",
          pageSize: "Letter landscape",
          pageMargin: "8mm 8mm 8mm 12mm",
          windowFeatures: "width=1400,height=900"
        });
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

      showAlert(`Lote preparado: ${batchPrintSelection.fichas} fichas y ${batchPrintSelection.avisos} avisos.`);
    } catch (error) {
      showAlert(error.message || "No fue posible preparar el lote de impresion.");
    } finally {
      setBatchPrinting(false);
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
      document.save(`resumen-operaciones-realizadas-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Resumen de operaciones descargado en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el resumen de operaciones.");
    }
  };

  const handlePrintAviso = async () => {
    await printDocument(
      `Aviso ${form.clave_catastral || "inmueble"}`,
      buildAvisoPrintMarkup(form),
      {
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        windowFeatures: "width=980,height=1200"
      }
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
        <div className="app-alert app-toast no-print" role="alert">
          <strong>Atención</strong>
          <span>{alert.text}</span>
        </div>
      ) : null}
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
      <Dialog open={showPrintBatchModal} onOpenChange={(open) => !batchPrinting && setShowPrintBatchModal(open)}>
        <DialogContent className="print-batch-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-2xl">
          <DialogHeader className="password-modal-head">
            <p className="eyebrow">Impresion rapida</p>
            <DialogTitle>Seleccionar fichas, avisos y copias</DialogTitle>
            <DialogDescription className="lead">
              Se muestran las fichas segun los filtros activos. Puedes buscar por clave y seleccionar cuantas impresiones de ficha o aviso necesitas.
            </DialogDescription>
            <p className="helper-text">
              Al continuar se abrira una vista previa grande para revisar el documento antes de enviar la impresion al navegador.
            </p>
          </DialogHeader>
          <div className="print-batch-summary">
            <Badge variant="secondary">{batchPrintSelection.fichas} fichas</Badge>
            <Badge variant="secondary">{batchPrintSelection.avisos} avisos</Badge>
            <Badge variant="outline">{printBatchRecords.length} visibles</Badge>
            <Badge variant="outline">
              {printBatchRecords.filter((record) => (record.estado_padron || "clandestino") === "clandestino").length} clandestinas
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={() => selectVisibleBatchPrintCopies("ficha")}>
              1 ficha visible
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => selectVisibleBatchPrintCopies("aviso")}>
              1 aviso visible
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearBatchPrintCopies}>
              Limpiar seleccion
            </Button>
          </div>
          <ScrollArea className="print-batch-scroll">
            <div className="print-batch-grid">
              {printBatchRecords.length ? (
                printBatchRecords.map((record) => {
                  const copies = batchPrintCopies[record.id] || {};
                  const fichaCopies = clampPrintCopies(copies.ficha ?? 0);
                  const avisoCopies = clampPrintCopies(copies.aviso ?? 0);
                  const padronStatus = record.estado_padron || "clandestino";
                  const isClandestina = padronStatus === "clandestino";

                  return (
                    <article
                      key={`print-${record.id}`}
                      className={`print-batch-card ${fichaCopies || avisoCopies ? "is-selected" : ""}`}
                    >
                      <div className="print-batch-card-icon">
                        <Icon name={record.estado_padron === "reportada" ? "success" : "records"} />
                      </div>
                      <div className="print-batch-card-main">
                        <strong>{record.clave_catastral}</strong>
                        <span>{record.barrio_colonia || "Sin ubicacion"}</span>
                        <small>{record.inquilino || record.abonado || record.nombre_catastral || "Sin nombre"}</small>
                      </div>
                      <div className="print-batch-status">
                        <Badge
                          variant={isClandestina ? "destructive" : padronStatus === "reportada" ? "secondary" : "outline"}
                          className={`print-status-badge is-${padronStatus}`}
                        >
                          {getPadronStatusLabel(padronStatus)}
                        </Badge>
                        <span>
                          {isClandestina
                            ? "Puede imprimirse como ficha clandestina."
                            : padronStatus === "varios_padrones"
                              ? "Aparece en Alcaldia y Aguas; revisa antes de imprimir."
                              : "Ya fue reportada o procesada."}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidatePrintRecord(record)}
                          disabled={processingRecordId === record.id}
                        >
                          <Icon name="search" />
                          {processingRecordId === record.id ? "Validando..." : "Validar padrones"}
                        </Button>
                      </div>
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
          </ScrollArea>
          <DialogFooter className="password-form-actions">
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
            >
              <Icon name="records" />
              {batchPrinting
                ? "Preparando..."
                : `Vista previa: ${batchPrintSelection.fichas} fichas / ${batchPrintSelection.avisos} avisos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <header className={`hero app-chrome no-print ${isAdmin ? "hero-admin" : ""} ${workspaceView !== "dashboard" ? "hero-module" : ""}`}>
        <div className="app-topbar">
          <button
            type="button"
            className="app-menu-button"
            onClick={() => setShowMobileModuleMenu((current) => !current)}
            aria-label="Abrir menu"
          >
            <Icon name="more" />
          </button>
          <div className="app-topbar-brand">
            <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="app-topbar-logo" />
            <div>
              <strong>Aguas de Choluteca</strong>
              <span>{headerMeta.title}</span>
            </div>
          </div>
          <div className="app-topbar-kpis">
            {headerStats.map((stat) => (
              <span className="app-topbar-kpi" key={stat.label}>
                <small>{stat.label}</small>
                <strong>{stat.value}</strong>
              </span>
            ))}
          </div>
          <div className="app-topbar-session">
            <span className={`app-save-state ${isDirty ? "is-live" : ""}`}>
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
            </span>
            <span className="app-user-chip">
              <Icon name="users" />
              {session?.user?.full_name || session?.user?.username || "Sesion activa"}
            </span>
            <button type="button" className="button-secondary app-logout-button" onClick={handleLogout}>
              <Icon name="logout" />
              Salir
            </button>
          </div>
        </div>

        <div className={`search-card ${headerMeta.cardClass} ${workspaceView === "requests" ? "is-hidden" : ""}`}>
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
                <button type="button" onClick={() => setWorkspaceView("executiveReport")}>
                  <Icon name="records" />
                  Operaciones realizadas
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
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("executiveReport")}>
                  <Icon name="records" />
                  Operaciones realizadas
                </button>
                <button type="button" className="button-secondary" onClick={handleLogout}>
                  <Icon name="logout" />
                  Cerrar sesión
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
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("executiveReport")}>
                  <Icon name="records" />
                  Operaciones realizadas
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
                Consulta el padrón maestro sin entrar al módulo de fichas. Acepta clave base `00-00-00` o `000-00-00`,
                y clave completa `00-00-00-00` o `000-00-00-00`.
              </p>
              <div className="search-actions">
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
            <div className="workspace-summary">
              <p className="workspace-title">
                Reporte administrativo compacto de puntos levantados en campo, agrupados por zona y listo para impresión institucional.
              </p>
              <div className="map-diary-summary">
                <span className="panel-pill">Bitácora: {formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
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
                  Ir a página 1
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
                  Cerrar sesión
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
                </button>
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
          ) : (
            <div className="workspace-summary">
              <p className="workspace-title">
                {workspaceView === "users"
                  ? "Alta de usuarios con envío por correo y perfiles de acceso."
                  : "Bitácora operativa con eventos de acceso, cambios y archivado."}
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
                  Cerrar sesión
                </button>
                <button type="button" className="button-secondary" onClick={() => setShowPasswordModal(true)}>
                  <Icon name="auth" />
                  Cambiar contraseña
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <aside className={`app-sidebar no-print ${showMobileModuleMenu ? "is-open" : ""}`}>
        {sidebarNavigationSections.map((section) => (
          <div className="app-sidebar-section" key={section.key}>
            <span className="app-sidebar-label">{section.title}</span>
            {section.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`app-sidebar-item ${workspaceView === item.key ? "is-active" : ""}`}
                onClick={() => {
                  setWorkspaceView(item.key);
                  setShowMobileModuleMenu(false);
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.badge !== null && item.badge !== undefined ? (
                  <small className="app-sidebar-badge">{item.badge}</small>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </aside>
      {showMobileModuleMenu ? (
        <button
          type="button"
          className="app-sidebar-backdrop no-print"
          aria-label="Cerrar menu"
          onClick={() => setShowMobileModuleMenu(false)}
        />
      ) : null}
      {workspaceView === "dashboard" ? (
      <main className="dashboard-layout">
        <section className="dashboard-main">
          <section className="dashboard-metrics-grid">
            {headerStats.map((stat) => (
              <article key={stat.label} className="dashboard-metric-card">
                <span className="dashboard-metric-icon"><Icon name={stat.icon} /></span>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </section>

          <section className="dashboard-content-grid">
            <article className="preview-panel dashboard-panel">
              <div className="dashboard-panel-head">
                <div>
                  <p className="sheet-kicker">Actividad reciente</p>
                  <h2><Icon name="activity" className="title-icon" />Pulso operativo</h2>
                </div>
                <button type="button" className="button-secondary" onClick={() => setWorkspaceView("logs")}>
                  <Icon name="logs" />
                  Bitácora completa
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
            </article>

            <article className="preview-panel dashboard-panel">
              <div className="dashboard-panel-head">
                <div>
                  <p className="sheet-kicker">Alertas y pendientes</p>
                  <h2><Icon name="warning" className="title-icon" />Atención requerida</h2>
                </div>
              </div>
              <div className="dashboard-alerts-list">
                {alertRecords.length ? (
                  alertRecords.slice(0, 5).map((record) => {
                    const meta = recordDeadlineMetaById[record.id];
                    return (
                      <article key={record.id} className={`dashboard-alert-item ${meta?.statusKey || "warning"}`}>
                        <span className="dashboard-alert-icon">
                          <Icon name={meta?.statusKey === "overdue" ? "danger" : "warning"} />
                        </span>
                        <div>
                          <strong>{record.clave_catastral || "Sin clave"}</strong>
                          <p>{meta?.label || "Requiere atención"} · {formatDateTime(record.created_at)}</p>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <h3>Sin alertas pendientes</h3>
                    <p>Todas las fichas están al día.</p>
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="dashboard-quick-actions">
            <div className="dashboard-quick-grid">
              {dashboardQuickActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="dashboard-quick-card"
                  onClick={() => setWorkspaceView(action.key)}
                >
                  <span className="dashboard-quick-icon"><Icon name={action.icon} /></span>
                  <span className="dashboard-quick-label">{action.label}</span>
                </button>
              ))}
            </div>
          </section>
        </section>
      </main>
      ) : workspaceView === "executiveReport" ? (
      <main className="executive-report-layout">
        <section className="executive-hero-panel">
          <div>
            <p className="sheet-kicker">Memoria operativa integral</p>
            <h2><Icon name="dashboard" className="title-icon" />Resumen de Operaciones realizadas</h2>
            <p>
              Consolidado de todo lo trabajado en la aplicación: captura de fichas, validación de padrones,
              avisos, impresión, geolocalización, mapeo, reportes PDF, usuarios, funciones desarrolladas,
              ahorro de tiempo para técnicos y trazabilidad.
            </p>
            <p className="executive-supervisor">{EXECUTIVE_REPORT_CREDIT}</p>
          </div>
          <button type="button" onClick={handleDownloadExecutiveReportPdf}>
            <Icon name="records" />
            Descargar PDF
          </button>
        </section>

        <section className="executive-kpi-grid">
          {[
            { label: "Fichas registradas", value: safeRecords.length, helper: `${executiveReportData.statusTotals.reportada || 0} reportadas` },
            { label: "Puntos GPS", value: safeMapPoints.length, helper: `${mapDiaryGroups.length} jornadas de campo` },
            { label: "Padrón maestro", value: padronMeta?.total_records ?? 0, helper: `${alcaldiaMeta?.total_records ?? 0} registros Alcaldía` },
            { label: "Eventos auditados", value: safeAuditLogs.length, helper: `${safeUsers.length} usuarios registrados` }
          ].map((item) => (
            <article key={item.label} className="executive-kpi-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </article>
          ))}
        </section>

        <section className="executive-section-grid">
          <article className="executive-card is-wide">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Alcance construido</p>
                <h3>Módulos y capacidades entregadas</h3>
              </div>
              <span className="panel-pill">
                Desde {executiveReportData.firstDate ? formatSpanishDate(executiveReportData.firstDate) : "sin registros"}
              </span>
            </div>
            <div className="executive-module-list">
              {executiveReportData.modules.map((item) => (
                <article key={item.title} className="executive-module-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <span>{item.evidence}</span>
                </article>
              ))}
            </div>
          </article>

          <article className="executive-card is-wide">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Funciones de la aplicación</p>
                <h3>Herramientas desarrolladas para campo y oficina</h3>
              </div>
            </div>
            <div className="executive-module-list">
              {executiveReportData.applicationFunctions.slice(0, 6).map((item) => (
                <article key={item[0]} className="executive-module-item">
                  <strong>{item[0]}</strong>
                  <p>{item[1]}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="executive-card is-wide">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Ahorro operativo</p>
                <h3>Tiempo que se ahorran los técnicos</h3>
              </div>
            </div>
            <div className="executive-table-list">
              {executiveReportData.timeSavingsRows.slice(0, 6).map((item) => (
                <div key={item[0]}>
                  <span>{item[0]}</span>
                  <strong>{item[1]} → {item[2]}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="executive-card">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Fichas</p>
                <h3>Estado operativo</h3>
              </div>
            </div>
            <div className="executive-stat-list">
              <div><span>Clandestinas</span><strong>{executiveReportData.statusTotals.clandestino || 0}</strong></div>
              <div><span>Reportadas</span><strong>{executiveReportData.statusTotals.reportada || 0}</strong></div>
              <div><span>Varios padrones</span><strong>{executiveReportData.statusTotals.varios_padrones || 0}</strong></div>
              <div><span>Con fotografía</span><strong>{executiveReportData.photoCount}</strong></div>
              <div><span>Listas para aviso</span><strong>{executiveReportData.printedReadyRecords}</strong></div>
              <div><span>Plazo crítico</span><strong>{alertRecords.length}</strong></div>
            </div>
          </article>

          <article className="executive-card">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Campo</p>
                <h3>Jornadas realizadas</h3>
              </div>
            </div>
            <div className="executive-table-list">
              {(executiveReportData.fieldJourneyRows.length ? executiveReportData.fieldJourneyRows : [{ label: "Sin jornadas", points: 0, zones: 0, records: 0 }]).slice(0, 8).map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.points} pts · {item.zones} zonas · {item.records} fichas</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="executive-card">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Responsables</p>
                <h3>Levantamiento por técnico</h3>
              </div>
            </div>
            <div className="executive-table-list">
              {(executiveReportData.fieldResponsibleRows.length ? executiveReportData.fieldResponsibleRows : [{ name: "Sin responsable", records: 0, withPhoto: 0 }]).map((item) => (
                <div key={item.name}>
                  <span>{item.name}</span>
                  <strong>{item.records} fichas · {item.withPhoto} fotos</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="executive-card">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Geolocalización</p>
                <h3>Puntos por tipo</h3>
              </div>
            </div>
            <div className="executive-table-list">
              {(executiveReportData.mapTypeRows.length ? executiveReportData.mapTypeRows : [{ label: "Sin puntos", total: 0 }]).map((item) => (
                <div key={item.label}><span>{item.label}</span><strong>{item.total}</strong></div>
              ))}
            </div>
          </article>

          <article className="executive-card">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Mapeo</p>
                <h3>Zonas principales</h3>
              </div>
            </div>
            <div className="executive-table-list">
              {(executiveReportData.mapZoneRows.length ? executiveReportData.mapZoneRows : [{ label: "Sin zonas", total: 0 }]).map((item) => (
                <div key={item.label}><span>{item.label}</span><strong>{item.total}</strong></div>
              ))}
            </div>
          </article>

          <article className="executive-card">
            <div className="executive-card-head">
              <div>
                <p className="sheet-kicker">Bitácora</p>
                <h3>Eventos principales</h3>
              </div>
            </div>
            <div className="executive-table-list">
              {(executiveReportData.auditRows.length ? executiveReportData.auditRows : [{ label: "Sin eventos", total: 0 }]).slice(0, 6).map((item) => (
                <div key={item.label}><span>{item.label}</span><strong>{item.total}</strong></div>
              ))}
            </div>
          </article>
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
      <main className="layout records-view shadcn-records-module">
        <Card className="sidebar no-print shadcn-records-sidebar" size="sm">
          <div className="panel-header">
            <h2>Registros</h2>
            <div className="sidebar-actions">
              <Button
                type="button"
                variant={recordView === "active" ? "default" : "outline"}
                onClick={() => setRecordView("active")}
              >
                Activas
              </Button>
              {isAdmin ? (
                <Button
                  type="button"
                  variant={recordView === "archived" ? "default" : "outline"}
                  onClick={() => setRecordView("archived")}
                >
                  Archivadas
                </Button>
              ) : null}
              {draftForm ? (
                <Button type="button" variant="outline" onClick={restoreDraft}>
                  Borrador
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={resetForm}>
                Nuevo
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="list-skeleton" aria-label="Cargando registros">
              <span className="skeleton-line is-short" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
            </div>
          ) : null}
          {emptyRecordsMessage ? <p className="helper-text">{emptyRecordsMessage}</p> : null}

          <div className="records-sidebar-controls">
            <label className="record-filter-field records-search-field">
              <span>Buscar por clave</span>
              <Input
                type="search"
                name="clave"
                value={recordFilters.clave}
                onChange={handleRecordFilterChange}
                placeholder="Ej. 183-02-02"
              />
            </label>
            <Tabs value={recordQuickFilter} onValueChange={setRecordQuickFilter} className="record-filter-strip records-filter-strip">
              <TabsList className="records-filter-tabs">
                {recordQuickFilterOptions.map((option) => {
                  const count =
                    option.key === "today"
                      ? recordsUpdatedToday
                      : option.key === "clandestino"
                        ? safeRecords.filter((record) => (record.estado_padron || "clandestino") === "clandestino").length
                      : option.key === "reportada"
                        ? safeRecords.filter((record) => record.estado_padron === "reportada").length
                      : option.key === "varios_padrones"
                        ? safeRecords.filter((record) => record.estado_padron === "varios_padrones").length
                      : option.key === "no_photo"
                        ? pendingPhotoRecords
                      : option.key === "alert"
                        ? alertRecords.length
                        : safeRecords.length;

                  return (
                    <TabsTrigger
                      key={option.key}
                      value={option.key}
                      className={`record-filter-chip ${recordQuickFilter === option.key ? "is-active" : ""}`}
                    >
                      <span>{option.label}</span>
                      <Badge variant={recordQuickFilter === option.key ? "secondary" : "outline"}>{count}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <div className="records-filter-toolbar">
              <Button
                type="button"
                variant={showRecordAdvancedFilters ? "default" : "outline"}
                onClick={() => setShowRecordAdvancedFilters((current) => !current)}
              >
                <Icon name="more" />
                Filtros avanzados
              </Button>
              <Button type="button" variant="outline" className="record-filter-clear" onClick={clearRecordFilters}>
                <Icon name="refresh" />
                Limpiar
              </Button>
            </div>
            {showRecordAdvancedFilters ? (
              <div className="record-filter-panel records-advanced-filters">
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
              </div>
            ) : null}
          </div>

        <div className="record-list-head">
          <span>Exp.</span>
          <span>
            {recordQuickFilter === "all"
              ? "Fichas activas"
              : recordQuickFilter === "clandestino"
                ? "Clandestinas"
              : recordQuickFilter === "reportada"
                ? "Reportadas"
              : recordQuickFilter === "varios_padrones"
                ? "En varios padrones"
              : recordQuickFilter === "today"
                ? "Movimiento de hoy"
                : recordQuickFilter === "no_photo"
                  ? "Pendientes de foto"
                  : "Plazo en alerta"}
          </span>
          <span>Vista</span>
        </div>

        <div className="record-list-scroll" role="region" aria-label="Lista de fichas">
        <div className="record-list">
          {loading ? (
            <div className="record-skeleton-stack" aria-label="Cargando fichas">
              {[0, 1, 2, 3].map((item) => (
                <div className="record-skeleton-card" key={item}>
                  <span className="skeleton-dot" />
                  <div>
                    <span className="skeleton-line is-short" />
                    <span className="skeleton-line" />
                    <span className="skeleton-line is-tiny" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
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
                  <small>{draftForm.comentarios || "Datos aún no guardados"}</small>
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
                            <span className={`record-badge ${record.estado_padron === "reportada" ? "is-reported" : ""}`}>
                              {recordView === "archived" ? "Log" : getPadronStatusLabel(record.estado_padron)}
                            </span>
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
                          {recordView !== "archived" && record.estado_padron !== "reportada" ? (
                            <button
                              type="button"
                              className="record-quick-chip is-success"
                              disabled={Boolean(processingRecordId)}
                              onClick={(event) => handleMarkRecordReported(record, event)}
                            >
                              {processingRecordId === record.id ? "Procesando..." : "Clandestino procesada"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
        </div>
        <div className="record-pagination">
          <div className="record-pagination-copy">
            <strong>Pagina {recordPagination.currentPage} de {recordPagination.totalPages}</strong>
            <span>
              {filteredRecords.length
                ? `Mostrando ${recordPagination.start + 1}-${recordPagination.end} de ${filteredRecords.length} fichas`
                : "No hay fichas con los filtros actuales"}
            </span>
          </div>
          <div className="record-pagination-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setRecordPage((current) => Math.max(1, current - 1))}
              disabled={recordPagination.currentPage === 1}
            >
              <Icon name="arrowLeft" />
              Anterior
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setRecordPage((current) => Math.min(recordPagination.totalPages, current + 1))}
              disabled={recordPagination.currentPage === recordPagination.totalPages}
            >
              Siguiente
              <Icon name="arrowRight" />
            </button>
          </div>
        </div>
        </Card>

        <section className="content">
          <section className="records-workspace-header no-print">
            <div className="records-title-row">
              <div>
                <p className="sheet-kicker">Gestion de fichas</p>
                <h2><Icon name="records" className="title-icon" />Fichas registradas</h2>
                <p className="workspace-title">
                  Captura, busqueda, validacion e impresion desde una vista compacta de trabajo.
                </p>
              </div>
              <div className="records-main-actions">
                <Button type="button" onClick={resetForm}>
                  <Icon name="plus" />
                  Nueva ficha
                </Button>
                <Button type="button" variant="outline" onClick={openPrintBatchModal}>
                  <Icon name="records" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRecordPreview((current) => !current)}
                >
                  <Icon name="records" />
                  {showRecordPreview ? "Ocultar vista" : "Vista previa"}
                </Button>
              </div>
            </div>
          </section>

          {lastProcessedRecord ? (
            <div className="processed-record-notice no-print" role="status">
              <div>
                <span className="sheet-kicker">Ficha procesada</span>
                <strong>{lastProcessedRecord.clave_catastral}</strong>
                <p>
                  Se marco como reportada y se retiro del formulario activo para evitar impresiones repetidas.
                </p>
              </div>
              <div className="processed-record-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setRecordQuickFilter("reportada");
                    setLastProcessedRecord(null);
                  }}
                >
                  Ver reportadas
                </button>
                <button type="button" onClick={() => setLastProcessedRecord(null)}>
                  Continuar
                </button>
              </div>
            </div>
          ) : null}

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
                <div className={`padron-status-panel no-print is-${form.estado_padron || "clandestino"}`}>
                  <div className="padron-status-copy">
                    <span className="sheet-kicker">Estado de padrones</span>
                    <div className="padron-status-heading">
                      <strong>{getPadronStatusLabel(form.estado_padron)}</strong>
                      <span
                        className={`record-badge ${
                          form.estado_padron === "reportada"
                            ? "is-reported"
                            : form.estado_padron === "clandestino"
                              ? "is-danger"
                              : ""
                        }`}
                      >
                        {form.estado_padron === "reportada"
                          ? "Procesada"
                          : form.estado_padron === "clandestino"
                            ? "Validada clandestina"
                            : "En revision"}
                      </span>
                    </div>
                    <p>{getPadronStatusDescription(form.estado_padron)}</p>
                  </div>
                  <div className="padron-status-actions">
                    <label>
                      <span>Clasificacion</span>
                      <select name="estado_padron" value={form.estado_padron || "clandestino"} onChange={handleChange}>
                        <option value="clandestino">Clandestina</option>
                        <option value="reportada">Reportada</option>
                        <option value="varios_padrones">En varios padrones</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => handleMarkRecordReported(form)}
                      disabled={!form.id || form.estado_padron === "reportada" || Boolean(processingRecordId)}
                    >
                      <Icon name="success" />
                      {processingRecordId === form.id ? "Procesando..." : "Clandestino procesada"}
                    </button>
                    <button type="button" className="button-secondary" onClick={handleValidateFormPadron}>
                      <Icon name="search" />
                      Validar padrones
                    </button>
                  </div>
                </div>
                <div className="form-grid padron-cross-grid">
                  <label>
                    <span>Clave Alcaldia</span>
                    <input name="clave_alcaldia" value={form.clave_alcaldia || ""} onChange={handleChange} />
                  </label>
                  <label>
                    <span>Nombre Alcaldia</span>
                    <input name="nombre_alcaldia" value={form.nombre_alcaldia || ""} onChange={handleChange} />
                  </label>
                  <label>
                    <span>Barrio Alcaldia</span>
                    <input name="barrio_alcaldia" value={form.barrio_alcaldia || ""} onChange={handleChange} />
                  </label>
                </div>
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
              <section className="sheet-section">
                <h3>Datos para aviso</h3>
                <div className="form-grid">
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
              </section>
            ) : null}

            {activeSection === "foto" ? (
              <section className="sheet-section">
                <h3>Fotografia del inmueble</h3>
                <div className="photo-workspace">
                  <div>
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
                    ) : (
                      <p className="helper-text">Carga evidencia fotografica desde escritorio o camara movil.</p>
                    )}
                  </div>
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
                className={saving ? "is-loading" : ""}
                onClick={() => setSaveIntent(saveIntentOptions.stay)}
              >
                {saving ? "Guardando..." : form.id ? "Actualizar ficha" : "Guardar ficha"}
              </button>
              {!form.id ? (
                <button
                  type="submit"
                  data-intent={saveIntentOptions.new}
                  className={`button-secondary ${saving ? "is-loading" : ""}`}
                  disabled={saving}
                  onClick={() => setSaveIntent(saveIntentOptions.new)}
                >
                  {saving ? "Guardando..." : "Guardar y nueva"}
                </button>
              ) : null}
              {recordView !== "archived" && form.id ? (
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

          <section className={`preview-panel record-preview-panel ${showRecordPreview ? "is-open" : "is-collapsed"}`}>
            <div className="preview-actions no-print">
              <button type="button" className="button-secondary" onClick={openPrintBatchModal}>
                <Icon name="records" />
                Imprimir ficha / aviso
              </button>
              <button type="button" className="button-secondary" onClick={handlePrintFicha}>
                Imprimir ficha
              </button>
              <button type="button" className={loadingAviso ? "is-loading" : ""} onClick={generateAviso} disabled={loadingAviso}>
                {loadingAviso ? "Generando aviso..." : "Generar aviso"}
              </button>
              <button type="button" className="button-secondary" onClick={handlePrintAviso}>
                Imprimir aviso
              </button>
              <Button
                type="button"
                variant="outline"
                onClick={() => requestRecordAiAssistance("comment")}
                disabled={Boolean(aiLoadingAction)}
              >
                {aiLoadingAction === "comment" ? "IA generando..." : "IA comentario"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => requestRecordAiAssistance("summary")}
                disabled={Boolean(aiLoadingAction)}
              >
                {aiLoadingAction === "summary" ? "IA generando..." : "IA resumen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => requestRecordAiAssistance("notice")}
                disabled={Boolean(aiLoadingAction)}
              >
                {aiLoadingAction === "notice" ? "IA generando..." : "IA aviso"}
              </Button>
            </div>
            {aiSuggestion ? (
              <div className="ai-assist-card no-print">
                <div>
                  <span className="sheet-kicker">Asistencia IA</span>
                  <strong>{aiSuggestion.label || "Texto generado"}</strong>
                </div>
                <p>{aiSuggestion.text}</p>
                <div className="ai-assist-actions">
                  <Button type="button" variant="outline" size="sm" onClick={copyAiSuggestion}>
                    Copiar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAiSuggestion(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="record-preview-head no-print">
              <div>
                <p className="sheet-kicker">Vista previa</p>
                <h2>Ficha visual</h2>
              </div>
              <button type="button" className="button-secondary" onClick={() => setShowRecordPreview((current) => !current)}>
                {showRecordPreview ? "Contraer" : "Expandir"}
              </button>
            </div>
            {showRecordPreview ? (
            <>
            <article className="document-sheet">
              <header className="document-header">
                <div className="document-brand-row">
                  <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="document-logo" />
                  <div>
                    <p className="document-company">Aguas de Choluteca, S.A. de C.V.</p>
                    <p>Barrio El Centro Antiguo Local de Cooperativa Guadalupe.</p>
                    <p>Tel: 2782-5075 Fax: 2780-3985</p>
                  </div>
                </div>
                <div className="document-title-box">
                  <p>Departamento de Catastro</p>
                  <h3>FICHA TECNICA DE INFORMACION CATASTRAL</h3>
                </div>
                <div className="document-meta-strip">
                  <div>
                    <strong>Clave Catastral</strong>
                    <span>{form.clave_catastral || "--"}</span>
                  </div>
                  <div>
                    <strong>Estado</strong>
                    <span>{getPadronStatusLabel(form.estado_padron)}</span>
                  </div>
                  <div>
                    <strong>Ficha</strong>
                    <span>{form.id ? `#${form.id}` : "Nueva"}</span>
                  </div>
                  <div>
                    <strong>Fecha aviso</strong>
                    <span>{form.fecha_aviso || "--"}</span>
                  </div>
                </div>
              </header>

              <section className="document-block">
                <h4>Estado de padrones</h4>
                <div className="document-grid">
                  <div>
                    <strong>Clasificacion</strong>
                    <span>{getPadronStatusLabel(form.estado_padron)}</span>
                  </div>
                  <div><strong>Clave Alcaldia</strong><span>{form.clave_alcaldia || "--"}</span></div>
                  <div><strong>Nombre Alcaldia</strong><span>{form.nombre_alcaldia || "--"}</span></div>
                  <div><strong>Barrio Alcaldia</strong><span>{form.barrio_alcaldia || "--"}</span></div>
                </div>
              </section>

              <section className="document-block">
                <h4>Informacion del abonado</h4>
                <div className="document-grid document-grid-wide">
                  <div><strong>Abonado</strong><span>{form.abonado || "--"}</span></div>
                  <div><strong>Catastral</strong><span>{form.nombre_catastral || "--"}</span></div>
                  <div><strong>Inquilino</strong><span>{form.inquilino || "--"}</span></div>
                  <div><strong>Barrio/Colonia</strong><span>{form.barrio_colonia || "--"}</span></div>
                  <div><strong>Identidad</strong><span>{form.identidad || "--"}</span></div>
                  <div><strong>Telefono</strong><span>{form.telefono || "--"}</span></div>
                </div>
              </section>

              <section className="document-block document-action-block">
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
                <div className="document-evidence-grid">
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
                      <span>Evidencia fotografica</span>
                    </div>
                  ) : (
                    <div className="document-photo-empty">Sin fotografia adjunta</div>
                  )}
                </div>
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
                <div className="preview-skeleton" aria-label="Cargando historial de la ficha">
                  <span className="skeleton-line is-short" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line" />
                </div>
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
            </>
            ) : (
              <div className="empty-state record-preview-empty no-print">
                <h3>Vista previa contraida</h3>
                <p>Usa el boton Vista previa cuando necesites revisar la ficha visual o el historial.</p>
              </div>
            )}
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
                        : lookupSearchMode === "alcaldia"
                          ? "Busca en el padron de Alcaldia por clave catastral, nombre, identidad o barrio/caserio."
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
                    ) : lookupSearchMode === "alcaldia" ? (
                      <>
                        <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("01-01-01")}>
                          01-01-01
                        </button>
                        <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("Barrio Suyapa")}>
                          Barrio Suyapa
                        </button>
                        <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("Sandra")}>
                          Sandra
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
                            <small>
                              {item.mode === "clave"
                                ? "Clave"
                                : item.mode === "nombre"
                                  ? "Nombre"
                                  : item.mode === "alcaldia"
                                    ? "Alcaldia"
                                    : "Abonado"}
                            </small>
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
                            : lookupSearchMode === "alcaldia"
                              ? "Buscar en Alcaldia"
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
                  <button type="button" className="button-secondary" onClick={handleDownloadPadron}>
                    <Icon name="records" />
                    Descargar padrón
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
                        {lookupResult.field === "texto"
                          ? "Busqueda Alcaldia"
                          : lookupResult.field === "clave"
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
                      {lookupResult.field === "texto"
                        ? lookupResult.exists
                          ? "Existe en Alcaldia"
                          : "Sin registro Alcaldia"
                        : lookupResult.exists
                          ? "Si registrada"
                          : "Sin registro"}
                    </span>
                  </div>

                  <p className="lookup-result-message">
                    {lookupResult.exists
                      ? lookupResult.field === "texto"
                        ? `Se encontraron ${lookupResult.total_matches} coincidencias en el padron de Alcaldia.`
                        : lookupResult.field === "clave"
                        ? lookupResult.mode === "base"
                          ? `Se encontraron ${lookupResult.total_matches} coincidencias asociadas a esa clave base.`
                          : "La clave consultada si existe en el sistema maestro."
                        : `Se encontraron ${lookupResult.total_matches} coincidencias asociadas a esa consulta.`
                      : "No existe registro en el sistema. Posible clandestino."}
                  </p>

                  {!lookupResult.exists && lookupResult.field === "clave" ? (
                    <div className="lookup-match-actions">
                      <button
                        type="button"
                        onClick={() =>
                          startNewRecordFromLookup(
                            {
                              clave_catastral: lookupResult.normalized_query || lookupQuery.trim(),
                              estado_padron: "clandestino",
                              comentarios: "Clandestino"
                            },
                            `Ficha nueva preparada para la clave ${lookupResult.normalized_query || lookupQuery.trim()}.`
                          )
                        }
                      >
                        <Icon name="records" />
                        Crear ficha nueva
                      </button>
                    </div>
                  ) : null}

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
                                : lookupResult.field === "texto"
                                  ? "Alcaldia"
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
                          if (lookupResult.field === "texto") {
                            return (
                              <article key={`${match.clave_catastral}-${match.identificador}-${match.nombre}`} className="lookup-match-card">
                                <div className="lookup-match-top">
                                  <div className="lookup-match-headline">
                                    <strong>{match.clave_catastral}</strong>
                                    <span className="lookup-abonado-pill">Alcaldia</span>
                                  </div>
                                  <span className={`lookup-match-status ${match.exists_in_aguas ? "is-ok" : "is-danger"}`}>
                                    <Icon name={match.exists_in_aguas ? "success" : "activity"} />
                                    {match.exists_in_aguas ? "Tambien aparece en Aguas" : "Clandestino: no aparece en Aguas"}
                                  </span>
                                </div>
                                <div className="lookup-match-grid">
                                  <div className="lookup-match-field">
                                    <span className="lookup-match-label">Nombre Alcaldia</span>
                                    <span>{match.nombre || "Sin nombre registrado"}</span>
                                  </div>
                                  <div className="lookup-match-field">
                                    <span className="lookup-match-label">Barrio/Caserio</span>
                                    <span>{match.caserio || match.direccion || "--"}</span>
                                  </div>
                                  <div className="lookup-match-field">
                                    <span className="lookup-match-label">Direccion</span>
                                    <span>{match.direccion || "--"}</span>
                                  </div>
                                  <div className="lookup-match-field">
                                    <span className="lookup-match-label">Identificador</span>
                                    <span>{match.identificador || "--"}</span>
                                  </div>
                                  <div className="lookup-match-field">
                                    <span className="lookup-match-label">Clave equivalente Aguas</span>
                                    <span>{match.exists_in_aguas ? match.clave_aguas_formato || "--" : "No registrada en Aguas"}</span>
                                  </div>
                                  <div className="lookup-match-field">
                                    <span className="lookup-match-label">Coincidencia</span>
                                    <strong className={match.exists_in_aguas ? "lookup-match-total is-good" : "lookup-match-total is-danger"}>
                                      {match.match_type === "exacta"
                                        ? "Exacta"
                                        : match.match_type === "base"
                                          ? "Por base"
                                          : "No aparece en Aguas"}
                                    </strong>
                                  </div>
                                </div>
                                <div className="lookup-match-actions">
                                  <button
                                    type="button"
                                    className="button-secondary"
                                    onClick={() =>
                                      startNewRecordFromLookup(
                                        {
                                          clave_catastral:
                                            (match.exists_in_aguas ? match.clave_aguas_formato : match.clave_catastral) ||
                                            "",
                                          nombre_catastral: match.nombre || "",
                                          barrio_colonia: match.caserio || match.direccion || "",
                                          identidad: match.identificador || "",
                                          comentarios: match.exists_in_aguas ? "Aparece en varios padrones" : "Clandestino",
                                          estado_padron: match.exists_in_aguas ? "varios_padrones" : "clandestino",
                                          clave_alcaldia: match.clave_catastral || "",
                                          nombre_alcaldia: match.nombre || "",
                                          barrio_alcaldia: match.caserio || match.direccion || ""
                                        },
                                        `Ficha nueva preparada desde Alcaldia para la clave ${match.clave_catastral || "--"}.`
                                      )
                                    }
                                  >
                                    <Icon name="records" />
                                    Pasar a ficha
                                  </button>
                                </div>
                              </article>
                            );
                          }

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
                              <div className="lookup-match-actions">
                                <button type="button" onClick={() => handlePrintLookupMatchReport(match)}>
                                  <Icon name="records" />
                                  Generar reporte
                                </button>
                                <button
                                  type="button"
                                  className="button-secondary"
                                  onClick={() => openLookupMatchInRecord(match)}
                                >
                                  <Icon name="search" />
                                  Abrir ficha
                                </button>
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
                  <h2><Icon name="refresh" className="title-icon" />Padron Aguas de Choluteca</h2>
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

            <div className="padron-dual-grid">
              <form className="lookup-card" onSubmit={handleUploadAlcaldia}>
                <div className="lookup-card-head">
                  <div>
                    <p className="sheet-kicker">Padron de contraste</p>
                    <h2><Icon name="records" className="title-icon" />Padron Alcaldia</h2>
                    <p className="lookup-card-description">
                      Este archivo se compara contra Aguas de Choluteca para detectar claves catastrales que no aparecen en el padron maestro.
                    </p>
                  </div>
                  <span className="panel-pill">{alcaldiaMeta?.total_records ?? 0} claves</span>
                </div>
                <div className="admin-result-grid padron-admin-grid">
                  <div className="document-block">
                    <h4>Archivo activo</h4>
                    <p><strong>Archivo:</strong> {alcaldiaMeta?.file_name || "Sin registro"}</p>
                    <p><strong>Fuente guardada:</strong> {alcaldiaMeta?.source_file_available ? (alcaldiaMeta?.source_file_name || "Disponible") : "No disponible"}</p>
                    <p><strong>Hoja:</strong> {alcaldiaMeta?.sheet_name || "--"}</p>
                    <p><strong>Ultima actualizacion:</strong> {formatDateTime(alcaldiaMeta?.updated_at)}</p>
                    <p><strong>Estado actual:</strong> {loadingAlcaldiaMeta ? "Consultando..." : "Sincronizado"}</p>
                    <div className="padron-summary-strip">
                      <div className="log-summary-card"><span>Nuevas</span><strong>{alcaldiaImportSummary?.added ?? 0}</strong></div>
                      <div className="log-summary-card"><span>Removidas</span><strong>{alcaldiaImportSummary?.removed ?? 0}</strong></div>
                      <div className="log-summary-card"><span>Cambiadas</span><strong>{alcaldiaImportSummary?.changed ?? 0}</strong></div>
                    </div>
                  </div>
                  <div className="document-block">
                    <h4>Nuevo archivo Alcaldia</h4>
                    <label className="file-input">
                      <span>Seleccionar Excel Alcaldia</span>
                      <input
                        type="file"
                        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleAlcaldiaFileChange}
                      />
                    </label>
                    <p className="helper-text">Se usa CLAVE CATASTRAL y se conserva nombre, direccion, caserio e identificador.</p>
                    {alcaldiaFile ? <p><strong>Archivo listo:</strong> {alcaldiaFile.name}</p> : null}
                  </div>
                </div>
                <div className="search-actions lookup-actions">
                  <button type="submit" disabled={uploadingAlcaldia}>
                    <Icon name="refresh" />
                    {uploadingAlcaldia ? "Actualizando..." : "Actualizar padron Alcaldia"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setAlcaldiaFile(null);
                      loadAlcaldiaMeta();
                    }}
                    disabled={loadingAlcaldiaMeta}
                  >
                    <Icon name="records" />
                    {loadingAlcaldiaMeta ? "Consultando..." : "Ver estado Alcaldia"}
                  </button>
                </div>
              </form>

              <article className="lookup-card padron-compare-card">
                <div className="lookup-card-head">
                  <div>
                    <p className="sheet-kicker">Deteccion de clandestinos</p>
                    <h2><Icon name="search" className="title-icon" />Comparar Alcaldia contra Aguas</h2>
                    <p className="lookup-card-description">
                      Si una clave del padron de Alcaldia no aparece en Aguas de Choluteca, queda marcada como candidata clandestina.
                    </p>
                  </div>
                  <button type="button" onClick={loadAlcaldiaComparison} disabled={loadingAlcaldiaComparison}>
                    <Icon name="search" />
                    {loadingAlcaldiaComparison ? "Comparando..." : "Comparar padrones"}
                  </button>
                </div>
                <div className="padron-comparison-strip">
                  <div className="log-summary-card"><span>Aguas</span><strong>{padronMeta?.total_records ?? 0}</strong></div>
                  <div className="log-summary-card"><span>Alcaldia</span><strong>{alcaldiaMeta?.total_records ?? 0}</strong></div>
                  <div className="log-summary-card"><span>Coincidencia exacta</span><strong>{alcaldiaComparison?.summary?.exact_matches ?? "--"}</strong></div>
                  <div className="log-summary-card"><span>Candidatas</span><strong>{alcaldiaComparison?.summary?.candidate_clandestine ?? "--"}</strong></div>
                </div>
                <div className="padron-candidate-list">
                  {alcaldiaComparison?.summary ? (
                    (alcaldiaComparison.candidates || []).length ? (
                      (alcaldiaComparison.candidates || []).slice(0, 20).map((item) => (
                        <article key={item.clave_catastral} className="padron-candidate-card">
                          <div>
                            <strong>{item.clave_catastral}</strong>
                            <span>{item.nombre || "Sin nombre registrado"}</span>
                          </div>
                          <p>{item.direccion || item.caserio || "Sin direccion registrada"}</p>
                          <small>No aparece en Aguas de Choluteca</small>
                        </article>
                      ))
                    ) : (
                      <p className="helper-text">No hay candidatas clandestinas con los padrones actuales.</p>
                    )
                  ) : (
                    <p className="helper-text">Carga ambos padrones y ejecuta la comparacion para ver las claves de Alcaldia que no aparecen en Aguas.</p>
                  )}
                </div>
              </article>
            </div>
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
                <div className="map-workflow-steps" aria-label="Flujo de captura">
                  <span>1. Ubica</span>
                  <span>2. Describe</span>
                  <span>3. Guarda</span>
                </div>
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
              <form className={`map-form-card ${editingMapPointId ? "is-editing" : ""}`} onSubmit={handleSaveMapPoint}>
                <div className="lookup-card-head map-card-head">
                  <div>
                    <p className="sheet-kicker">{editingMapPointId ? "Edicion activa" : "Nuevo punto"}</p>
                    <h3>{editingMapPointId ? "Actualizar ubicacion" : "Registrar ubicacion"}</h3>
                    <p className="helper-text">
                      {editingMapPointId
                        ? "Ajusta coordenadas o descripcion y guarda los cambios."
                        : "Usa GPS o toca el mapa; luego completa los datos tecnicos."}
                    </p>
                  </div>
                  <button type="button" className="button-secondary" onClick={resetMapDraft}>
                    <Icon name="refresh" />
                    {editingMapPointId ? "Cancelar" : "Limpiar"}
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
                    <Icon name={editingMapPointId ? "records" : "plus"} />
                    {savingMapPoint ? "Guardando..." : editingMapPointId ? "Actualizar punto" : "Guardar punto"}
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
                    <button type="button" className="button-secondary" onClick={(event) => handleEditMapPoint(selectedMapPoint.id, event)}>
                      <Icon name="records" />
                      Editar
                    </button>
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
                          <button type="button" className="record-quick-chip" onClick={(event) => handleEditMapPoint(point.id, event)}>
                            Editar
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
        <main className={`admin-layout ${["logs", "mapReports", "mapAnalytics", "requests"].includes(workspaceView) ? "admin-layout-logs" : ""}`}>
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

          <section className={`admin-content ${["logs", "mapReports", "mapAnalytics", "requests"].includes(workspaceView) ? "admin-content-logs" : ""}`}>
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
                    <div className="map-report-step-grid">
                      <article>
                        <span>1</span>
                        <div>
                          <strong>Selecciona jornada</strong>
                          <p>Los reportes quedan agrupados por fecha para no sobrescribir trabajos anteriores.</p>
                        </div>
                      </article>
                      <article>
                        <span>2</span>
                        <div>
                          <strong>Edita puntos</strong>
                          <p>Haz doble click en el mapa o usa la tabla para corregir coordenadas, tipo, color y pin final.</p>
                        </div>
                      </article>
                      <article>
                        <span>3</span>
                        <div>
                          <strong>Imprime o descarga</strong>
                          <p>El formato sale consolidado por zonas, con paginado y datos del personal de campo.</p>
                        </div>
                      </article>
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
                                    <th>Acciones</th>
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
                                      <td>
                                        <button
                                          type="button"
                                          className="record-quick-chip"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleEditReportMapPoint(point.id);
                                          }}
                                        >
                                          Editar
                                        </button>
                                      </td>
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
            ) : workspaceView === "mapAnalyticsLegacyDisabled" ? (
              <section className="preview-panel log-panel-full">
                <div className="log-shell">
                  <div className="log-hero">
                    <div className="admin-section-head">
                      <div>
                        <p className="sheet-kicker">Analitica de campo</p>
                        <h2><Icon name="dashboard" className="title-icon" />Estadisticas del levantamiento</h2>
                        <p className="workspace-title">
                          Vista separada del reporte institucional para revisar tendencias, distribucion por zonas y calidad de captura.
                        </p>
                      </div>
                      <span className="panel-pill">{formatMapDiaryLabel(activeMapDiaryDateKey)}</span>
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
                        <span>Tipos distintos</span>
                        <strong>{mapAnalyticsData.typeSeries.length}</strong>
                      </div>
                      <div className="log-summary-card">
                        <span>Contexto cercano</span>
                        <strong>{loadingMapContexts ? "Buscando" : "Listo"}</strong>
                      </div>
                    </div>
                  </div>
                  <article className="document-sheet log-sheet map-analytics-sheet">
                    <div className="map-report-office-head">
                      <div className="map-report-brand">
                        <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="brand-logo" />
                        <div>
                          <p className="sheet-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                          <h3>Centro estadistico de campo</h3>
                          <p className="helper-text">Graficos operativos y metricas de la jornada seleccionada, aparte del formato imprimible.</p>
                        </div>
                      </div>
                      <button type="button" className="button-secondary" onClick={() => setWorkspaceView("mapReports")}>
                        <Icon name="records" />
                        Ir al reporte institucional
                      </button>
                    </div>
                    <div className="map-analytics-grid">
                      <section className="document-block map-analytics-card">
                        <div className="lookup-card-head map-card-head">
                          <div>
                            <p className="sheet-kicker">Tendencia</p>
                            <h3>Jornadas recientes</h3>
                          </div>
                        </div>
                        <div className="map-analytics-bar-list">
                          {mapAnalyticsData.journeySeries.length ? (
                            mapAnalyticsData.journeySeries.map((item) => (
                              <div key={item.key} className="map-analytics-bar-row">
                                <div className="map-analytics-bar-copy">
                                  <strong>{item.label}</strong>
                                  <span>{item.total} puntos</span>
                                </div>
                                <div className="map-analytics-bar-track">
                                  <div
                                    className="map-analytics-bar-fill is-journey"
                                    style={{ width: `${(item.total / mapAnalyticsData.maxJourneyTotal) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">
                              <h3>Sin jornadas</h3>
                              <p>Cuando haya levantamientos, aqui veras la tendencia por dia.</p>
                            </div>
                          )}
                        </div>
                      </section>
                      <section className="document-block map-analytics-card">
                        <div className="lookup-card-head map-card-head">
                          <div>
                            <p className="sheet-kicker">Distribucion</p>
                            <h3>Tipos de punto</h3>
                          </div>
                        </div>
                        <div className="map-analytics-bar-list">
                          {mapAnalyticsData.typeSeries.length ? (
                            mapAnalyticsData.typeSeries.map((item) => (
                              <div key={item.label} className="map-analytics-bar-row">
                                <div className="map-analytics-bar-copy">
                                  <strong>{item.label}</strong>
                                  <span>{item.total}</span>
                                </div>
                                <div className="map-analytics-bar-track">
                                  <div
                                    className="map-analytics-bar-fill is-type"
                                    style={{ width: `${(item.total / mapAnalyticsData.maxTypeTotal) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">
                              <h3>Sin tipos</h3>
                              <p>Aun no hay puntos en la jornada seleccionada.</p>
                            </div>
                          )}
                        </div>
                      </section>
                      <section className="document-block map-analytics-card">
                        <div className="lookup-card-head map-card-head">
                          <div>
                            <p className="sheet-kicker">Zonas</p>
                            <h3>Mayor concentracion</h3>
                          </div>
                        </div>
                        <div className="map-analytics-bar-list">
                          {mapAnalyticsData.zoneSeries.length ? (
                            mapAnalyticsData.zoneSeries.map((item) => (
                              <div key={item.label} className="map-analytics-bar-row">
                                <div className="map-analytics-bar-copy">
                                  <strong>{item.label}</strong>
                                  <span>{item.total} puntos · prec. {item.accuracy ?? "--"} m</span>
                                </div>
                                <div className="map-analytics-bar-track">
                                  <div
                                    className="map-analytics-bar-fill is-zone"
                                    style={{ width: `${(item.total / mapAnalyticsData.maxZoneTotal) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">
                              <h3>Sin zonas</h3>
                              <p>No hay zonas consolidadas todavia para esta jornada.</p>
                            </div>
                          )}
                        </div>
                      </section>
                      <section className="document-block map-analytics-card">
                        <div className="lookup-card-head map-card-head">
                          <div>
                            <p className="sheet-kicker">Calidad</p>
                            <h3>Precision del levantamiento</h3>
                          </div>
                        </div>
                        <div className="map-analytics-bucket-grid">
                          {mapAnalyticsData.accuracyBuckets.map((bucket) => (
                            <div key={bucket.label} className={`map-analytics-bucket ${bucket.tone}`}>
                              <span>{bucket.label}</span>
                              <strong>{bucket.total}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
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
                        <h2><Icon name="dashboard" className="title-icon" />Menu de peticiones</h2>
                        <p className="workspace-title">
                          Prepara reportes desde el padron maestro con una sola vista de trabajo: eliges la plantilla, ajustas criterios y generas el listado listo para imprimir o exportar.
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
                    <div className="request-helper-strip">
                      <div className="request-helper-card">
                        <span className="sheet-kicker">Flujo rapido</span>
                        <strong>1. Plantilla  2. Ajuste  3. Generar</strong>
                        <p>Todo el trabajo queda concentrado aqui para que el operador no tenga que navegar a otros modulos.</p>
                      </div>
                      <div className="request-helper-card">
                        <span className="sheet-kicker">Ejemplos utiles</span>
                        <div className="request-example-list">
                          <span className="request-example-chip">apart, apto, aptos</span>
                          <span className="request-example-chip">barrio:centro</span>
                          <span className="request-example-chip">abonado:12345</span>
                          <span className="request-example-chip">-hotel</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <article className="document-sheet log-sheet request-sheet">
                    <div className="map-report-office-head request-office-head">
                      <div className="map-report-brand">
                        <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="brand-logo" />
                        <div>
                          <p className="sheet-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                          <h3>Constructor de peticiones</h3>
                          <p className="helper-text">Diseñado para abrir, configurar y entregar solicitudes desde un unico espacio.</p>
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
                          Usa comas para separar criterios. La plantilla base esta orientada a apartamentos, pero puedes ajustarla para cualquier otra peticion.
                        </p>
                        <p className="helper-text">
                          Tambien puedes usar filtros avanzados como <strong>barrio:centro</strong>, <strong>clave:001-02</strong>, <strong>abonado:12345</strong> o excluir con <strong>-hotel</strong>.
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
                            <p className="sheet-kicker">Vista previa</p>
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
                        <div className="request-criteria-panel">
                          <div className="request-criteria-group">
                            <span>Criterios incluidos</span>
                            <div className="request-example-list">
                              {(padronRequestResult?.request?.criteria?.include || padronRequestResult?.request?.keywords || []).length ? (
                                (padronRequestResult?.request?.criteria?.include || padronRequestResult?.request?.keywords || []).map((item) => (
                                  <span key={`include-${item}`} className="request-example-chip is-include">{item}</span>
                                ))
                              ) : (
                                <span className="request-example-chip is-empty">Sin criterios todavia</span>
                              )}
                            </div>
                          </div>
                          {(padronRequestResult?.request?.criteria?.exclude || []).length ? (
                            <div className="request-criteria-group">
                              <span>Criterios excluidos</span>
                              <div className="request-example-list">
                                {padronRequestResult.request.criteria.exclude.map((item) => (
                                  <span key={`exclude-${item}`} className="request-example-chip is-exclude">{item}</span>
                                ))}
                              </div>
                            </div>
                          ) : null}
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
