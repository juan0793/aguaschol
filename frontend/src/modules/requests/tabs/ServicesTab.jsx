import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";
import { SERVICE_COLUMNS, buildServiceRows, sortServiceRows, sumServiceRows } from "../utils/serviceTable";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);

function SortHeader({ sortKey, label, sort, onSort, className = "", title }) {
  const active = sort.key === sortKey;
  const state = active ? `is-active is-${sort.dir}` : "";
  return <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" onClick={() => onSort(sortKey)} className={state} title={title}>{label}<Icon name="chevronDown" /></button>
  </th>;
}

// La tabla es la pantalla: los encabezados de servicio eligen y ordenan, y la
// fila de totales va arriba, fija bajo los encabezados, donde entra la vista.
export default function ServicesTab({ model }) {
  const { serviceData } = model;
  const [query, setQuery] = useState("");
  // Usuarios: cuántos tienen cada servicio. Deuda: cuánto deben esas cuentas.
  const [view, setView] = useState("usuarios");
  const [sort, setSort] = useState({ key: "usuarios", dir: "desc" });
  const rows = useMemo(() => buildServiceRows(serviceData.barrios), [serviceData.barrios]);
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return sortServiceRows(text ? rows.filter((row) => row.name.toLowerCase().includes(text)) : rows, { ...sort, view });
  }, [rows, query, sort, view]);
  const totals = useMemo(() => sumServiceRows(visible), [visible]);
  const selected = new Set(model.selectedBarrios);
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.name));
  const focus = model.selectedServiceField;
  const serviceNames = Object.fromEntries(SERVICE_COLUMNS.map(([field, , , label]) => [field, label]));

  const onSort = (key) => {
    // Ordenar por un servicio también lo deja seleccionado (resalta su columna).
    if (serviceNames[key]) model.onSelectService(key);
    setSort((current) => ({ key, dir: current.key === key ? (current.dir === "desc" ? "asc" : "desc") : key === "name" ? "asc" : "desc" }));
  };
  const toggleVisible = () => {
    const names = visible.map((row) => row.name);
    model.onSetSelectedBarrios(allVisibleSelected ? model.selectedBarrios.filter((name) => !names.includes(name)) : [...new Set([...model.selectedBarrios, ...names])]);
  };
  const serviceClass = (field, extra = "") => `pq-col-service ${focus === field ? "is-focus" : ""} ${extra}`.trim();

  if (!serviceData.hasData) {
    return <div className="pq-panel"><div className="pq-empty"><Icon name="water" /><strong>{model.loadingServices ? "Leyendo el padrón maestro…" : "Sin datos de servicios"}</strong><span>{model.loadingServices ? "Calculando servicios y deuda por barrio." : "Actualiza los datos para calcular los servicios del padrón activo."}</span>{!model.loadingServices ? <button type="button" className="pq-btn" onClick={model.onRefresh}><Icon name="refresh" />Actualizar datos</button> : null}</div></div>;
  }

  return <div className="pq-panel is-table">
    <div className="pq-toolbar">
      <label className="pq-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar barrio" aria-label="Buscar barrio" /></label>
      <div className="pq-segmented" role="group" aria-label="Qué mostrar en la tabla">
        <button type="button" aria-pressed={view === "usuarios"} className={view === "usuarios" ? "is-active" : ""} onClick={() => setView("usuarios")}>Usuarios por servicio</button>
        <button type="button" aria-pressed={view === "deuda"} className={view === "deuda" ? "is-active" : ""} onClick={() => { setView("deuda"); if (sort.key === "usuarios") setSort({ key: "deuda", dir: "desc" }); }}>Deuda por servicio</button>
      </div>
      <div className="pq-toolbar-actions">
        <button type="button" className="pq-btn" onClick={() => model.onPrintServices()}><Icon name="print" />Imprimir informe</button>
        <button type="button" className="pq-btn" onClick={model.onDownloadServicesPdf} disabled={model.downloadingServicesPdf}><Icon name="download" />{model.downloadingServicesPdf ? "Guardando…" : "Guardar PDF"}</button>
      </div>
    </div>

    {model.selectedBarrios.length ? <div className="pq-selection" role="status">
      <span><strong>{model.selectedBarrios.length}</strong> {model.selectedBarrios.length === 1 ? "barrio seleccionado" : "barrios seleccionados"} para imprimir aparte</span>
      <button type="button" className="pq-link" onClick={() => model.onSetSelectedBarrios([])}>Quitar selección</button>
      <button type="button" className="pq-btn is-primary" onClick={() => model.onPrintServices({ onlySelected: true })}><Icon name="print" />Imprimir selección</button>
    </div> : null}

    <div className="pq-table-wrap">
      <table className={`pq-table is-services is-${view}`}>
        <thead>
          <tr>
            <th className="pq-check"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Seleccionar los barrios visibles" /></th>
            <SortHeader sortKey="name" label="Barrio" sort={sort} onSort={onSort} className="pq-col-name" />
            {view === "usuarios" ? <SortHeader sortKey="usuarios" label="Usuarios" sort={sort} onSort={onSort} /> : <>
              <SortHeader sortKey="deudores" label="Cuentas con deuda" sort={sort} onSort={onSort} />
              <SortHeader sortKey="capital" label="Capital" sort={sort} onSort={onSort} />
              <SortHeader sortKey="intereses" label="Intereses" sort={sort} onSort={onSort} />
            </>}
            {SERVICE_COLUMNS.map(([field, label, , fullName]) => <SortHeader key={field} sortKey={field} label={label} sort={sort} onSort={onSort} className={serviceClass(field)} title={`Ordenar por ${fullName}`} />)}
            <SortHeader sortKey="deuda" label="Deuda total" sort={sort} onSort={onSort} className="pq-col-total" />
          </tr>
          <tr className="pq-totals">
            <td className="pq-check" />
            <th scope="row" className="pq-col-name">{query ? "Total filtrado" : "Total del padrón"}<span className="pq-count">{count(visible.length)} {visible.length === 1 ? "barrio" : "barrios"}</span></th>
            {view === "usuarios" ? <td>{count(totals.usuarios)}</td> : <>
              <td>{count(totals.deuda.deudores)}</td>
              <td>{money(totals.deuda.capital)}</td>
              <td>{money(totals.deuda.intereses)}</td>
            </>}
            {SERVICE_COLUMNS.map(([field]) => {
              const service = totals.services[field];
              return <td key={field} className={serviceClass(field)} title={view === "usuarios" ? `${count(totals.usuarios - service.active)} sin el servicio` : undefined}>
                {view === "usuarios" ? <span className="pq-cell-service"><b>{count(service.active)}</b><small>{service.percentage}%</small><i aria-hidden="true"><em style={{ width: `${Math.min(100, service.percentage)}%` }} /></i></span> : money(service.deuda)}
              </td>;
            })}
            <td className="pq-col-total"><b>{money(totals.deuda.total)}</b></td>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => <tr key={row.name} className={selected.has(row.name) ? "is-selected" : ""}>
            <td className="pq-check"><input type="checkbox" checked={selected.has(row.name)} onChange={() => model.onToggleBarrio(row.name)} aria-label={`Seleccionar ${row.name}`} /></td>
            <th scope="row" className="pq-col-name">{row.name}</th>
            {view === "usuarios" ? <td>{count(row.usuarios)}</td> : <>
              <td>{count(row.deuda.deudores)}</td>
              <td>{money(row.deuda.capital)}</td>
              <td>{money(row.deuda.intereses)}</td>
            </>}
            {SERVICE_COLUMNS.map(([field]) => {
              const service = row.services[field];
              // Un cero se lee en gris y sin barra: así destacan los barrios que sí tienen el servicio.
              const zero = (view === "usuarios" ? service.active : service.deuda) === 0;
              return <td key={field} className={serviceClass(field, zero ? "is-zero" : "")}>
                {view === "usuarios" ? <span className="pq-cell-service"><b>{count(service.active)}</b><small>{service.percentage}%</small><i aria-hidden="true"><em style={{ width: `${Math.min(100, service.percentage)}%` }} /></i></span> : money(service.deuda)}
              </td>;
            })}
            <td className="pq-col-total"><b>{money(row.deuda.total)}</b></td>
          </tr>)}
          {!visible.length ? <tr><td colSpan={view === "usuarios" ? 9 : 11} className="pq-table-empty">Ningún barrio coincide con “{query}”.</td></tr> : null}
        </tbody>
      </table>
    </div>
    <p className="pq-note"><Icon name="notes" />{view === "deuda" ? "Una misma cuenta suma en cada servicio que tiene activo: el archivo maestro no separa la deuda por concepto facturado." : "Toca el encabezado de un servicio para resaltarlo y ordenar por él. Marca barrios para imprimirlos aparte."}</p>
  </div>;
}
