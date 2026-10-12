import { useState } from "react";
import { formatCount } from "./managerReportFormat.js";

// Gráficos de los informes de Gerencia, con el lenguaje de análisis del tablero:
// barras finas, una sola escala por gráfico y el color como dato.

export function StatStrip({ items, label }) {
  return <dl className="mr-stats" aria-label={label}>
    {items.map((item) => <div key={item.label}>
      <dt>{item.label}</dt>
      <dd><strong>{item.value}</strong>{item.detail ? <small className={item.tone || ""}>{item.detail}</small> : null}{item.split ? <SplitBar parts={item.split} /> : null}</dd>
    </div>)}
  </dl>;
}

export function SplitBar({ parts }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return <span className="mr-split" role="img" aria-label={parts.map((part) => `${part.label} ${Math.round((part.value / total) * 100)}%`).join(", ")}>
    {parts.map((part) => <i key={part.label} style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />)}
  </span>;
}

// Barras horizontales con escala compartida. Con onSelect cada fila filtra el detalle.
export function BarList({ title, rows, format = formatCount, onSelect, selected, empty = "Sin datos para este período.", note }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  // Todas las cifras de la lista ocupan el mismo ancho, para que las barras arranquen parejas.
  const valueWidth = Math.max(2, ...rows.map((row) => format(row.value).length));
  return <section className="mr-card">
    <header><h3>{title}</h3>{note ? <p>{note}</p> : null}</header>
    {!rows.length ? <p className="mr-empty">{empty}</p> : <ol className="mr-bars" style={{ "--mr-value-width": `${valueWidth + 1}ch` }}>
      {rows.map((row) => {
        const body = <>
          <span className="mr-bar-label"><span>{row.label}</span>{row.detail ? <small>{row.detail}</small> : null}</span>
          <span className="mr-bar-track" aria-hidden="true">
            {row.segments ? <span className="mr-bar-fill is-stacked" style={{ width: `${(row.value / max) * 100}%` }}>
              {row.segments.filter((part) => part.value > 0).map((part) => <i key={part.name} style={{ flexGrow: part.value, background: part.color }} />)}
            </span> : <span className="mr-bar-fill" style={{ width: `${Math.max(1.5, (row.value / max) * 100)}%` }} />}
          </span>
          <strong>{format(row.value)}</strong>
        </>;
        return <li key={row.label}>{onSelect
          ? <button type="button" className={selected === row.label ? "is-selected" : ""} aria-pressed={selected === row.label} onClick={() => onSelect(selected === row.label ? "" : row.label)} title={`Filtrar el detalle por ${row.label}`}>{body}</button>
          : <div>{body}</div>}</li>;
      })}
    </ol>}
  </section>;
}

// Columnas por día o por mes. Puntero o flechas recorren las columnas; la lectura va arriba.
export function ColumnChart({ title, rows, format = formatCount, summary, empty = "Sin datos para este período." }) {
  const [active, setActive] = useState(-1);
  const max = Math.max(1, ...rows.map((row) => row.value));
  const current = rows[active];
  const hasData = rows.some((row) => row.value > 0);
  const move = (event) => {
    if (!rows.length) return;
    if (event.key === "ArrowRight") { event.preventDefault(); setActive((index) => Math.min(rows.length - 1, index + 1)); }
    if (event.key === "ArrowLeft") { event.preventDefault(); setActive((index) => Math.max(0, (index < 0 ? rows.length : index) - 1)); }
    if (event.key === "Escape") setActive(-1);
  };
  return <section className="mr-card">
    <header><h3>{title}</h3><p aria-live="polite">{current ? <><b>{current.label}</b> · {format(current.value)}{current.detail ? ` · ${current.detail}` : ""}</> : summary}</p></header>
    {!hasData ? <p className="mr-empty">{empty}</p> : <div className="mr-columns" tabIndex={0} role="group" aria-label={`${title}. Usa las flechas para recorrer.`} onKeyDown={move} onMouseLeave={() => setActive(-1)} onBlur={() => setActive(-1)}>
      {rows.map((row, index) => <span key={row.key} className={`mr-column${index === active ? " is-active" : ""}`} onMouseEnter={() => setActive(index)}>
        <span className="mr-column-bar" style={{ height: `${row.value ? Math.max(3, (row.value / max) * 100) : 0}%` }} />
        <small>{row.short}</small>
      </span>)}
    </div>}
  </section>;
}

// Franja proporcional por etapa, con su leyenda y cifras.
export function StageStrip({ title, stages, note }) {
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);
  return <section className="mr-card">
    <header><h3>{title}</h3>{note ? <p>{note}</p> : null}</header>
    {!total ? <p className="mr-empty">Sin registros.</p> : <>
      <div className="mr-stage-strip" role="img" aria-label={stages.map((stage) => `${stage.label}: ${stage.value}`).join(", ")}>
        {stages.filter((stage) => stage.value > 0).map((stage) => <i key={stage.key} style={{ flexGrow: stage.value, background: stage.color }} title={`${stage.label}: ${formatCount(stage.value)}`} />)}
      </div>
      <ul className="mr-stage-legend">
        {stages.map((stage) => <li key={stage.key}><span style={{ background: stage.color }} aria-hidden="true" />{stage.label}<strong>{formatCount(stage.value)}</strong><small>{Math.round((stage.value / total) * 100)}%</small></li>)}
      </ul>
    </>}
  </section>;
}
