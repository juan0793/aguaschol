import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { formatSpanishDate } from "../../utils/datesAndBusiness";
import { formatCompactCurrency } from "../dashboard/dashboardSelectors";
import { CRITERIOS, ORDENES, TIPOS, filtrarBarrios, tipoDe, totalesBarrios } from "./barriosSinAguasData";
import "./barriosSinAguas.css";

// "Barrios sin Aguas": barrios del padrón de Alcaldía cuyas claves no aparecen en Aguas.
// Criterio de cobertura, gráfico de dónde se concentran, tabla para marcar e imprimir,
// y las claves de cada barrio para llevarlas a campo.

const n = (valor) => Number(valor || 0).toLocaleString("es-HN");
const pct = (valor) => `${Number(valor || 0).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%`;
const informes = () => import("./barriosSinAguasInformes");
const COLUMNAS_ORDEN = [["barrio", "Barrio"], ["claves", "Claves"], ["cobertura", "En Aguas"], ["sin_registrar", "Sin registro"], ["avaluo", "Avalúo"]];

function Concentracion({ filas, onAbrir }) {
  const top = filas.slice(0, 12);
  const mayor = Math.max(1, ...top.map((fila) => fila.claves));
  if (!top.length) return null;
  return <section className="bsa-chart" aria-labelledby="bsa-chart-titulo">
    <header>
      <h2 id="bsa-chart-titulo">Dónde se concentran</h2>
      <p className="bsa-leyenda"><i className="is-fuera" aria-hidden="true" />sin registro en Aguas <i className="is-dentro" aria-hidden="true" />ya en Aguas</p>
    </header>
    <ol>
      {top.map((fila) => <li key={fila.barrio}>
        <button type="button" onClick={() => onAbrir(fila)} aria-label={`${fila.barrio}: ${n(fila.claves)} claves, ${n(fila.sin_registrar)} sin registro en Aguas. Ver claves`}>
          <span className="bsa-chart-nombre"><strong>{fila.barrio}</strong>{fila.parecido ? <small>parecido: {fila.parecido.nombre}</small> : null}</span>
          <span className="bsa-chart-barra" aria-hidden="true" style={{ width: `${(fila.claves / mayor) * 100}%` }}>
            <i className="is-fuera" style={{ flexGrow: fila.sin_registrar }} />
            {fila.en_aguas ? <i className="is-dentro" style={{ flexGrow: fila.en_aguas }} /> : null}
          </span>
          <b>{n(fila.claves)}</b>
        </button>
      </li>)}
    </ol>
    {filas.length > top.length ? <p className="bsa-nota">Los 12 barrios con más claves; la tabla de abajo tiene los {n(filas.length)}.</p> : null}
  </section>;
}

