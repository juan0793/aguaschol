import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, Download, Edit3, Eraser, Layers, LocateFixed, Map as MapIcon, Minus, MousePointer2, Move, Pentagon, Plus, Redo2, RotateCcw, RotateCw, Save, Send, Square, Type, Undo2 } from "lucide-react";
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { toast } from "sonner";
import { API_URL } from "../../config/api";
import { Icon } from "../../components/Icon";
import { nextLineDraft, pushEditorHistory, redoEditorHistory, undoEditorHistory } from "./planosEditorHistory";

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
  ["poligono", "Poligono", Pentagon],
  ["texto", "Texto", Type],
  ["codigo", "Codigo", MapIcon],
  ["punto", "Punto", LocateFixed],
  ["tapado", "Tapar", Square],
  ["borrar", "Borrar", Eraser]
];
const deleteTool = tools.find(([key]) => key === "borrar");
const drawingTools = tools.filter(([key]) => key !== "borrar");

const editorLayers = [
  ["correcciones", "Correcciones"],
  ["codigos", "Codigos"],
  ["puntos", "Puntos"]
];

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

const sortDraftsFirst = (items = []) => [...items].sort((a, b) => {
  const score = (item) => (["borrador", "en_edicion", "devuelto"].includes(item.latest_version_estado || item.estado) ? 0 : 1);
  return score(a) - score(b);
});

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const toAssetUrl = (value = "") => (/^https?:\/\//i.test(value) ? value : value ? `${API_URL}${value}` : "");
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
  elements.map((item) => ({
    localId: item.localId || String(item.id || uid()),
    tipo_elemento: item.tipo_elemento || item.tipo || "texto",
    data_json: {
      capa: "correcciones",
      ...(item.data_json?.data_json || item.data_json || item.data || {})
    }
  }));

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const renderCroquisBackground = async (baseUrl) => {
  if (isPdf(baseUrl)) {
    const pdfjsLib = await loadPdfJs();
    const bytes = await fetch(baseUrl).then((response) => {
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

const drawCroquisElements = (ctx, elements = []) => {
  elements.forEach((element) => {
    const data = element.data_json || {};
    ctx.save();
    if (element.tipo_elemento === "linea" || element.tipo_elemento === "poligono") {
      const points = data.puntos || [];
      if (points.length) {
        ctx.beginPath();
        ctx.moveTo(Number(points[0].x || 0), Number(points[0].y || 0));
        points.slice(1).forEach((point) => ctx.lineTo(Number(point.x || 0), Number(point.y || 0)));
        if (element.tipo_elemento === "poligono") {
          ctx.closePath();
          ctx.fillStyle = data.relleno || "rgba(21,118,209,0.12)";
          ctx.fill();
        }
        ctx.strokeStyle = data.color || data.colorBorde || "#0f172a";
        ctx.lineWidth = Number(data.grosor || 3);
        ctx.stroke();
      }
    } else if (element.tipo_elemento === "punto") {
      ctx.beginPath();
      ctx.arc(Number(data.x || 0), Number(data.y || 0), 12, 0, Math.PI * 2);
      ctx.fillStyle = data.color || "#1576d1";
      ctx.fill();
    } else if (element.tipo_elemento === "tapado") {
      ctx.fillStyle = data.color || "#ffffff";
      ctx.fillRect(Number(data.x || 0), Number(data.y || 0), Number(data.width || 80), Number(data.height || 40));
    } else {
      const fontSize = Number(data.fontSize || 22);
      ctx.translate(Number(data.x || 0), Number(data.y || 0));
      ctx.rotate(Number(data.rotacion || 0) * Math.PI / 180);
      ctx.fillStyle = data.color || "#0f172a";
      ctx.font = `800 ${fontSize}px sans-serif`;
      ctx.fillText(data.contenido || "", 0, fontSize);
    }
    ctx.restore();
  });
};

const moveElement = (element, dx, dy) => {
  const data = element.data_json || {};
  if (Array.isArray(data.puntos)) {
    return { ...element, data_json: { ...data, puntos: data.puntos.map((point) => ({ x: Number(point.x || 0) + dx, y: Number(point.y || 0) + dy })) } };
  }
  return { ...element, data_json: { ...data, x: Number(data.x || 0) + dx, y: Number(data.y || 0) + dy } };
};

const StatusBadge = ({ status }) => <span className={`planos-status is-${status || "pendiente"}`}>{statusLabel[status] || status || "Pendiente"}</span>;

function CanvasCroquis({ barrio, elements, setElements, selectedId, setSelectedId, tool, content, activeLayer, polygonDraft, setPolygonDraft, zoom, setZoom, rotation, setRotation, snap }) {
  const shellRef = useRef(null);
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const transformerRef = useRef(null);
  const shapeRefs = useRef({});
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
  const showPrecision = precisionTools.includes(tool);
  const selected = elements.find((item) => item.localId === selectedId);

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
        image.crossOrigin = "anonymous";
        image.onload = () => {
          const next = { image, width: image.naturalWidth || 1000, height: image.naturalHeight || 700 };
          pdfBackgroundCache.set(baseUrl, next);
          if (!cancelled) setBackground({ ...next, loading: false, error: "" });
        };
        image.src = baseUrl;
        return;
      }
      const pdfjsLib = await loadPdfJs();
      const bytes = await fetch(baseUrl).then((response) => {
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

  const stagePoint = (stage) => {
    const pointer = stage.getPointerPosition();
    return pointer ? getImagePointFromScreenPoint(pointer) : null;
  };

  const centerPoint = () => getImagePointFromScreenPoint({ x: stageSize.width / 2, y: stageSize.height / 2 });
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

  const zoomAtPoint = (pointer, nextZoom) => {
    const imagePoint = getImagePointFromScreenPoint(pointer);
    const projected = getScreenPointFromImagePoint(imagePoint, nextZoom);
    setZoom(nextZoom);
    setViewPos((current) => ({ x: current.x + pointer.x - projected.x, y: current.y + pointer.y - projected.y }));
  };

  const addLinePoint = (point, useSnap = false) => {
    const finalPoint = lineDraft && useSnap ? snapPoint(lineDraft.start, point) : point;
    const next = nextLineDraft(lineDraft, finalPoint, activeLayer);
    if (!next.line) {
      setLineDraft(next.draft);
      setPointerPreview(finalPoint);
      toast.info("Punto inicial colocado.");
      return;
    }
    setElements((current) => [...current, { localId: uid(), ...next.line }]);
    setLineDraft(next.draft);
    setPointerPreview(null);
    toast.success("Linea agregada.");
  };

  const addElement = (point) => {
    if (tool === "texto" || tool === "codigo") {
      const text = content.trim() || (tool === "codigo" ? "10-00-00-00" : "Texto");
      setElements((current) => [...current, { localId: uid(), tipo_elemento: tool, data_json: { capa: activeLayer, x: point.x, y: point.y, contenido: text, fontSize: tool === "codigo" ? 28 : 22, rotacion: 0, color: "#0f172a" } }]);
      return;
    }
    if (tool === "punto") {
      setElements((current) => [...current, { localId: uid(), tipo_elemento: "punto", data_json: { capa: activeLayer, x: point.x, y: point.y, descripcion: content.trim() || "", color: "#1576d1" } }]);
      toast.success("Punto agregado.");
      return;
    }
    if (tool === "tapado") {
      setElements((current) => [...current, { localId: uid(), tipo_elemento: "tapado", data_json: { capa: activeLayer, x: point.x - 40, y: point.y - 20, width: 80, height: 40, color: "#ffffff" } }]);
      toast.success("Tapado agregado.");
      return;
    }
    if (tool === "poligono") {
      setPolygonDraft((current) => [...current, point]);
    }
  };

  const handleStageDown = (event) => {
    if (event.evt.touches?.length >= 2) {
      const touches = event.evt.touches;
      const distance = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      const angle = Math.atan2(touches[1].clientY - touches[0].clientY, touches[1].clientX - touches[0].clientX) * 180 / Math.PI;
      pinchRef.current = { distance, angle, zoom, rotation, viewPos };
      setIsPanning(true);
      return;
    }
    if (event.target !== event.target.getStage()) return;
    if (tool === "pan") {
      panRef.current = { pointer: event.target.getStage().getPointerPosition(), start: viewPos };
      setIsPanning(true);
      return;
    }
    if (showPrecision) {
      const stage = event.target.getStage();
      panRef.current = { pointer: stage.getPointerPosition(), imagePoint: stagePoint(stage), start: viewPos, moved: false, touch: Boolean(event.evt.touches) };
      setIsPanning(true);
      return;
    }
    const point = stagePoint(event.target.getStage());
    if (!point) return;
    if (tool === "linea") {
      addLinePoint(point, snap || event.evt.shiftKey);
      return;
    }
    if (tool === "borrar") {
      toast.info("El plano base no se puede borrar. Solo puedes borrar correcciones agregadas.");
      return;
    }
    if (["poligono", "texto", "codigo", "punto"].includes(tool)) addElement(point);
    if (tool === "select") setSelectedId("");
  };

  const handleStageMove = (event) => {
    if (event.evt.touches?.length >= 2 && pinchRef.current) {
      event.evt.preventDefault();
      const touches = event.evt.touches;
      const distance = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      const angle = Math.atan2(touches[1].clientY - touches[0].clientY, touches[1].clientX - touches[0].clientX) * 180 / Math.PI;
      zoomAtPoint(touchCenterPoint(touches), clampZoom(pinchRef.current.zoom * (distance / pinchRef.current.distance)));
      setRotation(Math.round(pinchRef.current.rotation + angle - pinchRef.current.angle));
      return;
    }
    if (panRef.current) {
      const pointer = event.target.getStage().getPointerPosition();
      if (!pointer || !panRef.current.pointer) return;
      setViewPos({
        x: panRef.current.start.x + pointer.x - panRef.current.pointer.x,
        y: panRef.current.start.y + pointer.y - panRef.current.pointer.y
      });
      if (Math.hypot(pointer.x - panRef.current.pointer.x, pointer.y - panRef.current.pointer.y) > (event.evt.touches ? 22 : 6)) panRef.current.moved = true;
      return;
    }
    if (tool === "linea" && lineDraft) {
      const point = stagePoint(event.target.getStage());
      if (point) setPointerPreview(snap || event.evt.shiftKey ? snapPoint(lineDraft.start, point) : point);
      return;
    }
  };

  const handleStageUp = (event) => {
    if (showPrecision && panRef.current && !panRef.current.moved) {
      if (panRef.current.touch) setViewPos(panRef.current.start);
      const point = panRef.current.touch ? panRef.current.imagePoint : stagePoint(event.target.getStage()) || panRef.current.imagePoint;
      if (point) {
        if (tool === "linea") addLinePoint(point, snap || event.evt.shiftKey);
        else addElement(point);
      }
    }
    panRef.current = null;
    pinchRef.current = null;
    setIsPanning(false);
  };

  const handleWheel = (event) => {
    event.evt.preventDefault();
    const pointer = event.target.getStage().getPointerPosition();
    if (pointer) zoomAtPoint(pointer, clampZoom(zoom * (event.evt.deltaY > 0 ? 0.9 : 1.1)));
  };

  const handleElementDown = (event, element) => {
    if (tool === "pan" || showPrecision) {
      event.cancelBubble = true;
      const stage = event.target.getStage();
      panRef.current = { pointer: stage.getPointerPosition(), imagePoint: stagePoint(stage), start: viewPos, moved: false, touch: Boolean(event.evt.touches) };
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
    if (polygonDraft.length < 3) return;
    setElements((current) => [...current, { localId: uid(), tipo_elemento: "poligono", data_json: { capa: activeLayer, puntos: polygonDraft, colorBorde: "#0f172a", grosor: 2, relleno: "rgba(21,118,209,0.12)" } }]);
    setPolygonDraft([]);
  };

  return (
    <div ref={shellRef} className={`planos-editor-stage is-tool-${tool}`}>
      {background.loading || background.error || !baseUrl ? (
        <div className="planos-canvas-message">{background.loading ? "Preparando fondo..." : background.error || "Sube un PDF base para este barrio."}</div>
      ) : null}
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleStageDown}
        onTouchStart={handleStageDown}
        onMouseMove={handleStageMove}
        onTouchMove={handleStageMove}
        onMouseUp={handleStageUp}
        onTouchEnd={handleStageUp}
        onWheel={handleWheel}
      >
        <Layer name="background-layer">
          <Group {...groupProps}>
            {background.image ? <KonvaImage image={background.image} width={background.width} height={background.height} listening={false} /> : null}
          </Group>
        </Layer>
        <Layer name="objects-layer">
          <Group {...groupProps}>
            {elements.map((element) => {
              const data = element.data_json || {};
              const selected = selectedId === element.localId;
              const stroke = selected ? "#1576d1" : data.color || data.colorBorde || "#0f172a";
              if (element.tipo_elemento === "linea" || element.tipo_elemento === "poligono") {
                return (
                  <Line
                    key={element.localId}
                    points={(data.puntos || []).flatMap((point) => [Number(point.x || 0), Number(point.y || 0)])}
                    closed={element.tipo_elemento === "poligono"}
                    fill={element.tipo_elemento === "poligono" ? data.relleno || "rgba(21,118,209,0.12)" : undefined}
                    stroke={stroke}
                    strokeWidth={selected ? Number(data.grosor || 2) + 2 : Number(data.grosor || 3)}
                    hitStrokeWidth={44}
                    draggable={tool === "select"}
                    onMouseDown={(event) => handleElementDown(event, element)}
                    onTouchStart={(event) => handleElementDown(event, element)}
                    onDragEnd={(event) => moveByDrag(element, event)}
                  />
                );
              }
              if (element.tipo_elemento === "punto") {
                return (
                  <Group key={element.localId} x={Number(data.x || 0)} y={Number(data.y || 0)} draggable={tool === "select"} onMouseDown={(event) => handleElementDown(event, element)} onTouchStart={(event) => handleElementDown(event, element)} onDragEnd={(event) => moveByDrag(element, event)}>
                    <Circle radius={26} fill="rgba(0,0,0,0)" />
                    <Circle radius={12} fill={selected ? "#0f9f8f" : data.color || "#1576d1"} />
                  </Group>
                );
              }
              if (element.tipo_elemento === "tapado") {
                return (
                  <Rect
                    key={element.localId}
                    ref={(node) => { if (node) shapeRefs.current[element.localId] = node; }}
                    x={Number(data.x || 0)}
                    y={Number(data.y || 0)}
                    width={Number(data.width || 80)}
                    height={Number(data.height || 40)}
                    fill={data.color || "#ffffff"}
                    stroke={selected ? "#1576d1" : data.color || "#ffffff"}
                    strokeWidth={selected ? 2 : 0}
                    draggable={tool === "select"}
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
                  draggable={tool === "select"}
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
            {lineDraft ? <Line points={[lineDraft.start.x, lineDraft.start.y, (showPrecision ? centerPoint() : pointerPreview || lineDraft.start).x, (showPrecision ? centerPoint() : pointerPreview || lineDraft.start).y]} stroke="#1576d1" strokeWidth={3} dash={[10, 8]} listening={false} /> : null}
            {polygonDraft.length ? <Line points={polygonDraft.flatMap((point) => [point.x, point.y])} stroke="#1576d1" strokeWidth={3} dash={[10, 8]} /> : null}
          </Group>
        </Layer>
      </Stage>
      {showPrecision ? (
        <>
          <div className="planos-crosshair"><Crosshair size={42} /><span>{centerPoint().x}, {centerPoint().y}</span></div>
          <div className="planos-precision-actions">
            <button type="button" onClick={() => {
              const point = centerPoint();
              if (tool === "linea") addLinePoint(point, snap);
              else addElement(point);
            }}>{tool === "linea" || tool === "poligono" ? "Agregar punto" : tool === "tapado" ? "Tapar" : "Colocar"}</button>
            {lineDraft ? <button type="button" onClick={() => { setLineDraft(null); setPointerPreview(null); }}>Cancelar</button> : null}
          </div>
        </>
      ) : null}
      {isPanning ? <div className="planos-pan-guide"><span>Centro {centerDelta().dx}, {centerDelta().dy} · Giro {centerDelta().tilt}°</span></div> : null}
      <button type="button" className="planos-fit-button" onClick={() => { setZoom(1); setRotation(0); setViewPos({ x: 0, y: 0 }); }}>Ajustar</button>
      {polygonDraft.length >= 3 ? <button type="button" className="planos-finish-polygon" onClick={finishPolygon}>Cerrar poligono</button> : null}
    </div>
  );
}

function EditorCroquis({ apiFetch, barrio, onClose }) {
  const [elements, setElements] = useState([]);
  const [version, setVersion] = useState(null);
  const [tool, setTool] = useState("select");
  const [content, setContent] = useState("");
  const [activeLayer, setActiveLayer] = useState("correcciones");
  const [selectedId, setSelectedId] = useState("");
  const [polygonDraft, setPolygonDraft] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [snap, setSnap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const hydratedRef = useRef(false);
  const hasLocalDraftRef = useRef(false);
  const lastSavedRef = useRef("[]");
  const historyRef = useRef({ past: [], future: [] });

  const selected = elements.find((item) => item.localId === selectedId);
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
      .then((response) => response.json())
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

  const undo = () => {
    setElements((current) => {
      const result = undoEditorHistory(historyRef.current, current);
      historyRef.current = result.history;
      setSelectedId("");
      return result.next;
    });
  };

  const redo = () => {
    setElements((current) => {
      const result = redoEditorHistory(historyRef.current, current);
      historyRef.current = result.history;
      setSelectedId("");
      return result.next;
    });
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar.");
      setVersion(data.version || version);
      const savedElements = normalizeElements(data.elements || elements);
      lastSavedRef.current = JSON.stringify(savedElements);
      hasLocalDraftRef.current = false;
      window.localStorage.removeItem(localDraftKey(barrio.id));
      setElements(savedElements);
      setSaveState("saved");
      return savedElements;
    } catch (error) {
      hasLocalDraftRef.current = true;
      window.localStorage.setItem(localDraftKey(barrio.id), JSON.stringify(elements));
      setSaveState("local");
      if (!silent) toast.error(error.message || "No se pudo guardar en el servidor. Borrador local pendiente.");
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (saveState === "dirty" || saveState === "local") saveDraft({ silent: saveState === "local" }).catch(() => {});
  }, [tool]);

  const sendReview = async () => {
    if (!elements.length) {
      toast.warning("Agrega al menos un cambio antes de enviar a revision.");
      return;
    }
    await saveDraft();
    const response = await apiFetch(`/planos/${barrio.id}/enviar-revision`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo enviar.");
    setVersion(data);
  };

  const closeEditor = async () => {
    if (saveState === "dirty" || saveState === "local") {
      toast.warning("Tienes cambios sin guardar.", {
        description: "Guarda el borrador antes de salir para continuar despues.",
        action: {
          label: "Guardar",
          onClick: async () => {
            await saveDraft().catch(() => {
              toast.warning("No se pudo guardar en el servidor. El borrador queda guardado localmente en este equipo.");
            });
            onClose();
          }
        }
      });
      return;
    }
    onClose();
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    commitElements((current) => current.map((item) => item.localId === selected.localId ? { ...item, data_json: { ...item.data_json, ...patch } } : item));
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
          <span className={`planos-save-state is-${saveState}`}>
            {saveState === "saving" ? "Guardando..." : saveState === "dirty" ? "Cambios sin guardar" : saveState === "local" ? "Borrador local pendiente de subir" : saveState === "error" ? "Error al guardar" : "Todo guardado"}
          </span>
        </div>
      </header>
      <div className="planos-toolbar">
        <div className="planos-tool-group">
          {drawingTools.map(([key, label, ToolIcon]) => <button key={key} type="button" className={tool === key ? "is-active" : ""} onClick={() => setTool(key)}><ToolIcon size={16} />{label}</button>)}
        </div>
        {deleteTool ? <button type="button" className={`planos-delete-tool ${tool === "borrar" ? "is-active" : ""}`} onClick={() => setTool("borrar")}><Eraser size={16} />Borrar</button> : null}
        <div className="planos-action-group">
          <label className="planos-layer-select"><Layers size={16} /><select value={activeLayer} onChange={(event) => setActiveLayer(event.target.value)}>{editorLayers.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {["texto", "codigo", "punto"].includes(tool) ? <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="Texto, codigo u observacion" /> : null}
          <button type="button" onClick={undo} disabled={!canUndo}><Undo2 size={16} />Deshacer</button>
          <button type="button" onClick={redo} disabled={!canRedo}><Redo2 size={16} />Rehacer</button>
          <button type="button" onClick={() => setZoom((current) => clampZoom(current - 0.5))}><Minus size={16} />Zoom</button>
          <button type="button" onClick={() => setZoom((current) => clampZoom(current + 0.5))}><Plus size={16} />Zoom</button>
          <button type="button" onClick={() => setRotation((current) => current - 15)}><RotateCcw size={16} />Girar</button>
          <button type="button" onClick={() => setRotation((current) => current + 15)}><RotateCw size={16} />Girar</button>
          <button type="button" onClick={() => setRotation(0)}>0 deg</button>
          {tool === "linea" ? <button type="button" className={snap ? "is-active" : ""} onClick={() => setSnap((current) => !current)}>Snap</button> : null}
          <button type="button" onClick={() => saveDraft()} disabled={saving}><Save size={16} />{saving ? "Guardando" : "Guardar borrador"}</button>
          <button type="button" className="planos-primary-action" onClick={sendReview}><Send size={16} />Revision</button>
        </div>
        <div className="planos-view-state">{tool} · Zoom {Math.round(zoom * 100)}% · Giro {rotation} deg{tool === "linea" ? " · Mueve el mapa y agrega puntos" : ""}</div>
      </div>
      <div className="planos-editor-grid">
        <CanvasCroquis barrio={barrio} elements={elements} setElements={commitElements} selectedId={selectedId} setSelectedId={setSelectedId} tool={tool} content={content} activeLayer={activeLayer} polygonDraft={polygonDraft} setPolygonDraft={setPolygonDraft} zoom={zoom} setZoom={setZoom} rotation={rotation} setRotation={setRotation} snap={snap} />
        <AnimatePresence>
        {selected ? <motion.aside className="planos-properties" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
          <p className="sheet-kicker">Propiedades</p>
          <strong>{selected.tipo_elemento}</strong>
          {["texto", "codigo"].includes(selected.tipo_elemento) ? <label>Texto <input value={selected.data_json.contenido || ""} onChange={(event) => updateSelected({ contenido: event.target.value })} /></label> : null}
          {selected.tipo_elemento === "punto" ? <label>Etiqueta <input value={selected.data_json.descripcion || ""} onChange={(event) => updateSelected({ descripcion: event.target.value })} /></label> : null}
          <label>Capa <select value={selected.data_json.capa || "correcciones"} onChange={(event) => updateSelected({ capa: event.target.value })}>{editorLayers.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
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
            <label>Grosor <input type="number" min="1" max="20" value={selected.data_json.grosor || 3} onChange={(event) => updateSelected({ grosor: Number(event.target.value || 3) })} /></label>
          )}
          <button type="button" className="button-secondary" onClick={() => commitElements((current) => current.filter((item) => item.localId !== selected.localId))}>Eliminar</button>
          <button type="button" className="button-secondary" onClick={() => setSelectedId("")}>Cerrar</button>
          <div className="planos-mini-stats">
            <span>{elements.length}</span>
            <small>{editorLayers.map(([key, label]) => `${label}: ${elements.filter((item) => (item.data_json?.capa || "correcciones") === key).length}`).join(" · ")}</small>
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
      const baseUrl = toAssetUrl(version.baseUrl || version.base_url || version.fondo_url || version.archivo_fondo || version.archivo_pdf || sourceBarrio.archivo_pdf);
      if (!baseUrl) throw new Error("Este croquis no tiene archivo base para descargar.");
      const response = await apiFetch(`/planos/${version.barrio_id}/elementos`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron cargar las correcciones.");
      const canvas = await renderCroquisBackground(baseUrl);
      drawCroquisElements(canvas.getContext("2d"), normalizeElements(data.elements || []));
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `croquis-${version.codigo_barrio || version.barrio_id}-v${version.numero_version || 1}.png`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Mapa actualizado descargado.");
    } catch (error) {
      toast.error(error.message || "No se pudo descargar el mapa actualizado.");
    }
  };

  if (selectedBarrio) {
    return <EditorCroquis apiFetch={apiFetch} barrio={selectedBarrio} onClose={() => { setSelectedBarrio(null); load().catch(() => {}); }} />;
  }

  const currentList = tab === "mios" ? mios : barrios;
  const pickedBarrio = currentList.find((barrio) => String(barrio.id) === barrioId) || null;
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
              {key === "mios" ? "Mis Croquis" : key === "barrios" ? "Barrios" : key === "revision" ? "Revision" : key === "mapas" ? "Mapas Actualizados" : "Historial"}
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
          <button type="button" disabled={!pickedBarrio} onClick={() => setSelectedBarrio(pickedBarrio)}>Editar croquis</button>
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
          {!revision.length ? <p>No hay croquis enviados a revision.</p> : null}
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
