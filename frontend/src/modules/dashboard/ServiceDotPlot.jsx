import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "../../utils/currency.js";
import { buildServiceColumns, layoutDots, niceTicks } from "./dotPlotLayout";

// Mismo orden que las columnas de Consultas del padrón.
const SERVICES = [
  { field: "agua", label: "Agua", short: "Agua" },
  { field: "alcantarillado", label: "Alcantarillado", short: "Alcant." },
  { field: "barrido", label: "Barrido", short: "Barrido" },
  { field: "recoleccion", label: "Recolección", short: "Recolec." },
  { field: "desechos_peligrosos", label: "Peligrosos", short: "Peligr." }
];
const PLOT_HEIGHT = 230;
const AXIS_LEFT = 64;
const TOP = 10;
const LABELS = 34;
const RADIUS = 4;

const tickLabel = (value) => {
  if (!value) return "0";
  if (value >= 1e6) return `L ${(value / 1e6).toLocaleString("es-HN", { maximumFractionDigits: 1 })} M`;
  if (value >= 1e3) return `L ${(value / 1e3).toLocaleString("es-HN", { maximumFractionDigits: 0 })} mil`;
  return `L ${value.toLocaleString("es-HN")}`;
};

// Ancho real del contenedor: el acomodo se hace en píxeles para que los puntos
// midan lo mismo en una pantalla ancha que en el teléfono.
const useWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

/**
 * Mora por barrio y servicio: una columna por servicio, un punto por barrio.
 * Al pasar sobre un punto, el mismo barrio se enciende en todas las columnas;
 * un clic lo deja fijo (otro clic, o clic en el fondo, lo suelta).
 * Con teclado: Tab entra, ↑/↓ recorren los barrios de la columna, ←/→ cambian
 * de servicio con el mismo barrio y Esc suelta.
 */
export default function ServiceDotPlot({ debtBarrios = [] }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null); // { barrio, field }
  const [pinned, setPinned] = useState(null);
  const active = hover || pinned;

  const columns = useMemo(() => buildServiceColumns(debtBarrios, SERVICES).filter((column) => column.dots.length), [debtBarrios]);
  const maxValue = Math.max(1, ...columns.flatMap((column) => column.dots.map((dot) => dot.value)));
  const { top, ticks } = niceTicks(maxValue);
  const layout = useMemo(
    () => (width ? layoutDots(columns, { width, height: PLOT_HEIGHT, left: AXIS_LEFT, top: TOP, radius: RADIUS, maxValue: top }) : { radius: RADIUS, columns: [] }),
    [columns, width, top]
  );
  const laid = layout.columns;
  const yOf = (value) => TOP + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;
  // En columnas angostas (teléfono) los nombres largos se enciman: van abreviados.
  const narrow = width && (width - AXIS_LEFT) / Math.max(1, columns.length) < 96;
  const shortOf = Object.fromEntries(SERVICES.map((service) => [service.field, service.short]));

  if (!columns.length) return null;

  const onKeyDown = (event) => {
    if (!laid.length) return;
    if (event.key === "Escape") { setPinned(null); return; }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    setHover(null);
    const current = pinned || { barrio: laid[0].dots[0]?.barrio, field: laid[0].field };
    const columnIndex = Math.max(0, laid.findIndex((column) => column.field === current.field));
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      // Siguiente servicio donde el mismo barrio tiene mora.
      const direction = event.key === "ArrowRight" ? 1 : -1;
      for (let offset = 1; offset < laid.length; offset += 1) {
        const column = laid[(columnIndex + direction * offset + laid.length) % laid.length];
        if (column.dots.some((dot) => dot.barrio === current.barrio)) { setPinned({ barrio: current.barrio, field: column.field }); return; }
      }
      return;
    }
    // Los puntos ya vienen ordenados de mayor a menor mora.
    const column = laid[columnIndex];
    const index = column.dots.findIndex((dot) => dot.barrio === current.barrio);
    const next = pinned ? index + (event.key === "ArrowDown" ? 1 : -1) : 0;
    const dot = column.dots[Math.min(column.dots.length - 1, Math.max(0, next))];
    setPinned({ barrio: dot.barrio, field: column.field });
  };

  // Datos del barrio encendido en cada servicio, para la ficha flotante.
  const detail = active ? laid.map((column) => ({ column, dot: column.dots.find((dot) => dot.barrio === active.barrio) })) : [];
  const anchor = active ? detail.find((item) => item.column.field === active.field)?.dot : null;
  const summary = columns.map((column) => `${column.label}: ${column.dots.length} barrios`).join("; ");

  return (
    <figure className="dw-dotplot" ref={ref}>
      <svg
        width={width || "100%"}
        height={TOP + PLOT_HEIGHT + LABELS}
        role="group"
        tabIndex={0}
        aria-label={`Mora por barrio en cada servicio. Cada punto es un barrio. ${summary}. Las flechas recorren los barrios y los servicios.`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => { if (event.target === event.currentTarget) setPinned(null); }}
      >
        {ticks.map((tick) => (
          <g key={tick} className="dw-dotplot-grid">
            <line x1={AXIS_LEFT} x2={width} y1={yOf(tick)} y2={yOf(tick)} />
            <text x={AXIS_LEFT - 8} y={yOf(tick)} dy="0.32em">{tickLabel(tick)}</text>
          </g>
        ))}
        {laid.map((column) => (
          <g key={column.field} className="dw-dotplot-column">
            <text className="dw-dotplot-label" x={column.center} y={TOP + PLOT_HEIGHT + 20}>{narrow ? shortOf[column.field] : column.label}</text>
            {column.dots.map((dot) => {
              const linked = active?.barrio === dot.barrio;
              return (
                <circle
                  key={dot.barrio}
                  cx={dot.x}
                  cy={dot.y}
                  r={linked ? layout.radius + 1.5 : layout.radius}
                  className={linked ? "is-linked" : active ? "is-dim" : ""}
                  onPointerEnter={() => setHover({ barrio: dot.barrio, field: column.field })}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => setPinned((current) => (current?.barrio === dot.barrio && current.field === column.field ? null : { barrio: dot.barrio, field: column.field }))}
                />
              );
            })}
          </g>
        ))}
      </svg>
      {anchor ? (
        <div
          className={`dw-dotplot-tip ${anchor.y < 150 ? "is-below" : ""}`.trim()}
          role="status"
          style={{ left: `${Math.min(Math.max(anchor.x, 110), Math.max(110, width - 110))}px`, top: `${anchor.y}px` }}
        >
          <strong>{active.barrio}</strong>
          <dl>
            {detail.map(({ column, dot }) => (
              <div key={column.field} className={column.field === active.field ? "is-current" : ""}>
                <dt>{column.label}</dt>
                <dd>{dot ? formatCurrency(dot.value) : "--"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <figcaption>Cada punto es un barrio, a la altura de la mora de sus cuentas con ese servicio (eje en lempiras). Al pasar el cursor, el mismo barrio se marca en todos los servicios; un clic lo deja fijo.</figcaption>
    </figure>
  );
}
