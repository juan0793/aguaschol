import { useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../../config/api";
import { Icon } from "../../components/Icon";

const tools = [
  ["select", "Seleccionar"],
  ["pan", "Mover"],
  ["linea", "Linea"],
  ["poligono", "Poligono"],
  ["texto", "Texto"],
  ["codigo", "Codigo"],
  ["punto", "Punto"],
  ["borrar", "Borrar"]
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
const normalizeElements = (elements = []) =>
  elements.map((item) => ({
    localId: item.localId || String(item.id || uid()),
    tipo_elemento: item.tipo_elemento || item.tipo || "texto",
    data_json: item.data_json?.data_json || item.data_json || item.data || {}
  }));

const elementCenter = (element) => {
  const data = element.data_json || {};
  if (Array.isArray(data.puntos) && data.puntos.length) {
    const total = data.puntos.reduce((sum, point) => ({ x: sum.x + Number(point.x || 0), y: sum.y + Number(point.y || 0) }), { x: 0, y: 0 });
    return { x: total.x / data.puntos.length, y: total.y / data.puntos.length };
  }
  return { x: Number(data.x || 0), y: Number(data.y || 0) };
};

const moveElement = (element, dx, dy) => {
  const data = element.data_json || {};
  if (Array.isArray(data.puntos)) {
    return { ...element, data_json: { ...data, puntos: data.puntos.map((point) => ({ x: Number(point.x || 0) + dx, y: Number(point.y || 0) + dy })) } };
  }
  return { ...element, data_json: { ...data, x: Number(data.x || 0) + dx, y: Number(data.y || 0) + dy } };
};

const getSvgPoint = (event, svg) => {
  const rect = svg.getBoundingClientRect();
  return {
    x: Math.round(((event.clientX - rect.left) / rect.width) * 1000),
    y: Math.round(((event.clientY - rect.top) / rect.height) * 700)
  };
};

const StatusBadge = ({ status }) => <span className={`planos-status is-${status || "pendiente"}`}>{statusLabel[status] || status || "Pendiente"}</span>;

function CanvasCroquis({ barrio, elements, setElements, selectedId, setSelectedId, tool, content, polygonDraft, setPolygonDraft, zoom }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const pdfUrl = toPdfUrl(barrio?.archivo_pdf);

  const addElement = (point) => {
    if (tool === "texto" || tool === "codigo") {
      const text = content.trim() || (tool === "codigo" ? "10-00-00-00" : "Texto");
      setElements((current) => [...current, { localId: uid(), tipo_elemento: tool, data_json: { x: point.x, y: point.y, contenido: text, fontSize: 22, rotacion: 0 } }]);
      return;
    }
    if (tool === "punto") {
      setElements((current) => [...current, { localId: uid(), tipo_elemento: "punto", data_json: { x: point.x, y: point.y, descripcion: content.trim() || "Punto GPS" } }]);
      return;
    }
    if (tool === "linea") {
      if (!polygonDraft.length) {
        setPolygonDraft([point]);
        return;
      }
      setElements((current) => [...current, { localId: uid(), tipo_elemento: "linea", data_json: { puntos: [polygonDraft[0], point], color: "#0f172a", grosor: 3 } }]);
      setPolygonDraft([]);
      return;
    }
    if (tool === "poligono") {
      setPolygonDraft((current) => [...current, point]);
    }
  };

  const handleBackgroundDown = (event) => {
    if (!svgRef.current) return;
    const point = getSvgPoint(event, svgRef.current);
    if (["linea", "poligono", "texto", "codigo", "punto"].includes(tool)) addElement(point);
    if (tool === "select") setSelectedId("");
  };

  const handleElementDown = (event, element) => {
    event.stopPropagation();
    if (tool === "borrar") {
      if (window.confirm("Eliminar este elemento del croquis?")) {
        setElements((current) => current.filter((item) => item.localId !== element.localId));
      }
      return;
    }
    setSelectedId(element.localId);
    if (!svgRef.current || !["select", "pan"].includes(tool)) return;
    dragRef.current = { id: element.localId, start: getSvgPoint(event, svgRef.current), original: element };
  };

  const handleMove = (event) => {
    if (!dragRef.current || !svgRef.current) return;
    const next = getSvgPoint(event, svgRef.current);
    const dx = next.x - dragRef.current.start.x;
    const dy = next.y - dragRef.current.start.y;
    setElements((current) => current.map((item) => item.localId === dragRef.current.id ? moveElement(dragRef.current.original, dx, dy) : item));
  };

  const finishPolygon = () => {
    if (polygonDraft.length < 3) return;
    setElements((current) => [...current, { localId: uid(), tipo_elemento: "poligono", data_json: { puntos: polygonDraft, colorBorde: "#0f172a", grosor: 2, relleno: "rgba(21,118,209,0.12)" } }]);
    setPolygonDraft([]);
  };

  return (
    <div className="planos-editor-stage">
      <div className="planos-canvas-zoom" style={{ width: `${zoom * 100}%`, height: `${700 * zoom}px` }}>
        {pdfUrl ? <object className="planos-pdf-base" data={pdfUrl} type="application/pdf" aria-label="PDF base del croquis" /> : <div className="planos-pdf-empty">Sube un PDF base para este barrio.</div>}
        <svg
          ref={svgRef}
          className="planos-svg-layer"
          viewBox="0 0 1000 700"
          onPointerDown={handleBackgroundDown}
          onPointerMove={handleMove}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerLeave={() => { dragRef.current = null; }}
        >
          {elements.map((element) => {
            const data = element.data_json || {};
            const selected = selectedId === element.localId;
            if (element.tipo_elemento === "linea") {
              return <polyline key={element.localId} className={selected ? "is-selected" : ""} points={(data.puntos || []).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={data.color || "#0f172a"} strokeWidth={data.grosor || 3} onPointerDown={(event) => handleElementDown(event, element)} />;
            }
            if (element.tipo_elemento === "poligono") {
              return <polygon key={element.localId} className={selected ? "is-selected" : ""} points={(data.puntos || []).map((p) => `${p.x},${p.y}`).join(" ")} fill={data.relleno || "rgba(21,118,209,0.12)"} stroke={data.colorBorde || "#0f172a"} strokeWidth={data.grosor || 2} onPointerDown={(event) => handleElementDown(event, element)} />;
            }
            if (element.tipo_elemento === "punto") {
              return <g key={element.localId} className={selected ? "is-selected" : ""} onPointerDown={(event) => handleElementDown(event, element)}><circle cx={data.x} cy={data.y} r="12" fill="#1576d1" /><text x={Number(data.x) + 16} y={Number(data.y) + 5}>{data.descripcion || "Punto"}</text></g>;
            }
            return <text key={element.localId} className={selected ? "is-selected" : ""} x={data.x} y={data.y} fontSize={data.fontSize || 22} onPointerDown={(event) => handleElementDown(event, element)}>{data.contenido || ""}</text>;
          })}
          {polygonDraft.length ? <polyline className="planos-draft-line" points={polygonDraft.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" /> : null}
        </svg>
      </div>
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

  const selected = elements.find((item) => item.localId === selectedId);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/planos/${barrio.id}/elementos`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setVersion(data.version || null);
        setElements(normalizeElements(data.elements || []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiFetch, barrio.id]);

  const saveDraft = async () => {
    setSaving(true);
    try {
      const response = await apiFetch(`/planos/${barrio.id}/guardar-borrador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar.");
      setVersion(data.version || version);
      setElements(normalizeElements(data.elements || elements));
    } finally {
      setSaving(false);
    }
  };

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

  const updateSelected = (patch) => {
    if (!selected) return;
    setElements((current) => current.map((item) => item.localId === selected.localId ? { ...item, data_json: { ...item.data_json, ...patch } } : item));
  };

  return (
    <section className="planos-editor">
      <header className="planos-editor-head">
        <button type="button" className="button-secondary" onClick={onClose}><Icon name="arrowLeft" />Volver</button>
        <div>
          <p className="sheet-kicker">Editor de Croquis</p>
          <h2>{barrio.nombre_barrio}</h2>
        </div>
        <StatusBadge status={version?.estado || barrio.estado} />
      </header>
      <div className="planos-toolbar">
        {tools.map(([key, label]) => <button key={key} type="button" className={tool === key ? "is-active" : ""} onClick={() => setTool(key)}>{label}</button>)}
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="Texto, codigo u observacion" />
        <button type="button" onClick={saveDraft} disabled={saving}>{saving ? "Guardando" : "Guardar"}</button>
        <button type="button" className="planos-primary-action" onClick={sendReview}>Enviar revision</button>
        <button type="button" onClick={() => setZoom((current) => Math.max(0.7, Number((current - 0.1).toFixed(1))))}>Zoom -</button>
        <button type="button" onClick={() => setZoom((current) => Math.min(2, Number((current + 0.1).toFixed(1))))}>Zoom +</button>
      </div>
      <div className="planos-editor-grid">
        <CanvasCroquis barrio={barrio} elements={elements} setElements={setElements} selectedId={selectedId} setSelectedId={setSelectedId} tool={tool} content={content} polygonDraft={polygonDraft} setPolygonDraft={setPolygonDraft} zoom={zoom} />
        <aside className="planos-properties">
          <p className="sheet-kicker">Propiedades</p>
          {selected ? (
            <>
              <strong>{selected.tipo_elemento}</strong>
              {["texto", "codigo"].includes(selected.tipo_elemento) ? <input value={selected.data_json.contenido || ""} onChange={(event) => updateSelected({ contenido: event.target.value })} /> : null}
              <label>Color <input type="color" value={selected.data_json.color || selected.data_json.colorBorde || "#0f172a"} onChange={(event) => updateSelected({ color: event.target.value, colorBorde: event.target.value })} /></label>
              <button type="button" className="button-secondary" onClick={() => setElements((current) => current.filter((item) => item.localId !== selected.localId))}>Eliminar</button>
            </>
          ) : (
            <p>Selecciona un elemento para editarlo o moverlo.</p>
          )}
          <div className="planos-mini-stats">
            <span>{elements.length}</span>
            <small>objetos JSON</small>
          </div>
        </aside>
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
