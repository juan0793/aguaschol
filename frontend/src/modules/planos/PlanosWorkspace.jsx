import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Edit3, Eraser, LocateFixed, Map as MapIcon, Minus, MousePointer2, Move, Pentagon, Plus, Save, Send, Type } from "lucide-react";
import { Circle, Group, Image as KonvaImage, Layer, Line, Stage, Text } from "react-konva";
import { API_URL } from "../../config/api";
import { Icon } from "../../components/Icon";

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
  ["borrar", "Borrar", Eraser]
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

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const toPdfUrl = (value = "") => (/^https?:\/\//i.test(value) ? value : value ? `${API_URL}${value}` : "");
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
    data_json: item.data_json?.data_json || item.data_json || item.data || {}
  }));

const moveElement = (element, dx, dy) => {
  const data = element.data_json || {};
  if (Array.isArray(data.puntos)) {
    return { ...element, data_json: { ...data, puntos: data.puntos.map((point) => ({ x: Number(point.x || 0) + dx, y: Number(point.y || 0) + dy })) } };
  }
  return { ...element, data_json: { ...data, x: Number(data.x || 0) + dx, y: Number(data.y || 0) + dy } };
};

const StatusBadge = ({ status }) => <span className={`planos-status is-${status || "pendiente"}`}>{statusLabel[status] || status || "Pendiente"}</span>;

