import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import LatticeLoader from "../../../components/micro/LatticeLoader";
import DescartesPrint from "../print/DescartesPrint";
import {
  DESCARTES_FILTROS_INICIALES,
  FILAS_POR_PAGINA,
  abonadosRepetidos,
  antecedenteTexto,
  columnasImpresas,
  describirFiltros,
  diaCorto,
  diasDescartes,
  filtrarSinDia,
  hayFiltros,
  indicePaginas,
  opcionesDescartes,
  paginar,
  totalesDescartes
} from "../utils/descartes";
import { estadoClass, estadoDocumentoLabel, formatDate, formatNumber, tipoDocumentoLabel } from "../utils/entregasFormatters";

// Pantalla Descartes (administración y Gerencia): lo que quedó sin entregar en el
// ciclo de facturación y los abonados "repetidos", que ya se habían quedado sin
// factura en un ciclo anterior. El servidor manda todo el ciclo; día, barrio,
// técnico, búsqueda y "solo repetidos" se filtran aquí, y las cifras, el reparto
// por técnico y por barrio, el impreso y el PDF siguen a esos filtros. La lista se
// lee por documento o por abonado repetido, con los mismos filtros.
// Filas por página: lo elige quien mira y se recuerda en su navegador.
const LLAVE_FILAS = "controlaguas.descartes.filasPorPagina";
const leerFilasPorPagina = () => {
  try {
    const guardado = Number(window.localStorage.getItem(LLAVE_FILAS));
    return FILAS_POR_PAGINA.includes(guardado) ? guardado : 25;
  } catch {
    return 25;
  }
};
const TOTALES_VISIBLES = 5;

const plural = (n, uno, varios) => `${formatNumber(n)} ${n === 1 ? uno : varios}`;
const ciclosTexto = (n) => (n === 1 ? "1 ciclo" : `${formatNumber(n)} ciclos`);
const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

// Lo que el documento ya traía de ciclos anteriores, para el `title` del antecedente.
const detalleAnteriores = (item, motivo) => (item.anteriores || [])
  .map((previo) => `${formatDate(previo.fecha_lote)} · ${motivo(previo.motivo)} · ${estadoDocumentoLabel(previo.estado)}`)
  .join("\n");

// Reparto de lo filtrado por técnico o por barrio. Cada fila filtra la lista; la
// barra comparte la escala del que más tiene.
function TotalesPor({ titulo, filas, activa, onElegir }) {
  const [verTodas, setVerTodas] = useState(false);
  const maximo = filas[0]?.documentos || 1;
  const visibles = verTodas ? filas : filas.slice(0, TOTALES_VISIBLES);
  const documentos = filas.reduce((suma, fila) => suma + fila.documentos, 0);
  const repetidos = filas.reduce((suma, fila) => suma + fila.repetidos, 0);
  return <section className="ent-desc-totales" aria-label={titulo}>
    <div className="ent-desc-totales-head">
      <h3>{titulo}</h3>
      {activa ? <button type="button" className="cl-quiet" onClick={() => onElegir("")}>Ver todos</button> : null}
    </div>
    {filas.length ? <>
      <div className="ent-desc-totales-cols" aria-hidden="true"><span /><span>Sin entregar</span><span>Repetidos</span></div>
      <ul>
        {visibles.map((fila) => <li key={fila.llave}>
          <button type="button" aria-pressed={activa === fila.llave} aria-label={`${fila.nombre}: ${plural(fila.documentos, "sin entregar", "sin entregar")}, ${plural(fila.repetidos, "repetido", "repetidos")}`} onClick={() => onElegir(activa === fila.llave ? "" : fila.llave)}>
            <span className="ent-desc-totales-nombre">{fila.nombre}<i style={{ "--parte": fila.documentos / maximo }} aria-hidden="true" /></span>
            <strong>{formatNumber(fila.documentos)}</strong>
            <em className={fila.repetidos ? "" : "is-cero"}>{formatNumber(fila.repetidos)}</em>
          </button>
        </li>)}
      </ul>
      {filas.length > TOTALES_VISIBLES ? <button type="button" className="cl-quiet ent-desc-totales-mas" onClick={() => setVerTodas(!verTodas)}>{verTodas ? "Ver menos" : `Ver los ${formatNumber(filas.length)}`}</button> : null}
      <p className="ent-desc-totales-total"><span>Total</span><strong>{formatNumber(documentos)}</strong><em>{formatNumber(repetidos)}</em></p>
    </> : <p className="ent-desc-totales-vacio">Nada con estos filtros.</p>}
  </section>;
}

