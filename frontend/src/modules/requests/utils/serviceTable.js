// Tabla de servicios por barrio del padrón maestro: una fila por barrio con
// usuarios, cada servicio (usuarios con el servicio y deuda de esas cuentas) y
// la deuda del barrio. Funciones puras para poder probarlas sin React.

// [campo, encabezado de columna, icono, nombre completo]. El orden es el de la
// tabla y también el de las tarjetas de servicio que la ordenan.
export const SERVICE_COLUMNS = [
  ["agua", "Agua", "water", "Agua potable"],
  ["alcantarillado", "Alcantarillado", "sewer", "Alcantarillado"],
  ["barrido", "Barrido", "broom", "Barrido"],
  ["recoleccion", "Recolección", "waste", "Recolección de desechos"],
  ["desechos_peligrosos", "Peligrosos", "warning", "Desechos peligrosos"]
];

const num = (value) => Number(value || 0);

export const barrioName = (barrio = {}) => String(barrio.barrio_colonia || "").trim() || "Sin barrio";

export const buildServiceRows = (barrios = []) =>
  barrios
    .map((barrio) => {
      const byField = Object.fromEntries((barrio.servicios || []).map((service) => [service.field, service]));
      return {
        name: barrioName(barrio),
        usuarios: num(barrio.total_registros),
        deuda: {
          capital: num(barrio.deuda?.capital),
          intereses: num(barrio.deuda?.intereses),
          total: num(barrio.deuda?.total),
          deudores: num(barrio.deuda?.deudores)
        },
        services: Object.fromEntries(SERVICE_COLUMNS.map(([field]) => [field, {
          active: num(byField[field]?.active),
          percentage: num(byField[field]?.percentage),
          deuda: num(byField[field]?.deuda?.total),
          // Cuentas con el servicio que deben y cuánto de capital e intereses.
          deudores: num(byField[field]?.deuda?.deudores),
          capital: num(byField[field]?.deuda?.capital),
          intereses: num(byField[field]?.deuda?.intereses)
        }]))
      };
    })
    .filter((row) => row.usuarios > 0);

const DEBT_KEYS = { deudores: "deudores", capital: "capital", intereses: "intereses", deuda: "total" };

export const serviceSortValue = (row, key, view = "usuarios") => {
  if (key === "name") return row.name;
  if (key === "usuarios") return row.usuarios;
  if (DEBT_KEYS[key]) return row.deuda[DEBT_KEYS[key]];
  const service = row.services[key];
  if (!service) return 0;
  return view === "deuda" ? service.deuda : service.active;
};

export const sortServiceRows = (rows = [], { key = "usuarios", dir = "desc", view = "usuarios" } = {}) => {
  const direction = dir === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = serviceSortValue(left, key, view);
    const b = serviceSortValue(right, key, view);
    const byValue = typeof a === "string" ? a.localeCompare(b, "es") : a - b;
    return byValue * direction || left.name.localeCompare(right.name, "es");
  });
};

export const sumServiceRows = (rows = []) => {
  const totals = {
    usuarios: 0,
    deuda: { capital: 0, intereses: 0, total: 0, deudores: 0 },
    services: Object.fromEntries(SERVICE_COLUMNS.map(([field]) => [field, { active: 0, percentage: 0, deuda: 0 }]))
  };
  rows.forEach((row) => {
    totals.usuarios += row.usuarios;
    Object.keys(totals.deuda).forEach((key) => { totals.deuda[key] += row.deuda[key]; });
    SERVICE_COLUMNS.forEach(([field]) => {
      totals.services[field].active += row.services[field].active;
      totals.services[field].deuda += row.services[field].deuda;
    });
  });
  SERVICE_COLUMNS.forEach(([field]) => {
    const service = totals.services[field];
    service.percentage = totals.usuarios ? Number(((service.active / totals.usuarios) * 100).toFixed(1)) : 0;
  });
  return totals;
};

// ---------- Un solo servicio ----------
// Al elegir un servicio, cada barrio se lee desde ese servicio: cuántos usuarios
// lo tienen, cuántos no, y lo que deben las cuentas que lo tienen. La deuda no se
// separa por concepto en el archivo maestro: es la de las cuentas con el servicio.

export const serviceLabel = (field) => SERVICE_COLUMNS.find(([key]) => key === field)?.[3] || field;

export const buildServiceFocusRows = (rows = [], field) => {
  const totalDeuda = rows.reduce((sum, row) => sum + (row.services[field]?.deuda || 0), 0);
  return rows.map((row) => {
    const service = row.services[field] || {};
    const active = num(service.active);
    return {
      name: row.name,
      usuarios: row.usuarios,
      active,
      sin: Math.max(0, row.usuarios - active),
      percentage: num(service.percentage),
      deudores: num(service.deudores),
      capital: num(service.capital),
      intereses: num(service.intereses),
      deuda: num(service.deuda),
      // Parte de la deuda del servicio en toda la ciudad que cae en este barrio.
      share: totalDeuda ? (num(service.deuda) / totalDeuda) * 100 : 0
    };
  });
};

const FOCUS_KEYS = ["usuarios", "active", "sin", "percentage", "deudores", "capital", "intereses", "deuda", "share"];

export const sortServiceFocusRows = (rows = [], { key = "active", dir = "desc" } = {}) => {
  const direction = dir === "asc" ? 1 : -1;
  const campo = key === "name" || FOCUS_KEYS.includes(key) ? key : "active";
  return [...rows].sort((left, right) => {
    const byValue = campo === "name" ? left.name.localeCompare(right.name, "es") : left[campo] - right[campo];
    return byValue * direction || left.name.localeCompare(right.name, "es");
  });
};

export const sumServiceFocusRows = (rows = []) => {
  const totals = rows.reduce((acc, row) => {
    ["usuarios", "active", "sin", "deudores", "capital", "intereses", "deuda", "share"].forEach((key) => { acc[key] += row[key]; });
    if (row.active > 0) acc.barriosCon += 1;
    return acc;
  }, { usuarios: 0, active: 0, sin: 0, deudores: 0, capital: 0, intereses: 0, deuda: 0, share: 0, barriosCon: 0 });
  totals.percentage = totals.usuarios ? Number(((totals.active / totals.usuarios) * 100).toFixed(1)) : 0;
  totals.barrios = rows.length;
  return totals;
};
