import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";
import { buildServiceFocusRows, serviceLabel, sortServiceFocusRows, sumServiceFocusRows } from "../utils/serviceTable";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);
const pct = (value) => `${Number(value || 0).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%`;

function SortHeader({ sortKey, label, sort, onSort, className = "" }) {
  const active = sort.key === sortKey;
  return <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" onClick={() => onSort(sortKey)} className={active ? `is-active is-${sort.dir}` : ""}>{label}<Icon name="chevronDown" /></button>
  </th>;
}

// Un solo servicio: los barrios que lo tienen, cuántos usuarios no lo tienen y lo
// que deben las cuentas con ese servicio. Lo que se ve en la tabla es lo que se
// imprime y se guarda en PDF.
export default function ServiceFocus({ model, rows, field }) {
  const label = serviceLabel(field);
  const nombre = label.toLowerCase();
  const [query, setQuery] = useState("");
  const [conSin, setConSin] = useState(false);
  const [sort, setSort] = useState({ key: "active", dir: "desc" });

  const todos = useMemo(() => buildServiceFocusRows(rows, field), [rows, field]);
  const resumen = useMemo(() => sumServiceFocusRows(todos), [todos]);
  const barriosSin = todos.length - resumen.barriosCon;
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    const base = todos.filter((row) => (conSin || row.active > 0) && (!text || row.name.toLowerCase().includes(text)));
    return sortServiceFocusRows(base, sort);
  }, [todos, conSin, query, sort]);
  const totals = useMemo(() => sumServiceFocusRows(visible), [visible]);
  const maxShare = Math.max(1, ...visible.map((row) => row.share));

  const selected = new Set(model.selectedBarrios);
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.name));
  const toggleVisible = () => {
    const names = visible.map((row) => row.name);
    model.onSetSelectedBarrios(allVisibleSelected ? model.selectedBarrios.filter((name) => !names.includes(name)) : [...new Set([...model.selectedBarrios, ...names])]);
  };
  const onSort = (key) => setSort((current) => ({ key, dir: current.key === key ? (current.dir === "desc" ? "asc" : "desc") : key === "name" ? "asc" : "desc" }));

  // El informe lleva las filas tal como están en pantalla (o solo las marcadas).
  const informe = (onlySelected = false) => {
    const filas = onlySelected ? visible.filter((row) => selected.has(row.name)) : visible;
    return {
      field,
      label,
      rows: filas,
      totals: sumServiceFocusRows(filas),
      resumen: { ...resumen, barriosSin },
      // Si la lista deja fuera a los barrios sin el servicio, el informe los nombra al final.
      barriosSinNombres: onlySelected || conSin || query.trim() ? [] : todos.filter((row) => !row.active).map((row) => row.name).sort((a, b) => a.localeCompare(b, "es")),
      filtro: onlySelected ? "Barrios seleccionados por el operador" : [query.trim() ? `Barrios que contienen “${query.trim()}”` : "", conSin ? `Incluye barrios sin ${nombre}` : `Solo barrios con ${nombre}`].filter(Boolean).join(" · ")
    };
  };
  const seleccionVisible = visible.filter((row) => selected.has(row.name)).length;

  const promedio = resumen.deudores ? resumen.deuda / resumen.deudores : 0;

  return <>
    {/* El resumen se lee como una frase: quién tiene el servicio, dónde y cuánto deben. */}
    <p className="pq-focus-summary">
      <b>{count(resumen.active)}</b> {resumen.active === 1 ? "usuario tiene" : "usuarios tienen"} {nombre} ({pct(resumen.percentage)} del padrón), en <b>{count(resumen.barriosCon)} de {count(todos.length)}</b> barrios.{" "}
      {resumen.deudores
        ? <>Sus cuentas deben <b>{money(resumen.deuda)}</b>: {count(resumen.deudores)} {resumen.deudores === 1 ? "cuenta tiene" : "cuentas tienen"} deuda, <b>{money(promedio)}</b> en promedio.</>
        : "Ninguna de esas cuentas tiene deuda."}
    </p>

    <div className="pq-toolbar">
      <label className="pq-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar barrio" aria-label="Buscar barrio" /></label>
      {barriosSin ? <label className="pq-check-toggle"><input type="checkbox" checked={conSin} onChange={(event) => setConSin(event.target.checked)} />Incluir los {count(barriosSin)} barrios sin el servicio</label> : null}
      <div className="pq-toolbar-actions">
        <button type="button" className="pq-btn" onClick={() => model.onPrintServiceFocus(informe())} disabled={!visible.length} title={`Imprimir el informe de ${nombre}`}><Icon name="print" />Imprimir</button>
        <button type="button" className="pq-btn" onClick={() => model.onDownloadServiceFocusPdf(informe())} disabled={!visible.length || model.downloadingServicesPdf} title={`Guardar el informe de ${nombre} en PDF`}><Icon name="download" />{model.downloadingServicesPdf ? "Guardando…" : "Guardar PDF"}</button>
      </div>
    </div>

    {model.selectedBarrios.length ? <div className="pq-selection" role="status">
      <span><strong>{seleccionVisible}</strong> {seleccionVisible === 1 ? "barrio marcado" : "barrios marcados"} en esta lista para imprimir aparte</span>
      <button type="button" className="pq-link" onClick={() => model.onSetSelectedBarrios([])}>Quitar selección</button>
      <button type="button" className="pq-btn is-primary" disabled={!seleccionVisible} onClick={() => model.onPrintServiceFocus(informe(true))}><Icon name="print" />Imprimir selección</button>
    </div> : null}

    {/* En pantalla, lo esencial. Capital e intereses van en el informe impreso y en el PDF. */}
    <div className="pq-table-wrap">
      <table className="pq-table is-services is-focus-table">
        <thead>
          <tr>
            <th className="pq-check"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Seleccionar los barrios visibles" /></th>
            <SortHeader sortKey="name" label="Barrio" sort={sort} onSort={onSort} className="pq-col-name" />
            <SortHeader sortKey="usuarios" label="Usuarios" sort={sort} onSort={onSort} />
            <SortHeader sortKey="active" label="Con el servicio" sort={sort} onSort={onSort} className="pq-col-service is-focus" />
            <SortHeader sortKey="sin" label="Sin el servicio" sort={sort} onSort={onSort} />
            <SortHeader sortKey="deudores" label="Cuentas con deuda" sort={sort} onSort={onSort} />
            <SortHeader sortKey="deuda" label="Deuda" sort={sort} onSort={onSort} className="pq-col-total" />
            <SortHeader sortKey="share" label="Parte de la deuda" sort={sort} onSort={onSort} className="pq-col-share" />
          </tr>
          <tr className="pq-totals">
            <td className="pq-check" />
            <th scope="row" className="pq-col-name">Total<span className="pq-count">{count(visible.length)} {visible.length === 1 ? "barrio" : "barrios"}</span></th>
            <td>{count(totals.usuarios)}</td>
            <td className="pq-col-service is-focus"><b>{count(totals.active)}</b></td>
            <td>{count(totals.sin)}</td>
            <td>{count(totals.deudores)}</td>
            <td className="pq-col-total"><b>{money(totals.deuda)}</b></td>
            <td className="pq-col-share">{pct(totals.share)}</td>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => <tr key={row.name} className={`${selected.has(row.name) ? "is-selected" : ""} ${row.active ? "" : "is-without"}`.trim()}>
            <td className="pq-check"><input type="checkbox" checked={selected.has(row.name)} onChange={() => model.onToggleBarrio(row.name)} aria-label={`Seleccionar ${row.name}`} /></td>
            <th scope="row" className="pq-col-name">{row.name}</th>
            <td>{count(row.usuarios)}</td>
            <td className={`pq-col-service is-focus ${row.active ? "" : "is-zero"}`.trim()}><span className="pq-cell-service"><b>{count(row.active)}</b><small>{pct(row.percentage)}</small><i aria-hidden="true"><em style={{ width: `${Math.min(100, row.percentage)}%` }} /></i></span></td>
            <td className={row.sin ? "" : "is-zero"}>{count(row.sin)}</td>
            <td className={row.deudores ? "" : "is-zero"}>{count(row.deudores)}</td>
            <td className="pq-col-total"><b>{money(row.deuda)}</b></td>
            <td className={`pq-col-share ${row.share ? "" : "is-zero"}`.trim()}><span className="pq-share"><small>{pct(row.share)}</small><i aria-hidden="true"><em style={{ width: `${(row.share / maxShare) * 100}%` }} /></i></span></td>
          </tr>)}
          {!visible.length ? <tr><td colSpan={8} className="pq-table-empty">{query ? `Ningún barrio con ${nombre} coincide con “${query}”.` : `Ningún barrio tiene ${nombre} en el padrón.`}</td></tr> : null}
        </tbody>
      </table>
    </div>
    <p className="pq-note"><Icon name="notes" />La deuda es la de las cuentas que tienen {nombre}: el padrón no la separa por servicio. “Parte de la deuda” dice cuánto de esa deuda está en cada barrio.</p>
  </>;
}
