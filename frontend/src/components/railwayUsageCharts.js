// Cálculos de los gráficos de "Uso en Railway". Sin React, para poder probarlos con node --test.

// Honduras está en UTC-6 todo el año (no tiene horario de verano).
export const TZ_OFFSET_SECONDS = -6 * 3600;
const HOUR = 3600;
const DAY = 24 * HOUR;

export const RANGE_HOURS = { "24h": 24, "7d": 168, "30d": 720 };

// Un color por servicio, solo para distinguir las líneas del gráfico (en el resto de la
// pantalla el nombre ya identifica el servicio). El orden sigue el costo del ciclo.
// Sin ocre ni rojo: DESIGN.md los reserva para intereses y para lo crítico.
export const SERVICE_COLORS = ["#1465d9", "#0f8a7e", "#8a4fb8", "#64748b"];
const FALLBACK_COLOR = "#94a3b8";

export const serviceColorMap = (usage) => {
  const ids = [
    ...(usage?.serviceUsage ?? []).map((row) => row.serviceId),
    ...(usage?.series ?? []).map((row) => row.serviceId)
  ];
  const unique = [...new Set(ids.filter(Boolean))];
  return new Map(unique.map((id, index) => [id, SERVICE_COLORS[index] ?? FALLBACK_COLOR]));
};

export const seriesFor = (usage, metric, colors) => (usage?.series ?? [])
  .filter((row) => row.measurement === metric && row.points?.length)
  .map((row) => ({ ...row, color: colors.get(row.serviceId) ?? FALLBACK_COLOR }))
  .sort((a, b) => [...colors.keys()].indexOf(a.serviceId) - [...colors.keys()].indexOf(b.serviceId));

const lastTimestamp = (list) => list.reduce(
  (latest, row) => Math.max(latest, row.points.at(-1)?.[0] ?? 0),
  0
);

// Recorta cada serie a las últimas `hours` horas, contadas desde el dato más reciente.
export const sliceRange = (list, hours) => {
  const to = lastTimestamp(list);
  const from = to - hours * HOUR;
  return {
    from,
    to,
    list: list.map((row) => ({ ...row, points: row.points.filter(([ts]) => ts >= from) }))
  };
};

export const timeline = (list) => [...new Set(list.flatMap((row) => row.points.map(([ts]) => ts)))]
  .sort((a, b) => a - b);

export const seriesStats = (points) => {
  if (!points.length) return { average: 0, max: 0 };
  let total = 0;
  let max = 0;
  for (const [, value] of points) {
    total += value;
    if (value > max) max = value;
  }
  return { average: total / points.length, max };
};

// Techo "redondo" para el eje: 0.0137 → 0.02, 1.87 → 2, 3.2 → 5.
export const niceCeil = (value) => {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
};

// Cortes del eje de tiempo alineados a la hora local: cada 4 h, cada día o cada 5 días.
export const timeTicks = (from, to, hours) => {
  const step = hours <= 24 ? 4 * HOUR : hours <= 168 ? DAY : 5 * DAY;
  const first = Math.ceil((from + TZ_OFFSET_SECONDS) / step) * step - TZ_OFFSET_SECONDS;
  const ticks = [];
  for (let ts = first; ts <= to; ts += step) ticks.push(ts);
  return { ticks, step };
};

// Trazo SVG de una serie; corta la línea cuando faltan más de dos horas seguidas.
export const linePath = (points, x, y) => {
  let d = "";
  let previous = null;
  for (const [ts, value] of points) {
    const command = previous === null || ts - previous > 2 * HOUR ? "M" : "L";
    d += `${command}${x(ts).toFixed(1)},${y(value).toFixed(1)}`;
    previous = ts;
  }
  return d;
};

// El máximo de cada servicio en toda la serie, del más alto al más bajo.
export const servicePeaks = (list) => list
  .map((row) => {
    const top = row.points.reduce((best, point) => (best === null || point[1] > best[1] ? point : best), null);
    return top ? { serviceId: row.serviceId, service: row.service, timestamp: top[0], value: top[1] } : null;
  })
  .filter(Boolean)
  .sort((a, b) => b.value - a.value);

export const WEEKDAYS =["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAYS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

// Promedio del total de todos los servicios por día de la semana y hora local.
export const hourlyHeatmap = (list) => {
  const totals = new Map();
  for (const row of list) {
    for (const [ts, value] of row.points) totals.set(ts, (totals.get(ts) ?? 0) + value);
  }
  const sums = Array.from({ length: 7 * 24 }, () => ({ total: 0, count: 0 }));
  for (const [ts, value] of totals) {
    const local = new Date((ts + TZ_OFFSET_SECONDS) * 1000);
    const day = (local.getUTCDay() + 6) % 7;
    sums[day * 24 + local.getUTCHours()].total += value;
    sums[day * 24 + local.getUTCHours()].count += 1;
  }
  const cells = sums.map(({ total, count }, index) => ({
    day: Math.floor(index / 24),
    hour: index % 24,
    value: count ? total / count : null
  }));
  const filled = cells.filter((cell) => cell.value !== null);
  const peak = filled.reduce((best, cell) => (best === null || cell.value > best.value ? cell : best), null);
  const min = filled.reduce((low, cell) => Math.min(low, cell.value), Infinity);
  const stamps = [...totals.keys()];
  const days = stamps.length ? Math.round((Math.max(...stamps) - Math.min(...stamps)) / DAY) : 0;
  return { cells, peak, min: Number.isFinite(min) ? min : 0, max: peak?.value ?? 0, days };
};

// Seis tonos de un mismo azul entre la hora más tranquila y la más cargada: la memoria
// nunca baja de cierto piso, y medir desde cero pintaría todo el mapa del mismo tono.
// El nivel 0 es "la hora más tranquila", no "sin datos".
export const HEAT_LEVELS = 6;
export const heatLevel = (value, min, max) => {
  if (value === null) return null;
  if (!(max > min)) return max > 0 ? HEAT_LEVELS - 1 : 0;
  return Math.min(HEAT_LEVELS - 1, Math.max(0, Math.round(((value - min) / (max - min)) * (HEAT_LEVELS - 1))));
};

export const formatMetric = (metric, value) => {
  if (!Number.isFinite(value)) return "—";
  if (metric === "CPU_USAGE") return `${value.toFixed(value < 0.1 ? 3 : 2)} vCPU`;
  if (value < 1) return `${Math.round(value * 1024)} MB`;
  return `${value.toFixed(2)} GB`;
};
