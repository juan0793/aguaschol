// Gráfico de puntos "Mora por barrio y servicio": una columna por servicio y un
// punto por barrio a la altura de la mora de sus cuentas con ese servicio.
// Funciones puras (sin React) para poder probar la escala y el acomodo.

// Paso "redondo" para el eje: 1, 2, 2.5 o 5 por potencia de diez.
export const niceStep = (max, targetTicks = 4) => {
  if (!(max > 0)) return 1;
  const raw = max / targetTicks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find((step) => step * power >= raw) || 10;
  return factor * power;
};

export const niceTicks = (max, targetTicks = 4) => {
  const step = niceStep(max, targetTicks);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  return { top, ticks };
};

/** Columnas por servicio con los barrios que tienen mora en ese servicio. */
export const buildServiceColumns = (debtBarrios = [], services = []) =>
  services.map(({ field, label }) => ({
    field,
    label,
    dots: debtBarrios
      .map((barrio) => {
        const service = (barrio.servicios || []).find((item) => item.field === field);
        return {
          barrio: String(barrio.barrio_colonia || "").trim() || "Sin barrio",
          value: Number(service?.deuda?.total || 0),
          cuentas: Number(service?.active || 0)
        };
      })
      .filter((dot) => dot.value > 0)
  }));

const RADII = [4, 3.5, 3, 2.5];

/**
 * Acomodo tipo enjambre: los puntos se apilan por franjas de altura y dentro de
 * cada franja se abren a los lados del centro de la columna (0, +1, -1, +2...).
 * Nunca dos barrios en el mismo lugar:
 * - si la franja más llena no cabe, los puntos se achican (hasta 2.5 px);
 * - lo que aún sobra sube y baja medio paso por vuelta (en la franja del piso,
 *   solo sube, para no cruzar el eje).
 * Devuelve { radius, columns } con x/y en píxeles.
 */
export const layoutDots = (columns, { width, height, left = 0, top = 0, radius = 4, maxValue }) => {
  const plotWidth = Math.max(1, width - left);
  const columnWidth = plotWidth / Math.max(1, columns.length);
  const bottom = top + height;
  const yOf = (value) => bottom - (value / maxValue) * height;
  const geometry = (r) => {
    const spacing = r * 2 + 1;
    const halfRoom = Math.max(0, columnWidth / 2 - r - 4);
    const maxSteps = Math.max(0, Math.floor(halfRoom / spacing));
    return { r, spacing, halfRoom, capacity: maxSteps * 2 + 1 };
  };
  // La franja más llena de todas las columnas decide el tamaño de los puntos.
  const fullestBin = (spacing) => Math.max(0, ...columns.map((column) => {
    const counts = new Map();
    column.dots.forEach((dot) => { const bin = Math.round(yOf(dot.value) / spacing); counts.set(bin, (counts.get(bin) || 0) + 1); });
    return Math.max(0, ...counts.values());
  }));
  const candidates = RADII.filter((r) => r <= radius).map(geometry);
  const chosen = candidates.find((item) => fullestBin(item.spacing) <= item.capacity) || candidates[candidates.length - 1] || geometry(radius);
  const { r, spacing, halfRoom, capacity } = chosen;

  return {
    radius: r,
    columns: columns.map((column, columnIndex) => {
      const center = left + columnWidth * columnIndex + columnWidth / 2;
      const bins = new Map();
      const dots = [...column.dots]
        .sort((a, b) => b.value - a.value || a.barrio.localeCompare(b.barrio, "es"))
        .map((dot) => {
          const baseY = yOf(dot.value);
          const bin = Math.round(baseY / spacing);
          const used = bins.get(bin) || 0;
          bins.set(bin, used + 1);
          const lane = used % capacity;
          const round = Math.floor(used / capacity);
          const step = lane === 0 ? 0 : (lane % 2 ? 1 : -1) * Math.ceil(lane / 2);
          const x = center + Math.max(-halfRoom, Math.min(halfRoom, step * spacing));
          const onFloor = baseY >= bottom - spacing;
          const dy = round === 0 ? 0 : onFloor ? -round * (spacing / 2) : (round % 2 ? -1 : 1) * Math.ceil(round / 2) * (spacing / 2);
          return { ...dot, x, y: baseY + dy };
        });
      return { ...column, center, dots };
    })
  };
};
