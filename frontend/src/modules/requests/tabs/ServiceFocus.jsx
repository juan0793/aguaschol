import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";
import { imprimirServicio } from "../padronInformes";
import SalidaBotones from "./SalidaBotones";
import AbonadosBarrio, { filaAbreAbonados } from "./AbonadosBarrio";
import { buildCombinacionRows, fraseCombinacion, serviceLabel, servicioUnico, sortServiceFocusRows, sumServiceFocusRows } from "../utils/serviceTable";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);
const pct = (value) => `${Number(value || 0).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%`;
const plural = (n, uno, varios) => `${count(n)} ${n === 1 ? uno : varios}`;

function SortHeader({ sortKey, label, sort, onSort, className = "", title }) {
  const active = sort.key === sortKey;
  return <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} title={title}>
    <button type="button" onClick={() => onSort(sortKey)} className={active ? `is-active is-${sort.dir}` : ""}>{label}<Icon name="chevronDown" /></button>
  </th>;
}

// Una combinación de servicios ("con agua", "con agua y sin los demás"…): los barrios
// donde hay usuarios que la cumplen, cuántos no y lo que deben esas cuentas. Lo que se
// ve es lo que se imprime; si hay barrios marcados, se imprimen solo esos.
export default function ServiceFocus({ model, rows, combinacion }) {
  const unico = servicioUnico(combinacion);
  const frase = fraseCombinacion(combinacion);
  // "con agua potable" cuando es un solo servicio, como en el resto de la app.
  const quien = unico ? `con ${serviceLabel(unico).toLowerCase()}` : frase || "con cualquier servicio";
  const [query, setQuery] = useState("");
  const [conSin, setConSin] = useState(false);
  const [soloMarcados, setSoloMarcados] = useState(false);
  const [sort, setSort] = useState({ key: "active", dir: "desc" });
  const [abonadosDe, setAbonadosDe] = useState("");

  const calculo = useMemo(() => buildCombinacionRows(rows, combinacion), [rows, combinacion]);
  const todos = useMemo(() => calculo.rows || [], [calculo]);
  const resumen = useMemo(() => sumServiceFocusRows(todos), [todos]);
  const totalPadron = resumen.usuarios;
  const barriosSin = todos.length - resumen.barriosCon;

  const selected = useMemo(() => new Set(model.selectedBarrios), [model.selectedBarrios]);
  // Los marcados cuentan aunque la búsqueda o la combinación los dejen fuera de la lista:
  // se marcaron a propósito y son los que se imprimen.
  const marcados = useMemo(() => sortServiceFocusRows(todos.filter((row) => selected.has(row.name)), sort), [todos, selected, sort]);
  const verMarcados = soloMarcados && marcados.length > 0;
  const visible = useMemo(() => {
    if (verMarcados) return marcados;
    const text = query.trim().toLowerCase();
    return sortServiceFocusRows(todos.filter((row) => (conSin || row.active > 0) && (!text || row.name.toLowerCase().includes(text))), sort);
  }, [verMarcados, marcados, todos, conSin, query, sort]);
  const totals = useMemo(() => sumServiceFocusRows(visible), [visible]);
  const maxShare = Math.max(1, ...visible.map((row) => row.share));
  const marcadosFuera = marcados.filter((row) => !visible.includes(row)).length;

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.name));
  const toggleVisible = () => {
    const names = visible.map((row) => row.name);
    model.onSetSelectedBarrios(allVisibleSelected ? model.selectedBarrios.filter((name) => !names.includes(name)) : [...new Set([...model.selectedBarrios, ...names])]);
  };
  const quitarMarcas = () => { model.onSetSelectedBarrios([]); setSoloMarcados(false); };
  const onSort = (key) => setSort((current) => ({ key, dir: current.key === key ? (current.dir === "desc" ? "asc" : "desc") : key === "name" ? "asc" : "desc" }));

  const titulo = unico ? serviceLabel(unico) : frase ? `Usuarios ${frase}` : "Todos los usuarios";
  const columnaCon = unico ? "Con el servicio" : "Cumplen";
  const columnaSin = unico ? "Sin el servicio" : "No cumplen";

  // El informe lleva lo marcado; si no hay marcas, la lista tal como está en pantalla.
  const informe = () => {
    const filas = marcados.length ? marcados : visible;
    const filtro = marcados.length
      ? [`${plural(marcados.length, "barrio marcado", "barrios marcados")} por el operador`]
      : [query.trim() ? `Barrios que contienen “${query.trim()}”` : "", conSin ? "Incluye barrios donde nadie cumple" : ""];
    return {
      label: titulo,
      soloMarcados: marcados.length > 0,
      quien,
      columnaCon,
      columnaSin,
      rows: filas,
      totals: sumServiceFocusRows(filas),
      resumen: { ...resumen, barriosSin },
      // Si la lista deja fuera a los barrios donde nadie cumple, el informe los nombra al final.
      barriosSinNombres: marcados.length || conSin || query.trim() ? [] : todos.filter((row) => !row.active).map((row) => row.name).sort((a, b) => a.localeCompare(b, "es")),
      filtro: filtro.filter(Boolean).join(" · ")
    };
  };
  const salida = (modo) => imprimirServicio(informe(), model.serviceReport?.source?.updated_at, modo);
  const promedio = resumen.deudores ? resumen.deuda / resumen.deudores : 0;

  if (!calculo.rows) {
    return <div className="pq-empty is-inline"><Icon name="warning" /><strong>Esta combinación todavía no se puede calcular</strong><span>El servidor del padrón no manda los usuarios por combinación. Mientras se actualiza, pide un solo servicio con “Con” y deja los demás en “Da igual”.</span></div>;
  }

  return <>
    {/* El resumen se lee como una frase: quién cumple la combinación, dónde y cuánto deben. */}
    <p className="pq-focus-summary">
      <b>{count(resumen.active)}</b> {resumen.active === 1 ? "usuario" : "usuarios"} {quien} ({pct(totalPadron ? (resumen.active / totalPadron) * 100 : 0)} del padrón), en <b>{count(resumen.barriosCon)} de {count(todos.length)}</b> barrios.{" "}
      {resumen.deudores
        ? <>Sus cuentas deben <b>{money(resumen.deuda)}</b>: {count(resumen.deudores)} {resumen.deudores === 1 ? "cuenta tiene" : "cuentas tienen"} deuda, <b>{money(promedio)}</b> en promedio.</>
        : resumen.active ? "Ninguna de esas cuentas tiene deuda." : "Ningún usuario del padrón cumple esta combinación."}
    </p>

    <div className="pq-toolbar">
      <label className="pq-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar barrio" aria-label="Buscar barrio" disabled={verMarcados} /></label>
      {barriosSin ? <label className="pq-check-toggle"><input type="checkbox" checked={conSin} onChange={(event) => setConSin(event.target.checked)} disabled={verMarcados} />Incluir los {count(barriosSin)} barrios donde nadie cumple</label> : null}
      <div className="pq-toolbar-actions">
        <SalidaBotones onSalida={salida} disabled={!(marcados.length || visible.length)} notify={model.notify} imprimir={marcados.length ? `Imprimir ${plural(marcados.length, "marcado", "marcados")}` : "Imprimir lista"} primario={marcados.length > 0} />
      </div>
    </div>

    {/* Una sola línea fija para la selección: no empuja la tabla al marcar. */}
    <div className={`pq-mark-line ${marcados.length ? "has-marks" : ""}`.trim()} role="status">
      {marcados.length ? <>
        <span><b>{plural(marcados.length, "barrio marcado", "barrios marcados")}</b> · {count(sumServiceFocusRows(marcados).active)} usuarios · {money(sumServiceFocusRows(marcados).deuda)}{marcadosFuera && !verMarcados ? <em> · {count(marcadosFuera)} fuera de esta lista</em> : null}</span>
        <label className="pq-check-toggle"><input type="checkbox" checked={verMarcados} onChange={(event) => setSoloMarcados(event.target.checked)} />Ver solo los marcados</label>
        <button type="button" className="pq-link" onClick={quitarMarcas}>Quitar marcas</button>
      </> : <span>Marca barrios para imprimir solo esos. Sin marcas se imprime la lista completa.</span>}
    </div>

    {/* En pantalla, lo esencial. Capital e intereses van en el informe impreso y en el PDF. */}
    <div className="pq-table-wrap">
      <table className="pq-table is-services is-focus-table">
        <thead>
          <tr>
            <th className="pq-check"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} disabled={!visible.length} aria-label="Marcar los barrios de la lista" /></th>
            <SortHeader sortKey="name" label="Barrio" sort={sort} onSort={onSort} className="pq-col-name" />
            <SortHeader sortKey="usuarios" label="Usuarios" sort={sort} onSort={onSort} />
            <SortHeader sortKey="active" label={columnaCon} sort={sort} onSort={onSort} className="pq-col-service is-focus" title={`Usuarios ${quien}`} />
            <SortHeader sortKey="sin" label={columnaSin} sort={sort} onSort={onSort} />
            <SortHeader sortKey="deudores" label="Cuentas con deuda" sort={sort} onSort={onSort} />
            <SortHeader sortKey="deuda" label="Deuda" sort={sort} onSort={onSort} className="pq-col-total" />
            <SortHeader sortKey="share" label="Parte de la deuda" sort={sort} onSort={onSort} className="pq-col-share" />
          </tr>
          <tr className="pq-totals">
            <td className="pq-check" />
            <th scope="row" className="pq-col-name">{verMarcados ? "Marcados" : "Total"}<span className="pq-count">{plural(visible.length, "barrio", "barrios")}</span></th>
            <td>{count(totals.usuarios)}</td>
            <td className="pq-col-service is-focus"><b>{count(totals.active)}</b></td>
            <td>{count(totals.sin)}</td>
            <td>{count(totals.deudores)}</td>
            <td className="pq-col-total"><b>{money(totals.deuda)}</b></td>
            <td className="pq-col-share">{pct(totals.share)}</td>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => <tr key={row.name} className={`is-openable ${selected.has(row.name) ? "is-selected" : ""} ${row.active ? "" : "is-without"}`.trim()} {...filaAbreAbonados(row.name, setAbonadosDe)}>
            <td className="pq-check"><input type="checkbox" checked={selected.has(row.name)} onChange={() => model.onToggleBarrio(row.name)} aria-label={`Marcar ${row.name}`} /></td>
            <th scope="row" className="pq-col-name">{row.name}</th>
            <td>{count(row.usuarios)}</td>
            <td className={`pq-col-service is-focus ${row.active ? "" : "is-zero"}`.trim()}><span className="pq-cell-service"><b>{count(row.active)}</b><small>{pct(row.percentage)}</small><i aria-hidden="true"><em style={{ width: `${Math.min(100, row.percentage)}%` }} /></i></span></td>
            <td className={row.sin ? "" : "is-zero"}>{count(row.sin)}</td>
            <td className={row.deudores ? "" : "is-zero"}>{count(row.deudores)}</td>
            <td className="pq-col-total"><b>{money(row.deuda)}</b></td>
            <td className={`pq-col-share ${row.share ? "" : "is-zero"}`.trim()}><span className="pq-share"><small>{pct(row.share)}</small><i aria-hidden="true"><em style={{ width: `${(row.share / maxShare) * 100}%` }} /></i></span></td>
          </tr>)}
          {!visible.length ? <tr><td colSpan={8} className="pq-table-empty">{query ? `Ningún barrio con usuarios ${quien} coincide con “${query}”.` : `Ningún usuario del padrón cumple esta combinación (${quien}).`}</td></tr> : null}
        </tbody>
      </table>
    </div>
    <p className="pq-note"><Icon name="notes" />La deuda es la de las cuentas que cumplen la combinación: el padrón no la separa por servicio. “Parte de la deuda” dice cuánto de esa deuda está en cada barrio. Doble clic en un barrio para ver sus abonados.</p>
    {abonadosDe ? <AbonadosBarrio key={abonadosDe} barrio={abonadosDe} combinacion={combinacion} model={model} onClose={() => setAbonadosDe("")} /> : null}
  </>;
}
