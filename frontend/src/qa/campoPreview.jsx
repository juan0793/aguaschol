import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import AppHeader from "../app/AppHeader";
import FieldMapWorkspace from "../modules/campo/FieldMapWorkspace";
import "../styles.css";

// Banco de pruebas de "Puntos GPS" (Mapa de campo). Datos de mentira con la
// forma real de /map-points: una jornada de hoy y tres anteriores.
// ?estado=vacio muestra la jornada sin puntos; ?estado=editando abre la edición.
// Las teselas del mapa vienen del backend; sin backend el mapa queda gris.

const params = new URLSearchParams(window.location.search);
const state = params.get("estado");

const TYPES = ["caja_registro", "caja_registro", "descarga", "pozo", "negocio_local_comercial", "alerta", "punto_observado"];
const COLORS = { negocio_local_comercial: "#ef4444", alerta: "#f59e0b" };
const REFERENCES = [
  "Frente a poste de luz, esquina noroeste",
  "Casa verde de dos plantas, portón negro",
  "",
  "Junto a la pulpería La Esperanza",
  "Taller mecánico, entrada lateral",
  "Tapadera quebrada, riesgo para peatones",
  "Frente a la iglesia, acera sur"
];
const DESCRIPTIONS = [
  "Caja de registro con descarga a colector principal. Clave 10-07-01-01.",
  "Caja sin tapadera, conexión de 4 pulgadas.",
  "Descarga directa a cuneta, clave 22095.",
  "Pozo de visita con sedimento acumulado.",
  "Local con dos baños y lavado de vehículos.",
  "Rebalse visible después de la lluvia.",
  ""
];

const makePoints = (dateKey, count, offset) => Array.from({ length: count }, (_, index) => {
  const type = TYPES[(index + offset) % TYPES.length];
  return {
    id: 4800 + offset * 50 + index,
    point_type: type,
    latitude: 13.3017 + ((index * 37 + offset * 11) % 40 - 20) / 2200,
    longitude: -87.1889 + ((index * 53 + offset * 7) % 40 - 20) / 2200,
    accuracy_meters: index % 5 === 3 ? null : 3 + (index % 4) * 2,
    reference_note: REFERENCES[(index + offset) % REFERENCES.length],
    description: DESCRIPTIONS[(index + offset) % DESCRIPTIONS.length],
    housing_units: 1 + (index % 3),
    marker_color: COLORS[type] || "#1576d1",
    created_at: `${dateKey}T${String(8 + (index % 9)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}:00-06:00`,
    is_terminal_point: index === count - 1
  };
});

const diary = state === "vacio"
  ? [
      { key: "2026-09-28", points: [] },
      { key: "2026-08-31", points: makePoints("2026-08-31", 14, 1) }
    ]
  : [
      { key: "2026-09-28", points: makePoints("2026-09-28", 9, 0) },
      { key: "2026-08-31", points: makePoints("2026-08-31", 14, 1) },
      { key: "2026-08-27", points: makePoints("2026-08-27", 1, 2) },
      { key: "2026-08-13", points: makePoints("2026-08-13", 6, 3) },
      ...Array.from({ length: 6 }, (_, index) => ({ key: `2026-07-${String(10 + index).padStart(2, "0")}`, points: makePoints("2026-07-10", 3, 4 + index) }))
    ];

const emptyDraft = { latitude: "", longitude: "", accuracy_meters: "", point_type: "caja_registro", reference: "", description: "", housing_units: 1 };
const noop = () => {};

function Preview() {
  const [dateKey, setDateKey] = useState(diary[0].key);
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedId, setSelectedId] = useState(state === "editando" ? diary[0].points[0]?.id : null);
  const [editingId, setEditingId] = useState(state === "editando" ? diary[0].points[0]?.id : null);
  const [limit, setLimit] = useState(6);
  const [mapStatus, setMapStatus] = useState("Sincronizado");

  const groups = diary.map((group) => ({ key: group.key, total: group.points.length }));
  const visible = diary.find((group) => group.key === dateKey)?.points || [];
  const selected = visible.find((point) => point.id === selectedId) || null;

  const fieldModel = {
    activeMapDiaryDateKey: dateKey,
    adjustMapDraftHousingUnits: (delta) => setDraft((current) => ({ ...current, housing_units: Math.max(1, Number(current.housing_units || 1) + delta) })),
    archivedMapDiaryGroups: groups.slice(4),
    editingMapPointId: editingId,
    handleCopyCoordinates: noop,
    handleDeleteMapPoint: noop,
    handleDownloadMapReport: noop,
    handleEditMapPoint: (id) => { setEditingId(id); setSelectedId(id); },
    handleLocateUser: () => setDraft((current) => ({ ...current, latitude: "13.301742", longitude: "-87.188915", accuracy_meters: "6" })),
    handleMapDraftChange: (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value })),
    handleMapDraftFromMap: (next) => setDraft((current) => ({ ...current, ...next })),
    handleOpenPointInMaps: noop,
    handleSaveMapPoint: (event) => event.preventDefault(),
    handleSelectMapPoint: setSelectedId,
    hiddenCanvasPointCount: 0,
    hiddenMapPointCount: Math.max(0, visible.length - limit),
    isAdmin: true,
    listedMapPoints: visible.slice(0, limit),
    loadingMapPoints: false,
    locatingUser: false,
    mapDescriptionLookupStatus: "",
    mapDiaryGroups: groups,
    mapDraft: draft,
    mapFocusRequest: null,
    mapLocationHelp: "",
    mapPointsForCanvas: visible,
    mapStatus,
    openMapDiaryArchiveModal: noop,
    primaryMapDiaryGroups: groups.slice(0, 4),
    resetMapDraft: () => { setDraft(emptyDraft); setEditingId(null); },
    savingMapPoint: false,
    selectedMapPoint: selected,
    selectedMapPointId: selectedId,
    setMapDiaryDateKey: setDateKey,
    setMapPointListLimit: setLimit,
    setMapStatus,
    setShowMapPrintDialog: noop,
    showMapPrintDialog: false,
    visibleMapPoints: visible,
    workspaceView: "map"
  };

  const headerModel = useMemo(() => new Proxy({
    ...fieldModel,
    apiFetch: async () => ({ ok: true, json: async () => ({ items: [], notifications: [], unread: 0 }) }),
    headerMeta: { title: "Mapa de campo", cardClass: "search-card-records", kicker: "Trabajo en sitio" },
    headerStats: [
      { label: "Puntos guardados", value: visible.length },
      { label: "Geolocalización", value: mapStatus },
      { label: "Selección", value: selected ? `#${selected.id}` : "Sin punto" }
    ],
    session: { user: { username: "admin", full_name: "admin", role: "admin" } },
    isDirty: false,
    unreadMessagesCount: 0
  }, {
    get: (target, key) => {
      if (key in target) return target[key];
      if (typeof key !== "string") return undefined;
      if (/^(set|handle|load|reset|open)/.test(key)) return noop;
      if (/^(show|loading|uploading|is|cargando)/.test(key)) return false;
      return [];
    }
  }), [fieldModel, visible.length, mapStatus, selected]);

  return (
    <div className="page-shell sidebar-collapsed">
      <AppHeader model={headerModel} />
      <FieldMapWorkspace model={fieldModel} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>
);
