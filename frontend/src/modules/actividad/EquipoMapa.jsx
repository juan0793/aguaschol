import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { API_URL } from "../../config/api.js";
import { getSharedProfileWebSocketManager, releaseSharedProfileWebSocketManager } from "../../utils/profileWebSocket.js";
import { capasDelMapa, conLectura, encuadre, tecnicosDelMapa } from "./equipoMapaDatos";
import "./equipoMapa.css";

// Mapa del equipo: dónde andan los técnicos (GPS del teléfono, en vivo) y los
// candidatos del banco que tienen asignados (encendidos con el color de cada
// uno) o que ya revisaron en el día (anillo). Fondo oscuro para que resalten.
const CENTRO = [-87.1908, 13.3003];
const TZ = new Date().getTimezoneOffset();
const VACIO = { type: "FeatureCollection", features: [] };
const DICTAMEN = { clandestino: "Clandestino", sin_determinar: "Sin determinar", registrado: "Registrado" };
const ESTADO = { en_linea: "En línea", reciente: "Hace poco", inactivo: "Sin señal", sin_gps: "Sin GPS hoy" };
const isoHoy = () => new Date(Date.now() - TZ * 60000).toISOString().slice(0, 10);
const tilesDe = (layer) => [`${new URL(API_URL, window.location.href).href.replace(/\/$/, "")}/map-tiles/{z}/{x}/{y}.png?layer=${layer}`];
const iniciales = (nombre = "") => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const relativo = (value, ahora) => {
  if (!value) return "";
  const minutos = Math.floor((ahora - new Date(value).getTime()) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `hace ${horas} h` : new Date(value).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
};
const quieto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Metros por píxel a zoom 0 en el ecuador; el círculo de precisión escala con el zoom.
const MPP0 = 156543.03;
const radioPrecision = ["interpolate", ["exponential", 2], ["zoom"],
  10, ["/", ["get", "acc"], ["/", ["*", MPP0, ["cos", ["/", ["*", ["get", "lat"], Math.PI], 180]]], 1024]],
  22, ["/", ["get", "acc"], ["/", ["*", MPP0, ["cos", ["/", ["*", ["get", "lat"], Math.PI], 180]]], 4194304]]];

export default function EquipoMapa({ apiFetch, session }) {
  const [fecha, setFecha] = useState(isoHoy);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [soloId, setSoloId] = useState(null);
  const [fondo, setFondo] = useState("dark");
  const [ahora, setAhora] = useState(Date.now());
  const [listo, setListo] = useState(false);
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const libre = useRef(null);
  const marcas = useRef(new Map());
  const encuadrado = useRef("");
  const fetchRef = useRef(apiFetch);
  fetchRef.current = apiFetch;
  const esHoy = fecha === isoHoy();

  const turno = useRef(0);
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    const mio = ++turno.current;
    if (!silencioso) setLoading(true);
    try {
      const response = await fetchRef.current(`/admin/team-activity/mapa?${new URLSearchParams({ fecha, tz: TZ })}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No se pudo cargar el mapa del equipo.");
      if (mio === turno.current) { setData(body); setError(""); }
    } catch (reason) { if (mio === turno.current) setError(reason.message); } finally { if (mio === turno.current) setLoading(false); }
  }, [fecha]);
  useEffect(() => { cargar(); }, [cargar]);

  // Hoy se refresca solo, en silencio y con la pestaña a la vista. Administración ya
  // recibe todo en vivo: cada 5 min basta como respaldo. Gerencia (sin WebSocket), cada 2 min.
  // El reloj de "hace N min" corre cada 20 s sin pedir nada al servidor.
  const cadaMs = session?.user?.role === "gerente" || session?.user?.preview ? 120000 : 300000;
  useEffect(() => {
    if (!esHoy) return undefined;
    const datos = setInterval(() => { if (document.visibilityState === "visible") cargar({ silencioso: true }); }, cadaMs);
    const reloj = setInterval(() => setAhora(Date.now()), 20000);
    return () => { clearInterval(datos); clearInterval(reloj); };
  }, [cadaMs, cargar, esHoy]);

  // En vivo (administración): cada lectura del teléfono mueve al técnico; lo que
  // pasa en el banco vuelve a pedir los candidatos (agrupado en 2 s).
  const sessionToken = session?.token || session?.sessionToken || "";
  useEffect(() => {
    if (!esHoy || !sessionToken || session?.user?.role === "gerente" || session?.user?.preview) return undefined;
    const manager = getSharedProfileWebSocketManager(sessionToken);
    if (!manager) return undefined;
    let espera = null;
    const ubicacion = (lectura) => { setData((actual) => conLectura(actual, lectura)); setAhora(Date.now()); };
    const actividad = (item) => {
      if (!String(item?.action || "").startsWith("banco_clandestinos.")) return;
      clearTimeout(espera);
      espera = setTimeout(() => cargar({ silencioso: true }), 2000);
    };
    manager.on("team_location", ubicacion);
    manager.on("team_activity", actividad);
    manager.connect().catch(() => {});
    return () => { clearTimeout(espera); manager.off("team_location", ubicacion); manager.off("team_activity", actividad); releaseSharedProfileWebSocketManager(sessionToken); };
  }, [cargar, esHoy, sessionToken, session?.user?.role, session?.user?.preview]);

  const tecnicos = useMemo(() => tecnicosDelMapa(data || {}, ahora), [data, ahora]);
  const capas = useMemo(() => capasDelMapa(data || {}, tecnicos, soloId), [data, tecnicos, soloId]);
  const enLinea = tecnicos.filter((t) => t.estado === "en_linea").length;
  const pendientes = tecnicos.reduce((sum, t) => sum + t.pendientes, 0);
  const revisados = tecnicos.reduce((sum, t) => sum + t.revisados, 0);

  // Crea el mapa una sola vez (MapLibre se baja solo al abrir esta vista).
  useEffect(() => {
    let cancelado = false;
    let animacion = null;
    (async () => {
      const maplibre = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelado || !contenedor.current || mapa.current) return;
      libre.current = maplibre;
      const map = new maplibre.Map({
        container: contenedor.current,
        center: CENTRO,
        zoom: 13,
        pitch: 35,
        maxPitch: 60,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            dark: { type: "raster", tiles: tilesDe("streets"), tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap" },
            imagery: { type: "raster", tiles: tilesDe("imagery"), tileSize: 256, maxzoom: 19, attribution: "Esri World Imagery" }
          },
          layers: [
            { id: "fondo", type: "background", paint: { "background-color": "#05080f" } },
            // Calles de OpenStreetMap en modo nocturno: con el brillo mínimo mayor que el máximo, la luz se invierte.
            { id: "dark", type: "raster", source: "dark", paint: { "raster-brightness-min": 0.92, "raster-brightness-max": 0.04, "raster-saturation": -0.85, "raster-contrast": 0.15, "raster-hue-rotate": 200 } },
            { id: "imagery", type: "raster", source: "imagery", layout: { visibility: "none" }, paint: { "raster-brightness-max": 0.55, "raster-saturation": -0.35, "raster-contrast": 0.1 } }
          ]
        }
      });
      mapa.current = map;
      // La columna o la ventana cambian de tamaño: el lienzo se ajusta.
      const ajuste = new ResizeObserver(() => map.resize());
      ajuste.observe(contenedor.current);
      map.once("remove", () => ajuste.disconnect());
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      map.on("load", () => {
        if (cancelado) return;
        map.addSource("barrios", { type: "geojson", data: VACIO });
        map.addSource("rastros", { type: "geojson", data: VACIO, lineMetrics: true });
        map.addSource("precision", { type: "geojson", data: VACIO });
        map.addSource("candidatos", { type: "geojson", data: VACIO });
        map.addLayer({ id: "barrios-linea", type: "line", source: "barrios", paint: { "line-color": "#7dd3fc", "line-opacity": 0.16, "line-width": 1 } });
        // Recorrido: un halo difuso debajo y la línea fina encima.
        map.addLayer({ id: "rastros-halo", type: "line", source: "rastros", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 9, "line-blur": 6, "line-opacity": 0.28 } });
        map.addLayer({ id: "rastros", type: "line", source: "rastros", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.85, "line-dasharray": [0.5, 1.6] } });
        map.addLayer({ id: "precision", type: "circle", source: "precision", paint: { "circle-color": ["get", "color"], "circle-opacity": 0.1, "circle-radius": radioPrecision, "circle-stroke-color": ["get", "color"], "circle-stroke-width": 1, "circle-stroke-opacity": 0.35 } });
        const pendiente = ["==", ["get", "estado"], "pendiente"];
        // Pendientes: brillo difuso del color del técnico y un núcleo claro.
        map.addLayer({ id: "cand-brillo", type: "circle", source: "candidatos", filter: pendiente, paint: { "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 7, 15, 14, 18, 22], "circle-blur": 1, "circle-opacity": 0.55 } });
        map.addLayer({ id: "cand-nucleo", type: "circle", source: "candidatos", filter: pendiente, paint: { "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.2, 15, 3.6, 18, 5.5], "circle-stroke-color": "#ffffff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4, 16, 1.2], "circle-stroke-opacity": 0.85 } });
        // Revisados en el día: anillo (enviado a ficha en su color, descartado en gris).
        map.addLayer({ id: "cand-revisado", type: "circle", source: "candidatos", filter: ["!", pendiente], paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 6, 18, 8], "circle-stroke-width": 1.6, "circle-stroke-color": ["case", ["==", ["get", "estado"], "enviado"], ["get", "color"], "#7b8794"], "circle-stroke-opacity": 0.9 } });
        const abrir = (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const p = feature.properties;
          const cuerpo = document.createElement("div");
          cuerpo.className = "em-popup";
          const filas = [["strong", p.clave || "Sin clave"], ["span", p.barrio || "Sin barrio"], ["span", `${DICTAMEN[p.dictamen] || p.dictamen || ""} · ${p.estado === "pendiente" ? "por revisar" : p.estado === "enviado" ? "pasó a ficha" : "descartado"}`], ["small", p.tecnico ? `${p.estado === "pendiente" ? "Asignado a" : "Revisó"} ${p.tecnico}` : ""]];
          filas.filter(([, texto]) => texto).forEach(([tag, texto]) => { const el = document.createElement(tag); el.textContent = texto; cuerpo.appendChild(el); });
          new maplibre.Popup({ closeButton: false, offset: 10, className: "em-popup-wrap" }).setLngLat(feature.geometry.coordinates).setDOMContent(cuerpo).addTo(map);
        };
        ["cand-nucleo", "cand-revisado", "cand-brillo"].forEach((id) => {
          map.on("click", id, abrir);
          map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
        });
        // Latido suave del brillo de los pendientes.
        if (!quieto()) {
          const inicio = performance.now();
          const latir = (t) => {
            if (cancelado || !map.getLayer("cand-brillo")) return;
            const fase = (Math.sin(((t - inicio) / 1400) * Math.PI) + 1) / 2;
            map.setPaintProperty("cand-brillo", "circle-opacity", 0.35 + fase * 0.35);
            animacion = requestAnimationFrame(latir);
          };
          animacion = requestAnimationFrame(latir);
        }
        fetchRef.current("/gis/barrios.geojson").then((r) => (r.ok ? r.json() : null)).then((geo) => { if (geo?.features && !cancelado) map.getSource("barrios")?.setData(geo); }).catch(() => {});
        setListo(true);
      });
    })().catch(() => setError("No se pudo abrir el mapa en este navegador."));
    return () => {
      cancelado = true;
      if (animacion) cancelAnimationFrame(animacion);
      marcas.current.forEach((marca) => marca.remove());
      marcas.current.clear();
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // Fondo: oscuro o satélite oscurecido.
  useEffect(() => {
    const map = mapa.current;
    if (!listo || !map) return;
    map.setLayoutProperty("dark", "visibility", fondo === "dark" ? "visible" : "none");
    map.setLayoutProperty("imagery", "visibility", fondo === "imagery" ? "visible" : "none");
  }, [fondo, listo]);

  // Capas y marcas de los técnicos.
  useEffect(() => {
    const map = mapa.current;
    const maplibre = libre.current;
    if (!listo || !map || !maplibre) return;
    map.getSource("candidatos")?.setData(capas.candidatos);
    map.getSource("rastros")?.setData(capas.rastros);
    map.getSource("precision")?.setData(capas.precision);
    const visibles = tecnicos.filter((t) => t.ubicacion && (soloId == null || t.id === soloId));
    const ids = new Set(visibles.map((t) => t.id));
    marcas.current.forEach((marca, id) => { if (!ids.has(id)) { marca.remove(); marcas.current.delete(id); } });
    for (const tecnico of visibles) {
      let marca = marcas.current.get(tecnico.id);
      if (!marca) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "em-tecnico";
        el.innerHTML = '<span class="em-tecnico-pulso"></span><span class="em-tecnico-punto"></span><span class="em-tecnico-texto"><b></b><small></small></span>';
        el.addEventListener("click", (event) => { event.stopPropagation(); setSoloId((actual) => (actual === tecnico.id ? null : tecnico.id)); });
        marca = new maplibre.Marker({ element: el, anchor: "center" }).setLngLat([tecnico.ubicacion.longitude, tecnico.ubicacion.latitude]).addTo(map);
        marcas.current.set(tecnico.id, marca);
      }
      const el = marca.getElement();
      el.style.setProperty("--em-color", tecnico.color);
      el.dataset.estado = tecnico.estado;
      el.querySelector(".em-tecnico-punto").textContent = iniciales(tecnico.nombre);
      el.querySelector("b").textContent = tecnico.nombre;
      el.querySelector("small").textContent = `${relativo(tecnico.ubicacion.at, ahora)}${tecnico.ubicacion.accuracy ? ` · ±${Math.round(tecnico.ubicacion.accuracy)} m` : ""}`;
      el.setAttribute("aria-label", `${tecnico.nombre}, ${ESTADO[tecnico.estado]}, ${relativo(tecnico.ubicacion.at, ahora)}`);
      marca.setLngLat([tecnico.ubicacion.longitude, tecnico.ubicacion.latitude]);
    }
    // Encuadra al cargar el día o al elegir un técnico, no con cada lectura en vivo.
    const clave = `${fecha}|${soloId ?? "todos"}|${data ? "datos" : ""}`;
    if (data && encuadrado.current !== clave) {
      encuadrado.current = clave;
      const caja = encuadre(capas, visibles);
      if (caja) map.fitBounds(caja, { padding: 64, maxZoom: 16.5, duration: quieto() ? 0 : 900 });
    }
  }, [ahora, capas, data, fecha, listo, soloId, tecnicos]);

  const elegido = tecnicos.find((t) => t.id === soloId);
  const irA = (tecnico) => setSoloId((actual) => (actual === tecnico.id ? null : tecnico.id));

  return <section className="em" aria-label="Mapa del equipo">
    <aside className="em-rail">
      <div className="em-controles">
        <label className="em-fecha"><span>Día</span><input type="date" value={fecha} max={isoHoy()} onChange={(event) => { setSoloId(null); setFecha(event.target.value || isoHoy()); }} /></label>
        {!esHoy ? <button type="button" className="em-link" onClick={() => setFecha(isoHoy())}>Volver a hoy</button> : null}
      </div>
      <dl className="em-cifras">
        <div><dt>En línea</dt><dd className={enLinea ? "is-vivo" : ""}>{esHoy ? enLinea : "—"}</dd></div>
        <div><dt>Por revisar</dt><dd>{pendientes.toLocaleString("es-HN")}</dd></div>
        <div><dt>Revisados {esHoy ? "hoy" : "el día"}</dt><dd>{revisados.toLocaleString("es-HN")}</dd></div>
      </dl>
      <header className="em-rail-head">
        <h2>Técnicos</h2>
        {soloId != null ? <button type="button" className="em-link" onClick={() => setSoloId(null)}>Ver todo el equipo</button> : null}
      </header>
      {tecnicos.length ? <ol className="em-lista">
        {tecnicos.map((tecnico) => <li key={tecnico.id}>
          <button type="button" className={`em-persona is-${tecnico.estado}${soloId === tecnico.id ? " is-activa" : ""}`} aria-pressed={soloId === tecnico.id} onClick={() => irA(tecnico)} style={{ "--em-color": tecnico.color }}>
            <i aria-hidden="true" />
            <span className="em-persona-nombre">{tecnico.nombre}<small>{tecnico.ubicacion ? `${ESTADO[tecnico.estado]} · ${relativo(tecnico.ubicacion.at, ahora)}` : ESTADO.sin_gps}</small></span>
            <span className="em-persona-num" title="Asignados por revisar">{tecnico.pendientes}</span>
            <span className="em-persona-num is-hecho" title={`Revisados: ${tecnico.enviados} a ficha, ${tecnico.revisados - tecnico.enviados} descartados`}>{tecnico.revisados}</span>
          </button>
        </li>)}
      </ol> : <p className="em-vacio">{loading ? "Cargando…" : "Nadie tiene candidatos asignados ni compartió su ubicación este día."}</p>}
      {tecnicos.length ? <p className="em-nota"><span>Por revisar</span> · <span className="is-hecho">Revisados</span></p> : null}
      <p className="em-nota">La ubicación llega del teléfono del técnico mientras tiene la app abierta. Solo aparecen los candidatos con coordenadas.</p>
    </aside>
    <div className="em-lienzo">
      <div ref={contenedor} className="em-mapa" />
      <div className="em-sobre em-arriba">
        <div className="em-fondos" role="group" aria-label="Fondo del mapa">
          {[["dark", "Nocturno"], ["imagery", "Satélite"]].map(([key, label]) => <button type="button" key={key} aria-pressed={fondo === key} className={fondo === key ? "is-active" : ""} onClick={() => setFondo(key)}>{label}</button>)}
        </div>
        {esHoy ? <span className="em-vivo"><i aria-hidden="true" />En vivo</span> : null}
        <button type="button" className="em-refrescar" onClick={() => cargar()} disabled={loading} aria-label="Actualizar el mapa"><Icon name="refresh" /></button>
      </div>
      {elegido ? <div className="em-sobre em-elegido" style={{ "--em-color": elegido.color }}><i aria-hidden="true" /><b>{elegido.nombre}</b><span>{elegido.pendientes} por revisar · {elegido.revisados} revisados</span><button type="button" onClick={() => setSoloId(null)} aria-label="Ver todo el equipo">×</button></div> : null}
      <div className="em-sobre em-leyenda" aria-hidden="true">
        <span><i className="is-pendiente" />Asignado, por revisar</span>
        <span><i className="is-enviado" />Pasó a ficha</span>
        <span><i className="is-descartado" />Descartado</span>
        <span><i className="is-tecnico" />Técnico (GPS)</span>
      </div>
      {error ? <p className="em-sobre em-error" role="alert">{error} <button type="button" onClick={() => cargar()}>Reintentar</button></p> : null}
      {loading && !data ? <p className="em-sobre em-cargando">Cargando el mapa…</p> : null}
    </div>
  </section>;
}