function CanvasCroquis({ barrio, elements, setElements, selectedId, setSelectedId, tool, content, polygonDraft, setPolygonDraft, zoom, setZoom }) {
  const shellRef = useRef(null);
  const panRef = useRef(null);
  const draftRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 700 });
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const [background, setBackground] = useState({ image: null, width: 1000, height: 700, loading: false, error: "" });
  const [draftObject, setDraftObject] = useState(null);
  const pdfUrl = toPdfUrl(barrio?.archivo_pdf);
  const fitScale = Math.min(stageSize.width / background.width, stageSize.height / background.height) || 1;
  const scale = fitScale * zoom;
  const imageX = (stageSize.width - background.width * scale) / 2 + viewPos.x;
  const imageY = (stageSize.height - background.height * scale) / 2 + viewPos.y;

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
    if (!pdfUrl) {
      setBackground({ image: null, width: 1000, height: 700, loading: false, error: "" });
      return () => { cancelled = true; };
    }
    if (pdfBackgroundCache.has(pdfUrl)) {
      setBackground({ ...pdfBackgroundCache.get(pdfUrl), loading: false, error: "" });
      return () => { cancelled = true; };
    }
    setBackground((current) => ({ ...current, loading: true, error: "" }));
    (async () => {
      const pdfjsLib = await loadPdfJs();
      const bytes = await fetch(pdfUrl).then((response) => {
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
        pdfBackgroundCache.set(pdfUrl, next);
        if (!cancelled) setBackground({ ...next, loading: false, error: "" });
      };
      image.src = canvas.toDataURL("image/png");
    })().catch((error) => {
      if (!cancelled) setBackground({ image: null, width: 1000, height: 700, loading: false, error: error.message || "No se pudo preparar el fondo." });
    });
    return () => { cancelled = true; };
  }, [pdfUrl]);

  useEffect(() => {
    draftRef.current = null;
    setDraftObject(null);
    if (tool !== "poligono") setPolygonDraft([]);
  }, [setPolygonDraft, tool]);

  const stagePoint = (stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: Math.round((pointer.x - imageX) / scale),
      y: Math.round((pointer.y - imageY) / scale)
    };
  };

  const addElement = (point) => {
    if (tool === "texto" || tool === "codigo") {
      const text = content.trim() || (tool === "codigo" ? "10-00-00-00" : "Texto");
      setElements((current) => [...current, { localId: uid(), tipo_elemento: tool, data_json: { x: point.x, y: point.y, contenido: text, fontSize: tool === "codigo" ? 28 : 22, rotacion: 0, color: "#0f172a" } }]);
      return;
    }
    if (tool === "punto") {
      setElements((current) => [...current, { localId: uid(), tipo_elemento: "punto", data_json: { x: point.x, y: point.y, descripcion: content.trim() || "", color: "#1576d1" } }]);
      return;
    }
    if (tool === "poligono") {
      setPolygonDraft((current) => [...current, point]);
    }
  };

  const handleStageDown = (event) => {
    if (event.target !== event.target.getStage()) return;
    if (tool === "pan") {
      panRef.current = { pointer: event.target.getStage().getPointerPosition(), start: viewPos };
      return;
    }
    const point = stagePoint(event.target.getStage());
    if (!point) return;
    if (tool === "linea") {
      const draft = { tipo_elemento: "linea", data_json: { puntos: [point, point], color: "#1576d1", grosor: 3 } };
      draftRef.current = draft;
      setDraftObject(draft);
      return;
    }
    if (["poligono", "texto", "codigo", "punto"].includes(tool)) addElement(point);
    if (tool === "select") setSelectedId("");
  };

  const handleStageMove = (event) => {
    if (tool === "linea" && draftRef.current?.tipo_elemento === "linea") {
      const point = stagePoint(event.target.getStage());
      if (point) {
        const next = {
          ...draftRef.current,
          data_json: { ...draftRef.current.data_json, puntos: [draftRef.current.data_json.puntos[0], point] }
        };
        draftRef.current = next;
        setDraftObject(next);
      }
      return;
    }
    if (tool !== "pan" || !panRef.current) return;
    const pointer = event.target.getStage().getPointerPosition();
    if (!pointer || !panRef.current.pointer) return;
    setViewPos({
      x: panRef.current.start.x + pointer.x - panRef.current.pointer.x,
      y: panRef.current.start.y + pointer.y - panRef.current.pointer.y
    });
  };

  const handleStageUp = (event) => {
    panRef.current = null;
    if (tool !== "linea" || draftRef.current?.tipo_elemento !== "linea") return;
    const point = stagePoint(event.target.getStage()) || draftRef.current.data_json.puntos?.[1];
    const start = draftRef.current.data_json.puntos?.[0];
    draftRef.current = null;
    setDraftObject(null);
    if (!point || Math.hypot(point.x - start.x, point.y - start.y) < 6) return;
    setElements((current) => [...current, { localId: uid(), tipo_elemento: "linea", data_json: { puntos: [start, point], color: "#0f172a", grosor: 3 } }]);
  };

  const handleElementDown = (event, element) => {
    event.cancelBubble = true;
    if (tool === "borrar") {
      setElements((current) => current.filter((item) => item.localId !== element.localId));
      setSelectedId((current) => (current === element.localId ? "" : current));
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

  const finishPolygon = () => {
    if (polygonDraft.length < 3) return;
    setElements((current) => [...current, { localId: uid(), tipo_elemento: "poligono", data_json: { puntos: polygonDraft, colorBorde: "#0f172a", grosor: 2, relleno: "rgba(21,118,209,0.12)" } }]);
    setPolygonDraft([]);
  };

  return (
    <div ref={shellRef} className="planos-editor-stage">
      {background.loading || background.error || !pdfUrl ? (
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
      >
        <Layer name="background-layer">
          {background.image ? <KonvaImage image={background.image} x={imageX} y={imageY} width={background.width * scale} height={background.height * scale} listening={false} /> : null}
        </Layer>
        <Layer name="objects-layer">
          <Group x={imageX} y={imageY} scaleX={scale} scaleY={scale}>
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
                    hitStrokeWidth={24}
                    draggable={tool === "select" || tool === "pan"}
                    onMouseDown={(event) => handleElementDown(event, element)}
                    onTouchStart={(event) => handleElementDown(event, element)}
                    onDragEnd={(event) => moveByDrag(element, event)}
                  />
                );
              }
              if (element.tipo_elemento === "punto") {
                return (
                  <Group key={element.localId} x={Number(data.x || 0)} y={Number(data.y || 0)} draggable={tool === "select" || tool === "pan"} onMouseDown={(event) => handleElementDown(event, element)} onTouchStart={(event) => handleElementDown(event, element)} onDragEnd={(event) => moveByDrag(element, event)}>
                    <Circle radius={12} fill={selected ? "#0f9f8f" : data.color || "#1576d1"} />
                  </Group>
                );
              }
              return (
                <Text
                  key={element.localId}
                  x={Number(data.x || 0)}
                  y={Number(data.y || 0)}
                  text={data.contenido || ""}
                  fontSize={Number(data.fontSize || 22)}
                  fill={selected ? "#1576d1" : data.color || "#0f172a"}
                  rotation={Number(data.rotacion || 0)}
                  draggable={tool === "select" || tool === "pan"}
                  onMouseDown={(event) => handleElementDown(event, element)}
                  onTouchStart={(event) => handleElementDown(event, element)}
                  onDragEnd={(event) => moveByDrag(element, event)}
                />
              );
            })}
          </Group>
        </Layer>
        <Layer name="draft-layer">
          <Group x={imageX} y={imageY} scaleX={scale} scaleY={scale}>
            {draftObject?.tipo_elemento === "linea" ? <Line points={(draftObject.data_json.puntos || []).flatMap((point) => [point.x, point.y])} stroke="#1576d1" strokeWidth={3} dash={[10, 8]} /> : null}
            {polygonDraft.length ? <Line points={polygonDraft.flatMap((point) => [point.x, point.y])} stroke="#1576d1" strokeWidth={3} dash={[10, 8]} /> : null}
          </Group>
        </Layer>
      </Stage>
      <button type="button" className="planos-fit-button" onClick={() => { setZoom(1); setViewPos({ x: 0, y: 0 }); }}>Ajustar</button>
      {polygonDraft.length >= 3 ? <button type="button" className="planos-finish-polygon" onClick={finishPolygon}>Cerrar poligono</button> : null}
    </div>
  );
}