// En el teléfono el índice de páginas lleva menos números para caber en una línea.
const ANGOSTO = "(max-width: 760px)";
function useAngosto() {
  const [angosto, setAngosto] = useState(() => window.matchMedia?.(ANGOSTO).matches || false);
  useEffect(() => {
    const consulta = window.matchMedia?.(ANGOSTO);
    if (!consulta) return undefined;
    const cambio = (evento) => setAngosto(evento.matches);
    consulta.addEventListener?.("change", cambio);
    return () => consulta.removeEventListener?.("change", cambio);
  }, []);
  return angosto;
}

export default function ControlDescartes({ api, config, onOpen, notify }) {
  const hoy = config.jornada?.fecha || "";
  // La fecha consultada define el ciclo; el día elegido solo filtra dentro de él.
  const [consulta, setConsulta] = useState(hoy);
  const [filtros, setFiltrosEstado] = useState(DESCARTES_FILTROS_INICIALES);
  const [modo, setModo] = useState("documentos");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPaginaEstado] = useState(leerFilasPorPagina);
  const listaRef = useRef(null);
  const angosto = useAngosto();
  const [hoja, setHoja] = useState(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const seccion = useRef(null);
  const barraFiltros = useRef(null);

  // El encabezado de la tabla y los totales quedan fijos justo bajo los filtros, que
  // cambian de alto al partirse en dos líneas.
  useEffect(() => {
    const barra = barraFiltros.current;
    if (!barra || typeof ResizeObserver === "undefined") return undefined;
    const medir = () => seccion.current?.style.setProperty("--desc-filtros-alto", `${Math.ceil(barra.getBoundingClientRect().height)}px`);
    const observador = new ResizeObserver(medir);
    observador.observe(barra);
    medir();
    return () => observador.disconnect();
  }, [Boolean(data)]);

  // Otro ciclo no se mezcla con el que estaba en pantalla: se vacía hasta que llega.
  useEffect(() => { setData(null); }, [consulta]);

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    setError("");
    api.descartes({ fecha: consulta })
      .then((respuesta) => { if (vigente) setData(respuesta); })
      .catch((problema) => { if (vigente) setError(problema.message); })
      .finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
  }, [api, consulta, recarga]);

  const setFiltros = (cambio) => {
    setFiltrosEstado((actual) => ({ ...actual, ...cambio }));
    setPagina(1);
  };
  const setPorPagina = (valor) => {
    setPorPaginaEstado(valor);
    setPagina(1);
    try { window.localStorage.setItem(LLAVE_FILAS, String(valor)); } catch { /* sin almacenamiento */ }
  };
  // Al cambiar de página desde el índice de abajo, la lista vuelve a su inicio una vez
  // dibujada la página nueva. Salto directo: el contenido cambia entero.
  const subirAlCambiar = useRef(false);
  const irAPagina = (numero) => {
    subirAlCambiar.current = true;
    setPagina(numero);
  };
  useEffect(() => {
    if (!subirAlCambiar.current) return;
    subirAlCambiar.current = false;
    const lista = listaRef.current;
    if (lista && lista.getBoundingClientRect().top < 0) lista.scrollIntoView({ block: "start" });
  }, [pagina]);
  const otroCiclo = consulta !== hoy;
  const volverAlCiclo = () => { setConsulta(hoy); setFiltros({ dia: "" }); };
  const limpiar = () => { setFiltros(DESCARTES_FILTROS_INICIALES); setConsulta(hoy); };

  const motivos = config.motivos;
  const motivo = (codigo) => motivos.find((item) => item.codigo === codigo)?.etiqueta || codigo;
  const ciclo = data?.ciclo || {};
  // Un servidor que todavía no manda `items` (despliegue a medias) deja al menos el día.
  const items = data?.items || data?.dia?.items || [];

  const opciones = useMemo(() => opcionesDescartes(items), [items]);
  const sinDia = useMemo(() => filtrarSinDia(items, filtros), [items, filtros]);
  const lista = useMemo(() => (filtros.dia ? sinDia.filter((item) => item.fecha_lote === filtros.dia) : sinDia), [sinDia, filtros.dia]);
  const totales = useMemo(() => totalesDescartes(lista), [lista]);
  const dias = useMemo(() => diasDescartes(sinDia), [sinDia]);
  const grupos = useMemo(() => abonadosRepetidos(lista), [lista]);
  const delCiclo = useMemo(() => ({ documentos: sinDia.length, repetidos: sinDia.filter((item) => item.repetido).length }), [sinDia]);
  // Un filtro que apunta a algo que ya no está en el ciclo (otro ciclo) se ofrece igual
  // en el selector, para que se vea qué está puesto y se pueda quitar.
  const conActual = (lista, llave, nombre) => (llave && !lista.some((item) => item.llave === llave) ? [...lista, { llave, nombre }] : lista);
  const barrios = conActual(opciones.barrios, filtros.barrio, "Barrio sin documentos en este ciclo");
  const tecnicos = conActual(opciones.tecnicos, filtros.tecnico, "Técnico sin documentos en este ciclo");

  const porAbonado = modo === "abonados";
  const filtrado = hayFiltros({ ...filtros, dia: "" });
  const filas = porAbonado ? grupos : lista;
  const pag = paginar(filas, pagina, porPagina);
  const enLaLista = pag.items;
  const periodo = filtros.dia ? `el ${formatDate(filtros.dia)}` : "en el ciclo";
  const caption = loading ? "Actualizando…" : porAbonado
    ? `${plural(grupos.length, "abonado repetido", "abonados repetidos")} ${periodo}${filtrado ? " con estos filtros" : ""}${grupos.length ? " · los de más ciclos primero" : ""}`
    : `${plural(lista.length, "documento", "documentos")} sin entregar ${periodo}${filtrado ? " con estos filtros" : ""}${lista.length ? (filtros.dia ? " · repetidos primero" : " · del día más reciente al más viejo") : ""}`;

  // Otro día: dentro del ciclo cargado solo filtra; fuera de él pide ese ciclo.
  const irAFecha = (fecha) => {
    if (!fecha) return;
    const dentro = fecha >= (ciclo.fecha_inicio || "0000-00-00") && fecha <= (ciclo.fecha_fin || hoy);
    if (!dentro) setConsulta(fecha);
    setFiltros({ dia: fecha });
  };

  // En la vista por abonado se imprimen sus documentos: los repetidos de lo filtrado.
  const filtrosImpresos = porAbonado ? { ...filtros, soloRepetidos: true } : filtros;
  const listaImpresa = porAbonado ? lista.filter((item) => item.repetido) : lista;
  const armarHoja = () => ({
    ciclo,
    dia: filtros.dia,
    filtros: describirFiltros(filtrosImpresos, { items, ciclo }),
    columnas: columnasImpresas(filtrosImpresos),
    totales: porAbonado ? totalesDescartes(listaImpresa) : totales,
    lista: listaImpresa,
    motivos,
    generadoEn: new Date().toISOString()
  });

  const imprimir = () => {
    if (!listaImpresa.length) { notify?.("No hay documentos con estos filtros para imprimir."); return; }
    setHoja(armarHoja());
  };

  const descargarPdf = async () => {
    if (!listaImpresa.length) { notify?.("No hay documentos con estos filtros para el PDF."); return; }
    setGenerandoPdf(true);
    try {
      const { descargarDescartesPdf } = await import("../print/descartesPdf");
      await descargarDescartesPdf(armarHoja());
    } catch (problema) {
      notify?.(problema.message || "No se pudo generar el PDF.");
    } finally {
      setGenerandoPdf(false);
    }
  };

  // La hoja espera en un portal fuera de la vista; se imprime cuando el logo ya está
  // listo y se quita al cerrar el diálogo (Safari no siempre avisa "afterprint").
  useEffect(() => {
    if (!hoja) return undefined;
    let vivo = true;
    const limpiarImpresion = () => {
      document.body.classList.remove("ent-imprimiendo-acta");
      if (vivo) setHoja(null);
    };
    const modoImpresion = window.matchMedia?.("print");
    const alSalir = (evento) => { if (!evento.matches) limpiarImpresion(); };
    const imagenes = [...document.querySelectorAll(".ent-acta-portal img")];
    Promise.all(imagenes.map((imagen) => imagen.decode?.().catch(() => {}))).then(() => {
      if (!vivo) return;
      document.body.classList.add("ent-imprimiendo-acta");
      window.addEventListener("afterprint", limpiarImpresion, { once: true });
      modoImpresion?.addEventListener?.("change", alSalir);
      window.print();
    });
    return () => {
      vivo = false;
      window.removeEventListener("afterprint", limpiarImpresion);
      modoImpresion?.removeEventListener?.("change", alSalir);
      document.body.classList.remove("ent-imprimiendo-acta");
    };
  }, [hoja]);

  const vacio = <p className="cl-empty ent-desc-vacio">
    {items.length ? (porAbonado ? "Ningún abonado repetido con estos filtros." : "Ningún documento sin entregar con estos filtros.") : `No se registraron documentos sin entregar ${periodo}.`}
    {items.length && hayFiltros(filtros) ? <button type="button" className="cl-secondary" onClick={limpiar}>Quitar filtros</button> : null}
  </p>;

  return <section ref={seccion} className="cl-inbox ent-operational-inbox ent-descartes" aria-busy={loading}>
    <div className="ent-desc-head">
      <div>
        <h2>Descartes</h2>
        <p>Lo que quedó sin entregar en el ciclo, por día, barrio y técnico. Un abonado es repetido si ya se había quedado sin factura en un ciclo anterior.</p>
      </div>
      <div className="ent-desc-acciones">
        <button type="button" className="cl-secondary" onClick={imprimir} disabled={!data || !listaImpresa.length}><Icon name="print" />Imprimir</button>
        <button type="button" className="cl-secondary" onClick={descargarPdf} disabled={!data || !listaImpresa.length || generandoPdf}><Icon name="download" />{generandoPdf ? "Generando…" : "PDF"}</button>
        <button type="button" className="cl-quiet ent-icon-only" onClick={() => setRecarga((n) => n + 1)} disabled={loading} aria-label={loading ? "Actualizando…" : "Actualizar descartes"} title="Actualizar">
          <Icon name="refresh" className={loading ? "ent-refresh-icon is-spinning" : "ent-refresh-icon"} />
        </button>
      </div>
    </div>

    {error ? <p className="cl-alert" role="alert">{error} <button type="button" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button></p> : null}
    {!data && !error ? <p className="cl-empty"><LatticeLoader label={otroCiclo ? "Cargando el ciclo…" : "Cargando descartes…"} /></p> : null}

    {data ? <>
      <div className={`ent-desc-ciclo${otroCiclo ? " is-anterior" : ""}`} role="status">
        <Icon name="calendar" />
        <span className="ent-desc-ciclo-texto">
          {otroCiclo ? <strong className="ent-desc-ciclo-aviso">Estás viendo un ciclo anterior. </strong> : null}
          {ciclo.fecha_inicio
            ? <>Ciclo {ciclo.cerrado ? "cerrado" : "abierto"} del <strong>{formatDate(ciclo.fecha_inicio)}</strong> al <strong>{formatDate(ciclo.fecha_fin)}</strong>.</>
            : <>Ciclo hasta el <strong>{formatDate(ciclo.fecha_fin)}</strong>.</>}
          {ciclo.corte_anterior ? null : <> Sin un cierre de ciclo anterior todavía no hay repetidos.</>}
        </span>
        {otroCiclo ? <button type="button" className="cl-secondary" onClick={volverAlCiclo}>Volver al ciclo actual</button> : null}
        <label className="ent-desc-otro-dia">Ir a un día<input type="date" value={filtros.dia || ""} max={hoy} onChange={(event) => irAFecha(event.target.value)} /></label>
      </div>

      <div ref={barraFiltros} className="ent-sticky-tools ent-desc-filtros">
        <div className="ent-search-row">
          <label className="cl-field ent-search-field">Buscar abonado<input type="search" value={filtros.q} onChange={(event) => setFiltros({ q: event.target.value })} placeholder="Número, clave catastral o nombre" /></label>
          <label className="cl-field">Barrio<select value={filtros.barrio} onChange={(event) => setFiltros({ barrio: event.target.value })}><option value="">Todos los barrios</option>{barrios.map((barrio) => <option key={barrio.llave} value={barrio.llave}>{barrio.nombre}</option>)}</select></label>
          <label className="cl-field">Técnico<select value={filtros.tecnico} onChange={(event) => setFiltros({ tecnico: event.target.value })}><option value="">Todos los técnicos</option>{tecnicos.map((tecnico) => <option key={tecnico.llave} value={tecnico.llave}>{tecnico.nombre}</option>)}</select></label>
          <div className="ent-desc-vista" role="group" aria-label="Ver la lista">
            <span>Ver</span>
            <div>
              <button type="button" aria-pressed={!porAbonado} onClick={() => { setModo("documentos"); setPagina(1); }}>Documentos</button>
              <button type="button" aria-pressed={porAbonado} onClick={() => { setModo("abonados"); setPagina(1); }}>Abonados repetidos</button>
            </div>
          </div>
          {porAbonado ? null : <label className="ent-check ent-desc-check"><input type="checkbox" checked={filtros.soloRepetidos} onChange={(event) => setFiltros({ soloRepetidos: event.target.checked })} />Solo repetidos</label>}
          {hayFiltros(filtros) || otroCiclo ? <button type="button" className="cl-quiet" onClick={limpiar}>Limpiar</button> : null}
        </div>
      </div>

      <div className="ent-descartes-dias" role="group" aria-label="Días del ciclo con documentos sin entregar">
        <button type="button" className="ent-desc-dia-ciclo" aria-pressed={!filtros.dia} onClick={() => setFiltros({ dia: "" })}>
          <strong>Todo el ciclo</strong>
          <span>{formatNumber(delCiclo.documentos)} sin entregar</span>
          {delCiclo.repetidos ? <em>{plural(delCiclo.repetidos, "repetido", "repetidos")}</em> : <small>Sin repetidos</small>}
        </button>
        {dias.map((dia) => <button key={dia.fecha} type="button" aria-pressed={dia.fecha === filtros.dia} onClick={() => setFiltros({ dia: dia.fecha })}>
          <strong>{diaCorto(dia.fecha)}</strong>
          <span>{formatNumber(dia.documentos)} sin entregar</span>
          {dia.repetidos ? <em>{plural(dia.repetidos, "repetido", "repetidos")}</em> : <small>{plural(dia.lotes, "lote", "lotes")}</small>}
        </button>)}
        {filtros.dia && !dias.some((dia) => dia.fecha === filtros.dia) ? <button type="button" aria-pressed="true" onClick={() => setFiltros({ dia: "" })}>
          <strong>{diaCorto(filtros.dia)}</strong>
          <span>0 sin entregar</span>
          <small>Quitar el día</small>
        </button> : null}
      </div>

      <dl className="ent-desc-cifras">
        <div><dt>Sin entregar</dt><dd>{formatNumber(totales.documentos)}</dd><span>{filtros.dia ? formatDate(filtros.dia) : "en el ciclo"} · {plural(totales.tecnicos, "técnico", "técnicos")} en {plural(totales.por_barrio.length, "barrio", "barrios")}</span></div>
        <div className={totales.repetidos ? "is-repetido" : ""}><dt>Repetidos</dt><dd>{formatNumber(totales.repetidos)}</dd><span>{porcentaje(totales.repetidos, totales.documentos)} % · {plural(totales.abonados_repetidos, "abonado", "abonados")}</span></div>
        <div className={totales.sin_responsable ? "is-sin-responsable" : ""}><dt>Sin responsable</dt><dd>{formatNumber(totales.sin_responsable)}</dd><span>{totales.sin_responsable ? "documentos en lotes sin técnico" : "todos tienen técnico"}</span></div>
      </dl>

      <div className="ent-desc-cuerpo">
        <div className="ent-desc-lista" ref={listaRef}>
          <div className="ent-desc-lista-head">
            <p className="ent-list-caption" role="status">{caption}{!loading && pag.totalPaginas > 1 ? ` · viendo ${formatNumber(pag.desde)}–${formatNumber(pag.hasta)}` : ""}</p>
            {filas.length > FILAS_POR_PAGINA[0] ? <label className="ent-desc-filas">Filas por página
              <select value={porPagina} onChange={(event) => setPorPagina(Number(event.target.value))}>{FILAS_POR_PAGINA.map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select>
            </label> : null}
          </div>
          {!filas.length ? (loading ? null : vacio) : porAbonado
            ? <table className="ent-desc-tabla is-abonados">
              <thead><tr><th>Abonado / clave</th><th>Nombre</th><th>Barrio</th><th>Técnico</th><th>Este ciclo</th><th>Antes</th></tr></thead>
              <tbody>
                {enLaLista.map((grupo) => <tr key={grupo.llave} onClick={() => onOpen(grupo.documentos[0])}>
                  <td className="ent-desc-c-abonado"><button type="button" onClick={(event) => { event.stopPropagation(); onOpen(grupo.documentos[0]); }}><strong>{grupo.numero_abonado || "Sin abonado"}</strong><span>{grupo.clave_catastral || "Sin clave"}</span></button></td>
                  <td className="ent-desc-c-nombre" title={grupo.abonado_nombre}>{grupo.abonado_nombre || "Sin nombre registrado"}</td>
                  <td className="ent-desc-c-barrio">{grupo.barrio_nombre || "Sin barrio"}</td>
                  <td className="ent-desc-c-tecnico">{grupo.responsable_nombre || "Sin responsable"}</td>
                  <td className="ent-desc-c-ciclo">{plural(grupo.documentos.length, "vez", "veces")} · último {diaCorto(grupo.ultima_fecha)}</td>
                  <td className="ent-desc-c-meta" aria-hidden="true">{grupo.barrio_nombre || "Sin barrio"} · {grupo.responsable_nombre || "Sin responsable"} · {plural(grupo.documentos.length, "vez", "veces")}, último {diaCorto(grupo.ultima_fecha)}</td>
                  <td className="ent-desc-c-antes"><span className="ent-repetido-tag">{ciclosTexto(grupo.ciclos_anteriores)}</span><small>{plural(grupo.veces_antes, "vez", "veces")}</small></td>
                </tr>)}
              </tbody>
            </table>
            : <table className={`ent-desc-tabla${filtros.dia ? " sin-dia" : ""}`}>
              <thead><tr><th>Abonado / clave</th><th>Nombre</th><th>Barrio</th><th>Técnico</th>{filtros.dia ? null : <th>Día</th>}<th>Motivo</th><th>Antecedente</th><th>Estado</th></tr></thead>
              <tbody>
                {enLaLista.map((item) => <tr key={item.id} onClick={() => onOpen(item)}>
                  <td className="ent-desc-c-abonado"><button type="button" onClick={(event) => { event.stopPropagation(); onOpen(item); }}><strong>{item.numero_abonado || "Sin abonado"}</strong><span>{item.clave_catastral || "Sin clave"}</span></button></td>
                  <td className="ent-desc-c-nombre" title={`${item.abonado_nombre || "Sin nombre registrado"} · ${tipoDocumentoLabel(item.tipo_documento)} · Lote #${item.lote_id}`}>{item.abonado_nombre || "Sin nombre registrado"}</td>
                  <td className="ent-desc-c-barrio">{item.barrio_nombre || "Sin barrio"}</td>
                  <td className="ent-desc-c-tecnico">{item.responsable_nombre || <span className="ent-desc-sin-tecnico">Sin responsable</span>}</td>
                  {filtros.dia ? null : <td className="ent-desc-c-dia">{diaCorto(item.fecha_lote)}</td>}
                  <td className="ent-desc-c-meta" aria-hidden="true">{item.barrio_nombre || "Sin barrio"} · {item.responsable_nombre || "Sin responsable"}{filtros.dia ? "" : ` · ${diaCorto(item.fecha_lote)}`}</td>
                  <td className="ent-desc-c-motivo" title={item.observacion || undefined}>{motivo(item.motivo)}</td>
                  <td className="ent-desc-c-antes">{item.repetido
                    ? <span className="ent-repetido-tag" title={detalleAnteriores(item, motivo)}>Repetido · {ciclosTexto(item.ciclos_anteriores || 1)}</span>
                    : <span className="ent-desc-sin-antes">{antecedenteTexto(item)}</span>}</td>
                  <td className="ent-desc-c-estado"><span className={`cl-status ${estadoClass(item.estado)}`}>{estadoDocumentoLabel(item.estado)}</span></td>
                </tr>)}
              </tbody>
            </table>}
          {pag.totalPaginas > 1 ? <nav className="ent-desc-paginas" aria-label="Páginas de la lista">
            <span className="ent-desc-rango">{formatNumber(pag.desde)}–{formatNumber(pag.hasta)} de {formatNumber(pag.total)}</span>
            <div>
              <button type="button" onClick={() => irAPagina(pag.pagina - 1)} disabled={pag.pagina <= 1} aria-label="Página anterior"><Icon name="arrowLeft" /></button>
              {indicePaginas(pag.pagina, pag.totalPaginas, angosto ? 1 : 2).map((numero, indice) => (numero === "…"
                ? <span key={`salto-${indice}`} className="ent-desc-salto" aria-hidden="true">…</span>
                : <button key={numero} type="button" aria-current={numero === pag.pagina ? "page" : undefined} aria-label={`Página ${numero}`} onClick={() => irAPagina(numero)}>{numero}</button>))}
              <button type="button" onClick={() => irAPagina(pag.pagina + 1)} disabled={pag.pagina >= pag.totalPaginas} aria-label="Página siguiente"><Icon name="arrowRight" /></button>
            </div>
          </nav> : null}
        </div>

        <aside className="ent-desc-lado" aria-label={`Totales de lo filtrado ${periodo}`}>
          <TotalesPor titulo="Por técnico" filas={totales.por_tecnico} activa={filtros.tecnico} onElegir={(tecnico) => setFiltros({ tecnico })} />
          <TotalesPor titulo="Por barrio" filas={totales.por_barrio} activa={filtros.barrio} onElegir={(barrio) => setFiltros({ barrio })} />
        </aside>
      </div>
    </> : null}

    {hoja ? createPortal(<div className="ent-acta-portal"><DescartesPrint hoja={hoja} /></div>, document.body) : null}
  </section>;
}
