import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { createSigApi } from "./services/sigApi";
import { emptyFeatureCollection, geometryBounds } from "./utils/sigGeojson";
import { sigVisibleLayerGroups } from "./utils/sigZoomRules";
import "./sigTerritorial.css";

const TABS = [["mapa", "Mapa"], ["barrios", "Barrios"], ["analisis", "Análisis"], ["reportes", "Reportes"]];
const initialCenter = [-87.1908, 13.3003];
const money = (value) => `L ${Number(value || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bboxFromMap = (map) => {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((value) => Number(value.toFixed(6)));
};

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

function SigMap({ api, selected, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const barriosRef = useRef(emptyFeatureCollection);
  const selectedRef = useRef(null);
  const refreshRef = useRef(() => {});
  const [zoom, setZoom] = useState(12);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({ barrios: true, lotes: true, abonados: true });
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
        map.addLayer({ id: "barrios-fill", type: "fill", source: "barrios", paint: { "fill-color": ["case", ["boolean", ["feature-state", "selected"], false], "#f59e0b", "#21a67a"], "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.42, 0.2] } });
        map.addLayer({ id: "barrios-line", type: "line", source: "barrios", paint: { "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#92400e", "#087a5a"], "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.4] } });
        map.addLayer({ id: "lotes-fill", type: "fill", source: "lotes", minzoom: 14, paint: { "fill-color": "#06b6d4", "fill-opacity": 0.1 } });
        map.addLayer({ id: "lotes-line", type: "line", source: "lotes", minzoom: 14, paint: { "line-color": "#0e7490", "line-opacity": 0.46, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.45, 18, 0.85, 21, 1.1] } });
        map.addLayer({ id: "numeros-lote", type: "symbol", source: "lotes", minzoom: 17, layout: { "text-field": ["coalesce", ["get", "numero_lote"], ""], "text-size": 11 }, paint: { "text-color": "#0f172a", "text-halo-color": "#fff", "text-halo-width": 1 } });
        map.addLayer({ id: "catastro-clusters", type: "circle", source: "catastro", filter: ["==", ["get", "cluster"], true], paint: { "circle-color": "#1375f5", "circle-radius": ["interpolate", ["linear"], ["get", "total"], 1, 8, 25, 11, 100, 15, 500, 21], "circle-opacity": 0.66, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        map.addLayer({ id: "catastro-cluster-count", type: "symbol", source: "catastro", filter: ["==", ["get", "cluster"], true], layout: { "text-field": ["to-string", ["get", "total"]], "text-size": 11 }, paint: { "text-color": "#fff", "text-halo-color": "#0f172a", "text-halo-width": 0.4 } });
        map.addLayer({ id: "catastro-points", type: "circle", source: "catastro", filter: ["!=", ["get", "cluster"], true], minzoom: 17, paint: { "circle-color": "#ef4444", "circle-radius": 4.5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.4 } });

        map.on("click", "barrios-fill", (event) => event.features?.[0]?.properties?.id && onSelect({ type: "barrio", data: event.features[0].properties }));
        map.on("click", "lotes-fill", async (event) => event.features?.[0]?.properties?.id && onSelect({ type: "lote", data: await api.lote(event.features[0].properties.id) }));
        map.on("click", "catastro-clusters", (event) => map.easeTo({ center: event.lngLat, zoom: Math.min(map.getZoom() + 2, 17), duration: 450 }));
        map.on("click", "catastro-points", async (event) => event.features?.[0]?.properties?.id && onSelect({ type: "catastro", data: await api.catastroPunto(event.features[0].properties.id) }));
        ["barrios-fill", "lotes-fill", "catastro-clusters", "catastro-points"].forEach((id) => {
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
  }, [ready, selected]);

  return (
    <section className="sig-map-shell">
      <aside className="sig-layer-panel">
        <h3>Capas</h3>
        {[["Territorio", [["barrios", "Barrios"], ["manzanas", "Manzanas"], ["quebradas", "Quebradas"]]], ["Catastro", [["lotes", "Lotes"], ["numeros", "Números de lote"], ["abonados", "Abonados"]]], ["Operativo", [["levantamientos", "Levantamientos"], ["inspecciones", "Inspecciones"]]]].map(([group, items]) => (
          <details key={group} open>
            <summary>{group}</summary>
            {items.map(([key, label]) => (
              <label key={key}>
                <input type="checkbox" checked={Boolean(layers[key])} disabled={!["barrios", "lotes", "abonados"].includes(key)} onChange={(event) => setLayers((prev) => ({ ...prev, [key]: event.target.checked }))} />
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

function Drawer({ selected, summary, onClose }) {
  if (!selected) return null;
  const data = selected.data || {};
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
        <button type="button">Ver levantamientos</button>
      </div>
    </aside>
  );
}

export default function SigTerritorialWorkspace({ apiFetch, showAlert }) {
  const api = useMemo(() => createSigApi(apiFetch), [apiFetch]);
  const [tab, setTab] = useState("mapa");
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [barrios, setBarrios] = useState([]);
  const [report, setReport] = useState(null);
  const [catastroReport, setCatastroReport] = useState(null);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.config().then(setConfig).catch((error) => showAlert?.(error.message));
    api.health().then(setHealth).catch(() => setHealth({ ready: false }));
    api.barrios().then(setBarrios).catch(() => setBarrios([]));
    api.barrioReport().then(setReport).catch(() => setReport(null));
    api.catastroReport().then(setCatastroReport).catch(() => setCatastroReport(null));
  }, [api, showAlert]);

  useEffect(() => {
    if (selected?.type !== "barrio" || !selected.data?.id) {
      setSummary(null);
      return;
    }
    api.barrioSummary(selected.data.id).then(setSummary).catch(() => setSummary(null));
  }, [api, selected]);

  return (
    <main className="sig-workspace">
      <header className="sig-header">
        <div>
          <span className="cl-kicker">Control Aguas</span>
          <h1>SIG Territorial</h1>
          <p>Infraestructura y análisis territorial.</p>
        </div>
        <div className={`sig-status ${health?.ready ? "is-ready" : ""}`}>
          <i />
          <span>{health?.ready ? "PostGIS conectado" : health?.configured ? "PostGIS no disponible" : "GIS_DATABASE_URL pendiente"}</span>
        </div>
      </header>

      <nav className="sig-tabs" aria-label="Vistas SIG Territorial">
        {TABS.map(([key, label]) => <button key={key} type="button" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </nav>

      {tab === "mapa" ? (
        <>
          <SigMap api={api} selected={selected} onSelect={setSelected} />
          <Drawer selected={selected} summary={summary} onClose={() => setSelected(null)} />
        </>
      ) : tab === "barrios" ? (
        <section className="sig-placeholder">
          <h2>Barrios y catastro</h2>
          <div className="sig-report-strip">
            <span>{barrios.length.toLocaleString("es-HN")} barrios</span>
            <span>{catastroReport?.lotes?.toLocaleString("es-HN") || 0} lotes</span>
            <span>{catastroReport?.catastro_puntos?.toLocaleString("es-HN") || 0} abonados GIS</span>
            <span>Sin clave: {report?.sin_clave ?? 0}</span>
          </div>
          <ul>
            {barrios.map((item) => (
              <li key={item.id}>
                <strong>{item.clave || "--"} · {item.nombre || "Sin nombre"}</strong>
                <button type="button" onClick={() => { setSelected({ type: "barrio", data: item }); setTab("mapa"); }}>Ver</button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="sig-placeholder">
          <h2>{TABS.find(([key]) => key === tab)?.[1]}</h2>
          <p>Fase 3 deja búsqueda, lotes y catastro operativos; reportes avanzados quedan fuera de alcance.</p>
          <ul>
            {(config?.datasets || []).slice(0, 8).map((item) => (
              <li key={item.key}><strong>{item.layer}</strong><span>{item.count.toLocaleString("es-HN")} · {item.geometry} · EPSG:{item.srid}</span></li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
