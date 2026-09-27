import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CalendarRange,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  Wallet
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import PageHeader from "./ds/PageHeader";
import {
  HEAT_LEVELS,
  RANGE_HOURS,
  WEEKDAYS,
  WEEKDAYS_LONG,
  formatMetric,
  heatLevel,
  hourlyHeatmap,
  linePath,
  niceCeil,
  serviceColorMap,
  servicePeaks,
  seriesFor,
  seriesStats,
  sliceRange,
  timeTicks,
  timeline
} from "./railwayUsageCharts";
import "./ds/design-system.css";
import "./railway-usage.css";

const projectUrl = import.meta.env.VITE_RAILWAY_PROJECT_URL?.trim() || "https://railway.com/project/953aa9b8-7664-4b8f-8bc5-2b1ea03fa5d4/observability?environmentId=421e4168-8901-4055-a0d9-f94a849570f8";
const metricsUrl = "https://docs.railway.com/observability/metrics";
const usageUrl = "https://docs.railway.com/projects/project-usage";

const resources = [
  { icon: MemoryStick, label: "Memoria", key: "MEMORY_USAGE_GB" },
  { icon: Cpu, label: "CPU", key: "CPU_USAGE" },
  { icon: Network, label: "Red de salida", key: "NETWORK_TX_GB" },
  { icon: HardDrive, label: "Disco", key: "DISK_USAGE_GB" },
  { icon: Database, label: "Respaldos", key: "BACKUP_USAGE_GB" }
];

