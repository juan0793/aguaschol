import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { TableSkeleton } from "../../components/ds/Skeleton";
import { congelarAltura, soltarAltura } from "../clandestinos/alturaSuave";
import PozoDetalle from "./PozoDetalle";
import PozosMapa from "./PozosMapa";
import { BarrasColonia, CalidadPorColonia, Cobertura, Dispersion, FranjaUso, Hallazgos, Histograma, Panel } from "./PozosGraficos";
import {
  CALIDADES, DATOS, FILTROS_INICIALES, VISTAS, calidadDe, calidadPorColonia, coberturaDatos, coloniasDe, contarVistas, conteoUso,
  filtrarPozos, formatoNumero, fueraDeRango, hallazgos, haceCuanto, histograma, ordenarPozos, paginar, pozosCsv, pozosPorColonia, resumenMetricas
} from "./pozosFiltros";
import "../clandestinos/styles/clandestinos.css";
import "./pozos.css";

const POR_PAGINA = 20;
const REVISAR_MS = 60000;

// Las cuatro maneras de ver los pozos filtrados. Los filtros y la franja de cifras valen para todas.
const MODOS = [
  { clave: "resumen", label: "Resumen", icono: "dashboard" },
  { clave: "lista", label: "Lista", icono: "records" },
  { clave: "mapa", label: "Mapa", icono: "map" },
  { clave: "analisis", label: "Análisis", icono: "barChart" }
];
// Descargas: los cuatro informes en PDF (pozosPdf.js) y la tabla en CSV. Todos usan la lista filtrada.
const DESCARGAS = [
  { tipo: "inventario", titulo: "Inventario de pozos", nota: "Cifras, gráficos, mapa general y la tabla completa." },
  { tipo: "fichas", titulo: "Fichas técnicas", nota: "Una hoja por pozo, con su mapa y la escala del valor guía." },
  { tipo: "calidad", titulo: "Calidad del agua", nota: "pH y TDS contra la norma, solo pozos medidos." },
  { tipo: "levantamiento", titulo: "Plan de levantamiento", nota: "Lo que falta medir, por colonia, con casillas para campo." },
  { tipo: "csv", titulo: "Tabla para Excel (CSV)", nota: "Todos los datos de cada pozo en columnas." }
];
const ETIQUETA_CALIDAD = { dentro: "Dentro de guía", fuera: "Fuera de guía", sin: "Sin medición" };
const CLASE_CALIDAD = { dentro: "is-approved", fuera: "is-discarded", sin: "" };

// Columnas del listado: [clave de orden, encabezado, unidad, decimales, numérica].
const COLUMNAS = [
  ["codigo", "Pozo", "", 0, false],
  ["colonia", "Colonia", "", 0, false],
  ["en_uso", "Uso", "", 0, false],
  ["calidad", "Calidad", "", 0, false],
  ["profundidad_m", "Prof.", "m", 2, true],
  ["nivel_freatico_m", "N. freático", "m", 2, true, "Nivel"],
  ["diametro_pulg", "Diám.", "pulg", 0, true],
  ["ph", "pH", "", 2, true],
  ["tds_g_l", "TDS", "g/L", 3, true],
  ["salinidad", "Salinidad", "", 2, true],
  ["temperatura_c", "Temp.", "°C", 1, true],
  ["oxigeno_disuelto", "O. disuelto", "%", 1, true],
  ["cloro_residual", "Cloro", "", 2, true]
];

function CeldaNumero({ campo, valor, decimales }) {
  if (valor === null || valor === undefined) return <td className="pz-num is-vacio">—</td>;
  const fuera = fueraDeRango(campo, valor);
  return <td className={`pz-num${fuera ? " is-fuera" : ""}`} title={fuera ? "Fuera del valor guía" : undefined}>{formatoNumero(valor, decimales, true)}</td>;
}

