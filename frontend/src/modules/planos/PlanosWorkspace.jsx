import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Clipboard, Copy, Crosshair, Download, Edit3, Eraser, Eye, EyeOff, Layers, LocateFixed, Lock, Map as MapIcon, Minus, MousePointer2, Move, Pentagon, Plus, Redo2, RotateCcw, RotateCw, Save, Send, Square, Trash2, Type, Undo2, Unlock } from "lucide-react";
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { toast } from "sonner";
import { API_URL } from "../../config/api";
import { Icon } from "../../components/Icon";
import { CroquisSyncStatus } from "./CroquisSyncStatus";
import { CroquisToolHint } from "./CroquisToolHint";
import { cloneEditorElement, completePlacementTool, finishLineDraft, moveElementInStack, nextLineDraft, patchEditorLayer, pushEditorHistory, redoEditorHistory, shouldPlaceFromPointerUp, undoEditorHistory } from "./planosEditorHistory";
import { buildCroquisSvg } from "./planosVectorExport";
import { buildCroquisPdf } from "./planosPdfExport";

const pdfBackgroundCache = new Map();
let pdfJsPromise = null;

const loadPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then(async (pdfjsLib) => {
      try {
        const { default: PdfWorker } = await import("pdfjs-dist/build/pdf.worker.mjs?worker&inline");
        pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerPort = null;
      }
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
};

const tools = [
  ["select", "Seleccionar", MousePointer2],
  ["pan", "Mover", Move],
  ["linea", "Linea", Edit3],
  ["codigo", "Numero", MapIcon],
  ["texto", "Texto", Type],
  ["borrar", "Borrar", Eraser],
  ["poligono", "Poligono", Pentagon],
  ["punto", "Punto", LocateFixed],
  ["tapado", "Tapar", Square]
];
const primaryToolKeys = new Set(["select", "pan", "linea", "codigo", "texto", "borrar"]);
const primaryTools = tools.filter(([key]) => primaryToolKeys.has(key));
const secondaryTools = tools.filter(([key]) => !primaryToolKeys.has(key));

const defaultEditorLayers = [
  ["plano_base", "Plano base"],
  ["calles", "Calles"],
  ["lotes", "Lotes"],
  ["agua_potable", "Red agua potable"],
  ["aguas_negras", "Red aguas negras"],
  ["codigos", "Codigos"],
  ["puntos", "Puntos tecnicos"],
  ["simbolos", "Simbolos"],
  ["observaciones", "Observaciones"],
  ["correcciones", "Correcciones"]
];
const createEditorLayers = () => defaultEditorLayers.map(([key, label]) => ({ key, label, visible: true, locked: key === "plano_base", opacity: 1 }));

const statusLabel = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_edicion: "En edicion",
  borrador: "Borrador",
  enviado_revision: "En revision",
  devuelto: "Devuelto",
  aprobado: "Aprobado",
  publicado: "Publicado"
};

const toolLabel = Object.fromEntries(tools.map(([key, label]) => [key, label]));
const singlePlacementTools = new Set(["punto", "texto", "codigo", "tapado"]);
const placementTools = new Set(["linea", "poligono", "texto", "codigo", "punto", "tapado"]);

const sortDraftsFirst = (items = []) => [...items].sort((a, b) => {
  const score = (item) => (["borrador", "en_edicion", "devuelto"].includes(item.latest_version_estado || item.estado) ? 0 : 1);
  return score(a) - score(b);
});

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const toAssetUrl = (value = "") => (/^https?:\/\//i.test(value) ? value : value ? `${API_URL}${value}` : "");
const usesApiCredentials = (value = "") => {
  try {
    return new URL(value, window.location.href).origin === new URL(API_URL, window.location.href).origin;
  } catch {
    return false;
  }
};
const fetchAsset = (url) => fetch(url, { credentials: usesApiCredentials(url) ? "include" : "omit" });
const isPdf = (value = "") => /\.pdf($|\?)/i.test(value);
const clampZoom = (value) => Math.min(12, Math.max(0.2, Number(value.toFixed(3))));
const snapPoint = (start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (!distance) return end;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: Math.round(start.x + Math.cos(angle) * distance), y: Math.round(start.y + Math.sin(angle) * distance) };
};
const localDraftKey = (barrioId) => `planos-draft-${barrioId}`;
const readLocalDraft = (barrioId) => {
  try {
    const value = window.localStorage.getItem(localDraftKey(barrioId));
    return value ? JSON.parse(value) : null;
  } catch {
    window.localStorage.removeItem(localDraftKey(barrioId));
    return null;
  }
};
const normalizeElements = (elements = []) =>
  elements.map((item) => {
    const data = item.data_json?.data_json || item.data_json || item.data || {};
    return {
      localId: item.localId || data.localId || String(item.id || uid()),
      tipo_elemento: item.tipo_elemento || item.tipo || "texto",
      data_json: {
        capa: "correcciones",
        ...data
      }
    };
  });

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new window.Image();
  image.crossOrigin = usesApiCredentials(src) ? "use-credentials" : "anonymous";
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const renderCroquisBackground = async (baseUrl) => {
  if (isPdf(baseUrl)) {
    const pdfjsLib = await loadPdfJs();
    const bytes = await fetchAsset(baseUrl).then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el PDF base.");
      return response.arrayBuffer();
    });
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, Math.max(2, 2800 / baseViewport.width)) });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas;
  }
  const image = await loadImage(baseUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  canvas.getContext("2d").drawImage(image, 0, 0);
  return canvas;
};

