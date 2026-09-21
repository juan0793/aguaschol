export const debtRankingAll = (barrios = [], metric = "total") => [...barrios].map((item) => ({ name: item.barrio_colonia || item.barrio || item.nombre || "Sin barrio", debt: item.deuda || {}, services: item.servicios || [], records: Number(item.total_registros || 0), value: metric === "accounts" ? Number(item.deuda?.deudores || 0) : metric === "critical" ? Number(item.deuda?.criticos || 0) : Number(item.deuda?.total || 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "es"));

export const debtRanking = (barrios = [], metric = "total") => debtRankingAll(barrios, metric).slice(0, 5);

export const sumDebtRows = (rows = []) => rows.reduce((sum, item) => ({ capital: sum.capital + Number(item.debt?.capital || 0), intereses: sum.intereses + Number(item.debt?.intereses || 0), total: sum.total + Number(item.debt?.total || 0), deudores: sum.deudores + Number(item.debt?.deudores || 0), criticos: sum.criticos + Number(item.debt?.criticos || 0), records: sum.records + Number(item.records || 0) }), { capital: 0, intereses: 0, total: 0, deudores: 0, criticos: 0, records: 0 });

export const debtMetricLabel = (metric = "total") => metric === "accounts" ? "Abonados con mora" : metric === "critical" ? "Casos criticos" : "Mora total";

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