// "Pozos": inventario de pozos de Choluteca, solo consulta, para administración y Gerencia.
// Usa la bandeja del sistema (la de Clandestinos e Inspecciones): pestañas con conteo, búsqueda,
// tabla indexada con páginas y la ficha en el cajón. Se actualiza sola cada minuto.
export default function PozosWorkspace({ apiFetch }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [orden, setOrden] = useState({ campo: "codigo", dir: "asc" });
  const [pagina, setPagina] = useState(1);
  const [modo, setModo] = useState("resumen");
  const [abiertoId, setAbiertoId] = useState(null);
  const [menuDescargas, setMenuDescargas] = useState(false);
  const [generando, setGenerando] = useState(null);
  const [fallaInforme, setFallaInforme] = useState("");
  const descargasRef = useRef(null);
  const [revisadoEn, setRevisadoEn] = useState(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [, setReloj] = useState(0);
  const versionRef = useRef(null);
  const tablaRef = useRef(null);
  const inboxRef = useRef(null);
  const indicadoresRef = useRef(null);
  const alturaBusqueda = useRef(0);

  // Primera carga con esqueleto; las siguientes en silencio (la tabla no se vacía ni salta).
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (silencioso && document.visibilityState !== "visible") return;
    if (silencioso) setActualizando(true); else setCargando(true);
    try {
      const response = await apiFetch("/pozos");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo cargar el inventario de pozos.");
      if (body.actualizado !== versionRef.current || !silencioso) {
        versionRef.current = body.actualizado;
        setData(body);
      }
      setError("");
      setSinConexion(false);
      setRevisadoEn(new Date().toISOString());
    } catch (reason) {
      // Un refresco fallido no inserta avisos (la tabla no se mueve): lo dice el indicador.
      if (silencioso) setSinConexion(true);
      else setError(reason.message || "No se pudo cargar el inventario de pozos.");
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    cargar();
    const silencioso = () => cargar({ silencioso: true });
    const timer = window.setInterval(silencioso, REVISAR_MS);
    const reloj = window.setInterval(() => setReloj((n) => n + 1), 30000);
    document.addEventListener("visibilitychange", silencioso);
    return () => { window.clearInterval(timer); window.clearInterval(reloj); document.removeEventListener("visibilitychange", silencioso); };
  }, [cargar]);

  const pozos = useMemo(() => data?.pozos ?? [], [data]);
  const conteos = useMemo(() => contarVistas(pozos), [pozos]);
  const colonias = useMemo(() => coloniasDe(pozos), [pozos]);
  const filtrados = useMemo(() => filtrarPozos(pozos, filtros), [pozos, filtros]);
  const ordenados = useMemo(() => ordenarPozos(filtrados, orden), [filtrados, orden]);
  const pag = useMemo(() => paginar(ordenados, pagina, POR_PAGINA), [ordenados, pagina]);
  const metricas = useMemo(() => resumenMetricas(filtrados), [filtrados]);
  const enMapa = useMemo(() => filtrados.filter((pozo) => pozo.coordenada_valida), [filtrados]);
  const graficos = useMemo(() => (modo === "resumen" || modo === "analisis" ? {
    colonias: pozosPorColonia(filtrados),
    uso: conteoUso(filtrados),
    cobertura: coberturaDatos(filtrados),
    hallazgos: hallazgos(filtrados),
    ph: histograma(filtrados, "ph"),
    tds: histograma(filtrados, "tds_g_l"),
    calidad: calidadPorColonia(filtrados)
  } : null), [filtrados, modo]);

  // Alto estable, como en Fichas: cambiar de pestaña, colonia, página, orden o vista congela el alto
  // de la bandeja y lo suelta con una transición; mientras se busca, el mayor alto visto es el piso.
  const cambiarVista = (cambio) => { congelarAltura(inboxRef.current); cambio(); };
  useLayoutEffect(() => { soltarAltura(inboxRef.current); }, [filtros.vista, filtros.colonia, filtros.calidad, filtros.falta, pagina, orden, modo]);
  const buscando = Boolean(filtros.texto.trim());
  useLayoutEffect(() => {
    const inbox = inboxRef.current;
    if (!inbox || inbox.dataset.alturaSuave) return;
    if (!buscando) { alturaBusqueda.current = 0; inbox.style.minHeight = ""; return; }
    alturaBusqueda.current = Math.max(alturaBusqueda.current, inbox.offsetHeight);
    inbox.style.minHeight = `${alturaBusqueda.current}px`;
  });

  // Marca azul que se desliza bajo la pestaña activa (la misma de Fichas).
  const [marca, setMarca] = useState(null);
  useLayoutEffect(() => {
    const medir = () => {
      const activo = indicadoresRef.current?.querySelector("button.is-active");
      setMarca(activo ? { left: activo.offsetLeft, top: activo.offsetTop + activo.offsetHeight - 3, width: activo.offsetWidth } : null);
    };
    medir();
    addEventListener("resize", medir);
    return () => removeEventListener("resize", medir);
  }, [filtros.vista, conteos, data]);

  const cambiar = (cambio) => {
    const soloTexto = Object.keys(cambio).length === 1 && "texto" in cambio;
    const aplicar = () => { setFiltros((actual) => ({ ...actual, ...cambio })); setPagina(1); };
    if (soloTexto) aplicar(); else cambiarVista(aplicar);
  };
  const ordenarPor = (campo) => cambiarVista(() => setOrden((actual) => ({ campo, dir: actual.campo === campo && actual.dir === "asc" ? "desc" : "asc" })));
  const irAPagina = (nueva) => {
    cambiarVista(() => setPagina(nueva));
    tablaRef.current?.scrollIntoView({ block: "nearest" });
  };
  const hayFiltros = filtros.texto.trim() || filtros.colonia || filtros.calidad || filtros.falta || filtros.vista !== "todos";
  const vistaActiva = VISTAS.find((vista) => vista.clave === filtros.vista);
  const calidadActiva = CALIDADES.find((calidad) => calidad.clave === filtros.calidad);
  const faltaActiva = DATOS.find((dato) => dato.clave === filtros.falta);
  // Un gráfico o hallazgo lleva a la lista con su filtro aplicado; tocar lo ya elegido lo quita.
  const verEnLista = (cambio) => cambiarVista(() => { setFiltros((actual) => ({ ...actual, ...cambio })); setPagina(1); setModo("lista"); });
  const alternar = (campo) => (valor) => cambiar({ [campo]: filtros[campo] === valor ? "" : valor });

  // Menú de descargas: se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!menuDescargas) return undefined;
    const cerrar = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !descargasRef.current?.contains(event.target)) setMenuDescargas(false);
    };
    document.addEventListener("pointerdown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => { document.removeEventListener("pointerdown", cerrar); document.removeEventListener("keydown", cerrar); };
  }, [menuDescargas]);

  // Qué filtros salen en el subtítulo del informe.
  const alcance = [
    hayFiltros ? [vistaActiva && filtros.vista !== "todos" ? vistaActiva.label : "", filtros.colonia, calidadActiva?.label, faltaActiva ? `Sin ${faltaActiva.label.toLowerCase()}` : "", filtros.texto.trim() ? `“${filtros.texto.trim()}”` : ""].filter(Boolean).join(" · ") : "Todos los pozos",
    `${ordenados.length} de ${pozos.length} pozos`
  ].join(" · ");
  const generarInforme = async (tipo, lista = ordenados) => {
    setMenuDescargas(false);
    if (tipo === "csv") { exportar(); return; }
    setGenerando({ tipo, texto: "Preparando…" });
    setFallaInforme("");
    try {
      const { descargarInformePozos } = await import("./informesPozos");
      await descargarInformePozos({ tipo, pozos: lista, alcance: lista === ordenados ? alcance : `${lista[0]?.codigo || ""} · ficha individual`, fuente: data?.fuente || "", onProgreso: (texto) => setGenerando({ tipo, texto }) });
    } catch (reason) {
      setFallaInforme(`No se pudo generar el informe: ${reason.message || "error desconocido"}. Intenta de nuevo.`);
    } finally {
      setGenerando(null);
    }
  };

  const exportar = () => {
    const url = URL.createObjectURL(new Blob([pozosCsv(ordenados)], { type: "text/csv;charset=utf-8" }));
    const enlace = Object.assign(document.createElement("a"), { href: url, download: `pozos-choluteca-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Cajón: recorre la lista en el orden en que se ve.
  const posicion = ordenados.findIndex((pozo) => pozo.id === abiertoId);
  const abierto = posicion >= 0 ? ordenados[posicion] : null;
  const abrir = useCallback((id) => setAbiertoId(id), []);
  useEffect(() => { if (abiertoId !== null && posicion < 0) setAbiertoId(null); }, [abiertoId, posicion]);

  return <main className="cl-module pz-module is-flat">
    <section ref={inboxRef} className="cl-inbox pz-inbox" aria-labelledby="pz-titulo">
      <header className="cl-inbox-head">
        <span className="cl-inbox-emblem" aria-hidden="true"><Icon name="water" /></span>
        <div className="cl-inbox-title">
          <h2 id="pz-titulo">Pozos</h2>
          <p className="cl-inbox-scope" aria-live="polite">
            <span className="cl-scope-count">{data ? `${filtrados.length} de ${pozos.length} pozos` : "Cargando inventario…"}</span>
            {filtros.vista !== "todos" ? <span className="cl-scope-chip">{vistaActiva?.label}<button type="button" onClick={() => cambiar({ vista: "todos" })} aria-label={`Quitar el filtro ${vistaActiva?.label}`}><Icon name="close" /></button></span> : null}
            {filtros.colonia ? <span className="cl-scope-chip">{filtros.colonia}<button type="button" onClick={() => cambiar({ colonia: "" })} aria-label={`Quitar la colonia ${filtros.colonia}`}><Icon name="close" /></button></span> : null}
            {calidadActiva ? <span className="cl-scope-chip">{calidadActiva.label}<button type="button" onClick={() => cambiar({ calidad: "" })} aria-label={`Quitar el filtro ${calidadActiva.label}`}><Icon name="close" /></button></span> : null}
            {faltaActiva ? <span className="cl-scope-chip">Sin {faltaActiva.label.toLowerCase()}<button type="button" onClick={() => cambiar({ falta: "" })} aria-label={`Quitar el filtro sin ${faltaActiva.label.toLowerCase()}`}><Icon name="close" /></button></span> : null}
            {filtros.texto.trim() ? <span className="cl-scope-chip">“{filtros.texto.trim()}”<button type="button" onClick={() => cambiar({ texto: "" })} aria-label="Quitar la búsqueda"><Icon name="close" /></button></span> : null}
            {hayFiltros ? <button type="button" className="cl-scope-clear" onClick={() => cambiar(FILTROS_INICIALES)}>Ver todos</button> : null}
          </p>
        </div>
        <div className="cl-inbox-actions pz-acciones">
          <span className={`pz-sync${actualizando ? " is-activo" : ""}${sinConexion ? " is-error" : ""}`} role="status">
            <i aria-hidden="true" />{actualizando ? "Actualizando…" : sinConexion ? `Sin conexión · datos ${/^hace/.test(haceCuanto(revisadoEn)) ? "de " : "del "}${haceCuanto(revisadoEn)}` : revisadoEn ? `Al día · ${haceCuanto(revisadoEn)}` : "Conectando…"}
          </span>
          <button type="button" className="cl-quiet" onClick={() => cargar({ silencioso: true })} disabled={actualizando || cargando}><Icon name="refresh" /><span>{sinConexion ? "Reintentar" : "Actualizar"}</span></button>
          <div ref={descargasRef} className="pz-descargas">
            <button type="button" className={`cl-secondary pz-exportar${generando ? " is-generando" : ""}`} onClick={() => setMenuDescargas((abierto) => !abierto)} disabled={!ordenados.length || Boolean(generando)} aria-expanded={menuDescargas} aria-haspopup="menu" aria-label={generando ? generando.texto : "Descargar informes de los pozos filtrados"}>
              <Icon name={generando ? "refresh" : "download"} /><span>{generando ? generando.texto : "Descargar"}</span>
            </button>
            {menuDescargas ? <div className="pz-descargas-menu" role="menu" aria-label="Descargar">
              <p>Con los {ordenados.length} pozos filtrados</p>
              {DESCARGAS.map((opcion) => <button type="button" role="menuitem" key={opcion.tipo} onClick={() => generarInforme(opcion.tipo)}>
                <Icon name={opcion.tipo === "csv" ? "records" : "print"} />
                <span><strong>{opcion.titulo}</strong><small>{opcion.nota}</small></span>
              </button>)}
            </div> : null}
          </div>
        </div>
      </header>

      <div className="cl-toolbar pz-toolbar">
        <label className="cl-search"><span>Buscar pozo</span><div><Icon name="search" /><input type="search" value={filtros.texto} onChange={(event) => cambiar({ texto: event.target.value })} placeholder="Código (032), nombre, colonia, bomba u observación" /></div></label>
        <label><span>Colonia</span>
          <select value={filtros.colonia} onChange={(event) => cambiar({ colonia: event.target.value })}>
            <option value="">Todas las colonias</option>
            {colonias.map(({ colonia, total }) => <option key={colonia} value={colonia}>{colonia} ({total})</option>)}
          </select>
        </label>
        <label><span>Calidad</span>
          <select value={filtros.calidad} onChange={(event) => cambiar({ calidad: event.target.value })}>
            <option value="">Toda calidad</option>
            {CALIDADES.map((calidad) => <option key={calidad.clave} value={calidad.clave}>{calidad.label}</option>)}
          </select>
        </label>
        <label><span>Le falta</span>
          <select value={filtros.falta} onChange={(event) => cambiar({ falta: event.target.value })}>
            <option value="">Cualquier dato</option>
            {DATOS.map((dato) => <option key={dato.clave} value={dato.clave}>{dato.label}</option>)}
          </select>
        </label>
        <div className="pz-modo" role="group" aria-label="Ver como">
          <span>Ver como</span>
          <div>
            {MODOS.map((item) => <button type="button" key={item.clave} className={modo === item.clave ? "is-active" : ""} aria-pressed={modo === item.clave} onClick={() => cambiarVista(() => setModo(item.clave))}><Icon name={item.icono} /><span>{item.label}</span></button>)}
          </div>
        </div>
      </div>

      <nav ref={indicadoresRef} className="cl-indicators pz-indicadores" aria-label="Filtrar pozos">
        {VISTAS.map((vista) => <button type="button" key={vista.clave} aria-pressed={filtros.vista === vista.clave} className={filtros.vista === vista.clave ? "is-active" : undefined} onClick={() => cambiar({ vista: vista.clave })}>
          <span className="cl-stage-label"><span className="is-long">{vista.label}</span><span className="is-short" aria-hidden="true">{vista.corto}</span></span><strong>{data ? conteos[vista.clave] : "–"}</strong>
        </button>)}
        {marca ? <i className="cl-indicators-mark" aria-hidden="true" style={{ transform: `translate(${marca.left}px, ${marca.top}px) scaleX(${marca.width / 100})` }} /> : null}
      </nav>


      {fallaInforme ? <p className="cl-alert" role="alert">{fallaInforme} <button type="button" className="pz-reintentar" onClick={() => setFallaInforme("")}>Cerrar</button></p> : null}
      {error && !data ? <p className="cl-alert" role="alert">{error} <button type="button" className="pz-reintentar" onClick={() => cargar()}>Reintentar</button></p> : null}

      {modo === "resumen" && graficos ? <div className="pz-tablero">
        <Panel id="pz-g-colonias" titulo="Pozos por colonia" nota="Toca una colonia para ver solo sus pozos.">
          <BarrasColonia filas={graficos.colonias} activa={filtros.colonia} onElegir={alternar("colonia")} />
        </Panel>
        <Panel id="pz-g-uso" titulo="Estado de uso">
          <FranjaUso uso={graficos.uso} total={filtrados.length} />
        </Panel>
        <Panel id="pz-g-cobertura" titulo="Datos levantados" nota="Cuántos pozos tienen cada dato. Toca uno para ver los que les falta.">
          <Cobertura filas={graficos.cobertura} activa={filtros.falta} onElegir={(clave) => verEnLista({ falta: filtros.falta === clave ? "" : clave })} />
        </Panel>
        <Panel id="pz-g-hallazgos" titulo="Para atender" nota="Cada línea abre la lista con esos pozos.">
          <Hallazgos items={graficos.hallazgos} onElegir={verEnLista} />
        </Panel>
      </div> : null}

      {modo === "analisis" && graficos ? <div className="pz-analisis">
        <section className="cl-service-stats pz-metricas" aria-labelledby="pz-metricas-titulo">
          <header className="cl-service-stats-head">
            <h3 id="pz-metricas-titulo">Mediciones de los pozos</h3>
            <p>Promedio de los pozos filtrados que tienen el dato; debajo, el rango y cuántos lo tienen.</p>
          </header>
          <dl className="cl-service-stats-grid">
            {metricas.map((metrica) => <div className="cl-service-stat pz-metrica" key={metrica.campo}>
              <dt>{metrica.label}</dt>
              <dd>
                <strong>{metrica.n ? formatoNumero(metrica.promedio, metrica.decimales) : "--"}{metrica.n && metrica.unidad ? <small> {metrica.unidad}</small> : null}</strong>
                <span>{metrica.n ? `${formatoNumero(metrica.min, metrica.decimales)} a ${formatoNumero(metrica.max, metrica.decimales)} · ${metrica.n} pozos` : "Sin datos"}</span>
                {metrica.fuera !== null && metrica.n ? <span className={metrica.fuera ? "pz-fuera" : "pz-dentro"}>{metrica.fuera ? `${metrica.fuera} fuera del valor guía` : "Todos dentro del valor guía"}</span> : <span aria-hidden="true">&nbsp;</span>}
              </dd>
            </div>)}
          </dl>
        </section>
        <div className="pz-tablero">
          <Panel id="pz-g-ph" titulo="Distribución de pH" nota={`${graficos.ph.reduce((suma, barra) => suma + barra.n, 0)} pozos con pH medido.`}>
            <Histograma barras={graficos.ph} campo="ph" decimales={1} />
          </Panel>
          <Panel id="pz-g-tds" titulo="Distribución de sólidos disueltos (TDS)" nota={`${graficos.tds.reduce((suma, barra) => suma + barra.n, 0)} pozos con TDS medido, en g/L.`}>
            <Histograma barras={graficos.tds} campo="tds_g_l" unidad="g/L" decimales={2} />
          </Panel>
          <Panel id="pz-g-dispersion" titulo="pH contra TDS" nota="Un punto por pozo. Toca uno para abrir su ficha.">
            <Dispersion pozos={filtrados} onAbrir={abrir} />
          </Panel>
          <Panel id="pz-g-calidad" titulo="Calidad por colonia" nota="Toca una colonia para ver solo sus pozos.">
            <CalidadPorColonia filas={graficos.calidad} activa={filtros.colonia} onElegir={alternar("colonia")} />
          </Panel>
        </div>
      </div> : null}

      {modo === "mapa" ? <div className="pz-vista-mapa">
        <PozosMapa pozos={enMapa} seleccionadoId={abiertoId} onSeleccionar={abrir} />
        <p className="pz-nota">{enMapa.length} de {filtrados.length} pozos en el mapa{filtrados.length > enMapa.length ? ` · ${filtrados.length - enMapa.length} sin coordenada válida (búscalos en la lista)` : ""}. Toca un punto para abrir su ficha.</p>
      </div> : null}

      {modo === "lista" ? <>
        <div ref={tablaRef} className={`cl-table-wrap pz-tabla-wrap${actualizando ? " is-refreshing" : ""}`} aria-busy={cargando || actualizando}>
          {actualizando ? <span className="cl-table-progress" role="status" aria-label="Actualizando pozos" /> : null}
          <table className="cl-table pz-tabla">
            <thead>
              <tr>
                <th scope="col" className="pz-indice">#</th>
                {COLUMNAS.map(([campo, titulo, unidad, , numerica, corto]) => <th scope="col" key={campo} className={numerica ? "pz-num" : campo === "codigo" ? "pz-col-pozo" : undefined} aria-sort={orden.campo === campo ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className={`pz-orden${orden.campo === campo ? " is-activo" : ""}`} onClick={() => ordenarPor(campo)}>
                    {corto ? <><span className="is-long">{titulo}</span><span className="is-short">{corto}</span></> : titulo}{unidad ? <small>{unidad}</small> : null}
                    <Icon name="chevronDown" />
                  </button>
                </th>)}
                <th scope="col"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && !data ? <TableSkeleton columns={COLUMNAS.length + 2} rows={8} label="Cargando pozos…" />
                : !pag.items.length ? <tr><td colSpan={COLUMNAS.length + 2} className="cl-empty">{pozos.length ? "Ningún pozo coincide con la búsqueda o los filtros." : "No hay pozos en el inventario."}</td></tr>
                : pag.items.map((pozo, indice) => <tr key={pozo.id} className={pozo.id === abiertoId ? "is-selected" : undefined}>
                  <td className="pz-indice">{pag.desde + indice}</td>
                  <td className="pz-col-pozo">
                    <button type="button" className="cl-link pz-pozo" onClick={() => abrir(pozo.id)}>
                      <strong>{pozo.codigo}{pozo.codigo_repetido || !pozo.coordenada_valida ? <Icon name="warning" /> : null}</strong>
                      <span>{pozo.nombre || "Sin nombre"}</span>
                    </button>
                  </td>
                  <td className="pz-colonia">{pozo.colonia || "Sin colonia"}</td>
                  <td>{pozo.en_uso ? <span className="cl-status is-approved"><i />En uso</span> : <span className="cl-status"><i />Sin dato</span>}</td>
                  <td><span className={`cl-status ${CLASE_CALIDAD[calidadDe(pozo)]}`}><i />{ETIQUETA_CALIDAD[calidadDe(pozo)]}</span></td>
                  {COLUMNAS.slice(4).map(([campo, , , decimales]) => <CeldaNumero key={campo} campo={campo} valor={pozo[campo]} decimales={decimales} />)}
                  <td><button type="button" className="cl-icon-button" onClick={() => abrir(pozo.id)} aria-label={`Abrir ficha del pozo ${pozo.codigo}`}><Icon name="arrowRight" /></button></td>
                </tr>)}
            </tbody>
          </table>
        </div>
        <footer className="cl-pagination">
          <span>{pag.total ? `Mostrando ${pag.desde}–${pag.hasta} de ${pag.total} pozos` : "Sin pozos para mostrar"}</span>
          <div>
            <button type="button" disabled={pag.pagina <= 1} onClick={() => irAPagina(pag.pagina - 1)}><Icon name="arrowLeft" />Anterior</button>
            <span className="pz-pagina">{pag.pagina} / {pag.totalPaginas}</span>
            <button type="button" disabled={pag.pagina >= pag.totalPaginas} onClick={() => irAPagina(pag.pagina + 1)}>Siguiente<Icon name="arrowRight" /></button>
          </div>
        </footer>
      </> : null}

      <p className="pz-fuente">Fuente: {data?.fuente || "encuesta de pozos"}{data?.actualizado ? ` · datos del ${new Date(data.actualizado).toLocaleString("es-HN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}. «—» quiere decir que no se midió. Valor guía de pH y TDS: Norma Técnica Nacional para la Calidad del Agua Potable de Honduras. <Icon name="warning" /> código repetido o coordenada fuera de Choluteca.</p>
    </section>

    {abierto ? <PozoDetalle
      pozo={abierto}
      posicion={posicion + 1}
      total={ordenados.length}
      onAnterior={posicion > 0 ? () => setAbiertoId(ordenados[posicion - 1].id) : null}
      onSiguiente={posicion < ordenados.length - 1 ? () => setAbiertoId(ordenados[posicion + 1].id) : null}
      onCerrar={() => setAbiertoId(null)}
      onFicha={generando ? null : () => generarInforme("fichas", [abierto])}
    /> : null}
  </main>;
}