const downloadVectorCroquis = async ({ barrio, elements, layers = [], versionNumber = 1 }) => {
  const baseUrl = toAssetUrl(barrio?.baseUrl || barrio?.base_url || barrio?.fondo_url || barrio?.archivo_fondo || barrio?.imagen_fondo || barrio?.archivo_pdf);
  if (!baseUrl) throw new Error("Este croquis no tiene archivo base para descargar.");
  const canvas = await renderCroquisBackground(baseUrl);
  const svg = buildCroquisSvg({ width: canvas.width, height: canvas.height, backgroundDataUrl: canvas.toDataURL("image/png"), elements, layers });
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  const code = String(barrio?.codigo_barrio || barrio?.id || "croquis").replace(/[^a-zA-Z0-9_-]+/g, "-");
  link.href = url;
  link.download = `croquis-${code}-v${versionNumber}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const barrioBaseUrl = (barrio = {}) =>
  toAssetUrl(barrio.baseUrl || barrio.base_url || barrio.fondo_url || barrio.archivo_fondo || barrio.imagen_fondo || barrio.archivo_pdf);

// Genera el PDF vectorial (plano base + trazos) y lo devuelve como Blob listo para subir/descargar.
const buildCroquisPdfBlob = async ({ barrio, elements, layers = [], renderWidth, renderHeight }) => {
  const baseUrl = barrioBaseUrl(barrio);
  if (!baseUrl) throw new Error("Este croquis no tiene plano base para exportar.");
  let args;
  if (isPdf(baseUrl)) {
    const pdfBytes = await fetchAsset(baseUrl).then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el PDF base.");
      return response.arrayBuffer();
    });
    args = { pdfBytes, renderWidth, renderHeight };
  } else {
    const canvas = await renderCroquisBackground(baseUrl);
    args = { imageDataUrl: canvas.toDataURL("image/png"), renderWidth: canvas.width, renderHeight: canvas.height };
  }
  const bytes = await buildCroquisPdf({ ...args, elements, layers });
  return new Blob([bytes], { type: "application/pdf" });
};

const croquisFileName = (barrio = {}, versionNumber = 1, extension = "pdf") => {
  const code = String(barrio.codigo_barrio || barrio.id || "croquis").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `croquis-${code}-v${versionNumber}.${extension}`;
};

const moveElement = (element, dx, dy) => {
  const data = element.data_json || {};
  if (Array.isArray(data.puntos)) {
    return { ...element, data_json: { ...data, puntos: data.puntos.map((point) => ({ x: Number(point.x || 0) + dx, y: Number(point.y || 0) + dy })) } };
  }
  return { ...element, data_json: { ...data, x: Number(data.x || 0) + dx, y: Number(data.y || 0) + dy } };
};

const StatusBadge = ({ status }) => <span className={`planos-status is-${status || "pendiente"}`}>{statusLabel[status] || status || "Pendiente"}</span>;

function CanvasCroquis({ barrio, elements, setElements, selectedId, setSelectedId, tool, onToolChange, content, activeLayer, layers, polygonDraft, setPolygonDraft, zoom, setZoom, rotation, setRotation, snap, continuousPlacement, precisionMode }) {
  const shellRef = useRef(null);
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const activePointersRef = useRef(new Map());
  const transformerRef = useRef(null);
  const shapeRefs = useRef({});
  const toolRef = useRef(tool);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 700 });
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const [background, setBackground] = useState({ image: null, width: 1000, height: 700, loading: false, error: "" });
  const [lineDraft, setLineDraft] = useState(null);
  const [pointerPreview, setPointerPreview] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const baseUrl = toAssetUrl(barrio?.baseUrl || barrio?.base_url || barrio?.fondo_url || barrio?.imagen_fondo || barrio?.archivo_fondo || barrio?.archivo_pdf);
  const fitScale = Math.min(stageSize.width / background.width, stageSize.height / background.height) || 1;
  const scale = fitScale * zoom;
  const viewport = { x: stageSize.width / 2 + viewPos.x, y: stageSize.height / 2 + viewPos.y, scale, rotation };
  const groupProps = { x: viewport.x, y: viewport.y, scaleX: viewport.scale, scaleY: viewport.scale, rotation: viewport.rotation, offsetX: background.width / 2, offsetY: background.height / 2 };
  const precisionTools = ["linea", "poligono", "texto", "codigo", "punto", "tapado"];
  const showPrecision = precisionMode && precisionTools.includes(tool);
  const selected = elements.find((item) => item.localId === selectedId);
  const layerMap = useMemo(() => Object.fromEntries(layers.map((layer) => [layer.key, layer])), [layers]);
  const baseLayer = layerMap.plano_base || { visible: true, opacity: 1, locked: true };
  const activeLayerState = layerMap[activeLayer] || { visible: true, locked: false, opacity: 1 };
  const layerForElement = (element) => layerMap[element.data_json?.capa || "correcciones"] || { visible: true, locked: false, opacity: 1 };

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    const resize = () => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (rect) setStageSize({ width: Math.max(320, rect.width), height: Math.max(420, rect.height) });
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (shellRef.current) observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setViewPos({ x: 0, y: 0 });
    if (!baseUrl) {
      setBackground({ image: null, width: 1000, height: 700, loading: false, error: "" });
      return () => { cancelled = true; };
    }
    if (pdfBackgroundCache.has(baseUrl)) {
      setBackground({ ...pdfBackgroundCache.get(baseUrl), loading: false, error: "" });
      return () => { cancelled = true; };
    }
    setBackground((current) => ({ ...current, loading: true, error: "" }));
    (async () => {
      if (!isPdf(baseUrl)) {
        const image = new window.Image();
        image.crossOrigin = usesApiCredentials(baseUrl) ? "use-credentials" : "anonymous";
        image.onload = () => {
          const next = { image, width: image.naturalWidth || 1000, height: image.naturalHeight || 700 };
          pdfBackgroundCache.set(baseUrl, next);
          if (!cancelled) setBackground({ ...next, loading: false, error: "" });
        };
        image.src = baseUrl;
        return;
      }
      const pdfjsLib = await loadPdfJs();
      const bytes = await fetchAsset(baseUrl).then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el PDF base.");
        return response.arrayBuffer();
      });
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const page = await pdf.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(4, Math.max(2, 2800 / baseViewport.width)) });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const image = new window.Image();
      image.onload = () => {
        const next = { image, width: canvas.width, height: canvas.height };
        pdfBackgroundCache.set(baseUrl, next);
        if (!cancelled) setBackground({ ...next, loading: false, error: "" });
      };
      image.src = canvas.toDataURL("image/png");
    })().catch((error) => {
      if (!cancelled) setBackground({ image: null, width: 1000, height: 700, loading: false, error: error.message || "No se pudo preparar el fondo." });
    });
    return () => { cancelled = true; };
  }, [baseUrl]);

  useEffect(() => {
    setLineDraft(null);
    setPointerPreview(null);
    if (tool !== "poligono") setPolygonDraft([]);
  }, [setPolygonDraft, tool]);

  useEffect(() => {
    if (!transformerRef.current) return;
    const node = selected?.tipo_elemento === "tapado" ? shapeRefs.current[selected.localId] : null;
    transformerRef.current.nodes(node ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected]);

  const getImagePointFromScreenPoint = (pointer, nextZoom = zoom, nextViewPos = viewPos, nextRotation = rotation) => {
    const nextScale = fitScale * nextZoom;
    const centerX = stageSize.width / 2 + nextViewPos.x;
    const centerY = stageSize.height / 2 + nextViewPos.y;
    const dx = pointer.x - centerX;
    const dy = pointer.y - centerY;
    const radians = nextRotation * Math.PI / 180;
    return {
      x: Math.round(((dx * Math.cos(radians) + dy * Math.sin(radians)) / nextScale) + background.width / 2),
      y: Math.round(((-dx * Math.sin(radians) + dy * Math.cos(radians)) / nextScale) + background.height / 2)
    };
  };

  const getScreenPointFromImagePoint = (point, nextZoom = zoom, nextViewPos = viewPos, nextRotation = rotation) => {
    const nextScale = fitScale * nextZoom;
    const radians = nextRotation * Math.PI / 180;
    const x = (point.x - background.width / 2) * nextScale;
    const y = (point.y - background.height / 2) * nextScale;
    return {
      x: stageSize.width / 2 + nextViewPos.x + x * Math.cos(radians) - y * Math.sin(radians),
      y: stageSize.height / 2 + nextViewPos.y + x * Math.sin(radians) + y * Math.cos(radians)
    };
  };

  const eventPointer = (event) => {
    const stage = event.target.getStage();
    const touch = event.evt.touches?.[0] || event.evt.changedTouches?.[0];
    if (!touch && Number.isFinite(event.evt.clientX) && Number.isFinite(event.evt.clientY)) {
      const rect = stage.container().getBoundingClientRect();
      return { x: event.evt.clientX - rect.left, y: event.evt.clientY - rect.top };
    }
    if (!touch) return stage.getPointerPosition();
    const rect = stage.container().getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const stagePoint = (stage, pointer = stage.getPointerPosition()) => {
    return pointer ? getImagePointFromScreenPoint(pointer) : null;
  };

  const eventPoint = (event) => stagePoint(event.target.getStage(), eventPointer(event));

  const aimScreenPoint = () => {
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
    const bottomSafe = mobile ? Math.min(220, Math.max(120, stageSize.height * 0.24)) : 0;
    return { x: stageSize.width / 2, y: (stageSize.height - bottomSafe) / 2 };
  };
  const centerPoint = () => getImagePointFromScreenPoint(aimScreenPoint());
  const centerDelta = () => {
    const point = centerPoint();
    const dx = Math.round(point.x - background.width / 2);
    const dy = Math.round(point.y - background.height / 2);
    const tilt = Math.round(((rotation % 360) + 360) % 360);
    return { dx, dy, tilt: tilt > 180 ? tilt - 360 : tilt };
  };
  const touchCenterPoint = (touches) => {
    const rect = shellRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    return { x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left, y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top };
  };
  const pointerPair = () => [...activePointersRef.current.values()].slice(0, 2);
  const pointerDistance = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
  const pointerAngle = ([a, b]) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const pointerCenter = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const zoomAtPoint = (pointer, nextZoom) => {
    const imagePoint = getImagePointFromScreenPoint(pointer);
    const projected = getScreenPointFromImagePoint(imagePoint, nextZoom);
    setZoom(nextZoom);
    setViewPos((current) => ({ x: current.x + pointer.x - projected.x, y: current.y + pointer.y - projected.y }));
  };

  const lineDraftPoints = lineDraft?.points || [];

  const addLinePoint = (point, useSnap = false) => {
    if (activeLayerState.locked || !activeLayerState.visible) {
      toast.warning("La capa activa esta bloqueada u oculta.");
      return;
    }
    const previousPoint = lineDraftPoints[lineDraftPoints.length - 1];
    const finalPoint = previousPoint && useSnap ? snapPoint(previousPoint, point) : point;
    const next = nextLineDraft(lineDraft, finalPoint, activeLayer);
    setLineDraft(next.draft);
    setPointerPreview(finalPoint);
    toast.info(next.draft.points.length === 1 ? "Punto inicial colocado." : "Vertice agregado.");
  };

  const finishLine = () => {
    if (activeLayerState.locked || !activeLayerState.visible) return;
    const line = finishLineDraft(lineDraft, activeLayer);
    if (!line) return;
    const localId = uid();
    setElements((current) => [...current, { localId, ...line, data_json: { ...line.data_json, localId } }]);
    setSelectedId(localId);
    onToolChange("select");
    setLineDraft(null);
    setPointerPreview(null);
    toast.success("Linea agregada.");
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tag) || tool !== "linea") return;
      if (event.key === "Enter") {
        event.preventDefault();
        finishLine();
      } else if (event.key === "Escape" && lineDraft) {
        event.preventDefault();
        setLineDraft(null);
        setPointerPreview(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeLayer, lineDraft, tool]);

  const updateVertex = (element, index, point) => {
    setElements((current) => current.map((item) => {
      if (item.localId !== element.localId) return item;
      const puntos = [...(item.data_json?.puntos || [])];
      puntos[index] = { x: Math.round(point.x), y: Math.round(point.y) };
      return { ...item, data_json: { ...item.data_json, puntos } };
    }));
  };

  const insertVertex = (element, index, point) => {
    setElements((current) => current.map((item) => {
      if (item.localId !== element.localId) return item;
      const puntos = [...(item.data_json?.puntos || [])];
      puntos.splice(index + 1, 0, { x: Math.round(point.x), y: Math.round(point.y) });
      return { ...item, data_json: { ...item.data_json, puntos } };
    }));
  };

  const completeSinglePlacement = (localId) => {
    const nextTool = completePlacementTool(toolRef.current, continuousPlacement);
    toolRef.current = nextTool;
    setSelectedId(localId);
    onToolChange(nextTool);
  };

  const addElement = (point) => {
    const currentTool = toolRef.current;
    if (activeLayerState.locked || !activeLayerState.visible) {
      toast.warning("La capa activa esta bloqueada u oculta.");
      return;
    }
    if (currentTool === "texto" || currentTool === "codigo") {
      const text = content.trim() || (currentTool === "codigo" ? "10-00-00-00" : "Texto");
      const localId = uid();
      setElements((current) => [...current, { localId, tipo_elemento: currentTool, data_json: { localId, capa: activeLayer, x: point.x, y: point.y, contenido: text, fontSize: currentTool === "codigo" ? 28 : 22, rotacion: 0, color: "#0f172a" } }]);
      completeSinglePlacement(localId);
      toast.success(currentTool === "codigo" ? "Numero agregado." : "Texto agregado.");
      return;
    }
    if (currentTool === "punto") {
      const localId = uid();
      setElements((current) => [...current, { localId, tipo_elemento: "punto", data_json: { localId, capa: activeLayer, x: point.x, y: point.y, descripcion: content.trim() || "", color: "#1576d1", size: 12, tipoPunto: "referencia" } }]);
      completeSinglePlacement(localId);
      toast.success("Punto agregado.");
      return;
    }
    if (currentTool === "tapado") {
      const localId = uid();
      setElements((current) => [...current, { localId, tipo_elemento: "tapado", data_json: { localId, capa: activeLayer, x: point.x - 40, y: point.y - 20, width: 80, height: 40, color: "#ffffff" } }]);
      completeSinglePlacement(localId);
      toast.success("Tapado agregado.");
      return;
    }
    if (currentTool === "poligono") {
      setPolygonDraft((current) => [...current, point]);
    }
  };

  const handleStageDown = (event) => {
    const currentTool = toolRef.current;
    const pointer = eventPointer(event);
    if (event.evt.pointerId != null && pointer) activePointersRef.current.set(event.evt.pointerId, pointer);
    if (activePointersRef.current.size >= 2) {
      const pair = pointerPair();
      const distance = pointerDistance(pair);
      const angle = pointerAngle(pair);
      pinchRef.current = { distance, angle, zoom, rotation, viewPos };
      if (panRef.current) panRef.current.pinched = true;
      setIsPanning(true);
      return;
    }
    if (event.target !== event.target.getStage()) return;
    if ((currentTool === "pan" || (precisionMode && precisionTools.includes(currentTool)) || placementTools.has(currentTool)) && pointer) {
      panRef.current = {
        pointer,
        imagePoint: stagePoint(event.target.getStage(), pointer),
        start: viewPos,
        moved: false,
        cancelled: false,
        pinched: false,
        placement: placementTools.has(currentTool),
        precision: precisionMode && precisionTools.includes(currentTool)
      };
      setIsPanning(true);
      return;
    }
    if (currentTool === "borrar") {
      toast.info("El plano base no se puede borrar. Solo puedes borrar correcciones agregadas.");
      return;
    }
    if (currentTool === "select") setSelectedId("");
  };

  const handleStageMove = (event) => {
    const currentTool = toolRef.current;
    const pointer = eventPointer(event);
    if (event.evt.pointerId != null && pointer) activePointersRef.current.set(event.evt.pointerId, pointer);
    if (activePointersRef.current.size >= 2 && pinchRef.current) {
      event.evt.preventDefault();
      const pair = pointerPair();
      const distance = pointerDistance(pair);
      const angle = pointerAngle(pair);
      zoomAtPoint(pointerCenter(pair), clampZoom(pinchRef.current.zoom * (distance / pinchRef.current.distance)));
      setRotation(Math.round(pinchRef.current.rotation + angle - pinchRef.current.angle));
      return;
    }
    if (panRef.current) {
      if (!pointer || !panRef.current.pointer) return;
      const distance = Math.hypot(pointer.x - panRef.current.pointer.x, pointer.y - panRef.current.pointer.y);
      if (distance > (event.evt.pointerType === "touch" ? 22 : 6)) panRef.current.moved = true;
      if (panRef.current.precision || currentTool === "pan" || panRef.current.moved) {
        setViewPos({
          x: panRef.current.start.x + pointer.x - panRef.current.pointer.x,
          y: panRef.current.start.y + pointer.y - panRef.current.pointer.y
        });
      }
      return;
    }
    if (tool === "linea" && lineDraft) {
      const point = eventPoint(event);
      const previousPoint = lineDraftPoints[lineDraftPoints.length - 1];
      if (point) setPointerPreview(previousPoint && (snap || event.evt.shiftKey) ? snapPoint(previousPoint, point) : point);
      return;
    }
  };

  const handleStageUp = (event) => {
    const currentTool = toolRef.current;
    const started = panRef.current;
    if (pinchRef.current) {
      panRef.current = null;
      pinchRef.current = null;
      if (event.evt.pointerId != null) activePointersRef.current.delete(event.evt.pointerId);
      setIsPanning(false);
      return;
    }
    if (started?.placement && shouldPlaceFromPointerUp({
      tool: currentTool,
      precisionMode,
      pointers: activePointersRef.current.size || 1,
      moved: started.moved,
      pinched: started.pinched,
      cancelled: started.cancelled,
      onCanvas: event.target === event.target.getStage()
    })) {
      const point = started.imagePoint;
      if (point) {
        if (currentTool === "linea") addLinePoint(point, snap || event.evt.shiftKey);
        else addElement(point);
      }
    }
    panRef.current = null;
    pinchRef.current = null;
    if (event.evt.pointerId != null) activePointersRef.current.delete(event.evt.pointerId);
    setIsPanning(false);
  };

  const handleStageCancel = (event) => {
    if (panRef.current) panRef.current.cancelled = true;
    panRef.current = null;
    pinchRef.current = null;
    if (event.evt.pointerId != null) activePointersRef.current.delete(event.evt.pointerId);
    setIsPanning(false);
  };

  const handleWheel = (event) => {
    event.evt.preventDefault();
    const pointer = event.target.getStage().getPointerPosition();
    if (pointer) zoomAtPoint(pointer, clampZoom(zoom * (event.evt.deltaY > 0 ? 0.9 : 1.1)));
  };

  const handleElementDown = (event, element) => {
    const layer = layerForElement(element);
    if (layer.locked || !layer.visible) {
      event.cancelBubble = true;
      toast.warning("Esta capa esta bloqueada u oculta.");
      return;
    }
    if (tool === "pan" || showPrecision) {
      event.cancelBubble = true;
      const pointer = eventPointer(event);
      panRef.current = { pointer, imagePoint: stagePoint(event.target.getStage(), pointer), start: viewPos, moved: false, touch: Boolean(event.evt.touches) };
      setIsPanning(true);
      return;
    }
    event.cancelBubble = true;
    if (tool === "borrar") {
      setElements((current) => current.filter((item) => item.localId !== element.localId));
      setSelectedId((current) => (current === element.localId ? "" : current));
      toast.success("Objeto eliminado.");
      return;
    }
    setSelectedId(element.localId);
  };

  const moveByDrag = (element, event) => {
    const data = element.data_json || {};
    if (Array.isArray(data.puntos)) {
      const dx = event.target.x();
      const dy = event.target.y();
      event.target.position({ x: 0, y: 0 });
      setElements((current) => current.map((item) => item.localId === element.localId ? moveElement(item, dx, dy) : item));
      return;
    }
    setElements((current) => current.map((item) => item.localId === element.localId ? { ...item, data_json: { ...item.data_json, x: Math.round(event.target.x()), y: Math.round(event.target.y()) } } : item));
  };

  const resizeTapado = (element, event) => {
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scale({ x: 1, y: 1 });
    setElements((current) => current.map((item) => item.localId === element.localId ? {
      ...item,
      data_json: {
        ...item.data_json,
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        width: Math.max(10, Math.round(node.width() * scaleX)),
        height: Math.max(10, Math.round(node.height() * scaleY))
      }
    } : item));
  };

  const finishPolygon = () => {
    if (activeLayerState.locked || !activeLayerState.visible) return;
    if (polygonDraft.length < 3) return;
    const localId = uid();
    setElements((current) => [...current, { localId, tipo_elemento: "poligono", data_json: { localId, capa: activeLayer, puntos: polygonDraft, colorBorde: "#0f172a", grosor: 2, relleno: "rgba(21,118,209,0.12)" } }]);
    setSelectedId(localId);
    onToolChange("select");
    setPolygonDraft([]);
  };
  const draftPreviewPoints = lineDraftPoints.length
    ? [...lineDraftPoints, showPrecision ? centerPoint() : pointerPreview || lineDraftPoints[lineDraftPoints.length - 1]]
    : [];
  const nudgeCenter = (dx, dy) => {
    const target = { x: centerPoint().x + dx, y: centerPoint().y + dy };
    const projected = getScreenPointFromImagePoint(target);
    setViewPos((current) => ({
      x: current.x + stageSize.width / 2 - projected.x,
      y: current.y + stageSize.height / 2 - projected.y
    }));
  };
  const centeredActionLabel =
    tool === "linea" ? (lineDraft ? "Agregar vertice" : "Iniciar linea") :
    tool === "poligono" ? "Agregar vertice" :
    tool === "codigo" ? "Agregar numero" :
    tool === "texto" ? "Agregar texto" :
    tool === "tapado" ? "Tapar area" :
    "Agregar punto";

  return (
    <div ref={shellRef} className={`planos-editor-stage is-tool-${tool}`} data-testid="croquis-stage">
      {background.loading || background.error || !baseUrl ? (
        <div className="planos-canvas-message">{background.loading ? "Preparando fondo..." : background.error || "Sube un PDF base para este barrio."}</div>
      ) : null}
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onPointerDown={handleStageDown}
        onPointerMove={handleStageMove}
        onPointerUp={handleStageUp}
        onPointerCancel={handleStageCancel}
        onDblClick={tool === "linea" ? finishLine : undefined}
        onDblTap={tool === "linea" ? finishLine : undefined}
        onWheel={handleWheel}
      >
        <Layer name="background-layer">
          <Group {...groupProps}>
            {background.image && baseLayer.visible ? <KonvaImage image={background.image} width={background.width} height={background.height} opacity={baseLayer.opacity} listening={false} /> : null}
          </Group>
        </Layer>
        <Layer name="objects-layer">
          <Group {...groupProps}>
            {elements.map((element) => {
              const data = element.data_json || {};
              const layer = layerForElement(element);
              if (!layer.visible) return null;
              const selected = selectedId === element.localId;
              const stroke = selected ? "#1576d1" : data.color || data.colorBorde || "#0f172a";
              if (element.tipo_elemento === "linea" || element.tipo_elemento === "poligono") {
                return (
                  <Group key={element.localId}>
                    <Line
                      opacity={layer.opacity}
                      points={(data.puntos || []).flatMap((point) => [Number(point.x || 0), Number(point.y || 0)])}
                      closed={element.tipo_elemento === "poligono"}
                      fill={element.tipo_elemento === "poligono" ? data.relleno || "rgba(21,118,209,0.12)" : undefined}
                      stroke={stroke}
                      strokeWidth={selected ? Number(data.grosor || 2) + 2 : Number(data.grosor || 3)}
                      hitStrokeWidth={44}
                      draggable={tool === "select" && !layer.locked}
                      onMouseDown={(event) => handleElementDown(event, element)}
                      onTouchStart={(event) => handleElementDown(event, element)}
                      onDragEnd={(event) => moveByDrag(element, event)}
                    />
                    {selected && tool === "select" && !layer.locked ? (data.puntos || []).map((point, index) => (
                      <Circle
                        key={`${element.localId}-vertex-${index}`}
                        x={Number(point.x || 0)}
                        y={Number(point.y || 0)}
                        radius={8}
                        fill="#ffffff"
                        stroke="#1576d1"
                        strokeWidth={3}
                        draggable
                        onMouseDown={(event) => { event.cancelBubble = true; }}
                        onTouchStart={(event) => { event.cancelBubble = true; }}
                        onDragEnd={(event) => updateVertex(element, index, { x: event.target.x(), y: event.target.y() })}
                      />
                    )) : null}
                    {selected && tool === "select" && !layer.locked ? (data.puntos || []).slice(0, -1).map((point, index) => {
                      const next = data.puntos[index + 1];
                      const mid = { x: (Number(point.x || 0) + Number(next.x || 0)) / 2, y: (Number(point.y || 0) + Number(next.y || 0)) / 2 };
                      return (
                        <Circle
                          key={`${element.localId}-mid-${index}`}
                          x={mid.x}
                          y={mid.y}
                          radius={6}
                          fill="#1576d1"
                          opacity={0.72}
                          onMouseDown={(event) => { event.cancelBubble = true; insertVertex(element, index, mid); }}
                          onTouchStart={(event) => { event.cancelBubble = true; insertVertex(element, index, mid); }}
                        />
                      );
                    }) : null}
                  </Group>
                );
              }
              if (element.tipo_elemento === "punto") {
                return (
                  <Group key={element.localId} x={Number(data.x || 0)} y={Number(data.y || 0)} opacity={layer.opacity} draggable={tool === "select" && !layer.locked} onMouseDown={(event) => handleElementDown(event, element)} onTouchStart={(event) => handleElementDown(event, element)} onDragEnd={(event) => moveByDrag(element, event)}>
                    <Circle radius={Math.max(22, Number(data.size || 12) + 14)} fill="rgba(0,0,0,0)" />
                    <Circle radius={Number(data.size || 12)} fill={selected ? "#0f9f8f" : data.color || "#1576d1"} />
                    {data.descripcion ? <Text x={Number(data.size || 12) + 6} y={-9} text={data.descripcion} fontSize={18} fontStyle="bold" fill={data.color || "#0f172a"} /> : null}
                  </Group>
                );
              }
              if (element.tipo_elemento === "tapado") {
                return (
                  <Rect
                    key={element.localId}
                    ref={(node) => { if (node) shapeRefs.current[element.localId] = node; }}
                    opacity={layer.opacity}
                    x={Number(data.x || 0)}
                    y={Number(data.y || 0)}
                    width={Number(data.width || 80)}
                    height={Number(data.height || 40)}
                    fill={data.color || "#ffffff"}
                    stroke={selected ? "#1576d1" : data.color || "#ffffff"}
                    strokeWidth={selected ? 2 : 0}
                    draggable={tool === "select" && !layer.locked}
                    onMouseDown={(event) => handleElementDown(event, element)}
                    onTouchStart={(event) => handleElementDown(event, element)}
                    onDragEnd={(event) => moveByDrag(element, event)}
                    onTransformEnd={(event) => resizeTapado(element, event)}
                  />
                );
              }
              const fontSize = Number(data.fontSize || 22);
              const textValue = data.contenido || "";
              return (
                <Group
                  key={element.localId}
                  x={Number(data.x || 0)}
                  y={Number(data.y || 0)}
                  rotation={Number(data.rotacion || 0)}
                  opacity={layer.opacity}
                  draggable={tool === "select" && !layer.locked}
                  onMouseDown={(event) => handleElementDown(event, element)}
                  onTouchStart={(event) => handleElementDown(event, element)}
                  onDragEnd={(event) => moveByDrag(element, event)}
                >
                  <Rect width={Math.max(48, textValue.length * fontSize * 0.65)} height={Math.max(34, fontSize * 1.4)} fill="rgba(0,0,0,0)" />
                  <Text text={textValue} fontSize={fontSize} fill={selected ? "#1576d1" : data.color || "#0f172a"} />
                </Group>
              );
            })}
            <Transformer ref={transformerRef} rotateEnabled={false} enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]} />
          </Group>
        </Layer>
        <Layer name="draft-layer">
          <Group {...groupProps}>
            {draftPreviewPoints.length > 1 ? <Line points={draftPreviewPoints.flatMap((point) => [point.x, point.y])} stroke="#1576d1" strokeWidth={3} dash={[10, 8]} listening={false} /> : null}
            {polygonDraft.length ? <Line points={polygonDraft.flatMap((point) => [point.x, point.y])} stroke="#1576d1" strokeWidth={3} dash={[10, 8]} /> : null}
          </Group>
        </Layer>
      </Stage>
      {showPrecision ? (
        <>
          <div className="planos-crosshair" style={{ left: aimScreenPoint().x, top: aimScreenPoint().y }}><Crosshair size={42} /><span>Centrado {centerPoint().x}, {centerPoint().y}</span></div>
          <div className="planos-nudge-pad" aria-label="Ajuste fino del punto centrado">
            <button type="button" onClick={() => nudgeCenter(0, -1)}>↑</button>
            <button type="button" onClick={() => nudgeCenter(-1, 0)}>←</button>
            <button type="button" onClick={() => nudgeCenter(1, 0)}>→</button>
            <button type="button" onClick={() => nudgeCenter(0, 1)}>↓</button>
          </div>
          <div className="planos-precision-actions">
            <button type="button" onClick={() => {
              const point = centerPoint();
              if (tool === "linea") addLinePoint(point, snap);
              else addElement(point);
            }}>{centeredActionLabel}</button>
            {lineDraft ? <button type="button" onClick={() => { setLineDraft(null); setPointerPreview(null); }}>Cancelar</button> : null}
            {lineDraftPoints.length > 1 ? <button type="button" onClick={finishLine}>Finalizar linea</button> : null}
          </div>
        </>
      ) : null}
      {lineDraft || polygonDraft.length ? (
        <div className="planos-drawing-actions">
          <strong>{lineDraft ? `Dibujando linea · ${lineDraftPoints.length} vertices` : `Dibujando poligono · ${polygonDraft.length} vertices`}</strong>
          {lineDraftPoints.length > 1 ? <button type="button" onClick={finishLine}>Finalizar</button> : null}
          {polygonDraft.length >= 3 ? <button type="button" onClick={finishPolygon}>Cerrar poligono</button> : null}
          <button type="button" onClick={() => { setLineDraft(null); setPointerPreview(null); setPolygonDraft([]); }}>Cancelar</button>
        </div>
      ) : null}
      {isPanning ? <div className="planos-pan-guide"><span>Centro {centerDelta().dx}, {centerDelta().dy} · Giro {centerDelta().tilt}°</span></div> : null}
      <button type="button" className="planos-fit-button" onClick={() => { setZoom(1); setRotation(0); setViewPos({ x: 0, y: 0 }); }}>Ajustar</button>
    </div>
  );
}

function EditorCroquis({ apiFetch, barrio, onClose }) {
  const [elements, setElements] = useState([]);
  const [version, setVersion] = useState(null);
  const [tool, setTool] = useState("select");
  const [content, setContent] = useState("");
  const [activeLayer, setActiveLayer] = useState("correcciones");
  const [layers, setLayers] = useState(() => createEditorLayers());
  const [selectedId, setSelectedId] = useState("");
  const [polygonDraft, setPolygonDraft] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [snap, setSnap] = useState(false);
  const [continuousPlacement, setContinuousPlacement] = useState(false);
  const [precisionMode, setPrecisionMode] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const hydratedRef = useRef(false);
  const hasLocalDraftRef = useRef(false);
  const lastSavedRef = useRef("[]");
  const historyRef = useRef({ past: [], future: [] });
  const clipboardRef = useRef(null);

  const selected = elements.find((item) => item.localId === selectedId);
  const layerOptions = layers.map((layer) => [layer.key, layer.label]);
  const activeLayerState = layers.find((layer) => layer.key === activeLayer) || layers[0];
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  useEffect(() => {
    document.body.classList.add("planos-focus-mode");
    return () => document.body.classList.remove("planos-focus-mode");
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    hasLocalDraftRef.current = false;
    apiFetch(`/planos/${barrio.id}/elementos`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudo cargar el croquis.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const loadedElements = normalizeElements(data.elements || []);
        const localDraft = readLocalDraft(barrio.id);
        const nextElements = localDraft ? normalizeElements(localDraft) : loadedElements;
        setVersion(data.version || null);
        setElements(nextElements);
        historyRef.current = { past: [], future: [] };
        lastSavedRef.current = JSON.stringify(loadedElements);
        hasLocalDraftRef.current = Boolean(localDraft);
        hydratedRef.current = true;
        setSaveState(localDraft ? "local" : "saved");
      })
      .catch(() => setSaveState("error"));
    return () => { cancelled = true; };
  }, [apiFetch, barrio.id]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const current = JSON.stringify(elements);
    const clean = current === lastSavedRef.current;
    if (!clean) {
      window.localStorage.setItem(localDraftKey(barrio.id), current);
      setSaveState(hasLocalDraftRef.current ? "local" : "dirty");
      return;
    }
    hasLocalDraftRef.current = false;
    window.localStorage.removeItem(localDraftKey(barrio.id));
    setSaveState("saved");
  }, [elements]);

  const commitElements = useCallback((updater) => {
    setElements((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const result = pushEditorHistory(historyRef.current, current, next);
      historyRef.current = result.history;
      return result.next;
    });
  }, []);

  const undo = useCallback(() => {
    const result = undoEditorHistory(historyRef.current, elements);
    historyRef.current = result.history;
    setSelectedId("");
    setElements(result.next);
  }, [elements]);

  const redo = useCallback(() => {
    const result = redoEditorHistory(historyRef.current, elements);
    historyRef.current = result.history;
    setSelectedId("");
    setElements(result.next);
  }, [elements]);

  const copySelected = () => {
    if (!selected) return;
    clipboardRef.current = selected;
    toast.success("Objeto copiado.");
  };

  const pasteSelected = () => {
    const copy = cloneEditorElement(clipboardRef.current);
    if (!copy) return;
    commitElements((current) => [...current, copy]);
    setSelectedId(copy.localId);
    clipboardRef.current = copy;
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = cloneEditorElement(selected);
    commitElements((current) => [...current, copy]);
    setSelectedId(copy.localId);
    clipboardRef.current = copy;
  };

  const deleteSelected = () => {
    if (!selected) return;
    commitElements((current) => current.filter((item) => item.localId !== selected.localId));
    setSelectedId("");
  };

  const moveSelectedInStack = (direction) => {
    if (!selected) return;
    commitElements((current) => moveElementInStack(current, selected.localId, direction));
  };

  const updateLayer = (key, patch) => {
    setLayers((current) => patchEditorLayer(current, key, patch));
    if (patch.visible === false && selected?.data_json?.capa === key) setSelectedId("");
  };

  const readErrorBody = async (response) => {
    try {
      return await response.json();
    } catch {
      return {};
    }
  };

  const saveErrorMessage = (status, data = {}) => {
    if (!status) return "Sin conexion con el servidor.";
    if (status === 401) return "Sesion vencida. Ingresa nuevamente.";
    if (status === 403) return "No tienes permiso para editar este croquis.";
    if (status === 409) return "Hay un conflicto con la version del servidor.";
    if (status === 413) return "El croquis es demasiado grande para sincronizar.";
    if (status === 422) return data.message || "El croquis tiene datos invalidos.";
    if (status >= 500) return "Error del servidor al guardar el croquis.";
    return data.message || "No se pudo guardar.";
  };

  const saveDraft = useCallback(async ({ silent = false } = {}) => {
    setSaving(true);
    setSaveState("saving");
    try {
      const response = await apiFetch(`/planos/${barrio.id}/guardar-borrador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements })
      });
      const data = await readErrorBody(response);
      if (!response.ok || data.ok !== true) throw new Error(saveErrorMessage(response.status, data));
      const savedVersion = data.version || version;
      setVersion(savedVersion);
      const savedElements = normalizeElements(data.elements || elements);
      lastSavedRef.current = JSON.stringify(savedElements);
      hasLocalDraftRef.current = false;
      window.localStorage.removeItem(localDraftKey(barrio.id));
      setElements(savedElements);
      setSaveState("saved");
      return { elements: savedElements, version: savedVersion };
    } catch (error) {
      hasLocalDraftRef.current = true;
      window.localStorage.setItem(localDraftKey(barrio.id), JSON.stringify(elements));
      setSaveState("local");
      if (!silent) {
        toast.error("No se pudo sincronizar con el servidor. Los cambios quedaron guardados en este dispositivo.", {
          description: error.message || ""
        });
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }, [apiFetch, barrio.id, elements, version]);

  useEffect(() => {
    if (saveState !== "dirty" && saveState !== "local") return undefined;
    const timer = window.setTimeout(() => {
      saveDraft({ silent: saveState === "local" }).catch(() => {});
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [saveDraft, saveState]);

  useEffect(() => {
    if (saveState !== "local") return undefined;
    const syncLocalDraft = () => {
      saveDraft({ silent: true }).catch(() => {});
    };
    const timer = window.setTimeout(syncLocalDraft, 1200);
    window.addEventListener("online", syncLocalDraft);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", syncLocalDraft);
    };
  }, [saveDraft, saveState]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((mod && key === "y") || (mod && event.shiftKey && key === "z")) {
        event.preventDefault();
        redo();
      } else if (mod && key === "c") {
        event.preventDefault();
        copySelected();
      } else if (mod && key === "v") {
        event.preventDefault();
        pasteSelected();
      } else if (mod && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, selected]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const saved = await saveDraft({ silent: true });
      const versionNumber = saved.version?.numero_version || version?.numero_version || 1;
      const versionId = saved.version?.id || version?.id;
      const blob = await buildCroquisPdfBlob({
        barrio,
        elements: saved.elements,
        layers,
        renderWidth: background.width,
        renderHeight: background.height
      });
      const filename = croquisFileName(barrio, versionNumber, "pdf");
      if (versionId) {
        try {
          const form = new FormData();
          form.append("pdf", blob, filename);
          const response = await apiFetch(`/planos/versiones/${versionId}/pdf-final`, { method: "POST", body: form });
          if (!response.ok) {
            const info = await response.json().catch(() => ({}));
            toast.warning(info.message || "El PDF se descargo, pero no se pudo guardar en el servidor.");
          }
        } catch {
          toast.warning("El PDF se descargo, pero no se pudo guardar en el servidor.");
        }
      }
      triggerDownload(blob, filename);
      toast.success("Croquis guardado en PDF.");
    } catch (error) {
      toast.error(error.message || "No se pudo generar el PDF.");
    } finally {
      setExporting(false);
    }
  };

  const downloadDraft = async () => {
    setExporting(true);
    try {
      const saved = await saveDraft({ silent: true });
      await downloadVectorCroquis({ barrio, elements: saved.elements, layers, versionNumber: saved.version?.numero_version || 1 });
      toast.success("Borrador guardado y SVG descargado.");
    } catch (error) {
      toast.error(error.message || "No se pudo descargar el croquis.");
    } finally {
      setExporting(false);
    }
  };

  const sendReview = async () => {
    if (!elements.length) {
      toast.warning("Agrega al menos un cambio antes de finalizar.");
      return;
    }
    setSubmitting(true);
    try {
      await saveDraft({ silent: true });
      const response = await apiFetch(`/planos/${barrio.id}/enviar-revision`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo enviar a revision.");
      setVersion(data);
      toast.success("Croquis guardado y enviado a revision.");
      onClose();
    } catch (error) {
      toast.error(error.message || "No se pudo enviar a revision.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeEditor = async () => {
    if (saveState === "dirty" || saveState === "local") {
      saveDraft({ silent: true }).catch(() => {
        toast.warning("El borrador queda guardado localmente en este equipo.");
      });
    }
    onClose();
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    commitElements((current) => current.map((item) => item.localId === selected.localId ? { ...item, data_json: { ...item.data_json, ...patch } } : item));
  };

  const deleteSelectedVertex = (index) => {
    if (!selected || !Array.isArray(selected.data_json?.puntos)) return;
    const minimum = selected.tipo_elemento === "poligono" ? 3 : 2;
    const puntos = selected.data_json.puntos.filter((_, pointIndex) => pointIndex !== index);
    if (puntos.length < minimum) {
      toast.warning(`No puedes dejar menos de ${minimum} vertices.`);
      return;
    }
    updateSelected({ puntos });
  };

  return (
    <section className="planos-editor">
      <header className="planos-editor-head">
        <button type="button" className="button-secondary" onClick={closeEditor}><Icon name="arrowLeft" />Volver</button>
        <div>
          <p className="sheet-kicker">Editor de Croquis</p>
          <h2>{barrio.nombre_barrio}</h2>
        </div>
        <div className="planos-editor-status">
          <StatusBadge status={version?.estado || barrio.estado} />
          <CroquisSyncStatus saveState={saveState} />
          <button type="button" className="button-secondary" onClick={() => saveDraft().then(() => toast.success("Borrador guardado.")).catch(() => {})} disabled={saving}><Save size={16} />{saving ? "Guardando" : "Guardar borrador"}</button>
          {saveState === "local" ? <button type="button" className="button-secondary" onClick={() => saveDraft().catch(() => {})} disabled={saving}><RotateCw size={16} />Reintentar</button> : null}
          <button type="button" className="button-secondary" onClick={exportPdf} disabled={saving || exporting}><Download size={16} />{exporting ? "Preparando" : "Guardar en PDF"}</button>
          <button type="button" className="button-secondary" onClick={downloadDraft} disabled={saving || exporting} title="Descargar como SVG vectorial">SVG</button>
          <button type="button" className="planos-primary-action" onClick={sendReview} disabled={saving || submitting}><Send size={16} />{submitting ? "Enviando" : "Enviar a revision"}</button>
        </div>
      </header>
      <div className="planos-toolbar">
        <div className="planos-tool-group">
          {primaryTools.map(([key, label, ToolIcon]) => (
            <button key={key} type="button" aria-label={label} title={label} className={tool === key ? "is-active" : ""} onClick={() => setTool(key)}>
              <ToolIcon size={16} /><span className="planos-tool-label">{label}</span>
            </button>
          ))}
        </div>
        <div className="planos-action-group">
          <button type="button" className={showLayers ? "is-active" : ""} onClick={() => setShowLayers((current) => !current)}><Layers size={16} />Capas</button>
          <label className="planos-layer-select"><Layers size={16} /><select value={activeLayer} onChange={(event) => setActiveLayer(event.target.value)}>{layerOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {["texto", "codigo", "punto"].includes(tool) ? <input value={content} onChange={(event) => setContent(event.target.value)} placeholder={tool === "codigo" ? "Numero" : "Texto u observacion"} /> : null}
          {singlePlacementTools.has(tool) ? <button type="button" className={continuousPlacement ? "is-active" : ""} onClick={() => setContinuousPlacement((current) => !current)}>Colocar varios</button> : null}
          {placementTools.has(tool) ? <button type="button" className={precisionMode ? "is-active" : ""} onClick={() => setPrecisionMode((current) => !current)}>Precision</button> : null}
          {secondaryTools.map(([key, label, ToolIcon]) => (
            <button key={key} type="button" aria-label={label} title={label} className={tool === key ? "is-active" : ""} onClick={() => setTool(key)}>
              <ToolIcon size={16} />{label}
            </button>
          ))}
        </div>
        <div className="planos-action-group planos-history-group">
          <button type="button" onClick={undo} disabled={!canUndo}><Undo2 size={16} />Deshacer</button>
          <button type="button" onClick={redo} disabled={!canRedo}><Redo2 size={16} />Rehacer</button>
        </div>
        <div className="planos-action-group planos-view-group">
          <button type="button" onClick={() => setZoom((current) => clampZoom(current - 0.5))}><Minus size={16} />Alejar</button>
          <button type="button" onClick={() => setZoom((current) => clampZoom(current + 0.5))}><Plus size={16} />Acercar</button>
          <button type="button" onClick={() => setRotation((current) => current - 15)}><RotateCcw size={16} />Girar izq.</button>
          <button type="button" onClick={() => setRotation((current) => current + 15)}><RotateCw size={16} />Girar der.</button>
          <button type="button" onClick={() => setRotation(0)}>Restablecer giro</button>
          {tool === "linea" ? <button type="button" className={snap ? "is-active" : ""} onClick={() => setSnap((current) => !current)}>Snap</button> : null}
        </div>
        <CroquisToolHint tool={tool} label={toolLabel[tool]} />
        <div className="planos-view-state">Zoom {Math.round(zoom * 100)}% · Giro {rotation} deg</div>
      </div>
      {showLayers ? <div className="planos-layers-panel">
        {layers.map((layer) => {
          const count = layer.key === "plano_base" ? 1 : elements.filter((item) => (item.data_json?.capa || "correcciones") === layer.key).length;
          return (
            <div key={layer.key} className={`planos-layer-row ${activeLayer === layer.key ? "is-active" : ""}`}>
              <button type="button" className="button-secondary planos-layer-name" onClick={() => setActiveLayer(layer.key)}>
                <span>{layer.label}</span>
                <small>{count}</small>
              </button>
              <button type="button" className="button-secondary" title={layer.visible ? "Ocultar" : "Mostrar"} onClick={() => updateLayer(layer.key, { visible: !layer.visible })}>{layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
              <button type="button" className="button-secondary" title={layer.locked ? "Desbloquear" : "Bloquear"} onClick={() => updateLayer(layer.key, { locked: !layer.locked })}>{layer.locked ? <Lock size={16} /> : <Unlock size={16} />}</button>
              <label>
                <span>{Math.round(layer.opacity * 100)}%</span>
                <input type="range" min="0.15" max="1" step="0.05" value={layer.opacity} onChange={(event) => updateLayer(layer.key, { opacity: Number(event.target.value) })} />
              </label>
            </div>
          );
        })}
      </div> : null}
      <div className="planos-editor-grid">
        <CanvasCroquis barrio={barrio} elements={elements} setElements={commitElements} selectedId={selectedId} setSelectedId={setSelectedId} tool={tool} onToolChange={setTool} content={content} activeLayer={activeLayer} layers={layers} polygonDraft={polygonDraft} setPolygonDraft={setPolygonDraft} zoom={zoom} setZoom={setZoom} rotation={rotation} setRotation={setRotation} snap={snap} continuousPlacement={continuousPlacement} precisionMode={precisionMode} />
        <AnimatePresence>
        {selected ? <motion.aside className="planos-properties" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
          <p className="sheet-kicker">Propiedades</p>
          <strong>{selected.tipo_elemento}</strong>
          {["texto", "codigo"].includes(selected.tipo_elemento) ? <label>Texto <input value={selected.data_json.contenido || ""} onChange={(event) => updateSelected({ contenido: event.target.value })} /></label> : null}
          {selected.tipo_elemento === "punto" ? <label>Etiqueta <input value={selected.data_json.descripcion || ""} onChange={(event) => updateSelected({ descripcion: event.target.value })} /></label> : null}
          {selected.tipo_elemento === "punto" ? <label>Tipo de punto <select value={selected.data_json.tipoPunto || "referencia"} onChange={(event) => updateSelected({ tipoPunto: event.target.value })}><option value="referencia">Referencia</option><option value="valvula">Valvula</option><option value="hidrante">Hidrante</option><option value="fuga">Fuga</option><option value="observacion">Observacion</option></select></label> : null}
          {selected.tipo_elemento === "punto" ? <label>Tamano <input type="number" min="6" max="40" value={selected.data_json.size || 12} onChange={(event) => updateSelected({ size: Number(event.target.value || 12) })} /></label> : null}
          <label>Capa <select value={selected.data_json.capa || "correcciones"} onChange={(event) => updateSelected({ capa: event.target.value })}>{layerOptions.filter(([key]) => key !== "plano_base").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Color <input type="color" value={selected.data_json.color || selected.data_json.colorBorde || "#0f172a"} onChange={(event) => updateSelected({ color: event.target.value, colorBorde: event.target.value })} /></label>
          {["texto", "codigo"].includes(selected.tipo_elemento) ? (
            <>
              <label>Tamano <input type="number" min="8" max="120" value={selected.data_json.fontSize || 22} onChange={(event) => updateSelected({ fontSize: Number(event.target.value || 22) })} /></label>
              <label>Rotacion <input type="number" min="-360" max="360" value={selected.data_json.rotacion || 0} onChange={(event) => updateSelected({ rotacion: Number(event.target.value || 0) })} /></label>
            </>
          ) : null}
          {selected.tipo_elemento === "tapado" ? (
            <div className="planos-position-grid">
              <label>Ancho <input type="number" min="10" max="500" value={selected.data_json.width || 80} onChange={(event) => updateSelected({ width: Number(event.target.value || 80) })} /></label>
              <label>Alto <input type="number" min="10" max="500" value={selected.data_json.height || 40} onChange={(event) => updateSelected({ height: Number(event.target.value || 40) })} /></label>
            </div>
          ) : null}
          {!Array.isArray(selected.data_json.puntos) ? (
            <div className="planos-position-grid">
              <label>X <input type="number" value={Math.round(Number(selected.data_json.x || 0))} onChange={(event) => updateSelected({ x: Number(event.target.value || 0) })} /></label>
              <label>Y <input type="number" value={Math.round(Number(selected.data_json.y || 0))} onChange={(event) => updateSelected({ y: Number(event.target.value || 0) })} /></label>
            </div>
          ) : (
            <>
              <label>Grosor <input type="number" min="1" max="20" value={selected.data_json.grosor || 3} onChange={(event) => updateSelected({ grosor: Number(event.target.value || 3) })} /></label>
              <div className="planos-vertex-list">
                {(selected.data_json.puntos || []).map((point, index) => (
                  <button key={`${selected.localId}-delete-vertex-${index}`} type="button" className="button-secondary" onClick={() => deleteSelectedVertex(index)}>
                    Eliminar vertice {index + 1} ({Math.round(Number(point.x || 0))}, {Math.round(Number(point.y || 0))})
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="planos-object-actions">
            <button type="button" className="button-secondary" onClick={copySelected}><Copy size={16} />Copiar</button>
            <button type="button" className="button-secondary" onClick={pasteSelected}><Clipboard size={16} />Pegar</button>
            <button type="button" className="button-secondary" onClick={duplicateSelected}><Copy size={16} />Duplicar</button>
            <button type="button" className="button-secondary" onClick={() => moveSelectedInStack("front")}><ArrowUp size={16} />Adelante</button>
            <button type="button" className="button-secondary" onClick={() => moveSelectedInStack("back")}><ArrowDown size={16} />Atras</button>
          </div>
          <button type="button" className="button-secondary" onClick={deleteSelected}><Trash2 size={16} />Eliminar</button>
          <button type="button" className="button-secondary" onClick={() => setSelectedId("")}>Cerrar</button>
          <div className="planos-mini-stats">
            <span>{elements.length}</span>
            <small>{activeLayerState?.label || "Capa"} {activeLayerState?.locked ? "bloqueada" : "editable"} · {activeLayerState?.visible ? "visible" : "oculta"}</small>
          </div>
        </motion.aside> : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default function PlanosWorkspace({ apiFetch, isAdmin = false, users = [] }) {
  const [tab, setTab] = useState("mios");
  const [barrios, setBarrios] = useState([]);
  const [mios, setMios] = useState([]);
  const [revision, setRevision] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [selectedBarrio, setSelectedBarrio] = useState(null);
  const [barrioId, setBarrioId] = useState("");
  const [form, setForm] = useState({ codigo_barrio: "", nombre_barrio: "", tecnico_id: "" });
  const [pdf, setPdf] = useState(null);

  const load = async () => {
    const [barriosRes, miosRes, historialRes] = await Promise.all([
      apiFetch("/planos/barrios"),
      apiFetch("/planos/asignaciones/mias"),
      apiFetch("/planos/versiones")
    ]);
    setBarrios((await barriosRes.json()).barrios || []);
    const myBarrios = sortDraftsFirst((await miosRes.json()).barrios || []);
    setMios(myBarrios);
    const draft = myBarrios.find((barrio) => ["borrador", "en_edicion", "devuelto"].includes(barrio.latest_version_estado || barrio.estado));
    if (!barrioId && draft) setBarrioId(String(draft.id));
    setHistorial((await historialRes.json()).versiones || []);
    if (isAdmin) {
      const revisionRes = await apiFetch("/planos/revision/pendientes");
      setRevision((await revisionRes.json()).versiones || []);
    }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const technicians = useMemo(() => users.filter((user) => user.is_active !== false), [users]);

  const createBarrio = async (event) => {
    event.preventDefault();
    const body = new FormData();
    body.set("codigo_barrio", form.codigo_barrio);
    body.set("nombre_barrio", form.nombre_barrio);
    if (pdf) body.set("pdf", pdf);
    const response = await apiFetch("/planos/barrios", { method: "POST", body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo crear el barrio.");
    setForm({ codigo_barrio: "", nombre_barrio: "", tecnico_id: "" });
    setPdf(null);
    await load();
  };

  const assign = async (barrioId) => {
    if (!form.tecnico_id) {
      toast.warning("Selecciona un tecnico.");
      return;
    }
    const response = await apiFetch("/planos/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barrio_id: barrioId, tecnico_id: form.tecnico_id })
    });
    if (!response.ok) toast.error((await response.json()).message || "No se pudo asignar.");
    await load();
  };

  const review = async (version, action) => {
    if (action === "publicar") {
      toast.warning("Publicar en Mapas Actualizados", {
        description: "Esta accion mandara el croquis a Mapas Actualizados.",
        action: {
          label: "Publicar",
          onClick: async () => {
            const response = await apiFetch(`/planos/versiones/${version.id}/publicar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ observacion: "" }) });
            if (!response.ok) toast.error((await response.json()).message || "No se pudo publicar.");
            else toast.success("Publicado en Mapas Actualizados.");
            await load();
          }
        }
      });
      return;
    }
    const observacion = action === "devolver" ? window.prompt("Observacion para devolver:", "") || "" : "";
    const response = await apiFetch(`/planos/versiones/${version.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacion })
    });
    if (!response.ok) toast.error((await response.json()).message || "No se pudo revisar.");
    await load();
  };

  const downloadUpdatedMap = async (version) => {
    try {
      const sourceBarrio = barrios.find((barrio) => Number(barrio.id) === Number(version.barrio_id)) || mios.find((barrio) => Number(barrio.id) === Number(version.barrio_id)) || {};
      const filename = croquisFileName({ ...sourceBarrio, ...version }, version.numero_version || 1, "pdf");
      if (version.archivo_pdf_final) {
        const stored = await apiFetch(version.archivo_pdf_final);
        if (!stored.ok) throw new Error("No se pudo descargar el PDF guardado.");
        triggerDownload(await stored.blob(), filename);
        toast.success("PDF actualizado descargado.");
        return;
      }
      const response = await apiFetch(`/planos/${version.barrio_id}/elementos?versionId=${version.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron cargar las correcciones.");
      const blob = await buildCroquisPdfBlob({
        barrio: { ...sourceBarrio, ...version, archivo_pdf: version.archivo_pdf || sourceBarrio.archivo_pdf },
        elements: normalizeElements(data.elements || [])
      });
      triggerDownload(blob, filename);
      toast.success("PDF actualizado descargado.");
    } catch (error) {
      toast.error(error.message || "No se pudo descargar el mapa actualizado.");
    }
  };

  if (selectedBarrio) {
    return <EditorCroquis apiFetch={apiFetch} barrio={selectedBarrio} onClose={() => { setSelectedBarrio(null); load().catch(() => {}); }} />;
  }

  const currentList = tab === "mios" ? mios : barrios;
  const pickedBarrio = currentList.find((barrio) => String(barrio.id) === barrioId) || null;
  const pickedState = pickedBarrio?.latest_version_estado || pickedBarrio?.estado;
  const mapasActualizados = historial.filter((version) => ["aprobado", "publicado"].includes(version.estado));

  return (
    <section className="planos-workspace">
      <div className="planos-header">
        <div>
          <p className="sheet-kicker">Planos y Croquis</p>
          <h2>Actualizacion editable de barrios</h2>
          <p>PDF base + capa editable JSON para revision y publicacion.</p>
        </div>
        <div className="planos-tabs">
          {["mios", "barrios", "revision", "mapas", "historial"].map((key) => (
            <button key={key} type="button" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
              {key === "mios" ? "Mis Croquis" : key === "barrios" ? "Barrios" : key === "revision" ? "Planos finalizados" : key === "mapas" ? "Mapas Actualizados" : "Historial"}
            </button>
          ))}
        </div>
      </div>

      {tab === "barrios" && isAdmin ? (
        <form className="planos-create-card" onSubmit={createBarrio}>
          <input value={form.codigo_barrio} onChange={(event) => setForm((current) => ({ ...current, codigo_barrio: event.target.value }))} placeholder="Codigo barrio" />
          <input value={form.nombre_barrio} onChange={(event) => setForm((current) => ({ ...current, nombre_barrio: event.target.value }))} placeholder="Nombre barrio" />
          <input type="file" accept="application/pdf" onChange={(event) => setPdf(event.target.files?.[0] || null)} />
          <select value={form.tecnico_id} onChange={(event) => setForm((current) => ({ ...current, tecnico_id: event.target.value }))}>
            <option value="">Tecnico para asignar</option>
            {technicians.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}
          </select>
          <button type="submit">Crear barrio</button>
        </form>
      ) : null}

      {["mios", "barrios"].includes(tab) ? (
        <div className="planos-picker">
          <select value={barrioId} onChange={(event) => setBarrioId(event.target.value)}>
            <option value="">Selecciona un barrio</option>
            {currentList.map((barrio) => <option key={barrio.id} value={barrio.id}>{barrio.codigo_barrio} - {barrio.nombre_barrio}</option>)}
          </select>
          <button type="button" disabled={!pickedBarrio || pickedState === "enviado_revision"} onClick={() => setSelectedBarrio(pickedBarrio)}>{pickedState === "enviado_revision" ? "En revision" : "Editar croquis"}</button>
          {tab === "barrios" && isAdmin ? <button type="button" className="button-secondary" disabled={!pickedBarrio} onClick={() => assign(pickedBarrio.id)}>Asignar</button> : null}
          {pickedBarrio ? (
            <div className="planos-picker-summary">
              <strong>{pickedBarrio.nombre_barrio}</strong>
              <span>{pickedBarrio.archivo_pdf ? "PDF base cargado" : "Sin PDF base"}</span>
              <StatusBadge status={pickedBarrio.latest_version_estado || pickedBarrio.estado} />
            </div>
          ) : null}
          {!currentList.length ? <p>No hay barrios para mostrar.</p> : null}
        </div>
      ) : null}

      {tab === "revision" ? (
        <div className="planos-table">
          {revision.map((version) => (
            <article key={version.id}>
              <strong>{version.nombre_barrio || `Barrio ${version.barrio_id}`}</strong>
              <span>Version {version.numero_version}</span>
              <button type="button" onClick={() => review(version, "aprobar")}>Aprobar</button>
              <button type="button" onClick={() => review(version, "devolver")}>Devolver</button>
            </article>
          ))}
          {!revision.length ? <p>No hay planos finalizados pendientes de revisar.</p> : null}
        </div>
      ) : null}

      {tab === "historial" ? (
        <div className="planos-table">
          {historial.map((version) => (
            <article key={version.id}>
              <strong>{version.nombre_barrio || `Barrio ${version.barrio_id}`}</strong>
              <span>Version {version.numero_version}</span>
              <StatusBadge status={version.estado} />
              {["aprobado", "publicado"].includes(version.estado) ? <button type="button" className="button-secondary" onClick={() => downloadUpdatedMap(version)}><Download size={16} />Descargar</button> : null}
              {isAdmin && version.estado === "aprobado" ? <button type="button" onClick={() => review(version, "publicar")}>Publicar</button> : null}
            </article>
          ))}
        </div>
      ) : null}

      {tab === "mapas" ? (
        <div className="planos-table">
          {mapasActualizados.map((version) => (
            <article key={version.id}>
              <strong>{version.nombre_barrio || `Barrio ${version.barrio_id}`}</strong>
              <span>Version {version.numero_version}</span>
              <StatusBadge status={version.estado} />
              <button type="button" className="button-secondary" onClick={() => downloadUpdatedMap(version)}><Download size={16} />Descargar</button>
              {isAdmin && version.estado === "aprobado" ? <button type="button" onClick={() => review(version, "publicar")}>Publicar en Mapas Actualizados</button> : null}
            </article>
          ))}
          {!mapasActualizados.length ? <p>No hay mapas aprobados o publicados.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
