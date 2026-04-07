import { useEffect, useMemo, useRef, useState } from "react";
import logoAguasCholuteca from "./assets/logo-aguas-choluteca.png";

const rawApiBase = (import.meta.env.VITE_API_URL?.trim() || "").replace(/\/$/, "");
const API_URL = (rawApiBase ? (rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`) : "/api").replace(/\/$/, "");
const FILES_URL = (import.meta.env.VITE_FILES_URL?.trim() || rawApiBase).replace(/\/$/, "");
const AUTH_STORAGE_KEY = "aguaschol-auth";
const DRAFT_STORAGE_KEY = "aguaschol-draft";
const MAP_POINT_TYPES = [
  { value: "caja_registro", label: "Caja de registro" },
  { value: "descarga", label: "Descarga" },
  { value: "pozo", label: "Pozo de visita" },
  { value: "punto_observado", label: "Punto observado" }
];
const emptyMapDraft = {
  latitude: "",
  longitude: "",
  accuracy_meters: "",
  point_type: "caja_registro",
  description: "",
  reference: ""
};
const MAP_BASEMAPS = [
  {
    label: "CARTO claro",
    tiles: [
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
    ],
    attribution: "OpenStreetMap contributors | CARTO"
  },
  {
    label: "OpenStreetMap",
    tiles: [
      "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
    ],
    attribution: "OpenStreetMap contributors"
  },
  {
    label: "OpenStreetMap HOT",
    tiles: [
      "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      "https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      "https://c.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
    ],
    attribution: "OpenStreetMap contributors | HOT"
  }
];
const buildMapStyle = (basemapIndex = 0) => ({
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: [`${API_URL}/map-tiles/{z}/{x}/{y}.png`],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap"
    }
  ]
});
let mapLibraryPromise;

const loadMapLibrary = async () => {
  if (!mapLibraryPromise) {
    mapLibraryPromise = Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(
      ([library]) => library.default
    );
  }

  return mapLibraryPromise;
};

const emptyForm = {
  id: null,
  clave_catastral: "",
  abonado: "",
  nombre_catastral: "",
  inquilino: "",
  barrio_colonia: "",
  identidad: "",
  telefono: "",
  accion_inspeccion: "",
  situacion_inmueble: "Habitado",
  tendencia_inmueble: "",
  uso_suelo: "Residencial",
  actividad: "Vivienda",
  codigo_sector: "",
  comentarios: "Clandestino",
  conexion_agua: "Si",
  conexion_alcantarillado: "Si",
  recoleccion_desechos: "Si",
  foto_path: "",
  fecha_aviso: new Date().toISOString().slice(0, 10),
  firmante_aviso: "Maria Eugenia Berrios",
  cargo_firmante: "Jefe de Facturacion",
  levantamiento_datos: "LUIS FERNANDO HERRERA SOLIZ",
  analista_datos: "Ing. Juan Ordoñez Bonilla"
};

const fieldGroups = [
  [
    { key: "abonado", label: "Abonado" },
    { key: "nombre_catastral", label: "Catastral" },
    { key: "inquilino", label: "Inquilino" }
  ],
  [
    { key: "barrio_colonia", label: "Barrio/Colonia/Lotificacion" },
    { key: "identidad", label: "No. de Identidad" },
    { key: "telefono", label: "Telefono/Celular" }
  ],
  [
    { key: "situacion_inmueble", label: "Situacion del inmueble" },
    { key: "tendencia_inmueble", label: "Tendencia del inmueble" },
    { key: "uso_suelo", label: "Uso del suelo" }
  ],
  [
    { key: "actividad", label: "Actividad" },
    { key: "codigo_sector", label: "Codigo del sector" },
    { key: "comentarios", label: "Comentarios" }
  ],
  [
    { key: "conexion_agua", label: "Conexion de agua potable" },
    { key: "conexion_alcantarillado", label: "Conexion alcantarillado" },
    { key: "recoleccion_desechos", label: "Recoleccion de desechos" }
  ]
];

const sectionDefinitions = [
  { key: "abonado", label: "Abonado", mobileLabel: "Datos" },
  { key: "inmueble", label: "Inmueble", mobileLabel: "Inmueble" },
  { key: "servicios", label: "Servicios", mobileLabel: "Servicios" },
  { key: "aviso", label: "Aviso y Foto", mobileLabel: "Aviso" }
];

const hasDraftContent = (candidate) =>
  Object.entries(emptyForm).some(([key, defaultValue]) => {
    if (["id", "foto_path"].includes(key)) return false;
    return (candidate?.[key] ?? "") !== defaultValue;
  });

const normalizeDateField = (value) => {
  if (!value) return "";
  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
};

const normalizeRecord = (record) => ({
  ...record,
  fecha_aviso: normalizeDateField(record?.fecha_aviso),
  archived_at: record?.archived_at ?? null,
  archived_reason: record?.archived_reason ?? ""
});

const buildPhotoUrl = (photoPath = "", version = "") => {
  if (!photoPath) return "";

  const separator = photoPath.includes("?") ? "&" : "?";
  const versionSuffix = version ? `${separator}v=${encodeURIComponent(version)}` : "";

  if (/^https?:\/\//i.test(photoPath)) {
    return `${photoPath}${versionSuffix}`;
  }

  return `${FILES_URL}${photoPath}${versionSuffix}`;
};

const formatClaveInput = (value = "") => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const groups = [];

  for (let index = 0; index < digits.length; index += 2) {
    groups.push(digits.slice(index, index + 2));
  }

  return groups.join("-");
};

const isLookupKeyComplete = (value = "") => {
  const parts = value.split("-").filter(Boolean);
  return [3, 4].includes(parts.length) && parts.every((part) => /^\d{2}$/.test(part));
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

const formatLookupAmount = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "--";
  return formatCurrency(numeric);
};

const getLookupTotalMeta = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return {
      text: "--",
      helper: "Sin referencia",
      tone: "",
      icon: "activity"
    };
  }

  if (numeric === 0) {
    return {
      text: "Sin saldo",
      helper: "Cuenta al dia",
      tone: "is-zero",
      icon: "success"
    };
  }

  if (numeric < 0) {
    return {
      text: formatCurrency(Math.abs(numeric)),
      helper: "Pago adelantado",
      tone: "is-credit",
      icon: "refresh"
    };
  }

  return {
    text: formatCurrency(numeric),
    helper: "Saldo pendiente",
    tone: "is-debt",
    icon: "activity"
  };
};

const roleLabel = (role) => (role === "admin" ? "Administrador" : "Operador");
const formatCoordinate = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : "--";
};
const buildExternalMapUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;

const getMapPointTypeLabel = (value) =>
  MAP_POINT_TYPES.find((option) => option.value === value)?.label ?? "Punto de campo";

const actionLabel = (action) =>
  (
    {
      "auth.login": "Inicio de sesion",
      "auth.logout": "Cierre de sesion",
      "auth.password_changed": "Contrasena actualizada",
      "user.created": "Usuario creado",
      "padron.updated": "Padron actualizado",
      "map_point.created": "Punto de campo creado",
      "map_point.deleted": "Punto de campo eliminado",
      "inmueble.created": "Ficha creada",
      "inmueble.updated": "Ficha actualizada",
      "inmueble.archived": "Ficha archivada",
      "inmueble.deleted": "Ficha eliminada",
      "inmueble.restored": "Ficha restaurada",
      "inmueble.photo_attached": "Fotografia cargada"
    }[action] ?? action
  );

const iconPaths = {
  records:
    "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z M8 8h8M8 12h8M8 16h5",
  users:
    "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m0 2c-3.8 0-7 2.1-7 4.7V20h14v-1.3C19 16.1 15.8 14 12 14",
  logs:
    "M7 5.5h10M7 10.5h10M7 15.5h6M6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3",
  refresh:
    "M19 6v5h-5M5 18v-5h5M18 11a6.5 6.5 0 0 0-11-3.8L5 11M6 13a6.5 6.5 0 0 0 11 3.8L19 13",
  logout:
    "M14 7V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5a2.5 2.5 0 0 0 2.5-2.5V17M10 12h10m0 0-3-3m3 3-3 3",
  search:
    "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14m9 3-4.2-4.2",
  map:
    "M12 21s7-4.4 7-10a7 7 0 1 0-14 0c0 5.6 7 10 7 10m0-7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5",
  copy:
    "M9 9h9v11H9zM6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1",
  plus:
    "M12 5v14M5 12h14",
  archive:
    "M4 7.5h16M9 12l3 3 3-3M12 15V8M6.5 4h11A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4",
  history:
    "M12 7v5l3 2M12 22a10 10 0 1 1 10-10A10 10 0 0 1 12 22",
  activity:
    "M4 13h3l2-5 3 10 2-5h4",
  success:
    "M20 6 9 17l-5-5",
  userCreated:
    "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m7.5 6.5L21 20l-2.5 2.5-2-2M5 20v-1.3C5 16.1 8.2 14 12 14c1.3 0 2.6.2 3.7.6",
  auth:
    "M12 3l7 4v5c0 4.3-2.9 8.2-7 9-4.1-.8-7-4.7-7-9V7z"
};

const Icon = ({ name, className = "" }) => (
  <span className={`app-icon ${className}`.trim()} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={iconPaths[name] || iconPaths.records} />
    </svg>
  </span>
);

const actionIconName = (action) =>
  (
    {
      "auth.login": "auth",
      "auth.logout": "logout",
      "auth.password_changed": "success",
      "user.created": "userCreated",
      "padron.updated": "refresh",
      "map_point.created": "map",
      "map_point.deleted": "archive",
      "inmueble.created": "plus",
      "inmueble.updated": "records",
      "inmueble.archived": "archive",
      "inmueble.deleted": "logout",
      "inmueble.restored": "refresh",
      "inmueble.photo_attached": "activity"
    }[action] ?? "activity"
  );

const getRecordGroupDate = (record, recordView) =>
  recordView === "archived"
    ? record?.archived_at || record?.updated_at || record?.created_at
    : record?.updated_at || record?.created_at || record?.fecha_aviso;

const formatMonthGroup = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-HN", {
    month: "long",
    year: "numeric"
  }).format(date);
};

const comparableFormShape = (candidate = {}) => ({
  clave_catastral: candidate.clave_catastral ?? "",
  abonado: candidate.abonado ?? "",
  nombre_catastral: candidate.nombre_catastral ?? "",
  inquilino: candidate.inquilino ?? "",
  barrio_colonia: candidate.barrio_colonia ?? "",
  identidad: candidate.identidad ?? "",
  telefono: candidate.telefono ?? "",
  accion_inspeccion: candidate.accion_inspeccion ?? "",
  situacion_inmueble: candidate.situacion_inmueble ?? "",
  tendencia_inmueble: candidate.tendencia_inmueble ?? "",
  uso_suelo: candidate.uso_suelo ?? "",
  actividad: candidate.actividad ?? "",
  codigo_sector: candidate.codigo_sector ?? "",
  comentarios: candidate.comentarios ?? "",
  conexion_agua: candidate.conexion_agua ?? "",
  conexion_alcantarillado: candidate.conexion_alcantarillado ?? "",
  recoleccion_desechos: candidate.recoleccion_desechos ?? "",
  fecha_aviso: normalizeDateField(candidate.fecha_aviso ?? ""),
  firmante_aviso: candidate.firmante_aviso ?? "",
  cargo_firmante: candidate.cargo_firmante ?? "",
  levantamiento_datos: candidate.levantamiento_datos ?? "",
  analista_datos: candidate.analista_datos ?? ""
});

const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const printDocument = async (title, bodyMarkup, options = {}) => {
  const {
    pageSize = "Letter portrait",
    pageMargin = "10mm",
    windowFeatures = "width=980,height=1200",
    bodyClassName = ""
  } = options;
  const printWindow = window.open("", "_blank", windowFeatures);

  if (!printWindow) {
    window.alert("No fue posible abrir la ventana de impresion.");
    return;
  }

  printWindow.document.write(`
    <html lang="es">
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${pageSize};
            margin: ${pageMargin};
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            color: #111;
            line-height: 1.2;
            font-size: 11px;
          }
          h1, h2, h3, p { margin: 0 0 6px; }
          .print-header { text-align: center; margin-bottom: 8px; }
          .print-logo {
            width: 62px;
            height: 62px;
            object-fit: contain;
            display: block;
            margin: 0 auto 6px;
          }
          .print-title { text-transform: uppercase; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
          .print-key {
            display: inline-block;
            border: 1px solid #666;
            padding: 4px 10px;
            margin-top: 4px;
            font-weight: 700;
          }
          .print-section {
            border: 1px solid #777;
            padding: 7px;
            margin-bottom: 7px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-section h3 {
            font-size: 11px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .print-field {
            border-bottom: 1px solid #bbb;
            padding-bottom: 3px;
            min-height: 24px;
          }
          .print-field strong {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .print-photo {
            margin-top: 8px;
            width: 100%;
            max-height: 190px;
            object-fit: contain;
            object-position: center;
            border: 1px solid #999;
            border-radius: 8px;
            background: #fff;
          }
          .print-roles {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 28px;
            text-align: center;
          }
          .print-signature-line {
            border-top: 1px solid #444;
            padding-top: 14px;
            min-height: 72px;
          }
          .print-signature-line strong {
            font-size: 10px;
            display: block;
            margin-bottom: 10px;
          }
          .print-ficha {
            max-width: 100%;
            padding-left: 4mm;
          }
          .print-ficha p {
            margin-bottom: 3px;
          }
          .print-ficha .print-header {
            margin-bottom: 6px;
          }
          .print-ficha .print-logo {
            width: 48px;
            height: 48px;
            margin-bottom: 4px;
          }
          .print-ficha .print-title {
            font-size: 12px;
            margin-bottom: 2px;
          }
          .print-ficha .print-key {
            padding: 3px 8px;
            margin-top: 2px;
            font-size: 10px;
          }
          .print-ficha .print-section {
            padding: 5px;
            margin-bottom: 5px;
          }
          .print-ficha .print-layout {
            display: grid;
            gap: 6px;
          }
          .print-ficha .print-top-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.45fr) minmax(250px, 0.95fr);
            gap: 8px;
            align-items: start;
          }
          .print-ficha .print-main-column,
          .print-ficha .print-side-column {
            display: grid;
            gap: 5px;
          }
          .print-ficha .print-section h3 {
            font-size: 10px;
            margin-bottom: 4px;
          }
          .print-ficha .print-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4px 8px;
          }
          .print-ficha .print-field {
            min-height: 18px;
            padding-bottom: 2px;
            font-size: 10px;
          }
          .print-ficha .print-field strong {
            font-size: 8px;
            margin-bottom: 1px;
          }
          .print-ficha .print-photo {
            margin-top: 0;
            height: 205px;
            max-height: 205px;
          }
          .print-ficha .print-photo-panel {
            display: grid;
            gap: 5px;
          }
          .print-ficha .print-photo-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 0;
          }
          .print-ficha .print-roles {
            gap: 12px;
            margin-top: 6px;
          }
          .print-ficha .print-signature-line {
            min-height: 74px;
            padding-top: 14px;
          }
          .print-ficha .print-signature-line strong {
            margin-bottom: 10px;
            line-height: 1.25;
          }
          .aviso {
            max-width: 720px;
            margin: 0 auto;
            padding: 12px 6px;
          }
          .aviso-header, .aviso-title, .aviso-signature, .aviso-copy {
            text-align: center;
          }
          .aviso-header p, .aviso-title, .aviso-copy {
            margin-bottom: 12px;
          }
          .aviso-date, .aviso-saludo {
            text-align: left;
            margin-bottom: 14px;
          }
          .aviso-body, .aviso-list li {
            text-align: justify;
            line-height: 1.45;
          }
          .aviso-list {
            margin: 6px 0 16px 22px;
          }
          .aviso-signature {
            margin-top: 34px;
          }
          .aviso-signature p {
            margin-bottom: 8px;
          }
          ul { margin-top: 0; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body class="${bodyClassName}">${bodyMarkup}</body>
    </html>
      `);
  printWindow.document.close();

  const images = Array.from(printWindow.document.images);
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );

  printWindow.focus();
  printWindow.print();
};

const formatSpanishDate = (value) => {
  if (!value) return "--";
  const normalized = normalizeDateField(value);
  if (!normalized) return "--";
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No fue posible leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No fue posible procesar la imagen seleccionada."));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No fue posible optimizar la fotografia."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });

const optimizeImageForUpload = async (file) => {
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return file;
  }

  const sourceImage = await loadImageFromFile(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(sourceImage.width, sourceImage.height));
  const width = Math.max(1, Math.round(sourceImage.width * scale));
  const height = Math.max(1, Math.round(sourceImage.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(sourceImage, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const optimizedBlob = await canvasToBlob(canvas, outputType, outputType === "image/png" ? undefined : 0.78);

  if (optimizedBlob.size >= file.size) {
    return file;
  }

  const extension = outputType === "image/png" ? ".png" : ".jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "fotografia";

  return new File([optimizedBlob], `${baseName}${extension}`, {
    type: outputType,
    lastModified: Date.now()
  });
};

const urlToDataUrl = async (url) => {
  const response = await fetch(url, { cache: "no-store" });
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No fue posible preparar la imagen para impresion."));
    reader.readAsDataURL(blob);
  });
};

function App() {
  const sheetRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapLibRef = useRef(null);
  const mapRef = useRef(null);
  const mapMarkersRef = useRef([]);
  const mapDraftMarkerRef = useRef(null);
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
  const [search, setSearch] = useState("");
  const [emptyRecordsMessage, setEmptyRecordsMessage] = useState("Cargando registros...");
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingRecordHistory, setLoadingRecordHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [avisoHtml, setAvisoHtml] = useState("");
  const [loadingAviso, setLoadingAviso] = useState(false);
  const [activeSection, setActiveSection] = useState("abonado");
  const [recordView, setRecordView] = useState("active");
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [workspaceView, setWorkspaceView] = useState("records");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupFeedback, setLookupFeedback] = useState("");
  const [mapPoints, setMapPoints] = useState([]);
  const [loadingMapPoints, setLoadingMapPoints] = useState(false);
  const [savingMapPoint, setSavingMapPoint] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [selectedMapPointId, setSelectedMapPointId] = useState(null);
  const [mapStatus, setMapStatus] = useState("Sincronizado");
  const [mapDraft, setMapDraft] = useState(emptyMapDraft);
  const [padronMeta, setPadronMeta] = useState(null);
  const [padronImportSummary, setPadronImportSummary] = useState(null);
  const [padronFile, setPadronFile] = useState(null);
  const [uploadingPadron, setUploadingPadron] = useState(false);
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
  const isAuthenticated = Boolean(session?.token);
  const isAdmin = session?.user?.role === "admin";
  const mustChangePassword = Boolean(session?.user?.force_password_change);
  const passwordModalVisible = isAuthenticated && (mustChangePassword || showPasswordModal);
  const safeRecords = Array.isArray(records) ? records : [];
  const safeMapPoints = Array.isArray(mapPoints) ? mapPoints : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const selectedMapPoint = safeMapPoints.find((point) => point.id === selectedMapPointId) ?? null;
  const selectedUser =
    safeUsers.find((user) => user.id === selectedUserId) ?? latestUserResult?.user ?? safeUsers[0] ?? null;
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
          value: String(safeMapPoints.length)
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
    mapStatus,
    padronMeta,
    safeMapPoints.length,
    safeRecords.length,
    selectedMapPoint,
    uploadingPadron,
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
  const visibleRecordGroups = useMemo(() => {
    const visibleLimit = draftForm ? 9 : 10;
    const limitedRecords = safeRecords.slice(0, Math.max(visibleLimit, 0));
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
  }, [draftForm, safeRecords, recordView]);

  const showAlert = (text) => {
    if (!text) return;
    setAlert({ text, id: Date.now() });
  };

  const clearSession = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
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
    setLookupQuery("");
    setLookupResult(null);
    setLookupFeedback("");
    setMapPoints([]);
    setSelectedMapPointId(null);
    setMapStatus("Sincronizado");
    setMapDraft(emptyMapDraft);
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

  const loadUsers = async () => {
    if (!isAuthenticated || !isAdmin) return;
    setLoadingUsers(true);

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
      setUsers([]);
      setSelectedUserId(null);
      showAlert(error.message || "No fue posible cargar los usuarios.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadPadronMeta = async () => {
    if (!isAuthenticated || !isAdmin) return;
    setLoadingPadronMeta(true);

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
      showAlert(error.message || "No fue posible cargar la informacion del padron.");
    } finally {
      setLoadingPadronMeta(false);
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
      setSelectedMapPointId((current) =>
        nextPoints.some((point) => point.id === current) ? current : nextPoints[0]?.id ?? null
      );
      setMapStatus("Sincronizado");
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

  const loadAuditLogs = async () => {
    if (!isAuthenticated || !isAdmin) return;
    setLoadingLogs(true);

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
      showAlert(error.message || "No fue posible cargar el historial.");
    } finally {
      setLoadingLogs(false);
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

    if (workspaceView === "logs") {
      loadAuditLogs();
    }
  }, [auditFilters, isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (isAuthenticated && workspaceView === "map") {
      loadMapPoints();
    }
  }, [isAuthenticated, workspaceView]);

  useEffect(() => {
    if (isAuthenticated && !isAdmin && !["records", "lookup", "map"].includes(workspaceView)) {
      setWorkspaceView("records");
    }
  }, [isAuthenticated, isAdmin, workspaceView]);

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

    if (!isLookupKeyComplete(lookupQuery)) {
      setLookupResult(null);
      setLookupFeedback("Completa la clave en formato 00-00-00 o 00-00-00-00.");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      handleLookupSearch();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, lookupQuery, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "map" || !mapContainerRef.current) {
      return undefined;
    }

    let cancelled = false;

    loadMapLibrary().then((maplibregl) => {
      if (cancelled || mapRef.current) {
        return;
      }

      mapLibRef.current = maplibregl;
      const map = maplibregl.map(mapContainerRef.current, {
        center: [13.3017, -87.1889],
        zoom: 14,
        zoomControl: true
      });

      const tileLayer = maplibregl.tileLayer(`${API_URL}/map-tiles/{z}/{x}/{y}.png`, {
        attribution: "OpenStreetMap contributors",
        maxZoom: 19
      });

      tileLayer.on("tileerror", () => {
        setMapStatus("Mapa sin capa base");
      });

      tileLayer.addTo(map);

      map.on("click", (event) => {
        setMapDraft((current) => ({
          ...current,
          latitude: Number(event.latlng.lat).toFixed(6),
          longitude: Number(event.latlng.lng).toFixed(6),
          accuracy_meters: current.accuracy_meters || ""
        }));
      });

      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);
    });

    const resizeTimer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
    };
  }, [workspaceView]);

  useEffect(() => {
    if (!mapRef.current || !mapLibRef.current) {
      return;
    }

    mapMarkersRef.current.forEach((marker) => marker.remove());
    mapMarkersRef.current = safeMapPoints.map((point) => {
      const marker = mapLibRef.current.circleMarker([Number(point.latitude), Number(point.longitude)], {
        radius: point.id === selectedMapPointId ? 10 : 8,
        color: "#ffffff",
        weight: 2,
        fillColor: point.id === selectedMapPointId ? "#25c7f0" : "#1576d1",
        fillOpacity: 0.95
      });

      marker.on("click", () => {
        setSelectedMapPointId(point.id);
      });

      marker.addTo(mapRef.current);
      return marker;
    });
  }, [safeMapPoints, selectedMapPointId]);

  useEffect(() => {
    if (!mapRef.current || !mapLibRef.current) {
      return;
    }

    const latitude = Number(mapDraft.latitude);
    const longitude = Number(mapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      mapDraftMarkerRef.current?.remove();
      mapDraftMarkerRef.current = null;
      return;
    }

    if (!mapDraftMarkerRef.current) {
      mapDraftMarkerRef.current = mapLibRef.current.circleMarker([latitude, longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: "#f8b043",
        fillOpacity: 0.95
      }).addTo(mapRef.current);
    } else {
      mapDraftMarkerRef.current.setLatLng([latitude, longitude]);
    }
  }, [mapDraft.latitude, mapDraft.longitude]);

  useEffect(() => {
    if (!mapRef.current || !selectedMapPoint) {
      return;
    }

    mapRef.current.flyTo([Number(selectedMapPoint.latitude), Number(selectedMapPoint.longitude)], Math.max(mapRef.current.getZoom(), 16), {
      duration: 0.7
    });
  }, [selectedMapPoint]);

  useEffect(() => {
    if (form.id || !hasDraftContent(form)) {
      return;
    }

    const nextDraft = { ...emptyForm, ...form, id: null };
    setDraftForm(nextDraft);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
    setDraftSavedAt(new Date().toISOString());
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
    const nextValue = formatClaveInput(event.target.value);
    setLookupQuery(nextValue);
    setLookupFeedback("");

    if (!nextValue.trim()) {
      setLookupResult(null);
    }
  };

  const handleLookupSearch = async (event) => {
    if (event) {
      event.preventDefault();
    }

    const normalizedLookupQuery = lookupQuery.trim();

    if (!normalizedLookupQuery) {
      setLookupResult(null);
      setLookupFeedback("Ingresa una clave catastral para consultar.");
      return;
    }

    if (!isLookupKeyComplete(normalizedLookupQuery)) {
      setLookupResult(null);
      setLookupFeedback("La clave debe tener formato 00-00-00 o 00-00-00-00.");
      return;
    }

    setLookupLoading(true);
    setLookupFeedback("");

    try {
      const response = await apiFetch(`/claves/search?clave=${encodeURIComponent(normalizedLookupQuery)}`);
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
    } catch (error) {
      setLookupResult(null);
      setLookupFeedback(error.message || "No fue posible consultar la clave.");
    } finally {
      setLookupLoading(false);
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

        if (mapRef.current) {
          mapRef.current.easeTo({
            center: [Number(nextDraft.longitude), Number(nextDraft.latitude)],
            zoom: 17,
            duration: 800
          });
        }
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
      setSelectedMapPointId(data.id);
      setMapStatus("Punto guardado");
      showAlert("Punto de campo guardado correctamente.");
      resetMapDraft();
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el punto.");
    } finally {
      setSavingMapPoint(false);
    }
  };

  const handleDownloadMapReport = async () => {
    try {
      const response = await apiFetch("/map-points/export");

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

  const resetForm = () => {
    setSelectedRecordId(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setAvisoHtml("");
    setActiveSection("abonado");
    focusSheet();
  };

  const restoreDraft = () => {
    if (!draftForm) {
      showAlert("No hay borrador pendiente.");
      return;
    }

    setSelectedRecordId(null);
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
      setWorkspaceView("records");
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

      applyRecord(updated);
      setDraftForm(null);
      setDraftSavedAt(null);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      setEmptyRecordsMessage("");
      loadRecords(search);
    } catch (error) {
      showAlert(error.message);
    } finally {
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
              <h2>Iniciar sesion</h2>
              <p className="lead">Ingresa con tu usuario o correo para continuar.</p>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              <label>
                <span>Usuario o correo</span>
                <input
                  name="username"
                  value={loginForm.username}
                  onChange={handleLoginChange}
                  autoComplete="username"
                />
              </label>
              <label>
                <span>Contrasena</span>
                <input
                  name="password"
                  type="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  autoComplete="current-password"
                />
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
      <header className="hero no-print">
        <div className={`hero-panel ${headerMeta.panelClass}`}>
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
          <div className="hero-strip">
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
            <label htmlFor="search">Espacios de trabajo</label>
            <span className="search-card-kicker">{headerMeta.kicker}</span>
          </div>
          <div className="session-chip">
            <Icon name="auth" />
            <span>Usuario actual: {session?.user?.full_name || session?.user?.username || "--"}</span>
          </div>
          <div className="workspace-nav">
            <button
              type="button"
              className={workspaceView === "records" ? "button-secondary active-filter" : "button-secondary"}
              onClick={() => setWorkspaceView("records")}
            >
              <Icon name="records" />
              Fichas
            </button>
            <button
              type="button"
              className={workspaceView === "lookup" ? "button-secondary active-filter" : "button-secondary"}
              onClick={() => setWorkspaceView("lookup")}
            >
              <Icon name="search" />
              Buscar clave
            </button>
            <button
              type="button"
              className={workspaceView === "map" ? "button-secondary active-filter" : "button-secondary"}
              onClick={() => setWorkspaceView("map")}
            >
              <Icon name="map" />
              Mapa de campo
            </button>
            {isAdmin ? (
              <button
                type="button"
                className={workspaceView === "padron" ? "button-secondary active-filter" : "button-secondary"}
                onClick={() => setWorkspaceView("padron")}
              >
                <Icon name="refresh" />
                Padron
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                className={workspaceView === "users" ? "button-secondary active-filter" : "button-secondary"}
                onClick={() => setWorkspaceView("users")}
              >
                <Icon name="users" />
                Usuarios
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                className={workspaceView === "logs" ? "button-secondary active-filter" : "button-secondary"}
                onClick={() => setWorkspaceView("logs")}
              >
                <Icon name="logs" />
                Historial
              </button>
            ) : null}
          </div>
          {workspaceView === "records" ? (
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
                Consulta el padron maestro sin entrar al modulo de fichas. Acepta clave base `00-00-00` o clave completa
                `00-00-00-00`.
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

      {workspaceView === "records" ? (
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

        <div className="record-list-head">
          <span>Exp.</span>
          <span>Fichas activas</span>
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
                          <span className="record-badge">{recordView === "archived" ? "Log" : "Ficha"}</span>
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

            <div className="action-row">
              <button type="submit" disabled={saving}>
                {saving ? "Guardando..." : form.id ? "Actualizar ficha" : "Guardar ficha"}
              </button>
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
                </div>
                <span className="panel-pill">Consulta separada</span>
              </div>

              <form className="lookup-form" onSubmit={handleLookupSearch}>
                <label className="lookup-field">
                  <span>Clave catastral</span>
                  <input
                    value={lookupQuery}
                    onChange={handleLookupInputChange}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="00-00-00 o 00-00-00-00"
                    maxLength={11}
                  />
                </label>
                <div className="lookup-guide-sheet">
                  <span>##</span>
                  <span>##</span>
                  <span>##</span>
                  <span className="is-optional">##</span>
                </div>
                <div className="lookup-helper-row">
                  <span className="helper-text">Base de 3 bloques: trae todas las coincidencias. Clave de 4 bloques: busca exacto.</span>
                  <div className="lookup-example-chips">
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("10-10-10")}>
                      10-10-10
                    </button>
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("10-10-10-01")}>
                      10-10-10-01
                    </button>
                  </div>
                </div>
                {lookupFeedback ? <p className="lookup-feedback">{lookupFeedback}</p> : null}
                <div className="search-actions lookup-actions">
                  <button type="submit" disabled={lookupLoading}>
                    <Icon name="search" />
                    {lookupLoading ? "Consultando..." : "Consultar clave"}
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
                      <p className="eyebrow">{lookupResult.mode === "base" ? "Busqueda por base" : "Busqueda exacta"}</p>
                      <h3>{lookupResult.normalized_query}</h3>
                    </div>
                    <span className={`lookup-status-pill ${lookupResult.exists ? "is-found" : "is-missing"}`}>
                      {lookupResult.exists ? "Si registrada" : "Sin registro"}
                    </span>
                  </div>

                  <p className="lookup-result-message">
                    {lookupResult.exists
                      ? lookupResult.mode === "base"
                        ? `Se encontraron ${lookupResult.total_matches} coincidencias asociadas a esa clave base.`
                        : "La clave consultada si existe en el sistema maestro."
                      : "No existe registro en el sistema. Posible clandestino."}
                  </p>

                  {lookupResult.exists ? (
                    <div className="lookup-match-list">
                      {lookupResult.matches.map((match) => (
                        (() => {
                          const totalMeta = getLookupTotalMeta(match.total);
                          return (
                            <article key={`${match.clave_catastral}-${match.inquilino}-${match.nombre}`} className="lookup-match-card">
                              <div className="lookup-match-top">
                                <strong>{match.clave_catastral}</strong>
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
                                  <span>{match.nombre || "--"}</span>
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
                            </article>
                          );
                        })()
                      ))}
                    </div>
                  ) : null}
                </article>
              ) : (
                <article className="lookup-empty-card">
                  <h3>Consulta rapida de clave</h3>
                  <p>
                    Usa esta pantalla para validar en campo si una clave ya existe en el padron maestro, sin entrar al
                    modulo de registro de clandestinos.
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
                <span className="panel-pill">{safeMapPoints.length} puntos</span>
              </div>
              <div className="map-toolbar">
                <span className={`map-status-chip ${mapStatus === "Sin conexion" ? "is-offline" : ""}`}>
                  <Icon name={mapStatus === "GPS listo" ? "success" : mapStatus === "Sin conexion" ? "activity" : "map"} />
                  {mapStatus}
                </span>
                <span className="helper-text">Toca el mapa para fijar coordenadas o usa tu ubicacion actual.</span>
              </div>
              <div ref={mapContainerRef} className="map-canvas" />
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
                    <span className="panel-pill">{safeMapPoints.length}</span>
                    <button type="button" className="button-secondary" onClick={handleDownloadMapReport}>
                      <Icon name="records" />
                      Reporte detallado
                    </button>
                  </div>
                </div>
                {loadingMapPoints ? <p className="helper-text">Cargando puntos...</p> : null}
                <div className="map-point-list">
                  {safeMapPoints.length ? (
                    safeMapPoints.map((point) => (
                      <article
                        key={point.id}
                        className={`map-point-card ${selectedMapPointId === point.id ? "is-active" : ""}`}
                      >
                        <button type="button" className="map-point-main" onClick={() => setSelectedMapPointId(point.id)}>
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
        <main className={`admin-layout ${workspaceView === "logs" ? "admin-layout-logs" : ""}`}>
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
                        <span className="record-badge">{roleLabel(user.role)}</span>
                      </div>
                      <span className="user-email">{user.email}</span>
                      <small className="user-meta">
                        Usuario: {user.username} - Ultimo acceso: {formatDateTime(user.last_login_at)}
                      </small>
                      <div className="user-card-actions">
                        <span className="record-badge">{user.username}</span>
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

          <section className={`admin-content ${workspaceView === "logs" ? "admin-content-logs" : ""}`}>
            {workspaceView === "users" ? (
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
