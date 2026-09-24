export const debtRankingAll = (barrios = [], metric = "total") => [...barrios].map((item) => ({ name: item.barrio_colonia || item.barrio || item.nombre || "Sin barrio", debt: item.deuda || {}, services: item.servicios || [], records: Number(item.total_registros || 0), value: metric === "accounts" ? Number(item.deuda?.deudores || 0) : metric === "critical" ? Number(item.deuda?.criticos || 0) : Number(item.deuda?.total || 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "es"));

export const debtRanking = (barrios = [], metric = "total") => debtRankingAll(barrios, metric).slice(0, 5);

export const sumDebtRows = (rows = []) => rows.reduce((sum, item) => ({ capital: sum.capital + Number(item.debt?.capital || 0), intereses: sum.intereses + Number(item.debt?.intereses || 0), total: sum.total + Number(item.debt?.total || 0), deudores: sum.deudores + Number(item.debt?.deudores || 0), criticos: sum.criticos + Number(item.debt?.criticos || 0), records: sum.records + Number(item.records || 0) }), { capital: 0, intereses: 0, total: 0, deudores: 0, criticos: 0, records: 0 });

export const debtMetricLabel = (metric = "total") => metric === "accounts" ? "Abonados con mora" : metric === "critical" ? "Mora alta" : "Mora total";

export const sumSelectedDebt = (rows = [], selected = []) => rows.filter((item) => selected.includes(item.name)).reduce((sum, item) => ({ capital: sum.capital + Number(item.debt.capital || 0), intereses: sum.intereses + Number(item.debt.intereses || 0), total: sum.total + Number(item.debt.total || 0), deudores: sum.deudores + Number(item.debt.deudores || 0), criticos: sum.criticos + Number(item.debt.criticos || 0), records: sum.records + Number(item.records || 0) }), { capital: 0, intereses: 0, total: 0, deudores: 0, criticos: 0, records: 0 });

export const sumSelectedServices = (rows = [], selected = []) => [...rows.filter((item) => selected.includes(item.name)).flatMap((item) => item.services).reduce((services, item) => { const current = services.get(item.field) || { field: item.field, label: item.label, active: 0, inactive: 0, unknown: 0, debt: 0 }; current.active += Number(item.active || 0); current.inactive += Number(item.inactive || 0); current.unknown += Number(item.unknown || 0); current.debt += Number(item.deuda?.total || 0); services.set(item.field, current); return services; }, new Map()).values()];

// Los nombres de barrio llegan del padron con tildes, puntos y abreviaturas
// inconsistentes ("BO. PORVENIR", "Col. El Eden"), asi que la busqueda compara
// sin acentos ni mayusculas y permite escribir varias palabras sueltas.
export const normalizeBarrioText = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Filtra sobre el padron completo, no sobre el top visible: el operador tiene
// que poder sumar cualquier barrio, aunque no este entre los de mayor mora.
export const filterBarriosByQuery = (rows = [], query = "", limit = 25) => {
  const terms = normalizeBarrioText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return rows.filter((item) => { const name = normalizeBarrioText(item.name); return terms.every((term) => name.includes(term)); }).slice(0, limit);
};

export const metricValueOf = (row = {}, metric = "total") => metric === "accounts" ? Number(row.debt?.deudores || 0) : metric === "critical" ? Number(row.debt?.criticos || 0) : Number(row.debt?.total || 0);

// Filas de los barrios elegidos, ordenadas por la metrica activa, para que el
// grafico de la seleccion se lea igual que el ranking de arriba.
export const selectedRankedRows = (rows = [], selected = [], metric = "total") => rows
  .filter((item) => selected.includes(item.name))
  .map((item) => ({ ...item, value: metricValueOf(item, metric) }))
  .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "es"));

// Monto abreviado para lectura ejecutiva: "L 231.9 M", "L 12.3 mil". Los
// centavos de una cartera de cientos de millones son ruido en el tablero; el
// monto exacto sigue disponible al pasar el cursor y en los reportes.
export const formatCompactCurrency = (value) => {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const fixed = (number) => number.toLocaleString("es-HN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (abs >= 1e9) return `L ${sign}${fixed(abs / 1e9)} mil M`;
  if (abs >= 1e6) return `L ${sign}${fixed(abs / 1e6)} M`;
  if (abs >= 1e4) return `L ${sign}${fixed(abs / 1e3)} mil`;
  return `L ${sign}${abs.toLocaleString("es-HN", { maximumFractionDigits: 0 })}`;
};

// Recorre los dias por calendario (no por 24 h desde ahora) para que el cambio
// de horario o la hora del navegador no salten ni dupliquen un dia.
const shiftDateKey = (dateKey, days) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Serie de los ultimos `days` dias, del mas antiguo a hoy, con cero en los
// dias sin movimiento. `totals` es un Map de "AAAA-MM-DD" a cantidad.
export const lastDaysSeries = (totals = new Map(), todayKey = "", days = 7) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey)) return [];
  return Array.from({ length: days }, (_, index) => {
    const key = shiftDateKey(todayKey, index - (days - 1));
    return { key, total: Number(totals.get(key) || 0) };
  });
};

// Reparto de ancho entre la columna de analisis y la lateral. El limite va en
// pixeles y no en porcentaje: lo que importa es que ninguna columna quede tan
// angosta que el ranking o la lista de pendientes se rompan.
export const SPLIT_DEFAULT = 62;
export const clampSplit = (percent, availableWidth = 0, minMain = 420, minSide = 300) => {
  const value = Number.isFinite(Number(percent)) ? Number(percent) : SPLIT_DEFAULT;
  const width = Number(availableWidth) || 0;
  // Sin espacio para ambos minimos (o sin medida) se acota a un rango sensato.
  if (width < minMain + minSide) return Math.min(75, Math.max(40, value));
  const min = (minMain / width) * 100;
  const max = 100 - (minSide / width) * 100;
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10;
};

// "7 de cada 10": una proporcion dicha como la diria una persona. Se redondea
// a decimos; con total cero no hay lectura posible.
export const ofEachTen = (part, total) => {
  const denominator = Number(total || 0);
  if (!denominator) return "";
  const tenths = Math.round((Number(part || 0) / denominator) * 10);
  return `${tenths} de cada 10`;
};

// Cuantos lempiras de interes se deben por cada lempira de capital.
export const interestPerCapital = (intereses, capital) => {
  const base = Number(capital || 0);
  return base ? Number(intereses || 0) / base : 0;
};
