import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";
import { imprimirListadoAbonados } from "../padronInformes";
import SalidaBotones from "./SalidaBotones";
import RangoSaldo from "./RangoSaldo";
import { filtrarPorSaldo, filtrarPorTexto, limitesDeSaldo, ordenarPorSaldo } from "../utils/rangoSaldo";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);
const plural = (cantidad, uno, varios) => (Number(cantidad) === 1 ? uno : varios);
const anchorId = (index) => `pq-barrio-${index}`;
// Con listados largos se abre solo el primer barrio para no cargar miles de filas de golpe.
const OPEN_ALL_UNTIL = 400;
// El índice de barrios solo ayuda cuando la lista de barrios no cabe a la vista.
const INDICE_DESDE = 9;

// Las categorías llegan del backend con su grupo (Comercios, Salud…); se muestran en este orden.
const ORDEN_GRUPOS = ["Comercios", "Salud", "Educación", "Vivienda"];
const agrupar = (templates = []) => {
  const grupos = new Map();
  templates.forEach((template) => {
    const grupo = template.group || "Otros";
    grupos.set(grupo, [...(grupos.get(grupo) || []), template]);
  });
  const lugar = (grupo) => { const i = ORDEN_GRUPOS.indexOf(grupo); return i < 0 ? ORDEN_GRUPOS.length : i; };
  return [...grupos.entries()].sort((a, b) => lugar(a[0]) - lugar(b[0]));
};