function EditorCroquis({ apiFetch, barrio, onClose }) {
  const [elements, setElements] = useState([]);
  const [version, setVersion] = useState(null);
  const [tool, setTool] = useState("select");
  const [content, setContent] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [polygonDraft, setPolygonDraft] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef("[]");

  const selected = elements.find((item) => item.localId === selectedId);

  useEffect(() => {
    document.body.classList.add("planos-focus-mode");
    return () => document.body.classList.remove("planos-focus-mode");
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    apiFetch(`/planos/${barrio.id}/elementos`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const loadedElements = normalizeElements(data.elements || []);
        const localDraft = readLocalDraft(barrio.id);
        const nextElements = localDraft ? normalizeElements(localDraft) : loadedElements;
        setVersion(data.version || null);
        setElements(nextElements);
        lastSavedRef.current = JSON.stringify(loadedElements);
        hydratedRef.current = true;
        setSaveState(localDraft ? "dirty" : "saved");
      })
      .catch(() => setSaveState("error"));
    return () => { cancelled = true; };
  }, [apiFetch, barrio.id]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const current = JSON.stringify(elements);
    const clean = current === lastSavedRef.current;
    if (!clean) window.localStorage.setItem(localDraftKey(barrio.id), current);
    setSaveState(clean ? "saved" : "dirty");
  }, [elements]);

  const saveDraft = useCallback(async () => {
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
      window.localStorage.removeItem(localDraftKey(barrio.id));
      setElements(savedElements);
      setSaveState("saved");
      return savedElements;
    } catch (error) {
      setSaveState("error");
      throw error;
    } finally {
      setSaving(false);
    }
  }, [apiFetch, barrio.id, elements, version]);

  useEffect(() => {
    if (saveState !== "dirty") return undefined;
    const timer = window.setTimeout(() => {
      saveDraft().catch(() => {});
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [saveDraft, saveState]);

  const sendReview = async () => {
    if (!elements.length) {
      window.alert("Agrega al menos un cambio antes de enviar a revision.");
      return;
    }
    await saveDraft();
    const response = await apiFetch(`/planos/${barrio.id}/enviar-revision`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo enviar.");
    setVersion(data);
  };

  const closeEditor = async () => {
    if (saveState === "dirty") {
      await saveDraft().catch(() => {});
    }
    onClose();
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    setElements((current) => current.map((item) => item.localId === selected.localId ? { ...item, data_json: { ...item.data_json, ...patch } } : item));
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
            {saveState === "saving" ? "Guardando..." : saveState === "dirty" ? "Cambios sin guardar" : saveState === "error" ? "Error al guardar" : "Todo guardado"}
          </span>
        </div>
      </header>
      <div className="planos-toolbar">
        {tools.map(([key, label, ToolIcon]) => <button key={key} type="button" className={tool === key ? "is-active" : ""} onClick={() => setTool(key)}><ToolIcon size={16} />{label}</button>)}
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="Texto, codigo u observacion" />
        <button type="button" onClick={() => setZoom((current) => Math.max(0.15, Number((current - 0.5).toFixed(2))))}><Minus size={16} />Zoom</button>
        <button type="button" onClick={() => setZoom((current) => Math.min(12, Number((current + 0.5).toFixed(2))))}><Plus size={16} />Zoom</button>
        <button type="button" onClick={saveDraft} disabled={saving}><Save size={16} />{saving ? "Guardando" : "Guardar"}</button>
        <button type="button" className="planos-primary-action" onClick={sendReview}><Send size={16} />Revision</button>
      </div>
      <div className="planos-editor-grid">
        <CanvasCroquis barrio={barrio} elements={elements} setElements={setElements} selectedId={selectedId} setSelectedId={setSelectedId} tool={tool} content={content} polygonDraft={polygonDraft} setPolygonDraft={setPolygonDraft} zoom={zoom} setZoom={setZoom} />
        <AnimatePresence>
        {selected ? <motion.aside className="planos-properties" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
          <p className="sheet-kicker">Propiedades</p>
          <strong>{selected.tipo_elemento}</strong>
          {["texto", "codigo"].includes(selected.tipo_elemento) ? <label>Texto <input value={selected.data_json.contenido || ""} onChange={(event) => updateSelected({ contenido: event.target.value })} /></label> : null}
          {selected.tipo_elemento === "punto" ? <label>Etiqueta <input value={selected.data_json.descripcion || ""} onChange={(event) => updateSelected({ descripcion: event.target.value })} /></label> : null}
          <label>Color <input type="color" value={selected.data_json.color || selected.data_json.colorBorde || "#0f172a"} onChange={(event) => updateSelected({ color: event.target.value, colorBorde: event.target.value })} /></label>
          {["texto", "codigo"].includes(selected.tipo_elemento) ? (
            <>
              <label>Tamano <input type="number" min="8" max="120" value={selected.data_json.fontSize || 22} onChange={(event) => updateSelected({ fontSize: Number(event.target.value || 22) })} /></label>
              <label>Rotacion <input type="number" min="-360" max="360" value={selected.data_json.rotacion || 0} onChange={(event) => updateSelected({ rotacion: Number(event.target.value || 0) })} /></label>
            </>
          ) : null}
          {!Array.isArray(selected.data_json.puntos) ? (
            <div className="planos-position-grid">
              <label>X <input type="number" value={Math.round(Number(selected.data_json.x || 0))} onChange={(event) => updateSelected({ x: Number(event.target.value || 0) })} /></label>
              <label>Y <input type="number" value={Math.round(Number(selected.data_json.y || 0))} onChange={(event) => updateSelected({ y: Number(event.target.value || 0) })} /></label>
            </div>
          ) : (
            <label>Grosor <input type="number" min="1" max="20" value={selected.data_json.grosor || 3} onChange={(event) => updateSelected({ grosor: Number(event.target.value || 3) })} /></label>
          )}
          <button type="button" className="button-secondary" onClick={() => setElements((current) => current.filter((item) => item.localId !== selected.localId))}>Eliminar</button>
          <button type="button" className="button-secondary" onClick={() => setSelectedId("")}>Cerrar</button>
          <div className="planos-mini-stats">
            <span>{elements.length}</span>
            <small>objetos JSON</small>
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
    setMios((await miosRes.json()).barrios || []);
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
      window.alert("Selecciona un tecnico.");
      return;
    }
    const response = await apiFetch("/planos/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barrio_id: barrioId, tecnico_id: form.tecnico_id })
    });
    if (!response.ok) window.alert((await response.json()).message || "No se pudo asignar.");
    await load();
  };

  const review = async (version, action) => {
    const observacion = action === "devolver" ? window.prompt("Observacion para devolver:", "") || "" : "";
    const response = await apiFetch(`/planos/versiones/${version.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacion })
    });
    if (!response.ok) window.alert((await response.json()).message || "No se pudo revisar.");
    await load();
  };

  if (selectedBarrio) {
    return <EditorCroquis apiFetch={apiFetch} barrio={selectedBarrio} onClose={() => { setSelectedBarrio(null); load().catch(() => {}); }} />;
  }

  const currentList = tab === "mios" ? mios : barrios;
  const pickedBarrio = currentList.find((barrio) => String(barrio.id) === barrioId) || null;

  return (
    <section className="planos-workspace">
      <div className="planos-header">
        <div>
          <p className="sheet-kicker">Planos y Croquis</p>
          <h2>Actualizacion editable de barrios</h2>
          <p>PDF base + capa editable JSON para revision y publicacion.</p>
        </div>
        <div className="planos-tabs">
          {["mios", "barrios", "revision", "historial"].map((key) => (
            <button key={key} type="button" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
              {key === "mios" ? "Mis Croquis" : key === "barrios" ? "Barrios" : key === "revision" ? "Revision" : "Historial"}
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
              {isAdmin && version.estado === "aprobado" ? <button type="button" onClick={() => review(version, "publicar")}>Publicar</button> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
