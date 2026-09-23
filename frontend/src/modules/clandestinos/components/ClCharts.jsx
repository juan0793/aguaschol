import { useEffect, useRef, useState } from "react";
import LiveNumber from "../../../components/micro/LiveNumber";

// Monta en cero y crece al siguiente cuadro: los gráficos entran en movimiento
// una sola vez. Después, solo se mueve lo que cambia de valor (transiciones CSS).
const useGrow = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  return ready;
};

// Cifra que cuenta al cambiar sin re-renderizar el gráfico (ver LiveNumber).
export const CountUp = ({ value, flash = "" }) => <LiveNumber value={value} flash={flash} />;

/**
 * Anillo seleccionable. Cada segmento es un botón: elegirlo filtra la vista;
 * elegirlo otra vez quita el filtro.
 * segments: [{ key, label, value, color }]
 */
export function DonutChart({ segments, selected = "", onSelect, label, centerCaption = "Total", size = 148 }) {
  const ready = useGrow();
  const total = segments.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const active = segments.find((item) => item.key === selected);
  const figureRef = useRef(null);
  // La respiración es CSS (no re-renderiza); se pausa si el anillo no se ve.
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) figure.removeAttribute("data-offscreen");
      else figure.setAttribute("data-offscreen", "");
    });
    observer.observe(figure);
    return () => observer.disconnect();
  }, []);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((item) => Number(item.value) > 0);
  const gap = visible.length > 1 ? 2.5 : 0;
  let offset = 0;
  return <figure ref={figureRef} className="cl-donut" style={{ "--donut-size": `${size}px` }}>
    <svg viewBox="0 0 140 140" role="group" aria-label={label}>
      <circle className="cl-donut-track" cx="70" cy="70" r={radius} />
      <g transform="rotate(-90 70 70)">{segments.map((item) => {
        const value = Number(item.value || 0);
        const length = total && ready ? (value / total) * circumference : 0;
        const dash = Math.max(0, length - gap);
        const start = offset;
        offset += length;
        if (!value) return null;
        const isActive = selected === item.key;
        return <circle
          key={item.key}
          className={`cl-donut-segment ${isActive ? "is-active" : ""} ${selected && !isActive ? "is-dimmed" : ""}`.trim()}
          cx="70" cy="70" r={radius}
          stroke={item.color}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-start}
          role="button"
          tabIndex={0}
          aria-pressed={isActive}
          aria-label={`${item.label}: ${value}`}
          onClick={() => onSelect?.(isActive ? "" : item.key)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(isActive ? "" : item.key); } }}
        ><title>{`${item.label}: ${value} (${total ? Math.round((value / total) * 100) : 0}%)`}</title></circle>;
      })}</g>
    </svg>
    <figcaption><LiveNumber as="strong" value={active ? active.value : total} duration={500} /><span>{active ? active.label : centerCaption}</span></figcaption>
  </figure>;
}

/**
 * Barras horizontales apiladas y seleccionables (una fila = una categoría).
 * rows: [{ key, label, total, parts: [{ key, value, color, label }] }]
 */
export function StackedBars({ rows, selected = "", onSelect, emptyText = "Sin datos para graficar", label }) {
  const ready = useGrow();
  const max = Math.max(1, ...rows.map((row) => row.total));
  if (!rows.length) return <p className="cl-bars-empty">{emptyText}</p>;
  return <ul className="cl-bars" aria-label={label}>
    {rows.map((row, index) => {
      const isActive = selected === row.key;
      const title = [`${row.label}: ${row.total}`, ...row.parts.filter((part) => part.value).map((part) => `${part.label}: ${part.value}`)].join("\n");
      return <li key={row.key}>
        <button type="button" title={title} aria-pressed={isActive} className={`${isActive ? "is-active" : ""} ${selected && !isActive ? "is-dimmed" : ""}`.trim()} onClick={() => onSelect?.(isActive ? "" : row.key)}>
          <span className="cl-bars-label">{row.label}</span>
          <span className="cl-bars-track" style={{ "--bar-delay": `${index * 45}ms` }}>
            <span className="cl-bars-fill" style={{ width: ready ? `${(row.total / max) * 100}%` : 0 }}>
              {row.parts.map((part) => part.value ? <i key={part.key} style={{ flexGrow: part.value, background: part.color }} /> : null)}
            </span>
          </span>
          <strong>{row.total}</strong>
        </button>
      </li>;
    })}
  </ul>;
}

/**
 * Leyenda que también filtra: icono, nombre, valor y una barra proporcional.
 * items: [{ key, label, value, color, icon, hint }]
 */
export function MeterLegend({ items, selected = "", onSelect, renderIcon }) {
  const ready = useGrow();
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  return <div className="cl-meters" role="group">
    {items.map((item) => {
      const isActive = selected === item.key;
      const percent = total ? Math.round((Number(item.value || 0) / total) * 100) : 0;
      return <button type="button" key={item.key} title={item.hint} aria-pressed={isActive} className={`${isActive ? "is-active" : ""} ${selected && !isActive ? "is-dimmed" : ""}`.trim()} style={{ "--meter-color": item.color }} onClick={() => onSelect?.(isActive ? "" : item.key)}>
        <span className="cl-meters-icon">{renderIcon?.(item)}</span>
        <span className="cl-meters-copy"><span>{item.label}</span><small>{percent}%</small></span>
        <strong><CountUp value={item.value} /></strong>
        <span className="cl-meters-track"><span style={{ width: ready ? `${percent}%` : 0 }} /></span>
      </button>;
    })}
  </div>;
}
