import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { groupClavesByBarrio } from "../utils/alcaldiaClaves";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const PAGE = 100;

// Claves de Alcaldía sin coincidencia en Aguas, por barrio. Son decenas de
// miles: los barrios van plegados y cada uno pinta de 100 en 100.
export default function ClavesSinAguas({ candidates, barrio, onBarrioChange, statsByBarrio }) {
  const [query, setQuery] = useState("");
  // null = todavía nadie abrió ni cerró nada: se abre solo el primer barrio.
  const [open, setOpen] = useState(null);
  const [shown, setShown] = useState({});
  const groups = useMemo(() => groupClavesByBarrio(candidates, { query, barrio }), [candidates, query, barrio]);
  const matches = useMemo(() => groups.reduce((total, group) => total + group.rows.length, 0), [groups]);
  const openSet = open ?? new Set(groups.length ? [groups[0].barrio] : []);
  // Con búsqueda o con un barrio elegido todo va abierto: son pocos grupos.
  const isOpen = (name) => Boolean(query) || Boolean(barrio) || openSet.has(name);
  const toggle = (name) => {
    const next = new Set(openSet);
    if (next.has(name)) next.delete(name); else next.add(name);
    setOpen(next);
  };

  return <section className="pq-claves" aria-label="Claves que no aparecen en Aguas">
    <header className="pq-claves-head">
      <div>
        <h3>{barrio ? `Claves sin registrar en ${barrio}` : "Claves de Alcaldía que no aparecen en Aguas"}</h3>
        <p>{count(matches)} {matches === 1 ? "clave" : "claves"}{barrio ? "" : ` en ${count(groups.length)} ${groups.length === 1 ? "barrio" : "barrios"}`}{query ? ` para “${query}”` : ""}. Posibles conexiones sin registrar.</p>
      </div>
      {barrio ? <button type="button" className="pq-link" onClick={() => onBarrioChange("")}><Icon name="arrowLeft" />Todos los barrios</button> : null}
    </header>
    <div className="pq-toolbar is-compact">
      <label className="pq-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar clave, propietario, dirección o barrio" aria-label="Buscar entre las claves sin registrar" /></label>
      {!query && !barrio && groups.length > 1 ? <div className="pq-toolbar-actions">
        <button type="button" className="pq-link" onClick={() => setOpen(new Set(groups.map((group) => group.barrio)))}>Abrir todos</button>
        <button type="button" className="pq-link" onClick={() => setOpen(new Set())}>Cerrar todos</button>
      </div> : null}
    </div>

    {groups.length ? <div className="pq-barrios">
      {groups.map((group) => {
        const expanded = isOpen(group.barrio);
        const limit = shown[group.barrio] || PAGE;
        const alcaldiaTotal = statsByBarrio.get(group.barrio)?.alcaldia_total;
        return <section key={group.barrio} className={`pq-barrio ${expanded ? "is-open" : ""}`.trim()}>
          <button type="button" className="pq-barrio-head" aria-expanded={expanded} onClick={() => toggle(group.barrio)}>
            <Icon name="chevronRight" />
            <strong>{group.barrio}</strong>
            <span><b>{count(group.rows.length)}</b> {query ? `de ${count(group.total)} ` : ""}sin registrar</span>
            {alcaldiaTotal ? <span>de {count(alcaldiaTotal)} claves de Alcaldía</span> : null}
          </button>
          {expanded ? <div className="pq-table-wrap is-flat">
            <table className="pq-table is-listado is-claves">
              <thead><tr><th>#</th><th>Clave Alcaldía</th><th>Formato Aguas</th><th>Propietario</th><th>Dirección</th><th>Último periodo pagado</th></tr></thead>
              <tbody>{group.rows.slice(0, limit).map((row, rowIndex) => <tr key={`${row.clave_catastral}-${rowIndex}`}>
                <td className="is-muted">{rowIndex + 1}</td>
                <th scope="row" className="is-mono">{row.clave_catastral || "--"}</th>
                <td className="is-mono is-muted">{row.clave_aguas_formato || "--"}</td>
                <td>{row.nombre || "--"}</td>
                <td className="is-muted">{row.direccion || "--"}</td>
                <td className="is-muted">{row.ultimo_periodo_pagado || "--"}</td>
              </tr>)}</tbody>
            </table>
            {group.rows.length > limit ? <div className="pq-claves-more">
              <span>Mostrando {count(limit)} de {count(group.rows.length)}</span>
              <button type="button" className="pq-link" onClick={() => setShown((current) => ({ ...current, [group.barrio]: limit + PAGE }))}>Mostrar {count(Math.min(PAGE, group.rows.length - limit))} más</button>
            </div> : null}
          </div> : null}
        </section>;
      })}
    </div> : <div className="pq-empty is-inline"><Icon name="search" /><strong>{query ? `Ninguna clave coincide con “${query}”` : "No hay claves sin registrar"}</strong>{query ? <span>Prueba con parte de la clave, el apellido o el nombre del barrio.</span> : null}</div>}
  </section>;
}
