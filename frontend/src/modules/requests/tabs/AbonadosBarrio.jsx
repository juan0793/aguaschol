import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";
import EstadoCuentaImpresion from "../estadoCuenta/EstadoCuentaImpresion";
import { armarEstadoCuenta } from "../estadoCuenta/estadoCuentaDatos";
import { imprimirAbonadosBarrios } from "../padronInformes";
import { announceReportGenerated, createReportId } from "../../../utils/printDocument";
import { ESTADOS_SALDO, ORDENES, coincide, estadoSaldo, ordenarAbonados, resumirAbonados } from "../utils/abonadosBarrio";
import { SERVICE_COLUMNS, serviceLabel } from "../utils/serviceTable";
import SalidaBotones from "./SalidaBotones";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);
const fechaPadron = (iso) => {
  const fecha = iso ? new Date(iso) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" }) : "";
};
// "L 390.90 capital − L 0.40 intereses": un interés negativo (saldo a favor) resta, sin "+ -L".
const desglose = (capital, intereses) => <>{money(capital)} capital {intereses < 0 ? "−" : "+"} <em>{money(Math.abs(intereses))} intereses</em></>;
// Un barrio grande tiene 1,500 abonados: se dibujan por tandas al bajar, para que el
// panel abra al instante. Totales, filtros e impresión usan siempre la lista completa.
const TANDA = 120;

// Abonados ya leídos de la versión vigente del padrón (su fecha), por barrio: volver
// a abrir un barrio es inmediato. Si la fecha cambia, todo lo anterior se descarta;
// sin fecha no se guarda nada, porque no habría cómo saber que quedó viejo.
const leidos = { version: "", porBarrio: new Map() };
export const leerGuardado = (version, barrio) => (version && leidos.version === version ? leidos.porBarrio.get(barrio) : undefined);
export const guardarLeido = (version, barrio, rows) => {
  if (!version) return;
  if (leidos.version !== version) leidos.porBarrio = new Map();
  leidos.version = version;
  leidos.porBarrio.set(barrio, rows);
};

// Propiedades de una fila de barrio que abre sus abonados con doble clic o Enter.
// La casilla de selección no cuenta: marcarla dos veces seguidas no abre el panel.
export const filaAbreAbonados = (name, abrir) => {
  const abre = (event) => {
    if (event.target.closest("input, button")) return;
    window.getSelection?.()?.removeAllRanges();
    abrir(name);
  };
  return {
    tabIndex: 0,
    title: "Doble clic para ver los abonados",
    onDoubleClick: abre,
    onKeyDown: (event) => { if (event.key === "Enter" && event.target === event.currentTarget) abre(event); }
  };
};

// Los cinco servicios en posición fija: se leen como una columna. El activo va lleno,
// el elegido en "Por servicio" en azul; el inactivo queda como trazo tenue.
function Servicios({ row, field }) {
  return <span className="pq-abo-srv" role="img" aria-label={`Servicios: ${SERVICE_COLUMNS.filter(([campo]) => row.servicios?.[campo]).map(([, etiqueta]) => etiqueta).join(", ") || "ninguno"}`}>
    {SERVICE_COLUMNS.map(([campo, etiqueta, icono]) => <i key={campo} className={`${row.servicios?.[campo] ? "is-on" : ""} ${campo === field ? "is-focus" : ""}`.trim()} title={`${etiqueta}: ${row.servicios?.[campo] ? "sí" : "no"}`}><Icon name={icono} /></i>)}
  </span>;
}

function Saldo({ row }) {
  const estado = estadoSaldo(row);
  if (estado === "al-dia") return <span className="pq-abo-saldo is-al-dia">Al día</span>;
  if (estado === "a-favor") return <span className="pq-abo-saldo is-a-favor">{money(Math.abs(row.total))}<small>a favor</small></span>;
  return <span className="pq-abo-saldo">{money(row.total)}</span>;
}

