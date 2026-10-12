import { useState } from "react";
import { Icon } from "../../components/Icon";
import { filterRows, pageNumbers, paginate } from "../reports/managerReportFormat.js";
import { sinceLabel } from "./managerOverview.js";

const n = (value) => Number(value || 0).toLocaleString("es-HN");
const lempiras = (value) => {
  const amount = Number(value || 0);
  if (amount >= 1e6) return `L ${(amount / 1e6).toFixed(1)} M`;
  if (amount >= 1e3) return `L ${(amount / 1e3).toFixed(1)} mil`;
  return `L ${amount.toLocaleString("es-HN", { maximumFractionDigits: 0 })}`;
};
const usd = new Intl.NumberFormat("es-HN", { style: "currency", currency: "USD" });

function Change({ value, unit = "%", suffix = "vs. mes anterior" }) {
  if (value == null) return <small className="mo-kpi-change">{suffix === "vs. mes anterior" ? "Sin mes anterior para comparar" : suffix}</small>;
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  return <small className={`mo-kpi-change is-${direction}`}>
    {direction !== "flat" ? <Icon name={direction === "up" ? "trendUp" : "trendDown"} /> : null}
    <b>{value > 0 ? "+" : ""}{value.toLocaleString("es-HN")}{unit}</b> {suffix}
  </small>;
}

function Tile({ icon, tone = "blue", label, value, children, onClick, title }) {
  const Tag = onClick ? "button" : "div";
  return <Tag className={`mo-kpi is-${tone}`} {...(onClick ? { type: "button", onClick, title } : {})}>
    <span className="mo-kpi-icon" aria-hidden="true"><Icon name={icon} /></span>
    <span className="mo-kpi-body"><span className="mo-kpi-label">{label}</span><strong>{value}</strong>{children}</span>
  </Tag>;
}

export function KpiTiles({ kpis, cost, navigate }) {
  const { creadas, finalizadas, pendientes, efectividad, fichas, equipo } = kpis;
  return <section className="mo-kpis" aria-label="Indicadores del mes">
    <Tile icon="clipboard" label="Inspecciones creadas" value={n(creadas.value)} onClick={() => navigate("inspecciones")} title="Abrir Inspecciones">
      <Change value={creadas.change} />
      <small className="mo-kpi-note">{n(finalizadas.value)} finalizadas{finalizadas.previous != null ? ` · ${n(finalizadas.previous)} el mes anterior` : ""}</small>
    </Tile>
    <Tile icon="activity" tone={pendientes.oldestDays > 7 ? "amber" : "blue"} label="Inspecciones pendientes" value={n(pendientes.value)} onClick={() => navigate("inspecciones")} title="Abrir Inspecciones">
      <small className="mo-kpi-change">{pendientes.oldestDays != null ? <>La más antigua lleva <b>{n(pendientes.oldestDays)} {pendientes.oldestDays === 1 ? "día" : "días"}</b></> : "Ninguna asignada sin empezar"}</small>
      <small className="mo-kpi-note">De todos los períodos</small>
    </Tile>
    <Tile icon="checkCircle" tone="green" label="Entregas efectivas" value={efectividad.asignadas ? `${n(Math.round(efectividad.value))}%` : "—"} onClick={() => navigate("entregas")} title="Abrir Control de entregas">
      <Change value={efectividad.points} unit=" pts" />
      <small className="mo-kpi-note">{n(efectividad.entregadas)} de {n(efectividad.asignadas)} documentos{efectividad.vencidas ? <> · <span className="is-critical">{n(efectividad.vencidas)} {efectividad.vencidas === 1 ? "vencido" : "vencidos"}</span></> : ""}</small>
    </Tile>
    <Tile icon="records" tone="red" label="Fichas clandestinas activas" value={n(fichas.value)} onClick={() => navigate("records")} title="Abrir Fichas clandestinas">
      <small className="mo-kpi-note">Del levantamiento al cierre</small>
    </Tile>
    <Tile icon="users" label="Equipo activo hoy" value={n(equipo.value)} onClick={() => navigate("teamActivity")} title="Abrir Actividad del equipo">
      <small className="mo-kpi-change">{equipo.value ? <><b>{n(equipo.acciones)}</b> acciones registradas</> : "Sin actividad registrada hoy"}</small>
      <small className="mo-kpi-note">Según la bitácora del sistema</small>
    </Tile>
    <Tile icon="trendUp" tone="slate" label="Costo de la app en el ciclo" value={cost.summary ? usd.format(cost.summary.currentUsage) : cost.loading ? "…" : "—"}>
      {cost.summary ? <>
        <small className="mo-kpi-change"><b>{usd.format(cost.cycle.dailyAverage)}</b> por día · estimado {usd.format(cost.summary.estimatedUsage)}</small>
        <span className="mo-kpi-pace" role="img" aria-label={`Día ${cost.cycle.cycleDay} de ${cost.cycle.cycleDays} del ciclo de Railway`}><b style={{ width: `${cost.cycle.spentShare * 100}%` }} /><i style={{ left: `${cost.cycle.elapsedShare * 100}%` }} /></span>
        <small className="mo-kpi-note">Railway · día {cost.cycle.cycleDay} de {cost.cycle.cycleDays}</small>
      </> : <small className="mo-kpi-note">{cost.error ? "No se pudo consultar Railway" : "Consultando Railway…"}</small>}
    </Tile>
  </section>;
}

