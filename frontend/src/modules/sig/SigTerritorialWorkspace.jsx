import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { createSigApi } from "./services/sigApi";
import { emptyFeatureCollection, geometryBounds } from "./utils/sigGeojson";
import { sigVisibleLayerGroups } from "./utils/sigZoomRules";
import "./sigTerritorial.css";

const TABS = [
  ["mapa", "Mapa"],
  ["barrios", "Barrios"],
  ["analisis", "Análisis"],
  ["reportes", "Reportes"]
];

const initialCenter = [-87.1908, 13.3003];

function SigMap({ api, selectedBarrio, onSelectBarrio }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const barriosRef = useRef(emptyFeatureCollection);
  const [zoom, setZoom] = useState(12);
  const [barriosReady, setBarriosReady] = useState(false);
  const visibleGroups = useMemo(() => sigVisibleLayerGroups(zoom), [zoom]);

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
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "OpenStreetMap"
            }
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }]
        }
      });

      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      map.on("zoomend", () => setZoom(Number(map.getZoom().toFixed(1))));
      map.on("load", async () => {
        const barrios = await api.barriosGeoJson();
        if (cancelled) return;
        barriosRef.current = barrios;
        map.addSource("barrios", { type: "geojson", data: barrios });
        map.addLayer({
          id: "barrios-fill",
          type: "fill",
          source: "barrios",
          paint: {
            "fill-color": ["case", ["boolean", ["feature-state", "selected"], false], "#f59e0b", "#21a67a"],
            "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.42, 0.2]
          }
        });
        map.addLayer({
          id: "barrios-line",
          type: "line",
          source: "barrios",
          paint: {
            "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#92400e", "#087a5a"],
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.4]
          }
        });
        map.on("click", "barrios-fill", (event) => {
          const feature = event.features?.[0];
          if (feature?.properties?.id) onSelectBarrio(feature.properties);
        });
        map.on("mouseenter", "barrios-fill", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "barrios-fill", () => { map.getCanvas().style.cursor = ""; });
        setBarriosReady(true);
      });
      mapRef.current = map;
      cleanup = () => map.remove();
    })();

    return () => {
      cancelled = true;
      cleanup();
      mapRef.current = null;
    };
  }, [api, onSelectBarrio]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !barriosReady) return;
    for (const feature of barriosRef.current.features) {
      map.setFeatureState({ source: "barrios", id: feature.id }, { selected: feature.properties.id === selectedBarrio?.id });
    }
    const feature = barriosRef.current.features.find((item) => item.properties.id === selectedBarrio?.id);
    if (feature) map.fitBounds(geometryBounds(feature.geometry), { padding: 56, duration: 650 });
  }, [barriosReady, selectedBarrio]);

  return (
    <section className="sig-map-shell">
      <aside className="sig-layer-panel">
        <h3>Capas</h3>
        {[
          ["Territorio", ["Barrios", "Manzanas", "Quebradas", "Área de cobertura", "Sector 3"]],
          ["Catastro", ["Lotes", "Números de lote", "Abonados"]],
          ["Agua potable", ["Red principal", "Red secundaria", "Aducción"]],
          ["Operativo", ["Levantamientos", "Inspecciones", "Puntos SIG"]]
        ].map(([group, layers]) => (
          <details key={group} open>
            <summary>{group}</summary>
            {layers.map((layer, index) => (
              <label key={layer}>
                <input type="checkbox" defaultChecked={index === 0 && group === "Territorio"} disabled={group !== "Territorio" || layer !== "Barrios"} />
                {layer}
              </label>
            ))}
          </details>
        ))}
      </aside>
      <div className="sig-map-stage">
        <div className="sig-toolbar">
          <label>
            <Icon name="search" />
            <input placeholder="Buscar clave, abonado o barrio" />
          </label>
          <button type="button" disabled><Icon name="plus" /> Punto</button>
          <button type="button" disabled><Icon name="print" /> Imprimir</button>
        </div>
        <div ref={containerRef} className="sig-map" />
        <footer>
          <span>Zoom {zoom}</span>
          <span>UTM 16N · EPSG:32616</span>
          <span>Barrios: {barriosReady ? "cargados" : "cargando"}</span>
          <span>Reglas: {visibleGroups.join(", ")}</span>
        </footer>
      </div>
    </section>
  );
}

export default function SigTerritorialWorkspace({ apiFetch, showAlert }) {
  const api = useMemo(() => createSigApi(apiFetch), [apiFetch]);
  const [tab, setTab] = useState("mapa");
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [barrios, setBarrios] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedBarrio, setSelectedBarrio] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.config().then(setConfig).catch((error) => showAlert?.(error.message));
    api.health().then(setHealth).catch(() => setHealth({ ready: false }));
    api.barrios().then(setBarrios).catch(() => setBarrios([]));
    api.barrioReport().then(setReport).catch(() => setReport(null));
  }, [api, showAlert]);

  useEffect(() => {
    if (!selectedBarrio?.id) {
      setSummary(null);
      return;
    }
    api.barrioSummary(selectedBarrio.id).then(setSummary).catch(() => setSummary(null));
  }, [api, selectedBarrio]);

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
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "mapa" ? (
        <>
          <SigMap api={api} selectedBarrio={selectedBarrio} onSelectBarrio={setSelectedBarrio} />
          {selectedBarrio ? (
            <aside className="sig-drawer">
              <button type="button" onClick={() => setSelectedBarrio(null)}>Cerrar</button>
              <span>{selectedBarrio.tipo || "Barrio"}</span>
              <h2>{selectedBarrio.nombre || "Sin nombre"}</h2>
              <dl>
                <div><dt>Clave</dt><dd>{selectedBarrio.clave || "Sin clave"}</dd></div>
                <div><dt>Área</dt><dd>{Number(selectedBarrio.area_m2 || 0).toLocaleString("es-HN")} m²</dd></div>
                <div><dt>Manzanas</dt><dd>{summary?.manzanas ?? "..."}</dd></div>
                <div><dt>Quebradas</dt><dd>{summary?.quebradas ?? "..."}</dd></div>
              </dl>
            </aside>
          ) : null}
        </>
      ) : tab === "barrios" ? (
        <section className="sig-placeholder">
          <h2>Barrios</h2>
          <p>{barrios.length.toLocaleString("es-HN")} barrios importados.</p>
          {report ? (
            <div className="sig-report-strip">
              <span>Sin etiqueta: {report.sin_etiqueta}</span>
              <span>Sin clave: {report.sin_clave}</span>
              <span>Duplicados: {report.duplicados?.length || 0}</span>
            </div>
          ) : null}
          <ul>
            {barrios.map((item) => (
              <li key={item.id}>
                <strong>{item.clave || "--"} · {item.nombre || "Sin nombre"}</strong>
                <button type="button" onClick={() => { setSelectedBarrio(item); setTab("mapa"); }}>Ver</button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="sig-placeholder">
          <h2>{TABS.find(([key]) => key === tab)?.[1]}</h2>
          <p>Fase 2 mantiene esta vista limitada a territorio.</p>
          <ul>
            {(config?.datasets || []).slice(0, 8).map((item) => (
              <li key={item.key}>
                <strong>{item.layer}</strong>
                <span>{item.count.toLocaleString("es-HN")} · {item.geometry} · EPSG:{item.srid}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