const metricOptions = [
  { key: "MEMORY_USAGE_GB", label: "Memoria", unit: "GB" },
  { key: "CPU_USAGE", label: "CPU", unit: "vCPU" }
];
const rangeOptions = [
  { key: "24h", label: "24 h" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" }
];

const TZ = "America/Tegucigalpa";
const money = new Intl.NumberFormat("es-HN", { style: "currency", currency: "USD" });
const percent = new Intl.NumberFormat("es-HN", { style: "percent", maximumFractionDigits: 0 });
const dateHour = new Intl.DateTimeFormat("es-HN", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const date = new Intl.DateTimeFormat("es-HN", { timeZone: TZ, day: "numeric", month: "short" });
const hourOnly = new Intl.DateTimeFormat("es-HN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const weekdayDay = new Intl.DateTimeFormat("es-HN", { timeZone: TZ, weekday: "short", day: "numeric" });
const DAY_MS = 24 * 60 * 60 * 1000;

const tickDecimals = (max) => (max < 0.1 ? 3 : max < 1 ? 2 : max < 10 ? 1 : 0);

// Mide el ancho real del contenedor para dibujar el SVG en píxeles (el texto no se deforma).
function useElementWidth() {
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!node) return undefined;
    setWidth(Math.round(node.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width];
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="ru-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.key} type="button" aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CycleSummary({ usage }) {
  const start = new Date(usage.period.start).getTime();
  const end = new Date(usage.period.end).getTime();
  const updated = new Date(usage.period.updatedAt).getTime();
  const elapsedDays = Math.max((updated - start) / DAY_MS, 0.04);
  const elapsedShare = Math.min(Math.max((updated - start) / (end - start), 0), 1);
  const spentShare = usage.estimatedUsage > 0 ? Math.min(usage.currentUsage / usage.estimatedUsage, 1) : 0;
  const cpuPeak = usage.peaks?.CPU_USAGE?.[0];
  const memoryPeak = usage.peaks?.MEMORY_USAGE_GB?.[0];

  return (
    <section className="ru-summary" aria-label="Resumen del ciclo">
      <div className="ru-stat">
        <span className="ru-stat-label"><Wallet size={15} aria-hidden="true" />Consumido en el ciclo</span>
        <strong>{money.format(usage.currentUsage)}</strong>
        <small>{money.format(usage.currentUsage / elapsedDays)} por día en promedio</small>
      </div>
      <div className="ru-stat">
        <span className="ru-stat-label"><CalendarClock size={15} aria-hidden="true" />Estimado al cierre</span>
        <strong>{money.format(usage.estimatedUsage)}</strong>
        {usage.estimatedUsage > 0 ? (
          <>
            <div
              className="ru-pace"
              role="img"
              aria-label={`Se ha consumido el ${percent.format(spentShare)} del estimado con el ${percent.format(elapsedShare)} del ciclo transcurrido.`}
            >
              <b style={{ width: `${spentShare * 100}%` }} />
              <i style={{ left: `${elapsedShare * 100}%` }} />
            </div>
            <small>{percent.format(spentShare)} del estimado · {percent.format(elapsedShare)} del ciclo transcurrido</small>
          </>
        ) : <small>Railway aún no calcula la proyección.</small>}
      </div>
      <div className="ru-stat">
        <span className="ru-stat-label"><Cpu size={15} aria-hidden="true" />Pico de CPU</span>
        <strong>{cpuPeak ? formatMetric("CPU_USAGE", cpuPeak.value) : "—"}</strong>
        <small>{cpuPeak ? `${cpuPeak.service} · ${dateHour.format(new Date(cpuPeak.timestamp))} · últimos 30 días` : "Sin datos horarios"}</small>
      </div>
      <div className="ru-stat">
        <span className="ru-stat-label"><MemoryStick size={15} aria-hidden="true" />Pico de memoria</span>
        <strong>{memoryPeak ? formatMetric("MEMORY_USAGE_GB", memoryPeak.value) : "—"}</strong>
        <small>{memoryPeak ? `${memoryPeak.service} · ${dateHour.format(new Date(memoryPeak.timestamp))} · últimos 30 días` : "Sin datos horarios"}</small>
      </div>
    </section>
  );
}

function UsageLineChart({ list, from, to, hours, metric, unit }) {
  const [measure, width] = useElementWidth();
  const [active, setActive] = useState(null);
  // Un clic (o un toque) fija la hora; otro clic o Esc la suelta.
  const [pinned, setPinned] = useState(false);
  const times = useMemo(() => timeline(list), [list]);
  const height = width && width < 560 ? 210 : 260;
  const pad = { top: 12, right: 14, bottom: 26, left: 48 };
  const plotW = Math.max(width - pad.left - pad.right, 1);
  const plotH = height - pad.top - pad.bottom;
  const max = niceCeil(Math.max(0, ...list.flatMap((row) => row.points.map(([, value]) => value))));
  const span = Math.max(to - from, 1);
  const x = (ts) => pad.left + ((ts - from) / span) * plotW;
  const y = (value) => pad.top + plotH - (value / max) * plotH;
  const { ticks: allTicks, step } = timeTicks(from, to, hours);
  // En pantallas angostas se salta un corte de cada dos para que las etiquetas no se toquen.
  const tickGap = allTicks.length > 1 ? plotW / allTicks.length : plotW;
  const ticks = tickGap < 64 ? allTicks.filter((_, index) => index % 2 === 0) : allTicks;
  const tickLabel = (ts) => (step < 86400 ? hourOnly : hours <= 168 ? weekdayDay : date).format(new Date(ts * 1000));
  const decimals = tickDecimals(max);
  const activeTs = active === null ? null : times[Math.min(active, times.length - 1)];
  const readings = activeTs === null ? [] : list
    .map((row) => ({ ...row, value: row.points.find(([ts]) => ts === activeTs)?.[1] }))
    .filter((row) => row.value !== undefined)
    .sort((a, b) => b.value - a.value);

  const pickAt = (clientX, rect) => {
    const ts = from + ((clientX - rect.left - pad.left) / plotW) * span;
    let best = 0;
    for (let index = 1; index < times.length; index += 1) {
      if (Math.abs(times[index] - ts) < Math.abs(times[best] - ts)) best = index;
    }
    setActive(times.length ? best : null);
  };
  const onKeyDown = (event) => {
    if (!times.length) return;
    const last = times.length - 1;
    const moves = { ArrowLeft: -1, ArrowRight: 1, PageDown: -24, PageUp: 24 };
    if (event.key in moves) {
      event.preventDefault();
      setActive((current) => Math.min(last, Math.max(0, (current ?? last) + moves[event.key])));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : last);
    } else if (event.key === "Escape") {
      setActive(null);
      setPinned(false);
    }
  };
  const onPointerDown = (event) => {
    pickAt(event.clientX, event.currentTarget.getBoundingClientRect());
    setPinned((current) => (event.pointerType === "mouse" ? !current : true));
  };
  const onPointerMove = (event) => {
    if (pinned && event.pointerType === "mouse") return;
    pickAt(event.clientX, event.currentTarget.getBoundingClientRect());
  };
  const release = () => {
    if (pinned) return;
    setActive(null);
  };

  // La ficha va a la derecha del cursor; si no cabe, a la izquierda; y nunca sale del gráfico.
  const tipX = activeTs === null ? 0 : x(activeTs);
  const [tipNode, setTipNode] = useState(null);
  const [tipLeft, setTipLeft] = useState(null);
  useLayoutEffect(() => {
    if (!tipNode) return;
    const tipWidth = tipNode.offsetWidth;
    let left = tipX + 14;
    if (left + tipWidth > width) left = tipX - 14 - tipWidth;
    if (left < 0) left = Math.max(0, width - tipWidth);
    setTipLeft(left);
  }, [tipNode, tipX, width, readings.length]);

  return (
    <div className="ru-line-chart" ref={measure}>
      {width ? (
        <svg
          width={width}
          height={height}
          tabIndex={0}
          role="group"
          aria-label={`Uso de ${unit} por servicio. Use las flechas para recorrer las horas y Esc para salir. Un clic fija la hora.`}
          className={pinned ? "is-pinned" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerLeave={release}
          onKeyDown={onKeyDown}
          onBlur={() => { setActive(null); setPinned(false); }}
        >
          <g className="ru-grid">
            {[0, 0.25, 0.5, 0.75, 1].map((share) => (
              <g key={share}>
                <line x1={pad.left} x2={pad.left + plotW} y1={y(max * share)} y2={y(max * share)} />
                <text x={pad.left - 8} y={y(max * share)} dy="0.32em">{(max * share).toFixed(decimals)}</text>
              </g>
            ))}
          </g>
          <g className="ru-axis">
            {ticks.map((ts) => (
              <text key={ts} x={x(ts)} y={height - 6}>{tickLabel(ts)}</text>
            ))}
          </g>
          {list.map((row) => (
            <path key={row.serviceId} className="ru-line" d={linePath(row.points, x, y)} style={{ stroke: row.color }} />
          ))}
          {activeTs !== null ? (
            <g className="ru-crosshair">
              <line x1={x(activeTs)} x2={x(activeTs)} y1={pad.top} y2={pad.top + plotH} />
              {readings.map((row) => (
                <circle key={row.serviceId} cx={x(activeTs)} cy={y(row.value)} r="4" style={{ fill: row.color }} />
              ))}
            </g>
          ) : null}
        </svg>
      ) : <div style={{ height }} />}
      {activeTs !== null ? (
        <div
          ref={setTipNode}
          className="ru-tip"
          style={{ left: tipLeft ?? tipX, top: pad.top, visibility: tipLeft === null ? "hidden" : undefined }}
          aria-live="polite"
        >
          <strong>{dateHour.format(new Date(activeTs * 1000))}</strong>
          <dl>
            {readings.map((row) => (
              <div key={row.serviceId}>
                <dt><i style={{ background: row.color }} />{row.service}</dt>
                <dd>{formatMetric(metric, row.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function PerformancePanel({ usage, colors }) {
  const [metric, setMetric] = useState("MEMORY_USAGE_GB");
  const [range, setRange] = useState("7d");
  const [hidden, setHidden] = useState(() => new Set());
  const unit = metricOptions.find((option) => option.key === metric).unit;
  const all = useMemo(() => seriesFor(usage, metric, colors), [usage, metric, colors]);
  const sliced = useMemo(() => sliceRange(all, RANGE_HOURS[range]), [all, range]);
  const visible = useMemo(() => sliced.list.filter((row) => !hidden.has(row.serviceId)), [sliced, hidden]);

  const toggle = (serviceId) => setHidden((current) => {
    const next = new Set(current);
    if (next.has(serviceId)) next.delete(serviceId);
    else if (sliced.list.length - next.size > 1) next.add(serviceId);
    return next;
  });

  return (
    <section className="ru-panel ru-performance" aria-labelledby="ru-performance-title">
      <header className="ru-panel-head">
        <div>
          <h2 id="ru-performance-title">Rendimiento por servicio</h2>
          <p>Uso horario de {metric === "CPU_USAGE" ? "CPU, en vCPU" : "memoria, en GB"}. Pase el cursor o toque el gráfico para leer todos los servicios a la misma hora; un clic la deja fija.</p>
        </div>
        <div className="ru-controls">
          <Segmented label="Recurso" options={metricOptions} value={metric} onChange={setMetric} />
          <Segmented label="Periodo" options={rangeOptions} value={range} onChange={setRange} />
        </div>
      </header>
      {sliced.list.length ? (
        <>
          <UsageLineChart key={`${metric}-${range}`} list={visible} from={sliced.from} to={sliced.to} hours={RANGE_HOURS[range]} metric={metric} unit={unit} />
          <ul className="ru-legend" aria-label="Servicios">
            {sliced.list.map((row) => {
              const stats = seriesStats(row.points);
              const shown = !hidden.has(row.serviceId);
              return (
                <li key={row.serviceId}>
                  <button type="button" aria-pressed={shown} onClick={() => toggle(row.serviceId)} title={shown ? "Ocultar del gráfico" : "Mostrar en el gráfico"}>
                    <i style={{ background: row.color }} aria-hidden="true" />
                    <span className="ru-legend-name">{row.service}</span>
                    <span className="ru-legend-stats">
                      prom. <b>{formatMetric(metric, stats.average)}</b> · máx. <b>{formatMetric(metric, stats.max)}</b>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="ru-empty">Railway no devolvió datos horarios de {metric === "CPU_USAGE" ? "CPU" : "memoria"} para este periodo.</p>
      )}
      <a className="ru-text-link" href={metricsUrl} target="_blank" rel="noreferrer">
        Cómo leer las métricas en Railway <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    </section>
  );
}

function PeakHoursPanel({ usage, colors }) {
  const [metric, setMetric] = useState("MEMORY_USAGE_GB");
  const [active, setActive] = useState(null);
  const [pinned, setPinned] = useState(false);
  const list = useMemo(() => seriesFor(usage, metric, colors), [usage, metric, colors]);
  const heat = useMemo(() => hourlyHeatmap(list), [list]);
  const peaks = useMemo(() => servicePeaks(list), [list]);
  const describe = (cell) => (cell.value === null
    ? `${WEEKDAYS_LONG[cell.day]} a las ${String(cell.hour).padStart(2, "0")}:00 · sin datos`
    : `${WEEKDAYS_LONG[cell.day]} a las ${String(cell.hour).padStart(2, "0")}:00 · ${formatMetric(metric, cell.value)} entre todos los servicios, en promedio`);
  const activeCell = active === null ? null : heat.cells[active];
  const hover = (index) => { if (!pinned) setActive(index); };
  const pin = (index) => {
    if (pinned && active === index) {
      setPinned(false);
      return;
    }
    setActive(index);
    setPinned(true);
  };

  const onKeyDown = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -24, ArrowDown: 24 };
    if (event.key in moves) {
      event.preventDefault();
      setActive((current) => {
        const base = current ?? (heat.peak ? heat.peak.day * 24 + heat.peak.hour : 0);
        const next = base + moves[event.key];
        return next < 0 || next >= heat.cells.length ? base : next;
      });
    } else if (event.key === "Escape") {
      setActive(null);
      setPinned(false);
    }
  };

  return (
    <section className="ru-panel ru-heat-panel" aria-labelledby="ru-heat-title">
      <header className="ru-panel-head">
        <div>
          <h2 id="ru-heat-title">Horas pico</h2>
          <p>Carga combinada de los servicios por día y hora{heat.days ? `, promedio de ${heat.days} días` : ""}.</p>
        </div>
        <div className="ru-controls">
          <Segmented label="Recurso" options={metricOptions} value={metric} onChange={(key) => { setMetric(key); setActive(null); setPinned(false); }} />
        </div>
      </header>
      {heat.peak ? (
        <>
          <div
            className="ru-heat"
            tabIndex={0}
            role="group"
            aria-label="Mapa de calor por día y hora. Use las flechas para recorrerlo. Un clic fija la celda."
            onKeyDown={onKeyDown}
            onPointerLeave={() => hover(null)}
            onBlur={() => { setActive(null); setPinned(false); }}
          >
            <span aria-hidden="true" />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={`h${hour}`} className={`ru-heat-hour${hour % 3 ? "" : " is-labeled"}${hour % 6 ? "" : " is-major"}`} aria-hidden="true">
                {hour % 3 ? "" : hour}
              </span>
            ))}
            {WEEKDAYS.map((day, dayIndex) => (
              <div key={day} className="ru-heat-row">
                <span className="ru-heat-day" aria-hidden="true">{day}</span>
                {heat.cells.slice(dayIndex * 24, dayIndex * 24 + 24).map((cell) => {
                  const index = cell.day * 24 + cell.hour;
                  const level = heatLevel(cell.value, heat.min, heat.max);
                  const isPeak = cell === heat.peak;
                  return (
                    <span
                      key={index}
                      className={`ru-heat-cell${isPeak ? " is-peak" : ""}${active === index ? " is-active" : ""}`}
                      data-level={level ?? "none"}
                      onPointerEnter={() => hover(index)}
                      onPointerDown={() => pin(index)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="ru-heat-foot">
            <p className="ru-heat-readout" aria-live="polite">
              {activeCell ? describe(activeCell) : <>Hora más cargada: <b>{describe(heat.peak)}</b></>}
            </p>
            <span className="ru-heat-scale" aria-hidden="true">
              Menos
              {Array.from({ length: HEAT_LEVELS }, (_, level) => <i key={level} data-level={level} />)}
              Más
            </span>
          </div>
        </>
      ) : (
        <p className="ru-empty">Aún no hay suficientes datos horarios para ubicar las horas pico.</p>
      )}
      {peaks.length ? (
        <div className="ru-peaks">
          <h3>Pico de cada servicio</h3>
          <ol>
            {peaks.map((peak) => (
              <li key={peak.serviceId}>
                <span>{peak.service}</span>
                <time dateTime={new Date(peak.timestamp * 1000).toISOString()}>{dateHour.format(new Date(peak.timestamp * 1000))}</time>
                <b>{formatMetric(metric, peak.value)}</b>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

// Las dos listas del panel comparten escala: el mismo dólar mide lo mismo en ambas.
function CostBars({ rows, label, scale }) {
  return (
    <ul className="ru-bars" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className="ru-bar-label">{row.marker}{row.label}</span>
          <span className="ru-bar" aria-hidden="true">
            {row.estimate > row.current ? (
              <em style={{ width: `${(row.estimate / scale) * 100}%` }} />
            ) : null}
            <b style={{ width: `${(row.current / scale) * 100}%` }} />
          </span>
          <span className="ru-bar-value">
            <strong>{money.format(row.current)}</strong>
            <small>{row.note}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CostPanel({ usage }) {
  const total = usage.currentUsage || 0;
  const share = (value) => (total > 0 ? percent.format(value / total) : "—");
  const resourceRows = resources
    .map(({ icon: Icon, label, key }) => {
      const current = usage.resourceUsage?.[key] ?? 0;
      const estimate = usage.estimatedResourceUsage?.[key];
      return {
        key,
        label,
        marker: <Icon size={15} aria-hidden="true" />,
        current,
        estimate,
        note: estimate !== undefined ? `cierre ≈ ${money.format(estimate)}` : share(current)
      };
    })
    .sort((a, b) => b.current - a.current);
  const serviceRows = (usage.serviceUsage ?? []).map((row) => ({
    key: row.serviceId,
    label: row.service,
    marker: null,
    current: row.cost,
    note: `${share(row.cost)} del total`
  }));
  const hasEstimate = resourceRows.some((row) => row.estimate !== undefined);
  const scale = Math.max(0, ...[...resourceRows, ...serviceRows].map((row) => Math.max(row.current, row.estimate ?? 0))) || 1;

  return (
    <section className="ru-panel ru-cost-panel" aria-labelledby="ru-cost-title">
      <header className="ru-panel-head">
        <div>
          <h2 id="ru-cost-title">Costo del ciclo</h2>
          <p>Lo facturado hasta hoy, en USD, con la proyección de Railway al cierre.</p>
        </div>
      </header>
      <h3 className="ru-subhead">Por recurso</h3>
      <CostBars rows={resourceRows} label="Costo por recurso" scale={scale} />
      {hasEstimate ? (
        <p className="ru-bars-key" aria-hidden="true">
          <span><b />Consumido</span>
          <span><em />Proyección al cierre</span>
        </p>
      ) : null}
      {serviceRows.length ? (
        <>
          <h3 className="ru-subhead">Por servicio</h3>
          <CostBars rows={serviceRows} label="Costo por servicio" scale={scale} />
        </>
      ) : null}
      <a className="ru-text-link" href={usageUrl} target="_blank" rel="noreferrer">
        Cómo calcula Railway el consumo <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="ru-loading" aria-hidden="true">
      <div className="ru-summary">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="ru-stat"><i className="ru-skeleton is-short" /><i className="ru-skeleton is-figure" /><i className="ru-skeleton" /></div>
        ))}
      </div>
      <div className="ru-panel"><i className="ru-skeleton is-short" /><i className="ru-skeleton is-chart" /></div>
    </div>
  );
}

export default function RailwayUsageWorkspace({ apiFetch }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/admin/railway/usage");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "No se pudieron consultar las métricas de Railway.");
      setUsage(payload);
    } catch (requestError) {
      setError(requestError.message || "No se pudo conectar con Railway.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadUsage(); }, [loadUsage]);

  const colors = useMemo(() => serviceColorMap(usage), [usage]);
  const period = usage?.period;
  const cycleDay = period ? Math.min(
    Math.ceil((new Date(period.updatedAt) - new Date(period.start)) / DAY_MS),
    Math.round((new Date(period.end) - new Date(period.start)) / DAY_MS)
  ) : 0;
  const cycleDays = period ? Math.round((new Date(period.end) - new Date(period.start)) / DAY_MS) : 0;

  return (
    <div className="railway-usage">
      <PageHeader
        title="Uso en Railway"
        description="Costo del ciclo de facturación y carga de cada servicio: cuánto se gasta, qué lo explica y a qué horas se carga el sistema."
        primaryAction={(
          <a className="ru-primary-link" href={projectUrl} target="_blank" rel="noreferrer">
            Abrir en Railway <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        )}
      />

      <div className={`ru-status${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>
        {error ? <AlertTriangle size={16} aria-hidden="true" /> : <CalendarRange size={16} aria-hidden="true" />}
        <p>
          {error ? error : period ? (
            <>Ciclo <b>{date.format(new Date(period.start))} – {date.format(new Date(period.end))}</b> · día {cycleDay} de {cycleDays} · actualizado {dateHour.format(new Date(period.updatedAt))}</>
          ) : "Consultando el consumo y las métricas de Railway…"}
        </p>
        <button type="button" className="ru-refresh" onClick={loadUsage} disabled={loading} aria-label={loading ? "Actualizando" : error ? "Reintentar" : "Actualizar"}>
          <RefreshCw size={15} aria-hidden="true" className={loading ? "is-spinning" : undefined} />
          <span>{loading ? "Actualizando…" : error ? "Reintentar" : "Actualizar"}</span>
        </button>
      </div>

      {usage ? (
        <div className={`ru-body${loading ? " is-refreshing" : ""}`}>
          <CycleSummary usage={usage} />
          <PerformancePanel usage={usage} colors={colors} />
          <div className="ru-lower">
            <PeakHoursPanel usage={usage} colors={colors} />
            <CostPanel usage={usage} />
          </div>
        </div>
      ) : loading ? <LoadingState /> : (
        <section className="ru-panel ru-unavailable">
          <h2>No hay datos de Railway para mostrar</h2>
          <p>La consulta falló antes de devolver el consumo. Revise que el backend tenga configurados RAILWAY_API_TOKEN, RAILWAY_PROJECT_ID y RAILWAY_ENVIRONMENT_ID, y vuelva a intentar.</p>
        </section>
      )}
    </div>
  );
}