function ClavesDelBarrio({ barrio, apiFetch, alcaldia, aguas, onCerrar }) {
  const [estado, setEstado] = useState({ cargando: true, claves: [], error: "" });
  const [todas, setTodas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [saliendo, setSaliendo] = useState("");
  useEffect(() => {
    let vivo = true;
    setEstado({ cargando: true, claves: [], error: "" });
    apiFetch(`/claves/alcaldia/barrios-sin-aguas/claves?barrio=${encodeURIComponent(barrio.barrio)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudieron traer las claves del barrio.");
        if (vivo) setEstado({ cargando: false, claves: data.claves || [], error: "" });
      })
      .catch((error) => { if (vivo) setEstado({ cargando: false, claves: [], error: error.message }); });
    return () => { vivo = false; };
  }, [apiFetch, barrio.barrio]);
  const texto = busqueda.trim().toLowerCase();
  const visibles = estado.claves
    .filter((clave) => todas || !clave.en_aguas)
    .filter((clave) => !texto || `${clave.clave_catastral} ${clave.nombre} ${clave.direccion}`.toLowerCase().includes(texto));
  const salir = async (modo) => {
    setSaliendo(modo);
    try { (await informes()).imprimirClavesBarrio({ barrio, claves: estado.claves, soloSinRegistro: !todas, alcaldia, aguas }, modo); }
    finally { setSaliendo(""); }
  };

  return <section className="bsa-claves" aria-labelledby="bsa-claves-titulo">
    <header>
      <div>
        <button type="button" className="bsa-volver" onClick={onCerrar}><Icon name="arrowLeft" />Todos los barrios</button>
        <h2 id="bsa-claves-titulo">{barrio.barrio}</h2>
        <p>{n(barrio.claves)} claves de Alcaldía · {n(barrio.en_aguas)} en Aguas ({pct(barrio.cobertura)}) · código {barrio.codigo_caserio || "sin código"}{barrio.sectores?.length ? ` · sectores ${barrio.sectores.join(", ")}` : ""}</p>
        {barrio.parecido ? <p className="bsa-aviso"><Icon name="warning" />En Aguas hay un barrio con nombre parecido: <b>{barrio.parecido.nombre}</b> ({n(barrio.parecido.usuarios)} usuarios). Puede estar registrado con otras claves.</p> : null}
      </div>
      <div className="bsa-acciones">
        <button type="button" className="bsa-btn" onClick={() => salir("imprimir")} disabled={!visibles.length || Boolean(saliendo)}><Icon name="print" />Imprimir</button>
        <button type="button" className="bsa-btn" onClick={() => salir("pdf")} disabled={!visibles.length || Boolean(saliendo)}><Icon name="download" />{saliendo === "pdf" ? "Guardando…" : "Guardar PDF"}</button>
      </div>
    </header>
    <div className="bsa-filtros">
      <label className="bsa-buscar"><Icon name="search" /><input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar clave, propietario o dirección" aria-label="Buscar clave, propietario o dirección" /></label>
      <div className="bsa-seg" role="group" aria-label="Qué claves ver">
        <button type="button" aria-pressed={!todas} className={!todas ? "is-activo" : ""} onClick={() => setTodas(false)}>Sin registro <b>{n(barrio.sin_registrar)}</b></button>
        <button type="button" aria-pressed={todas} className={todas ? "is-activo" : ""} onClick={() => setTodas(true)}>Todas <b>{n(barrio.claves)}</b></button>
      </div>
    </div>
    {estado.error ? <p className="bsa-error">{estado.error}</p> : estado.cargando ? <p className="bsa-vacio">Cargando claves…</p> : <div className="bsa-tabla-wrap">
      <table className="bsa-tabla">
        <thead><tr><th>Clave</th><th>Propietario</th><th>Dirección</th><th>Naturaleza</th><th className="is-num">Avalúo</th><th>Último pago Alcaldía</th>{todas ? <th>En Aguas</th> : null}</tr></thead>
        <tbody>{visibles.slice(0, 400).map((clave) => <tr key={clave.clave_catastral}>
          <td className="is-mono">{clave.clave_catastral}</td>
          <td>{clave.nombre || "—"}</td>
          <td className="is-suave">{clave.direccion || "—"}</td>
          <td>{clave.naturaleza || "—"}</td>
          <td className="is-num">{clave.avaluo ? formatCompactCurrency(clave.avaluo) : "—"}</td>
          <td>{clave.ultimo_periodo_pagado || "—"}</td>
          {todas ? <td>{clave.en_aguas ? <span className="bsa-si">Sí</span> : <span className="bsa-no">No</span>}</td> : null}
        </tr>)}</tbody>
      </table>
      {visibles.length > 400 ? <p className="bsa-nota">Se muestran 400 de {n(visibles.length)} claves; la impresión y el PDF llevan todas.</p> : null}
      {!visibles.length ? <p className="bsa-vacio">Ninguna clave coincide con la búsqueda.</p> : null}
    </div>}
  </section>;
}

export default function BarriosSinAguasWorkspace({ apiFetch }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [criterio, setCriterio] = useState("0");
  const [tipo, setTipo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("claves");
  const [soloParecido, setSoloParecido] = useState(false);
  const [marcados, setMarcados] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [saliendo, setSaliendo] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const response = await apiFetch("/claves/alcaldia/barrios-sin-aguas");
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No se pudo cruzar Alcaldía con Aguas.");
      setData(body);
    } catch (reason) { setError(reason.message || "No se pudo cruzar Alcaldía con Aguas."); }
    finally { setCargando(false); }
  }, [apiFetch]);
  useEffect(() => { cargar(); }, [cargar]);

  const barrios = data?.barrios || [];
  const filas = useMemo(() => filtrarBarrios(barrios, { criterio, tipo, busqueda, orden, soloParecido }), [barrios, criterio, tipo, busqueda, orden, soloParecido]);
  const conteos = useMemo(() => Object.fromEntries(CRITERIOS.map((item) => [item.key, filtrarBarrios(barrios, { criterio: item.key }).length])), [barrios]);
  const t = useMemo(() => totalesBarrios(filas), [filas]);
  const clavesAlcaldia = Number(data?.alcaldia?.claves || 0);
  const marcadosSet = new Set(marcados);
  const filasMarcadas = filas.filter((fila) => marcadosSet.has(fila.barrio));
  const todosMarcados = filas.length > 0 && filasMarcadas.length === filas.length;
  const crit = CRITERIOS.find((item) => item.key === criterio);
  const alternar = (nombre) => setMarcados((actual) => (actual.includes(nombre) ? actual.filter((item) => item !== nombre) : [...actual, nombre]));
  const alternarTodos = () => setMarcados((actual) => (todosMarcados ? actual.filter((nombre) => !filas.some((fila) => fila.barrio === nombre)) : [...new Set([...actual, ...filas.map((fila) => fila.barrio)])]));

  const salida = async (modo) => {
    const lista = filasMarcadas.length ? filasMarcadas : filas;
    setSaliendo(modo);
    try {
      (await informes()).imprimirBarriosSinAguas({
        filas: lista,
        criterio,
        marcados: filasMarcadas.length > 0,
        totalBarriosAlcaldia: barrios.length,
        alcaldia: data?.alcaldia || {},
        aguas: data?.aguas || {},
        filtro: [
          ["Criterio", crit.label],
          ...(tipo !== "todos" ? [["Tipo", TIPOS.find(([key]) => key === tipo)[1]]] : []),
          ...(soloParecido ? [["", "Con nombre parecido en Aguas"]] : []),
          ...(busqueda.trim() ? [["Búsqueda", busqueda.trim()]] : [])
        ]
      }, modo);
    } finally { setSaliendo(""); }
  };

  return <main className="bsa" aria-busy={cargando}>
    <header className="bsa-head">
      <div>
        <h1>Barrios sin Aguas</h1>
        <p>Barrios del padrón de Alcaldía cuyas claves catastrales no aparecen en el padrón de Aguas: posibles zonas completas sin registrar.
          {data ? <> Alcaldía del <b>{formatSpanishDate(data.alcaldia.actualizado)}</b> · Aguas del <b>{formatSpanishDate(data.aguas.actualizado)}</b>.</> : null}</p>
      </div>
      <div className="bsa-acciones">
        <button type="button" className="bsa-btn is-icono" onClick={cargar} disabled={cargando} aria-label="Volver a cruzar los padrones" title="Volver a cruzar los padrones"><Icon name="refresh" className={cargando ? "ds-icon-spin" : ""} /></button>
        {!abierto ? <>
          <button type="button" className="bsa-btn" onClick={() => salida("pdf")} disabled={!filas.length || Boolean(saliendo)}><Icon name="download" />{saliendo === "pdf" ? "Guardando…" : "Guardar PDF"}</button>
          <button type="button" className="bsa-btn is-primario" onClick={() => salida("imprimir")} disabled={!filas.length || Boolean(saliendo)}><Icon name="print" />{filasMarcadas.length ? `Imprimir ${n(filasMarcadas.length)} marcados` : "Imprimir lista"}</button>
        </> : null}
      </div>
    </header>

    {error ? <p className="bsa-error">{error}</p> : null}
    {!data && !error ? <p className="bsa-vacio">{cargando ? "Cruzando Alcaldía con Aguas…" : ""}</p> : null}

    {data && abierto ? <ClavesDelBarrio barrio={abierto} apiFetch={apiFetch} alcaldia={data.alcaldia} aguas={data.aguas} onCerrar={() => setAbierto(null)} /> : null}

    {data && !abierto ? <>
      {/* Cuántos barrios quedan fuera según qué tan poco aparecen en Aguas. */}
      <nav className="bsa-criterios" aria-label="Criterio de cobertura">
        {CRITERIOS.map((item) => <button key={item.key} type="button" aria-pressed={criterio === item.key} className={criterio === item.key ? "is-activo" : ""} onClick={() => setCriterio(item.key)}>
          <strong>{n(conteos[item.key])}</strong><span>{item.label}</span>
        </button>)}
      </nav>

      <dl className="bsa-cifras">
        <div><dt>claves de Alcaldía en estos barrios</dt><dd>{n(t.claves)}</dd><small>{clavesAlcaldia ? `${pct((t.claves / clavesAlcaldia) * 100)} del padrón de Alcaldía` : ""}</small></div>
        <div><dt>sin registro en Aguas</dt><dd>{n(t.sin_registrar)}</dd><small>{n(t.en_aguas)} ya están en Aguas</small></div>
        <div><dt>urbanas / rurales</dt><dd>{n(t.urbano)} <span>/</span> {n(t.rural)}</dd><small>{n(t.con_pago)} pagan impuesto en Alcaldía</small></div>
        <div><dt>con nombre parecido en Aguas</dt><dd>{n(t.con_parecido)}</dd><small>revisar antes de ir a campo</small></div>
      </dl>

      <Concentracion filas={[...filas].sort(ORDENES.sin_registrar)} onAbrir={setAbierto} />

      <section className="bsa-lista" aria-labelledby="bsa-lista-titulo">
        <header>
          <h2 id="bsa-lista-titulo">{n(filas.length)} {filas.length === 1 ? "barrio" : "barrios"} {crit.corto}</h2>
          <div className="bsa-filtros">
            <label className="bsa-buscar"><Icon name="search" /><input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar barrio o código" aria-label="Buscar barrio o código" /></label>
            <div className="bsa-seg" role="group" aria-label="Tipo de barrio">
              {TIPOS.map(([key, label]) => <button key={key} type="button" aria-pressed={tipo === key} className={tipo === key ? "is-activo" : ""} onClick={() => setTipo(key)}>{label}</button>)}
            </div>
            <label className="bsa-check"><input type="checkbox" checked={soloParecido} onChange={(event) => setSoloParecido(event.target.checked)} />Solo con nombre parecido en Aguas</label>
          </div>
        </header>
        {marcados.length ? <p className="bsa-marcas"><b>{n(marcados.length)}</b> {marcados.length === 1 ? "barrio marcado" : "barrios marcados"}{filasMarcadas.length !== marcados.length ? ` (${n(filasMarcadas.length)} en esta lista)` : ""}: se imprimen solo ellos. <button type="button" onClick={() => setMarcados([])}>Quitar marcas</button></p> : null}
        {filas.length ? <div className="bsa-tabla-wrap">
          <table className="bsa-tabla is-barrios">
            <thead><tr>
              <th className="is-check"><input type="checkbox" checked={todosMarcados} onChange={alternarTodos} aria-label="Marcar todos los barrios de la lista" /></th>
              {COLUMNAS_ORDEN.map(([key, label]) => <th key={key} className={key === "barrio" ? "" : "is-num"} aria-sort={orden === key ? (key === "barrio" || key === "cobertura" ? "ascending" : "descending") : undefined}>
                <button type="button" className={orden === key ? "is-activo" : ""} onClick={() => setOrden(key)}>{label}{orden === key ? <Icon name="chevronDown" /> : null}</button>
              </th>)}
              <th>Tipo</th>
              <th>Nombre parecido en Aguas</th>
              <th><span className="bsa-sr">Acciones</span></th>
            </tr></thead>
            <tbody>{filas.map((fila) => <tr key={fila.barrio} className={marcadosSet.has(fila.barrio) ? "is-marcado" : ""}>
              <td className="is-check"><input type="checkbox" checked={marcadosSet.has(fila.barrio)} onChange={() => alternar(fila.barrio)} aria-label={`Marcar ${fila.barrio}`} /></td>
              <th scope="row"><span className="bsa-barrio">{fila.barrio}</span><small>{fila.codigo_caserio || "sin código"}</small></th>
              <td className="is-num"><b>{n(fila.claves)}</b></td>
              <td className="is-num"><span className="bsa-cob"><i style={{ width: `${Math.min(100, fila.cobertura)}%` }} /></span>{fila.en_aguas ? <>{n(fila.en_aguas)} <small>{pct(fila.cobertura)}</small></> : <span className="is-cero">0</span>}</td>
              <td className="is-num">{n(fila.sin_registrar)}</td>
              <td className="is-num">{fila.avaluo ? formatCompactCurrency(fila.avaluo) : <span className="is-cero">—</span>}</td>
              <td>{tipoDe(fila) === "rural" ? "Rural" : "Urbano"}</td>
              <td>{fila.parecido ? <span className="bsa-parecido">{fila.parecido.nombre}<small>{n(fila.parecido.usuarios)} usuarios</small></span> : <span className="is-cero">—</span>}</td>
              <td><button type="button" className="bsa-link" onClick={() => setAbierto(fila)}>Ver claves<Icon name="arrowRight" /></button></td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="bsa-vacio">Ningún barrio cumple este criterio con los filtros elegidos.</p>}
      </section>
    </> : null}
  </main>;
}