// Dona de inspecciones pendientes por estado, con el total al centro.
export function InspectionDonut({ estados, navigate }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <article className="mo-card">
    <header><h3>Inspecciones pendientes</h3><button type="button" className="mo-link" onClick={() => navigate("inspecciones")}>Ver</button></header>
    {!estados.total ? <p className="mo-empty">No hay inspecciones pendientes.</p> : <div className="mo-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={estados.items.map((item) => `${item.label}: ${item.value}`).join(", ")}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef2f6" strokeWidth="16" />
        {estados.items.filter((item) => item.value > 0).map((item) => {
          const length = (item.value / estados.total) * circumference;
          const segment = <circle key={item.id} cx="70" cy="70" r={radius} fill="none" stroke={item.color} strokeWidth="16" strokeDasharray={`${Math.max(length - 2, 1)} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
          offset += length;
          return segment;
        })}
        <text x="70" y="68" textAnchor="middle" className="mo-donut-total">{n(estados.total)}</text>
        <text x="70" y="86" textAnchor="middle" className="mo-donut-caption">pendientes</text>
      </svg>
      <ul>{estados.items.map((item) => <li key={item.id}><span style={{ background: item.color }} aria-hidden="true" />{item.label}<strong>{n(item.value)}</strong><small>{Math.round((item.value / estados.total) * 100)}%</small></li>)}</ul>
    </div>}
  </article>;
}

export function DeliveryEffectiveness({ rows, navigate }) {
  return <article className="mo-card">
    <header><h3>Efectividad de entregas por barrio</h3><button type="button" className="mo-link" onClick={() => navigate("entregas")}>Ver</button></header>
    {!rows.length ? <p className="mo-empty">Sin lotes en el período.</p> : <ol className="mo-effect">
      {rows.slice(0, 6).map((row) => <li key={row.barrio}>
        <span className="mo-effect-name">{row.barrio}</span>
        <span className="mo-effect-track" aria-hidden="true"><span style={{ width: `${Math.min(100, row.efectividad)}%` }} /></span>
        <strong>{Math.round(row.efectividad)}%</strong>
        <small>{n(row.entregadas)} de {n(row.asignadas)}</small>
      </li>)}
    </ol>}
  </article>;
}

export function TeamToday({ equipo, navigate }) {
  return <article className="mo-card">
    <header><h3>Equipo hoy</h3><button type="button" className="mo-link" onClick={() => navigate("teamActivity")}>Ver todo</button></header>
    {!equipo.length ? <p className="mo-empty">Nadie ha registrado actividad hoy.</p> : <ul className="mo-team">
      {equipo.slice(0, 6).map((person) => <li key={person.id}>
        <span className="mo-avatar" aria-hidden="true">{person.nombre.trim().charAt(0).toUpperCase()}</span>
        <span className="mo-team-name"><strong>{person.nombre}</strong><small>{n(person.hoy)} {person.hoy === 1 ? "acción" : "acciones"}{person.cerrados ? ` · ${n(person.cerrados)} ${person.cerrados === 1 ? "cerrada" : "cerradas"}` : ""}</small></span>
        <span className={`mo-status is-${person.status}`}>{person.status === "now" ? "Activo ahora" : "Activo hoy"}</span>
        <small className="mo-team-time">{sinceLabel(person.minutes)}</small>
      </li>)}
    </ul>}
  </article>;
}

const BARRIO_PAGE = 8;
export function BarrioSummary({ rows }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = search ? rows.filter((row) => filterRows([[row.barrio]], search).length) : rows;
  const data = paginate(filtered, page, BARRIO_PAGE);
  return <article className="mo-card mo-barrios">
    <header>
      <h3>Resumen por barrio</h3>
      <label className="mo-search"><Icon name="search" /><input className="mo-input" type="search" value={search} placeholder="Buscar barrio" aria-label="Buscar barrio" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
    </header>
    <div className="mo-table-wrap">
      <table className="mo-table">
        <thead>
          <tr><th rowSpan={2} className="is-rank">#</th><th rowSpan={2}>Barrio</th><th colSpan={2} className="is-group">Padrón</th><th colSpan={2} className="is-group">Cartera en mora</th><th colSpan={2} className="is-group">Entregas del período</th></tr>
          <tr><th className="is-number">Abonados</th><th className="is-number">Con mora</th><th className="is-number">Monto</th><th className="is-number">% del total</th><th className="is-number">Entregadas</th><th className="is-number">Efectividad</th></tr>
        </thead>
        <tbody>{data.items.map((row, index) => <tr key={row.barrio}>
          <td className="is-rank">{data.from + index}</td>
          <td>{row.barrio}</td>
          <td className="is-number">{n(row.abonados)}</td>
          <td className="is-number">{n(row.deudores)}</td>
          <td className="is-number">{lempiras(row.mora)}</td>
          <td className="is-number"><span className="mo-share"><i aria-hidden="true"><b style={{ width: `${Math.min(100, row.share * 4)}%` }} /></i>{row.share.toFixed(1)}%</span></td>
          <td className="is-number">{row.asignadas == null ? <span className="mo-muted">—</span> : `${n(row.entregadas)} de ${n(row.asignadas)}`}</td>
          <td className="is-number">{row.efectividad == null ? <span className="mo-muted">—</span> : `${Math.round(row.efectividad)}%`}</td>
        </tr>)}</tbody>
      </table>
      {!data.total ? <p className="mo-empty">Ningún barrio coincide con la búsqueda.</p> : null}
    </div>
    <footer>
      <p>{data.total ? `${n(data.from)}–${n(data.to)} de ${n(data.total)} barrios · ordenados por mora` : ""}{rows.some((row) => row.asignadas == null) ? " · “—” sin lotes de entrega en el período" : ""}</p>
      {data.totalPages > 1 ? <nav className="mo-pager" aria-label="Páginas de barrios">
        <button type="button" onClick={() => setPage(data.page - 1)} disabled={data.page === 1} aria-label="Página anterior"><Icon name="arrowLeft" /></button>
        {pageNumbers(data.page, data.totalPages).map((value, index) => value === "…" ? <span key={`gap-${index}`} aria-hidden="true">…</span> : <button type="button" key={value} className={value === data.page ? "is-active" : ""} aria-current={value === data.page ? "page" : undefined} onClick={() => setPage(value)}>{value}</button>)}
        <button type="button" onClick={() => setPage(data.page + 1)} disabled={data.page === data.totalPages} aria-label="Página siguiente"><Icon name="arrowRight" /></button>
      </nav> : null}
    </footer>
  </article>;
}
