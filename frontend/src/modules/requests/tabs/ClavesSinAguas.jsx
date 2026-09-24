import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { buildClavesIndex, filterClavesIndex } from "../utils/alcaldiaClaves";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const PAGE = 100;
// El backend admite hasta 5,000 claves por envío; más se mandan por tandas.
const SEND_CHUNK = 5000;
const BANCO_ESTADOS = { pendiente: "En el banco", enviado: "Ya es ficha", descartado: "Descartada" };
// Qué pasó con un envío, en una frase: nuevas, ya estaban, y las que se omitieron
// porque el predio ya estaba en el banco por otro origen o ya tenía ficha.
const resumenEnvio = (total) => [
  `${count(total.nuevos)} ${total.nuevos === 1 ? "clave nueva" : "claves nuevas"} en el banco`,
  total.actualizados ? `${count(total.actualizados)} ya estaban` : "",
  total.sin_cambios_procesados ? `${count(total.sin_cambios_procesados)} ya procesadas` : "",
  total.ya_en_banco ? `${count(total.ya_en_banco)} ya estaban en el banco por levantamiento de campo` : "",
  total.con_ficha ? `${count(total.con_ficha)} ya tienen ficha` : ""
].filter(Boolean).join(", ") + ".";

// Claves de Alcaldía sin coincidencia en Aguas. Índice de barrios a la izquierda
// y las claves del barrio elegido a la derecha, de 100 en 100: nunca se pinta
// la lista entera. Las claves marcadas se mandan al Banco de clandestinos.
export default function ClavesSinAguas({ candidates, initialBarrio = "", statsByBarrio, apiFetch, notify, onOpenBanco }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeBarrio, setActiveBarrio] = useState(initialBarrio);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Map()); // clave -> barrio
  const [bancoRefs, setBancoRefs] = useState(() => new Map()); // clave -> estado en el banco
  const [sending, setSending] = useState(false);
  const [lastSend, setLastSend] = useState(null);

  const index = useMemo(() => buildClavesIndex(candidates), [candidates]);
  const groups = useMemo(() => filterClavesIndex(index, deferredQuery), [index, deferredQuery]);
  const matches = useMemo(() => groups.reduce((total, group) => total + group.rows.length, 0), [groups]);
  const active = groups.find((group) => group.barrio === activeBarrio) || groups[0] || null;
  const pageCount = active ? Math.max(1, Math.ceil(active.rows.length / PAGE)) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = active ? active.rows.slice(currentPage * PAGE, currentPage * PAGE + PAGE) : [];
  const searching = query !== deferredQuery;

  // Al cambiar de barrio o de búsqueda se vuelve a la primera página.
  useEffect(() => { setPage(0); }, [active?.barrio, deferredQuery]);

  const loadRefs = useCallback(async () => {
    if (!apiFetch) return;
    try {
      const response = await apiFetch("/clandestinos/banco/refs?origen=alcaldia");
      const body = await response.json().catch(() => ({}));
      if (response.ok) setBancoRefs(new Map((body.items || []).map((item) => [item.origen_ref, item.estado])));
    } catch { /* sin marcas: la lista sigue funcionando */ }
  }, [apiFetch]);
  useEffect(() => { loadRefs(); }, [loadRefs]);

  const selectable = (row) => !bancoRefs.has(row.clave_catastral);
  const toggle = (row) => setSelected((current) => {
    const next = new Map(current);
    if (next.has(row.clave_catastral)) next.delete(row.clave_catastral); else next.set(row.clave_catastral, active.barrio);
    return next;
  });
  const setMany = (rows, on) => setSelected((current) => {
    const next = new Map(current);
    rows.filter(selectable).forEach((row) => { if (on) next.set(row.clave_catastral, active.barrio); else next.delete(row.clave_catastral); });
    return next;
  });
  const pageSelectable = pageRows.filter(selectable);
  const pageAllSelected = pageSelectable.length > 0 && pageSelectable.every((row) => selected.has(row.clave_catastral));
  const barrioSelectable = active ? active.rows.filter(selectable) : [];
  const barrioSelected = barrioSelectable.filter((row) => selected.has(row.clave_catastral)).length;
  const selectedByBarrio = useMemo(() => {
    const totals = new Map();
    selected.forEach((barrio) => totals.set(barrio, (totals.get(barrio) || 0) + 1));
    return totals;
  }, [selected]);

  const send = async () => {
    const claves = [...selected.keys()];
    if (!claves.length || !apiFetch) return;
    setSending(true);
    const total = { nuevos: 0, actualizados: 0, sin_cambios_procesados: 0, enviados: 0, omitidos: 0, ya_en_banco: 0, con_ficha: 0 };
    try {
      for (let start = 0; start < claves.length; start += SEND_CHUNK) {
        const response = await apiFetch("/clandestinos/banco/desde-alcaldia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claves: claves.slice(start, start + SEND_CHUNK) }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "No se pudo enviar al Banco de clandestinos.");
        Object.keys(total).forEach((key) => { total[key] += Number(body[key] || 0); });
      }
      setLastSend(total);
      setSelected(new Map());
      notify?.(resumenEnvio(total));
    } catch (error) {
      notify?.(error.message);
    } finally {
      setSending(false);
      loadRefs();
    }
  };

  const pickBarrio = (barrio) => { setActiveBarrio(barrio); setPage(0); };
  const alcaldiaTotal = active ? statsByBarrio.get(active.barrio)?.alcaldia_total : 0;

  return <section className="pq-claves" aria-label="Claves que no aparecen en Aguas">
    <header className="pq-claves-head">
      <div>
        <h3>Claves de Alcaldía que no aparecen en Aguas</h3>
        <p>{count(matches)} {matches === 1 ? "clave" : "claves"} en {count(groups.length)} {groups.length === 1 ? "barrio" : "barrios"}{deferredQuery ? ` para “${deferredQuery}”` : ""}. Marca las que quieras mandar al Banco de clandestinos.</p>
      </div>
    </header>

    <label className={`pq-search ${searching ? "is-busy" : ""}`.trim()}><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar clave, propietario, dirección o barrio" aria-label="Buscar entre las claves sin registrar" /></label>

    {selected.size ? <div className="pq-selection" role="status">
      <span><strong>{count(selected.size)}</strong> {selected.size === 1 ? "clave seleccionada" : "claves seleccionadas"} en {count(selectedByBarrio.size)} {selectedByBarrio.size === 1 ? "barrio" : "barrios"}</span>
      <button type="button" className="pq-link" onClick={() => setSelected(new Map())} disabled={sending}>Quitar selección</button>
      <button type="button" className="pq-btn is-primary" onClick={send} disabled={sending}><Icon name="send" />{sending ? "Enviando…" : "Enviar al Banco de clandestinos"}</button>
    </div> : lastSend ? <div className="pq-selection is-done" role="status">
      <span><Icon name="checkCircle" />{resumenEnvio(lastSend)}</span>
      {onOpenBanco ? <button type="button" className="pq-btn" onClick={onOpenBanco}><Icon name="inbox" />Abrir el banco</button> : null}
    </div> : null}

    {groups.length ? <div className="pq-claves-layout">
      <nav className="pq-claves-index" aria-label="Barrios con claves sin registrar">
        <label className="pq-claves-picker"><span>Barrio</span>
          <select value={active?.barrio || ""} onChange={(event) => pickBarrio(event.target.value)}>
            {groups.map((group) => <option key={group.barrio} value={group.barrio}>{group.barrio} ({count(group.rows.length)})</option>)}
          </select>
        </label>
        <ol>
          {groups.map((group) => {
            const picked = selectedByBarrio.get(group.barrio);
            return <li key={group.barrio}>
              <button type="button" className={group.barrio === active?.barrio ? "is-active" : ""} aria-current={group.barrio === active?.barrio ? "true" : undefined} onClick={() => pickBarrio(group.barrio)}>
                <span>{group.barrio}</span>
                {picked ? <em title="Seleccionadas en este barrio">{count(picked)}</em> : null}
                <b>{count(group.rows.length)}</b>
              </button>
            </li>;
          })}
        </ol>
      </nav>

      {active ? <div className="pq-claves-detail">
        <header>
          <div>
            <h4>{active.barrio}</h4>
            <p><b>{count(active.rows.length)}</b> {deferredQuery ? `de ${count(active.total)} ` : ""}sin registrar{alcaldiaTotal ? ` de ${count(alcaldiaTotal)} claves de Alcaldía` : ""}</p>
          </div>
          {barrioSelectable.length ? <button type="button" className="pq-link" onClick={() => setMany(active.rows, barrioSelected < barrioSelectable.length)}>
            {barrioSelected < barrioSelectable.length ? `Seleccionar las ${count(barrioSelectable.length)} del barrio` : "Quitar las del barrio"}
          </button> : null}
        </header>
        <div key={`${active.barrio}-${currentPage}`} className="pq-table-wrap pq-claves-table">
          <table className="pq-table is-listado is-claves">
            <thead><tr>
              <th className="pq-check"><input type="checkbox" checked={pageAllSelected} disabled={!pageSelectable.length} onChange={() => setMany(pageRows, !pageAllSelected)} aria-label="Seleccionar las claves de esta página" /></th>
              <th>#</th><th>Clave Alcaldía</th><th>Formato Aguas</th><th>Propietario</th><th>Dirección</th><th>Último pago</th>
            </tr></thead>
            <tbody>{pageRows.map((row, rowIndex) => {
              const estado = bancoRefs.get(row.clave_catastral);
              const isSelected = selected.has(row.clave_catastral);
              return <tr key={`${row.clave_catastral}-${currentPage * PAGE + rowIndex}`} className={`${isSelected ? "is-selected" : ""} ${estado ? "is-in-banco" : ""}`.trim()}>
                <td className="pq-check">{estado ? null : <input type="checkbox" checked={isSelected} onChange={() => toggle(row)} aria-label={`Seleccionar ${row.clave_catastral}`} />}</td>
                <td className="is-muted">{currentPage * PAGE + rowIndex + 1}</td>
                <th scope="row" className="is-mono">{row.clave_catastral || "--"}{estado ? <span className={`pq-banco-tag is-${estado}`}>{BANCO_ESTADOS[estado] || "En el banco"}</span> : null}</th>
                <td className="is-mono is-muted">{row.clave_aguas_formato || "--"}</td>
                <td>{row.nombre || "--"}</td>
                <td className="is-muted">{row.direccion || "--"}</td>
                <td className="is-muted">{row.ultimo_periodo_pagado || "--"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {pageCount > 1 ? <nav className="pq-pager" aria-label="Páginas de claves">
          <span>{count(currentPage * PAGE + 1)}–{count(Math.min(active.rows.length, (currentPage + 1) * PAGE))} de {count(active.rows.length)}</span>
          <button type="button" className="pq-btn" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}><Icon name="arrowLeft" />Anterior</button>
          <span className="pq-pager-page">Página {count(currentPage + 1)} de {count(pageCount)}</span>
          <button type="button" className="pq-btn" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>Siguiente<Icon name="arrowRight" /></button>
        </nav> : null}
      </div> : null}
    </div> : <div className="pq-empty is-inline"><Icon name="search" /><strong>{deferredQuery ? `Ninguna clave coincide con “${deferredQuery}”` : "No hay claves sin registrar"}</strong>{deferredQuery ? <span>Prueba con parte de la clave, el apellido o el nombre del barrio.</span> : null}</div>}
  </section>;
}
