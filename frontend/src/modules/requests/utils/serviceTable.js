// Tabla de servicios por barrio del padrón maestro: una fila por barrio con
// usuarios, cada servicio (usuarios con el servicio y deuda de esas cuentas) y
// la deuda del barrio. Funciones puras para poder probarlas sin React.

export const SERVICE_COLUMNS = [
  ["agua", "Agua", "water"],
  ["alcantarillado", "Alcantarillado", "sewer"],
  ["barrido", "Barrido", "broom"],
  ["recoleccion", "Recolección", "waste"],
  ["desechos_peligrosos", "Peligrosos", "warning"]
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
          deuda: num(byField[field]?.deuda?.total)
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
