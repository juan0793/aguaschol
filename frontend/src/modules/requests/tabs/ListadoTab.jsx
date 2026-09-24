import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);
const anchorId = (index) => `pq-barrio-${index}`;
// Con listados largos se abre solo el primer barrio para no cargar miles de filas de golpe.
const OPEN_ALL_UNTIL = 400;

export default function ListadoTab({ model }) {
  const { form, requestResult: result } = model;
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(() => new Set());
  const barrios = useMemo(() => result?.summary?.barrios || [], [result]);
  const include = result?.request?.criteria?.include || result?.request?.keywords || [];
  const exclude = result?.request?.criteria?.exclude || [];

  useEffect(() => {
    const total = Number(result?.summary?.total_registros || 0);
    setClosed(new Set(total > OPEN_ALL_UNTIL ? barrios.slice(1).map((barrio) => barrio.barrio_colonia) : []));
    setQuery("");
  }, [result, barrios]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return barrios.map((barrio) => ({ ...barrio, visibleRows: barrio.rows }));
    return barrios
      .map((barrio) => ({ ...barrio, visibleRows: barrio.rows.filter((row) => [row.nombre, row.abonado, row.clave_catastral].some((value) => String(value || "").toLowerCase().includes(text))) }))
      .filter((barrio) => barrio.visibleRows.length);
  }, [barrios, query]);
  const matches = filtered.reduce((total, barrio) => total + barrio.visibleRows.length, 0);
  const toggle = (name) => setClosed((current) => { const next = new Set(current); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const maxBarrio = Math.max(1, ...barrios.map((barrio) => Number(barrio.total_registros || 0)));

  return <div className="pq-panel pq-listado">
    <form className="pq-builder" onSubmit={model.onRunRequest}>
      <header><span className="pq-kicker">1 · Criterios</span><h2>¿Qué abonados necesitas?</h2></header>
      <label><span>Plantilla</span>
        <select name="preset_id" value={form.preset_id} onChange={model.onPresetChange}>
          {model.templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
        </select>
      </label>
      <label><span>Palabras clave</span>
        <textarea name="keywords" rows="3" value={form.keywords} onChange={model.onFormChange} placeholder="clinica, hospital, odont, laborat" />
        <small>Separa con comas. Busca en nombre, barrio, clave y abonado.</small>
      </label>
      <details className="pq-help">
        <summary><Icon name="notes" />Filtros avanzados</summary>
        <ul>
          <li><code>barrio:centro</code> solo ese barrio</li>
          <li><code>clave:001-02</code> claves que empiezan así</li>
          <li><code>abonado:12345</code> un abonado</li>
          <li><code>-hotel</code> excluye lo que diga “hotel”</li>
        </ul>
      </details>
      <fieldset>
        <legend>2 · Encabezado del documento</legend>
        <label><span>Título</span><input name="title" value={form.title} onChange={model.onFormChange} placeholder="Título institucional de la petición" /></label>
        <label><span>Descripción</span><textarea name="description" rows="2" value={form.description} onChange={model.onFormChange} placeholder="Resumen de lo que necesita el solicitante" /></label>
      </fieldset>
      <button type="submit" className="pq-btn is-primary is-block" disabled={model.loadingRequest}><Icon name="search" className={model.loadingRequest ? "ds-icon-spin" : ""} />{model.loadingRequest ? "Buscando abonados…" : "Generar listado"}</button>
      <small className="pq-builder-note">La columna Tarifa es el valor base registrado en el padrón maestro.</small>
    </form>

    <section className="pq-results" aria-live="polite">
      {!result ? <div className="pq-empty"><Icon name="users" /><strong>Todavía no hay listado</strong><span>Elige una plantilla o escribe palabras clave y toca “Generar listado”. Los abonados aparecen aquí agrupados por barrio.</span></div> : <>
        <header className="pq-results-head">
          <div><span className="pq-kicker">3 · Resultado</span><h2>{result.request?.title || "Listado del padrón"}</h2>{result.request?.description ? <p>{result.request.description}</p> : null}</div>
          <div className="pq-results-actions">
            <button type="button" className="pq-btn" onClick={model.onPrintRequest}><Icon name="print" />Imprimir</button>
            <button type="button" className="pq-btn" onClick={model.onDownloadRequestPdf}><Icon name="download" />PDF</button>
          </div>
        </header>
        <dl className="pq-summary">
          <div><dt>Abonados</dt><dd>{count(result.summary?.total_registros)}</dd></div>
          <div><dt>Barrios</dt><dd>{count(result.summary?.total_barrios)}</dd></div>
          <div><dt>Tarifa acumulada</dt><dd>{money(result.summary?.tarifa_total)}</dd></div>
          <div><dt>Total con intereses</dt><dd>{money(result.summary?.total_con_interes)}</dd></div>
        </dl>
        {include.length || exclude.length ? <div className="pq-criteria">
          <span>Criterios</span>
          {include.map((item) => <b key={`in-${item}`} className="is-include">{item}</b>)}
          {exclude.map((item) => <b key={`out-${item}`} className="is-exclude">sin “{item}”</b>)}
        </div> : null}

        {barrios.length ? <>
          <nav className="pq-barrio-jump" aria-label="Barrios del listado">
            {barrios.map((barrio, index) => <a key={barrio.barrio_colonia} href={`#${anchorId(index)}`} onClick={() => setClosed((current) => { const next = new Set(current); next.delete(barrio.barrio_colonia); return next; })}>
              <span>{barrio.barrio_colonia}</span><b>{count(barrio.total_registros)}</b>
              <i aria-hidden="true"><em style={{ width: `${(Number(barrio.total_registros || 0) / maxBarrio) * 100}%` }} /></i>
            </a>)}
          </nav>
          <div className="pq-toolbar is-compact">
            <label className="pq-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, abonado o clave" aria-label="Buscar en el listado" /></label>
            {query ? <span className="pq-count">{count(matches)} {matches === 1 ? "coincidencia" : "coincidencias"}</span> : null}
            <div className="pq-toolbar-actions">
              <button type="button" className="pq-link" onClick={() => setClosed(new Set())}>Abrir todos</button>
              <button type="button" className="pq-link" onClick={() => setClosed(new Set(barrios.map((barrio) => barrio.barrio_colonia)))}>Cerrar todos</button>
            </div>
          </div>
          <div className="pq-barrios">
            {filtered.map((barrio) => {
              const index = barrios.findIndex((item) => item.barrio_colonia === barrio.barrio_colonia);
              const open = Boolean(query) || !closed.has(barrio.barrio_colonia);
              return <section key={barrio.barrio_colonia} id={anchorId(index)} className={`pq-barrio ${open ? "is-open" : ""}`.trim()}>
                <button type="button" className="pq-barrio-head" aria-expanded={open} onClick={() => toggle(barrio.barrio_colonia)}>
                  <Icon name="chevronRight" />
                  <strong>{barrio.barrio_colonia}</strong>
                  <span>{count(query ? barrio.visibleRows.length : barrio.total_registros)} abonados</span>
                  <span>Tarifa <b>{money(barrio.tarifa_total)}</b></span>
                  <span>Total <b>{money(barrio.total_con_interes)}</b></span>
                </button>
                {open ? <div className="pq-table-wrap is-flat">
                  <table className="pq-table is-listado">
                    <thead><tr><th>#</th><th>Nombre</th><th>Abonado</th><th>Clave catastral</th><th className="is-num">Tarifa</th><th className="is-num">Total</th></tr></thead>
                    <tbody>{barrio.visibleRows.map((row, rowIndex) => <tr key={`${row.clave_catastral}-${row.abonado}-${rowIndex}`}>
                      <td className="is-muted">{rowIndex + 1}</td>
                      <th scope="row">{row.nombre || "—"}</th>
                      <td>{row.abonado || "—"}</td>
                      <td className="is-mono">{model.formatClave(row) || "—"}</td>
                      <td className="is-num">{money(row.tarifa)}</td>
                      <td className="is-num"><b>{money(row.total)}</b></td>
                    </tr>)}</tbody>
                  </table>
                </div> : null}
              </section>;
            })}
            {!filtered.length ? <p className="pq-table-empty">Ningún abonado coincide con “{query}”.</p> : null}
          </div>
        </> : <div className="pq-empty"><Icon name="search" /><strong>Sin abonados para estos criterios</strong><span>Prueba con otras palabras clave o quita algún filtro.</span></div>}
      </>}
    </section>
  </div>;
}
