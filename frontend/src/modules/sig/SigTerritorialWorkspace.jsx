import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { getMapPointTypeLabel } from "../../utils/mapField";
import { createSigApi } from "./services/sigApi";
import { emptyFeatureCollection, geometryBounds } from "./utils/sigGeojson";
import { sigVisibleLayerGroups } from "./utils/sigZoomRules";
import "./sigTerritorial.css";

const TABS = [["mapa", "Mapa"], ["barrios", "Barrios"], ["analisis", "Análisis"], ["reportes", "Reportes"]];
const initialCenter = [-87.1908, 13.3003];
const money = (value) => `L ${Number(value || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const VALIDATION_STATUS = {
  approved: { label: "Aprobado", color: "#16a34a" },
  corrected: { label: "Corregido", color: "#0891b2" },
  needs_correction: { label: "Necesita corrección", color: "#f97316" },
  pending: { label: "Pendiente", color: "#64748b" }
};
const GPS_ACCURACY_LABEL = { excelente: "Excelente", buena: "Buena", aceptable: "Aceptable", baja: "Baja", deficiente: "Deficiente", sin_dato: "Sin dato" };
const isGisReady = (health) => Boolean(health?.ready);
const bboxFromMap = (map) => {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((value) => Number(value.toFixed(6)));
};

function SigOfflineState({ health, datasets = [] }) {
  const checking = health == null;
  const configured = Boolean(health?.configured);
  return (
    <section className="sig-offline" role="status">
      <div>
        <span className="cl-kicker">Estado GIS</span>
        <h2>{checking ? "Verificando conexión GIS" : configured ? "PostGIS no responde" : "GIS_DATABASE_URL pendiente"}</h2>
        <p>{checking ? "Consultando el estado de la base territorial." : configured ? "La base territorial está configurada, pero no se pudo consultar en este momento." : "Conecta la base GIS para activar mapa, búsqueda, barrios y catastro."}</p>
      </div>
      <div className="sig-offline-metrics" aria-label="Capas esperadas">
        <span><strong>{datasets.length}</strong> capas previstas</span>
        <span><strong>EPSG:32616</strong> territorio</span>
        <span><strong>EPSG:4326</strong> GPS</span>
      </div>
    </section>
  );
}

function SigSearch({ api, onPick }) {
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResult(null);
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => api.search(text).then((next) => {
      setResult(next);
      setOpen(Boolean(next?.groups?.length));
    }).catch(() => {
      setResult(null);
      setOpen(false);
    }), 250);
    return () => clearTimeout(timer);
  }, [api, query]);

  useEffect(() => {
    const closeIfOutside = (event) => {
      if (!searchRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const pick = (item) => {
    setOpen(false);
    setResult(null);
    setQuery("");
    onPick(item);
  };

  return (
    <div className="sig-search" ref={searchRef}>
      <label>
        <Icon name="search" />
        <input value={query} onFocus={() => result?.groups?.length && setOpen(true)} onChange={(event) => setQuery(event.target.value)} placeholder="Clave, abonado, barrio, manzana o lote" />
      </label>
      {open && result?.groups?.length ? (
        <div className="sig-search-results">
          {result.groups.map((group) => (
            <section key={group.key}>
              <strong>{group.key}</strong>
              {group.items.map((item) => (
                <button key={`${item.type}-${item.id}`} type="button" onClick={() => pick(item)}>
                  <span>{item.label}</span>
                  <small>{item.detail || item.type}</small>
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SigMap({ api, selected, onSelect, focusRequest, onFocusConsumed, showAlert }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const barriosRef = useRef(emptyFeatureCollection);
  const selectedRef = useRef(null);
  const refreshRef = useRef(() => {});
  const [zoom, setZoom] = useState(12);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({ barrios: true, lotes: true, abonados: true, levantamientos: false });
  const visibleGroups = useMemo(() => sigVisibleLayerGroups(zoom), [zoom]);

  const refreshBboxLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const currentZoom = Number(map.getZoom().toFixed(1));
    const bbox = bboxFromMap(map);
    if (layers.lotes && currentZoom >= 14) {
      const lotes = await api.lotes({ bbox });
      map.getSource("lotes")?.setData(lotes);
    } else {
      map.getSource("lotes")?.setData(emptyFeatureCollection);
    }
    if (layers.abonados && currentZoom >= 13) {
      const catastro = await api.catastro({ bbox, zoom: currentZoom });
      map.getSource("catastro")?.setData(catastro);
    } else {
      map.getSource("catastro")?.setData(emptyFeatureCollection);
    }
    if (layers.levantamientos && currentZoom >= 15) {
      const levantamientos = await api.levantamientos({ bbox });
      map.getSource("levantamientos")?.setData(levantamientos);
    } else {
      map.getSource("levantamientos")?.setData(emptyFeatureCollection);
    }
  }, [api, layers]);

  useEffect(() => {
    refreshRef.current = refreshBboxLayers;
  }, [refreshBboxLayers]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const maplibre = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibre.Map({
        container: containerRef.current,
        center: initialCenter,
        zoom,
        style: {
          version: 8,
          sources: {
            osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "OpenStreetMap" }
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }]
        }
      });

      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      map.on("zoomend", () => setZoom(Number(map.getZoom().toFixed(1))));
      map.on("moveend", () => refreshRef.current().catch(() => {}));
      map.on("load", async () => {
        const barrios = await api.barriosGeoJson();
        if (cancelled) return;
        barriosRef.current = barrios;
        map.addSource("barrios", { type: "geojson", data: barrios });
        map.addSource("lotes", { type: "geojson", data: emptyFeatureCollection });
        map.addSource("catastro", { type: "geojson", data: emptyFeatureCollection });
        map.addSource("levantamientos", { type: "geojson", data: emptyFeatureCollection });
        map.addLayer({ id: "barrios-fill", type: "fill", source: "barrios", paint: { "fill-color": ["case", ["boolean", ["feature-state", "selected"], false], "#f59e0b", "#21a67a"], "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.42, 0.2] } });
        map.addLayer({ id: "barrios-line", type: "line", source: "barrios", paint: { "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#92400e", "#087a5a"], "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.4] } });
        map.addLayer({ id: "lotes-fill", type: "fill", source: "lotes", minzoom: 14, paint: { "fill-color": "#06b6d4", "fill-opacity": 0.1 } });
        map.addLayer({ id: "lotes-line", type: "line", source: "lotes", minzoom: 14, paint: { "line-color": "#0e7490", "line-opacity": 0.46, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.45, 18, 0.85, 21, 1.1] } });
        map.addLayer({ id: "numeros-lote", type: "symbol", source: "lotes", minzoom: 17, layout: { "text-field": ["coalesce", ["get", "numero_lote"], ""], "text-size": 11 }, paint: { "text-color": "#0f172a", "text-halo-color": "#fff", "text-halo-width": 1 } });
        map.addLayer({ id: "catastro-clusters", type: "circle", source: "catastro", filter: ["==", ["get", "cluster"], true], paint: { "circle-color": "#1375f5", "circle-radius": ["interpolate", ["linear"], ["get", "total"], 1, 8, 25, 11, 100, 15, 500, 21], "circle-opacity": 0.66, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        map.addLayer({ id: "catastro-cluster-count", type: "symbol", source: "catastro", filter: ["==", ["get", "cluster"], true], layout: { "text-field": ["to-string", ["get", "total"]], "text-size": 11 }, paint: { "text-color": "#fff", "text-halo-color": "#0f172a", "text-halo-width": 0.4 } });
        map.addLayer({ id: "catastro-points", type: "circle", source: "catastro", filter: ["!=", ["get", "cluster"], true], minzoom: 17, paint: { "circle-color": "#ef4444", "circle-radius": 4.5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.4 } });
        map.addLayer({ id: "levantamientos-halo", type: "circle", source: "levantamientos", minzoom: 15, paint: {
          "circle-radius": ["match", ["get", "gps_accuracy"], "excelente", 6, "buena", 6, "aceptable", 10, 15],
          "circle-opacity": ["match", ["get", "gps_accuracy"], "excelente", 0.12, "buena", 0.12, "aceptable", 0.16, 0.22],
          "circle-color": "#0f172a"
        } });
        map.addLayer({ id: "levantamientos-points", type: "circle", source: "levantamientos", minzoom: 15, paint: {
          "circle-radius": 5,
          "circle-color": ["match", ["get", "validation_status"], "approved", "#16a34a", "corrected", "#0891b2", "needs_correction", "#f97316", "#64748b"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.4
        } });

        map.on("click", "barrios-fill", (event) => event.features?.[0]?.properties?.id && onSelect({ type: "barrio", data: event.features[0].properties }));
        map.on("click", "lotes-fill", async (event) => event.features?.[0]?.properties?.id && onSelect({ type: "lote", data: await api.lote(event.features[0].properties.id) }));
        map.on("click", "catastro-clusters", (event) => map.easeTo({ center: event.lngLat, zoom: Math.min(map.getZoom() + 2, 17), duration: 450 }));
        map.on("click", "catastro-points", async (event) => event.features?.[0]?.properties?.id && onSelect({ type: "catastro", data: await api.catastroPunto(event.features[0].properties.id) }));
        map.on("click", "levantamientos-points", async (event) => event.features?.[0]?.properties?.id && onSelect({ type: "levantamiento", data: await api.levantamiento(event.features[0].properties.id) }));
        ["barrios-fill", "lotes-fill", "catastro-clusters", "catastro-points", "levantamientos-points"].forEach((id) => {
          map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
        });
        setReady(true);
        refreshRef.current().catch(() => {});
      });
      mapRef.current = map;
      cleanup = () => map.remove();
    })();
    return () => {
      cancelled = true;
      cleanup();
      mapRef.current = null;
    };
  }, [api, onSelect]);

  useEffect(() => { refreshBboxLayers().catch(() => {}); }, [refreshBboxLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const feature of barriosRef.current.features) {
      map.setFeatureState({ source: "barrios", id: feature.id }, { selected: selected?.type === "barrio" && feature.properties.id === selected.data?.id });
    }
    selectedRef.current = selected;
    const barrioFeature = selected?.type === "barrio" ? barriosRef.current.features.find((item) => item.properties.id === selected.data?.id) : null;
    if (barrioFeature) map.fitBounds(geometryBounds(barrioFeature.geometry), { padding: 56, duration: 650 });
    if (selected?.data?.bbox) map.fitBounds(selected.data.bbox, { padding: 72, duration: 650 });

    if (selected?.type === "catastro" && Array.isArray(selected.data?.lnglat)) {
      const [lng, lat] = selected.data.lnglat.map(Number);
      if (Number.isFinite(lng) && Number.isFinite(lat)) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 18), duration: 650 });
    }
    if (selected?.type === "levantamiento") {
      const lng = Number(selected.data?.longitude);
      const lat = Number(selected.data?.latitude);
      if (Number.isFinite(lng) && Number.isFinite(lat)) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 18), duration: 650 });
    }
  }, [ready, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusRequest) return;
    setLayers((prev) => ({ ...prev, levantamientos: true }));
    if (Number.isFinite(focusRequest.longitude) && Number.isFinite(focusRequest.latitude)) {
      map.flyTo({ center: [focusRequest.longitude, focusRequest.latitude], zoom: Math.max(map.getZoom(), 17), duration: 650 });
    }
    (async () => {
      if (focusRequest.pointId) {
        try {
          const data = await api.levantamiento(focusRequest.pointId);
          if (data) onSelect({ type: "levantamiento", data });
        } catch { /* ignore */ }
      }
      onFocusConsumed?.();
    })();
  }, [focusRequest, ready]);

  return (
    <section className="sig-map-shell">
      <aside className="sig-layer-panel">
        <h3>Capas</h3>
        {[["Territorio", [["barrios", "Barrios"], ["manzanas", "Manzanas"], ["quebradas", "Quebradas"]]], ["Catastro", [["lotes", "Lotes"], ["numeros", "Números de lote"], ["abonados", "Abonados"]]], ["Operativo", [["levantamientos", "Levantamientos"], ["inspecciones", "Inspecciones"]]]].map(([group, items]) => (
          <details key={group} open>
            <summary>{group}</summary>
            {items.map(([key, label]) => (
              <label key={key}>
                <input type="checkbox" checked={Boolean(layers[key])} disabled={!["barrios", "lotes", "abonados", "levantamientos"].includes(key)} onChange={(event) => setLayers((prev) => ({ ...prev, [key]: event.target.checked }))} />
                {label}
              </label>
            ))}
          </details>
        ))}
      </aside>
      <div className="sig-map-stage">
        <div className="sig-toolbar">
          <SigSearch api={api} onPick={async (item) => {
            if (item.type === "barrio") onSelect({ type: "barrio", data: { id: item.id, nombre: item.label, clave: item.detail } });
            if (item.type === "lote") onSelect({ type: "lote", data: await api.lote(item.id) });
            if (item.type === "abonado") onSelect({ type: "catastro", data: await api.catastroPunto(item.id) });
            if (item.type === "padron") {
              try {
                const match = await api.resolveClave(item.id);
                if (match.type === "lote") onSelect({ type: "lote", data: await api.lote(match.id) });
                if (match.type === "catastro") onSelect({ type: "catastro", data: await api.catastroPunto(match.id) });
              } catch (error) {
                showAlert?.(`${item.label}: sin punto georreferenciado en el mapa todavia.`);
              }
            }
          }} />
          <button type="button" disabled><Icon name="plus" /> Punto</button>
          <button type="button" disabled><Icon name="print" /> Imprimir</button>
        </div>
        <div ref={containerRef} className="sig-map" />
        <footer>
          <span>Zoom {zoom}</span>
          <span>UTM 16N · EPSG:32616</span>
          <span>Barrios: {ready ? "cargados" : "cargando"}</span>
          <span>Reglas: {visibleGroups.join(", ")}</span>
        </footer>
      </div>
    </section>
  );
}

function Drawer({ selected, summary, onClose, onOpenFieldValidation }) {
  if (!selected) return null;
  const data = selected.data || {};

  if (selected.type === "levantamiento") {
    const status = VALIDATION_STATUS[data.validation_status] || VALIDATION_STATUS.pending;
    const geo = data.barrio_geografico;
    const match = data.barrio_coincide;
    const matchGlyph = match === true ? "✓" : match === false ? "⚠" : "—";
    const matchClass = match === true ? "is-match" : match === false ? "is-mismatch" : "is-unknown";
    return (
      <aside className="sig-drawer">
        <button type="button" onClick={onClose}>Cerrar</button>
        <span>levantamiento</span>
        <h2>{getMapPointTypeLabel(data.point_type)}</h2>
        <span className="sig-status-pill"><i style={{ background: status.color }} />{status.label}</span>

        <div className="sig-accuracy-row">
          <span className="sig-halo" data-bucket={data.gps_accuracy} />
          <span className="sig-mono">{data.accuracy_meters ? `${data.accuracy_meters} m` : "Sin dato"}</span>
          <small>{GPS_ACCURACY_LABEL[data.gps_accuracy] || "Sin dato"}</small>
        </div>

        <div className="sig-verify">
          <p className="sig-verify-title">Coincidencia territorial</p>
          <div className="sig-verify-row">
            <div className="sig-verify-chip">
              <small>Declarado</small>
              <strong>{data.barrio_declarado?.label || "Sin dato"}</strong>
            </div>
            <span className={`sig-verify-glyph ${matchClass}`}>{matchGlyph}</span>
            <div className="sig-verify-chip">
              <small>Geográfico</small>
              <strong>{geo ? `${geo.clave || "--"} · ${geo.nombre}` : "Sin PostGIS"}</strong>
            </div>
          </div>
        </div>

        <dl>
          <div><dt>Manzana geográfica</dt><dd>{data.manzana_geografico?.numero || "Sin dato"}</dd></div>
          <div><dt>Lote geográfico</dt><dd>{data.lote_geografico?.numero_lote || "Sin dato"}</dd></div>
          <div><dt>Referencia</dt><dd>{data.reference_note || data.description || "Sin dato"}</dd></div>
        </dl>
        <div className="sig-drawer-actions">
          <button type="button" onClick={() => onOpenFieldValidation?.({ pointId: data.id })}>Ver en Control Territorial</button>
        </div>
      </aside>
    );
  }

  const padron = data.abonado_actual;
  const title = selected.type === "lote" ? `Lote ${data.numero_lote || data.id}` : selected.type === "catastro" ? data.inquilino || data.abonado || data.clave_catastral : data.nombre || "Sin nombre";
  return (
    <aside className="sig-drawer">
      <button type="button" onClick={onClose}>Cerrar</button>
      <span>{selected.type}</span>
      <h2>{title}</h2>
      <dl>
        <div><dt>Barrio</dt><dd>{data.barrio || data.nombre || "Sin dato"} {data.barrio_clave ? `· ${data.barrio_clave}` : ""}</dd></div>
        <div><dt>Manzana</dt><dd>{data.manzana || summary?.manzanas || "Sin dato"}</dd></div>
        <div><dt>Lote</dt><dd>{data.numero_lote || "Sin dato"}</dd></div>
        <div><dt>Clave</dt><dd>{data.catastro_clave || data.clave_catastral || data.clave || "Sin clave"}</dd></div>
        <div><dt>Abonado FoxPro</dt><dd>{padron?.nombre || padron?.inquilino || "Sin cruce"}</dd></div>
        <div><dt>Servicios</dt><dd>{padron?.servicios ? Object.entries(padron.servicios).filter(([, v]) => v === "S").map(([k]) => k).join(", ") || "Sin activos" : "Sin dato"}</dd></div>
        <div><dt>Mora</dt><dd>{padron?.mora ? money(padron.mora.total) : money(padron?.total)}</dd></div>
        <div><dt>Control Territorial</dt><dd>{data.puntos_control?.length ?? 0}</dd></div>
        <div><dt>Inspecciones</dt><dd>{data.inspecciones?.length ?? 0}</dd></div>
      </dl>
      <div className="sig-drawer-actions">
        <button type="button">Ver ficha</button>
        <button type="button">Crear inspección</button>
        <button type="button" disabled={!data.puntos_control?.length} onClick={() => onOpenFieldValidation?.(data.puntos_control?.length === 1 ? { pointId: data.puntos_control[0].id } : {})}>Ver levantamientos</button>
      </div>
    </aside>
  );
}

export default function SigTerritorialWorkspace({ apiFetch, showAlert, focusRequest, onFocusConsumed, onOpenFieldValidation }) {
  const api = useMemo(() => createSigApi(apiFetch), [apiFetch]);
  const [tab, setTab] = useState("mapa");
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [barrios, setBarrios] = useState([]);
  const [report, setReport] = useState(null);
  const [catastroReport, setCatastroReport] = useState(null);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const ready = isGisReady(health);

  useEffect(() => {
    let cancelled = false;
    api.config().then((nextConfig) => !cancelled && setConfig(nextConfig)).catch((error) => showAlert?.(error.message));
    api.health().then(async (nextHealth) => {
      if (cancelled) return;
      setHealth(nextHealth);
      if (!isGisReady(nextHealth)) {
        setBarrios([]);
        setReport(null);
        setCatastroReport(null);
        return;
      }
      const [nextBarrios, nextReport, nextCatastroReport] = await Promise.all([
        api.barrios().catch(() => []),
        api.barrioReport().catch(() => null),
        api.catastroReport().catch(() => null)
      ]);
      if (!cancelled) {
        setBarrios(nextBarrios);
        setReport(nextReport);
        setCatastroReport(nextCatastroReport);
      }
    }).catch(() => setHealth({ configured: false, ready: false }));
    return () => { cancelled = true; };
  }, [api, showAlert]);

  useEffect(() => {
    if (selected?.type !== "barrio" || !selected.data?.id) {
      setSummary(null);
      return;
    }
    api.barrioSummary(selected.data.id).then(setSummary).catch(() => setSummary(null));
  }, [api, selected]);

  useEffect(() => {
    if (focusRequest) setTab("mapa");
  }, [focusRequest]);

  return (
    <main className="sig-workspace">
      <header className="sig-header">
        <div>
          <span className="cl-kicker">Control Aguas</span>
          <h1>SIG Territorial</h1>
          <p>Infraestructura y análisis territorial.</p>
        </div>
        <div className={`sig-status ${ready ? "is-ready" : ""}`}>
          <i />
          <span>{health == null ? "Verificando GIS..." : ready ? "PostGIS conectado" : health?.configured ? "PostGIS no disponible" : "GIS_DATABASE_URL pendiente"}</span>
        </div>
      </header>

      <nav className="sig-tabs" aria-label="Vistas SIG Territorial">
        {TABS.map(([key, label]) => <button key={key} type="button" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </nav>

      {tab === "mapa" ? (
        ready ? <>
          <SigMap api={api} selected={selected} onSelect={setSelected} focusRequest={focusRequest} onFocusConsumed={onFocusConsumed} showAlert={showAlert} />
          <Drawer selected={selected} summary={summary} onClose={() => setSelected(null)} onOpenFieldValidation={onOpenFieldValidation} />
        </> : <SigOfflineState health={health} datasets={config?.datasets} />
      ) : tab === "barrios" ? (
        <section className="sig-placeholder">
          <h2>Barrios y catastro</h2>
          <div className="sig-report-strip">
            <span>{barrios.length.toLocaleString("es-HN")} barrios</span>
            <span>{catastroReport?.lotes?.toLocaleString("es-HN") || 0} lotes</span>
            <span>{catastroReport?.catastro_puntos?.toLocaleString("es-HN") || 0} abonados GIS</span>
            <span>Sin clave: {report?.sin_clave ?? 0}</span>
          </div>
          {!ready ? <p className="sig-empty-note">La conexión GIS no está activa. Cuando PostGIS responda, aquí aparecerá el listado de barrios para abrirlos en el mapa.</p> : null}
          <ul>
            {barrios.map((item) => (
              <li key={item.id}>
                <strong>{item.clave || "--"} · {item.nombre || "Sin nombre"}</strong>
                <button type="button" onClick={() => { setSelected({ type: "barrio", data: item }); setTab("mapa"); }}>Ver</button>
              </li>
            ))}
          </ul>
        </section>
      ) : tab === "analisis" ? (
        <section className="sig-placeholder">
          <h2>Análisis de capas</h2>
          <p>Inventario técnico disponible para validar cobertura, geometría y referencia espacial.</p>
          <ul>
            {(config?.datasets || []).slice(0, 8).map((item) => (
              <li key={item.key}><strong>{item.layer}</strong><span>{item.count.toLocaleString("es-HN")} · {item.geometry} · EPSG:{item.srid}</span></li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="sig-placeholder sig-report-empty">
          <h2>Reportes</h2>
          <p>Los reportes avanzados todavía no están habilitados.</p>
          <div className="sig-report-strip">
            <span>{(config?.datasets || []).length} capas catalogadas</span>
            <span>{ready ? "GIS listo" : "GIS pendiente"}</span>
            <span>Exportación por definir</span>
          </div>
        </section>
      )}
    </main>
  );
}