export default function ListadoTab({ model }) {
  const { form, requestResult: completo } = model;
  const grupos = useMemo(() => agrupar(model.templates), [model.templates]);
  const limites = useMemo(() => limitesDeSaldo(completo), [completo]);
  const [rango, setRango] = useState(null);
  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState("clave");
  const [closed, setClosed] = useState(() => new Set());
  const resultsRef = useRef(null);
  const anterior = useRef(completo);
  const desde = rango?.desde ?? limites.min;
  const hasta = rango?.hasta ?? limites.max;

  useEffect(() => {
    const total = Number(completo?.summary?.total_registros || 0);
    const nombres = (completo?.summary?.barrios || []).map((barrio) => barrio.barrio_colonia);
    setClosed(new Set(total > OPEN_ALL_UNTIL ? nombres.slice(1) : []));
    setRango(null);
    setQuery("");
    // En pantallas de una columna el resultado queda debajo del formulario: se lleva a la vista.
    if (completo && completo !== anterior.current && window.matchMedia?.("(max-width: 1000px)").matches) resultsRef.current?.scrollIntoView({ block: "start" });
    anterior.current = completo;
  }, [completo]);

  // Lo que se ve es lo que se imprime: rango de saldo, búsqueda, orden y encabezado
  // se aplican a un solo objeto, que alimenta la tabla, la hoja impresa y el PDF.
  const titulo = String(form.title || "").trim() || completo?.request?.title || "Listado del padrón";
  const descripcion = String(form.description || "").trim();
  const result = useMemo(() => {
    let visto = filtrarPorTexto(filtrarPorSaldo(completo, desde, hasta), query);
    if (visto && orden === "saldo") visto = ordenarPorSaldo(visto);
    return visto ? { ...visto, request: { ...visto.request, title: titulo, description: descripcion } } : visto;
  }, [completo, desde, hasta, query, orden, titulo, descripcion]);
  const barrios = result?.summary?.barrios || [];
  const total = Number(completo?.summary?.total_registros || 0);
  const visibles = Number(result?.summary?.total_registros || 0);
  const acotado = visibles !== total;
  const toggle = (name) => setClosed((current) => { const next = new Set(current); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const maxBarrio = Math.max(1, ...barrios.map((barrio) => Number(barrio.total_registros || 0)));
  const limpiar = () => { setRango(null); setQuery(""); };

  return <div className="pq-panel pq-listado">
    <form className="pq-builder" onSubmit={model.onRunRequest}>
      <h2>Categorías</h2>
      <div className="pq-cats">
        {grupos.map(([grupo, templates]) => <div key={grupo} className="pq-cats-group" role="group" aria-label={grupo}>
          <span>{grupo}</span>
          <div>{templates.map((template) => <button key={template.id} type="button" className={form.preset_id === template.id ? "is-active" : ""} aria-pressed={form.preset_id === template.id} disabled={model.loadingRequest}
            onClick={() => (model.onPickTemplate ? model.onPickTemplate(template.id) : model.onPresetChange({ target: { value: template.id } }))}>{template.label}</button>)}</div>
        </div>)}
        {!grupos.length ? <small className="pq-builder-note">No se pudieron cargar las categorías. Escribe palabras clave abajo.</small> : null}
      </div>
      <label><span>O busca por palabras clave</span>
        <textarea name="keywords" rows="2" value={form.keywords} onChange={model.onFormChange} placeholder="ferretería, pulpería, taller" />
        <small>Separa con comas. Basta el inicio de la palabra: “farmac” encuentra farmacia y farmacéutica.</small>
      </label>
      <button type="submit" className="pq-btn is-primary is-block" disabled={model.loadingRequest}><Icon name="search" className={model.loadingRequest ? "ds-icon-spin" : ""} />{model.loadingRequest ? "Buscando abonados…" : "Generar listado"}</button>
      <details className="pq-help">
        <summary><Icon name="notes" />Filtros avanzados</summary>
        <ul>
          <li><code>barrio:centro</code> solo ese barrio</li>
          <li><code>clave:001-02</code> claves que empiezan así</li>
          <li><code>abonado:12345</code> un abonado</li>
          <li><code>-hotel</code> excluye lo que diga “hotel”</li>
        </ul>
      </details>
      <small className="pq-builder-note">La columna Tarifa es el valor base registrado en el padrón maestro.</small>
    </form>

    <section className="pq-results" ref={resultsRef}>
      {!completo ? <div className="pq-empty"><Icon name="users" /><strong>Todavía no hay listado</strong><span>Toca una categoría (farmacias, hoteles, tiendas…) o escribe palabras clave y toca “Generar listado”. Los abonados aparecen aquí agrupados por barrio.</span></div> : <>
        <header className="pq-results-head">
          <div>
            <h2>{titulo}</h2>
            {descripcion ? <p>{descripcion}</p> : null}
          </div>
          <div className="pq-results-actions">
            <SalidaBotones primario disabled={!barrios.length} onSalida={(modo) => imprimirListadoAbonados(result, model.formatClave, model.serviceReport?.source?.updated_at, modo)} notify={model.notify} />
          </div>
          <details className="pq-doc">
            <summary>Cambiar el título y la descripción del documento</summary>
            <div>
              <label><span>Título</span><input name="title" value={form.title} onChange={model.onFormChange} placeholder="Título institucional del listado" /></label>
              <label><span>Descripción</span><input name="description" value={form.description} onChange={model.onFormChange} placeholder="Para qué se pide este listado" /></label>
            </div>
          </details>
        </header>

        {limites.max > limites.min ? <RangoSaldo limites={limites} desde={desde} hasta={hasta} onChange={(a, b) => setRango({ desde: a, hasta: b })} /> : null}

        <p className="pq-resumen" role="status">
          <span><b>{count(visibles)}</b>{acotado ? ` de ${count(total)}` : ""} {plural(acotado ? total : visibles, "abonado", "abonados")} en <b>{count(result.summary?.total_barrios)}</b> {plural(result.summary?.total_barrios, "barrio", "barrios")}</span>
          <span>Saldo <b>{money(result.summary?.total_con_interes)}</b></span>
          <span>Tarifa mensual {money(result.summary?.tarifa_total)}</span>
          <small>Imprimir y Guardar PDF sacan esta misma lista.</small>
        </p>

        <div className="pq-toolbar is-compact">
          <label className="pq-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, abonado o clave" aria-label="Buscar en el listado" /></label>
          <div className="pq-orden"><span id="pq-orden-label">Orden</span>
            <div className="pq-segmented" role="group" aria-labelledby="pq-orden-label">
              <button type="button" className={orden === "clave" ? "is-active" : ""} aria-pressed={orden === "clave"} onClick={() => setOrden("clave")}>Por clave</button>
              <button type="button" className={orden === "saldo" ? "is-active" : ""} aria-pressed={orden === "saldo"} onClick={() => setOrden("saldo")}>Mayor saldo</button>
            </div>
          </div>
          <div className="pq-toolbar-actions">
            {acotado ? <button type="button" className="pq-link" onClick={limpiar}>Quitar filtros</button> : null}
            <button type="button" className="pq-link" onClick={() => setClosed(new Set())}>Abrir todos</button>
            <button type="button" className="pq-link" onClick={() => setClosed(new Set(barrios.map((barrio) => barrio.barrio_colonia)))}>Cerrar todos</button>
          </div>
        </div>

        {barrios.length >= INDICE_DESDE && !query ? <nav className="pq-barrio-jump" aria-label="Ir a un barrio">
          {barrios.map((barrio, index) => <a key={barrio.barrio_colonia} href={`#${anchorId(index)}`} onClick={() => setClosed((current) => { const next = new Set(current); next.delete(barrio.barrio_colonia); return next; })}>
            <span>{barrio.barrio_colonia}</span><b>{count(barrio.total_registros)}</b>
            <i aria-hidden="true"><em style={{ width: `${(Number(barrio.total_registros || 0) / maxBarrio) * 100}%` }} /></i>
          </a>)}
        </nav> : null}

        {barrios.length ? <div className="pq-barrios">
          {barrios.map((barrio, index) => {
            const open = Boolean(query) || !closed.has(barrio.barrio_colonia);
            return <section key={barrio.barrio_colonia} id={anchorId(index)} className={`pq-barrio ${open ? "is-open" : ""}`.trim()}>
              <h3><button type="button" className="pq-barrio-head" aria-expanded={open} onClick={() => toggle(barrio.barrio_colonia)}>
                <Icon name="chevronRight" />
                <strong>{barrio.barrio_colonia}</strong>
                <span>{count(barrio.total_registros)} {plural(barrio.total_registros, "abonado", "abonados")}</span>
                <span>Tarifa <b>{money(barrio.tarifa_total)}</b></span>
                <span>Saldo <b>{money(barrio.total_con_interes)}</b></span>
              </button></h3>
              {open ? <div className="pq-table-wrap is-flat">
                <table className="pq-table is-listado" aria-label={`Abonados de ${barrio.barrio_colonia}`}>
                  <thead><tr><th className="pq-c-idx">#</th><th>Nombre</th><th>Abonado</th><th>Clave catastral</th><th className="is-num pq-c-tarifa">Tarifa</th><th className="is-num">Saldo</th></tr></thead>
                  <tbody>{barrio.rows.map((row, rowIndex) => <tr key={`${row.clave_catastral}-${row.abonado}-${rowIndex}`}>
                    <td className="is-muted pq-c-idx">{rowIndex + 1}</td>
                    <th scope="row">{row.nombre || "—"}</th>
                    <td>{row.abonado || "—"}</td>
                    <td className="is-mono">{model.formatClave(row) || "—"}</td>
                    <td className="is-num pq-c-tarifa">{money(row.tarifa)}</td>
                    <td className="is-num"><b>{money(row.total)}</b></td>
                  </tr>)}</tbody>
                </table>
              </div> : null}
            </section>;
          })}
        </div> : <div className="pq-empty"><Icon name="search" /><strong>{total ? "Ningún abonado con esos filtros" : "Sin abonados para estos criterios"}</strong><span>{total ? "Amplía el rango de saldo o borra la búsqueda para volver a ver el listado." : "Prueba con otra categoría u otras palabras clave."}</span>{total ? <button type="button" className="pq-btn" onClick={limpiar}>Quitar filtros</button> : null}</div>}
      </>}
    </section>
  </div>;
}