// Doble clic en un barrio de las tablas de servicios: el estado de cuenta del barrio.
// Arriba lo que debe el barrio; abajo sus abonados, del que más debe al que menos, con
// búsqueda, filtros y la ficha de cada uno. Lo filtrado es lo que se imprime.
export default function AbonadosBarrio({ barrio, field = "", model, onClose }) {
  const actualizado = model.serviceReport?.source?.updated_at || "";
  const llave = `${actualizado}|${barrio}`;
  // Cada respuesta queda marcada con la llave (versión y barrio) que la pidió; lo que
  // se muestra es siempre de la llave actual, nunca de un barrio o padrón anterior.
  const [respuesta, setRespuesta] = useState(null);
  const [intento, setIntento] = useState(0);
  const guardado = leerGuardado(actualizado, barrio);
  const estado = guardado ? { cargando: false, error: "", rows: guardado }
    : respuesta?.llave === llave && respuesta.intento === intento ? respuesta
      : { cargando: true, error: "", rows: [] };
  const [query, setQuery] = useState("");
  const [filtroSaldo, setFiltroSaldo] = useState("todos");
  const [soloServicio, setSoloServicio] = useState(false);
  const [orden, setOrden] = useState("saldo");
  const [abierta, setAbierta] = useState("");
  const capa = useRef(null);
  const buscador = useRef(null);
  const lista = useRef(null);
  const cuerpo = useRef(null);
  const centinela = useRef(null);
  const origen = useRef(document.activeElement);
  const servicio = field ? serviceLabel(field).toLowerCase() : "";
  // `model` se arma de nuevo en cada redibujo de la app: si la carga dependiera de él,
  // cada redibujo cancelaría la consulta en curso y el panel no terminaría de cargar.
  const apiFetch = useRef(model.apiFetch);
  apiFetch.current = model.apiFetch;

  useEffect(() => {
    if (leerGuardado(actualizado, barrio)) return undefined;
    // Una respuesta que llega después de cambiar de barrio o de padrón se descarta entera.
    let vigente = true;
    (async () => {
      try {
        const response = await apiFetch.current(`/claves/services/barrio-accounts?${new URLSearchParams({ barrios: barrio })}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "No se pudo leer el padrón.");
        if (!vigente) return;
        const rows = body.barrios?.[0]?.rows || [];
        guardarLeido(actualizado, barrio, rows);
        setRespuesta({ llave, intento, cargando: false, error: "", rows });
      } catch (error) {
        if (vigente) setRespuesta({ llave, intento, cargando: false, error: error.message || "No se pudo leer el padrón.", rows: [] });
      }
    })();
    return () => { vigente = false; };
  }, [barrio, llave, actualizado, intento]);

  // Mientras el panel está abierto, lo que había detrás al abrirlo no recibe foco ni
  // clics. Corre una sola vez: `onClose` cambia en cada redibujo de la app, y repetir
  // el efecto dejaba inerte lo que se abre después encima (la impresión) y movía el foco.
  const cerrar = useRef(onClose);
  cerrar.current = onClose;
  useEffect(() => {
    buscador.current?.focus();
    // Escape cierra el panel solo si no hay otra capa abierta encima de él.
    const alTeclear = (event) => {
      if (event.key === "Escape" && document.body.lastElementChild === capa.current) cerrar.current();
    };
    document.addEventListener("keydown", alTeclear);
    const inertes = [...document.body.children].filter((nodo) => nodo !== capa.current && !nodo.inert);
    inertes.forEach((nodo) => { nodo.inert = true; });
    const anterior = origen.current;
    return () => {
      document.removeEventListener("keydown", alTeclear);
      inertes.forEach((nodo) => { nodo.inert = false; });
      anterior?.focus?.();
    };
  }, []);

  const barrioResumen = useMemo(() => resumirAbonados(estado.rows), [estado.rows]);
  const conServicio = useMemo(() => (field ? estado.rows.filter((row) => row.servicios?.[field]).length : 0), [estado.rows, field]);
  const visibles = useMemo(() => ordenarAbonados(estado.rows.filter((row) => (filtroSaldo === "todos" || estadoSaldo(row) === filtroSaldo)
    && (!soloServicio || row.servicios?.[field])
    && coincide(row, query)), orden), [estado.rows, filtroSaldo, soloServicio, field, query, orden]);
  const vistos = useMemo(() => resumirAbonados(visibles), [visibles]);
  const filtrado = visibles.length !== estado.rows.length;
  // La tanda vuelve a la primera cuando cambia lo que se ve (barrio, filtros u orden).
  const firma = `${llave}|${filtroSaldo}|${soloServicio}|${query}|${orden}`;
  const [tanda, setTanda] = useState({ firma, n: TANDA });
  const limite = tanda.firma === firma ? tanda.n : TANDA;
  const quedan = Math.max(visibles.length - limite, 0);
  const mostrarMas = () => setTanda({ firma, n: limite + TANDA * 2 });
  useEffect(() => {
    if (!quedan || !centinela.current || typeof IntersectionObserver === "undefined") return undefined;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((entrada) => entrada.isIntersecting)) setTanda({ firma, n: limite + TANDA * 2 });
    }, { root: cuerpo.current, rootMargin: "600px 0px" });
    observador.observe(centinela.current);
    return () => observador.disconnect();
  }, [quedan, firma, limite]);
  const parteIntereses = barrioResumen.capital + barrioResumen.intereses > 0 && barrioResumen.intereses > 0
    ? Math.min(100, (barrioResumen.intereses / (barrioResumen.capital + barrioResumen.intereses)) * 100) : 0;

  const filtrosActivos = [
    filtroSaldo !== "todos" ? ["Saldo", ESTADOS_SALDO.find(([clave]) => clave === filtroSaldo)?.[1]] : null,
    soloServicio ? ["Servicio", `Con ${servicio}`] : null,
    query.trim() ? ["Búsqueda", `“${query.trim()}”`] : null
  ].filter(Boolean);
  const limpiar = () => { setQuery(""); setFiltroSaldo("todos"); setSoloServicio(false); buscador.current?.focus(); };
  const claveDe = (row) => model.formatClave?.({ ...row, barrio_colonia: barrio }) || row.clave_catastral || "--";

  const salidaLista = (modo) => imprimirAbonadosBarrios({
    barrios: [{ barrio_colonia: barrio, rows: visibles }],
    formatClave: model.formatClave,
    conDesglose: true,
    filtro: filtrado ? [...filtrosActivos, ["Resultado", `${count(visibles.length)} de ${count(estado.rows.length)} abonados`], ["Orden", ORDENES.find(([clave]) => clave === orden)?.[1]]] : [],
    padronActualizado: actualizado
  }, modo);
  // Estado de cuenta de un abonado. Imprimir abre el diálogo del sistema con la hoja
  // (sin la vista previa antigua); el PDF se dibuja con el mismo diseño.
  const [hoja, setHoja] = useState(null);
  const estadoDe = (row) => armarEstadoCuenta({ row, barrio, clave: claveDe(row), padronActualizado: actualizado, reportId: createReportId() });
  const salidaUno = async (row, modo) => {
    if (modo === "pdf") {
      try {
        const { descargarEstadoCuentaPdf } = await import("../estadoCuenta/estadoCuentaPdf");
        await descargarEstadoCuentaPdf(estadoDe(row));
      } catch (error) {
        model.notify?.(error.message || "No se pudo generar el PDF.");
      }
      return;
    }
    setHoja(estadoDe(row));
  };
  useEffect(() => {
    if (!hoja) return undefined;
    let vivo = true;
    const limpiar = () => {
      document.body.classList.remove("pq-ec-imprimiendo");
      if (vivo) setHoja(null);
    };
    // Safari no siempre avisa "afterprint": también se limpia al salir del modo impresión.
    const modoImpresion = window.matchMedia?.("print");
    const alSalir = (evento) => { if (!evento.matches) limpiar(); };
    const imagenes = [...document.querySelectorAll(".pq-ec-portal img")];
    Promise.all(imagenes.map((imagen) => imagen.decode?.().catch(() => {}))).then(() => {
      if (!vivo) return;
      document.body.classList.add("pq-ec-imprimiendo");
      window.addEventListener("afterprint", limpiar, { once: true });
      modoImpresion?.addEventListener?.("change", alSalir);
      announceReportGenerated({ reportId: hoja.reportId, title: `Estado de cuenta · ${hoja.nombre}`, reportType: "estado-cuenta-abonado" });
      window.print();
    });
    return () => {
      vivo = false;
      window.removeEventListener("afterprint", limpiar);
      modoImpresion?.removeEventListener?.("change", alSalir);
      document.body.classList.remove("pq-ec-imprimiendo");
    };
  }, [hoja]);
  const copiarClave = async (row) => {
    try {
      await navigator.clipboard.writeText(claveDe(row));
      model.notify?.(`Clave ${claveDe(row)} copiada.`);
    } catch {
      model.notify?.("No se pudo copiar la clave.");
    }
  };

  // Flechas arriba y abajo recorren las filas; Inicio y Fin van a los extremos.
  const moverFoco = (event) => {
    const filas = [...(lista.current?.querySelectorAll(".pq-abo-fila") || [])];
    const actual = filas.indexOf(event.target);
    if (actual < 0) return;
    const destino = { ArrowDown: actual + 1, ArrowUp: actual - 1, Home: 0, End: filas.length - 1 }[event.key];
    if (destino === undefined) return;
    event.preventDefault();
    filas[Math.max(0, Math.min(filas.length - 1, destino))]?.focus();
  };

  return <>{hoja ? createPortal(<div className="pq-ec-portal"><EstadoCuentaImpresion datos={hoja} /></div>, document.body) : null}{createPortal(<div ref={capa} className="pq-workspace pq-abo-capa" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="pq-abo" role="dialog" aria-modal="true" aria-labelledby="pq-abo-titulo">
      <header className="pq-abo-head">
        <div className="pq-abo-titulo">
          <h2 id="pq-abo-titulo">{barrio}</h2>
          <p>{estado.cargando ? "Leyendo el padrón…" : <>{count(estado.rows.length)} {estado.rows.length === 1 ? "abonado" : "abonados"}{field ? <> · {count(conServicio)} con {servicio}</> : null}</>}{fechaPadron(actualizado) ? <> · padrón del {fechaPadron(actualizado)}</> : null}</p>
        </div>
        <button type="button" className="pq-abo-cerrar" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>

        {/* Lo que debe el barrio va primero: es la cifra que decide qué hacer. */}
        <div className="pq-abo-cuenta" aria-busy={estado.cargando}>
          <div className="pq-abo-cuenta-total">
            <span>Saldo del barrio</span>
            <strong>{estado.cargando ? "—" : money(barrioResumen.saldo)}</strong>
          </div>
          <div className="pq-abo-cuenta-partes">
            <i className="pq-abo-barra" aria-hidden="true"><em style={{ width: `${100 - parteIntereses}%` }} /><b style={{ width: `${parteIntereses}%` }} /></i>
            <span><i className="is-capital" aria-hidden="true" />{money(barrioResumen.capital)} capital</span>
            <span><i className="is-intereses" aria-hidden="true" />{money(barrioResumen.intereses)} intereses{parteIntereses ? <small> · {Math.round(parteIntereses)} %</small> : null}</span>
          </div>
          <dl className="pq-abo-cuenta-cifras">
            <div><dt>Con deuda</dt><dd>{count(barrioResumen.deuda)}</dd></div>
            <div><dt>Al día</dt><dd>{count(barrioResumen["al-dia"])}</dd></div>
            {barrioResumen["a-favor"] ? <div><dt>A favor</dt><dd>{count(barrioResumen["a-favor"])}</dd></div> : null}
          </dl>
        </div>
      </header>

      <div className="pq-abo-tools">
        <label className="pq-search"><Icon name="search" /><input ref={buscador} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, abonado o clave (con o sin guiones)" aria-label="Buscar abonado" /></label>
        <label className="pq-abo-orden"><span>Ordenar</span>
          <select value={orden} onChange={(event) => setOrden(event.target.value)}>
            {ORDENES.map(([clave, etiqueta]) => <option key={clave} value={clave}>{etiqueta}</option>)}
          </select>
        </label>
        <div className="pq-segmented pq-abo-estados" role="group" aria-label="Filtrar por saldo">
          {ESTADOS_SALDO.filter(([clave]) => clave !== "a-favor" || barrioResumen["a-favor"]).map(([clave, etiqueta]) => <button key={clave} type="button" aria-pressed={filtroSaldo === clave} className={filtroSaldo === clave ? "is-active" : ""} onClick={() => setFiltroSaldo(clave)}>
            {etiqueta}<small>{count(clave === "todos" ? estado.rows.length : barrioResumen[clave])}</small>
          </button>)}
        </div>
        {field ? <label className="pq-check-toggle"><input type="checkbox" checked={soloServicio} onChange={(event) => setSoloServicio(event.target.checked)} />Solo con {servicio}</label> : null}
      </div>

      <div className="pq-abo-cuerpo" ref={cuerpo}>
        <div className="pq-abo-cols" aria-hidden="true">
          <span>Clave · abonado</span><span>Nombre</span><span>Servicios</span><span className="is-num">Intereses</span><span className="is-num">Saldo</span><span />
        </div>
        {estado.cargando ? <ol className="pq-abo-lista is-cargando" aria-label="Cargando abonados">
          {Array.from({ length: 8 }, (_, indice) => <li key={indice}><span className="pq-abo-hueso" style={{ width: `${62 - (indice % 3) * 9}%` }} /><span className="pq-abo-hueso is-corto" /></li>)}
        </ol>
          : estado.error ? <div className="pq-abo-vacio is-error" role="alert"><p>{estado.error}</p><button type="button" className="pq-btn" onClick={() => setIntento((valor) => valor + 1)}><Icon name="refresh" />Reintentar</button></div>
            : !visibles.length ? <div className="pq-abo-vacio">
              <p>{estado.rows.length ? `Ningún abonado ${[filtroSaldo !== "todos" ? ESTADOS_SALDO.find(([clave]) => clave === filtroSaldo)?.[1].toLowerCase() : "", soloServicio ? `con ${servicio}` : ""].filter(Boolean).join(" y ")}${query.trim() ? ` coincide con “${query.trim()}”` : " en esta lista"}.` : "El barrio no tiene abonados en el padrón."}</p>
              {estado.rows.length ? <button type="button" className="pq-btn" onClick={limpiar}>Ver todos los abonados</button> : null}
            </div>
              : <ol className="pq-abo-lista" ref={lista} aria-label={`Abonados de ${barrio}`}>
                {visibles.slice(0, limite).map((row) => {
                  const id = `${row.clave_catastral}-${row.abonado}`;
                  const abiertaEsta = abierta === id;
                  const tono = estadoSaldo(row);
                  return <li key={id} className={`is-${tono} ${abiertaEsta ? "is-abierta" : ""}`.trim()}>
                    <button type="button" className="pq-abo-fila" aria-expanded={abiertaEsta} onClick={() => setAbierta(abiertaEsta ? "" : id)} onKeyDown={moverFoco}>
                      <span className="pq-abo-id"><b>{claveDe(row)}</b><small>{row.abonado || "--"}</small></span>
                      <span className="pq-abo-nombre">{row.nombre || "Sin nombre"}</span>
                      <Servicios row={row} field={field} />
                      <span className={`pq-abo-int ${Number(row.intereses) ? "" : "is-cero"}`.trim()}>{Number(row.intereses) ? money(row.intereses) : "—"}</span>
                      <Saldo row={row} />
                      <Icon name="chevronDown" className="pq-abo-flecha" />
                    </button>
                    {abiertaEsta ? <div className="pq-abo-ficha">
                      <dl>
                        <div><dt>Capital</dt><dd>{money(row.tarifa)}</dd></div>
                        <div><dt>Intereses</dt><dd className="is-intereses">{money(row.intereses)}</dd></div>
                        <div><dt>{tono === "a-favor" ? "Saldo a favor" : "Saldo total"}</dt><dd><b>{money(tono === "a-favor" ? Math.abs(row.total) : row.total)}</b></dd></div>
                        <div className="is-ancho"><dt>Servicios</dt><dd>{SERVICE_COLUMNS.filter(([campo]) => row.servicios?.[campo]).map(([, etiqueta]) => etiqueta).join(" · ") || "Sin servicios activos"}</dd></div>
                      </dl>
                      <div className="pq-abo-ficha-acciones">
                        <button type="button" className="pq-btn is-primary" onClick={() => salidaUno(row, "imprimir")}><Icon name="print" />Imprimir estado de cuenta</button>
                        <button type="button" className="pq-btn" onClick={() => salidaUno(row, "pdf")}><Icon name="download" />PDF</button>
                        <button type="button" className="pq-btn" onClick={() => copiarClave(row)}><Icon name="copy" />Copiar clave</button>
                      </div>
                    </div> : null}
                  </li>;
                })}
                {quedan ? <li className="pq-abo-mas" ref={centinela}>
                  <button type="button" className="pq-link" onClick={mostrarMas}>Mostrar {count(Math.min(quedan, TANDA * 2))} más · faltan {count(quedan)}</button>
                </li> : null}
              </ol>}
      </div>

      <footer className="pq-abo-pie">
        <div className="pq-abo-pie-resumen">
          <span><b>{filtrado ? `${count(visibles.length)} de ${count(estado.rows.length)}` : count(visibles.length)}</b> {visibles.length === 1 && !filtrado ? "abonado" : "abonados"}{filtrosActivos.length ? <> · {filtrosActivos.map(([, texto]) => texto).join(" · ")}</> : null}</span>
          <span>{money(vistos.saldo)}{vistos.intereses ? <> ({desglose(vistos.capital, vistos.intereses)})</> : null}</span>
        </div>
        <div className="pq-toolbar-actions">
          {filtrosActivos.length ? <button type="button" className="pq-link" onClick={limpiar}>Quitar filtros</button> : null}
          <SalidaBotones onSalida={salidaLista} disabled={estado.cargando || !visibles.length} notify={model.notify} imprimir={filtrado ? "Imprimir esta lista" : "Imprimir lista"} />
        </div>
      </footer>
    </aside>
  </div>, document.body)}</>;
}
