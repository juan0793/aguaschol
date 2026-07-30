export const PAGE_SIZE = 10;

export const flattenReportPoints = (zones = []) =>
  zones.flatMap((zone) =>
    (zone.items || []).map((point) => ({
      ...point,
      report_zone: point.report_zone_label || point.suggested_zone || zone.displayName || zone.zone || "Sin barrio"
    }))
  );

export const filterReportDays = (groups = [], { query = "", year = "", month = "", withPoints = false } = {}) => {
  const needle = query.trim().toLowerCase();
  return groups.filter((group) => {
    const [groupYear, groupMonth] = String(group.key || "").split("-");
    return (!needle || String(group.key).toLowerCase().includes(needle)) &&
      (!year || groupYear === year) &&
      (!month || groupMonth === month) &&
      (!withPoints || Number(group.total || 0) > 0);
  });
};

export const filterReportPoints = (points = [], filters = {}, debtKeys = new Set()) => {
  const query = String(filters.query || "").trim().toLowerCase();
  return points.filter((point) => {
    const key = String(point.report_key || point.reference || "");
    const haystack = [key, point.report_zone, point.reference, point.description, point.point_type]
      .join(" ")
      .toLowerCase();
    const hasCoordinates = Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude));
    return (!query || haystack.includes(query)) &&
      (!filters.barrio || point.report_zone === filters.barrio) &&
      (!filters.type || point.point_type === filters.type) &&
      (!filters.status || (filters.status === "ready" ? hasCoordinates : !hasCoordinates)) &&
      (!filters.debt || (filters.debt === "with" ? debtKeys.has(key) : !debtKeys.has(key)));
  });
};

export const paginate = (items = [], page = 1, pageSize = PAGE_SIZE) => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  page,
  totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  total: items.length
});

export const buildPadronNameIndex = (results = []) => {
  const names = new Map();
  const add = (key, name) => {
    const cleanName = String(name || "").trim();
    if (key && cleanName && !names.has(key)) names.set(key, cleanName);
  };

  results.forEach((result) => {
    (result.matches || []).forEach((match) => {
      const name = match.inquilino || match.nombre;
      add(result.key, name);
      add(match.clave_catastral && `clave:${match.clave_catastral}`, name);
      add(match.clave_aguas_formato && `clave:${match.clave_aguas_formato}`, name);
      add(match.abonado && `abonado:${String(match.abonado).replace(/\D/g, "")}`, name);
    });
  });

  return names;
};

export const buildSharedCadastralKeys = (results = []) => {
  const keys = new Map();

  results.forEach((result) => {
    (result.matches || []).forEach((match) => {
      const clave = String(match.clave_catastral || match.clave_aguas_formato || "").trim();
      const abonado = String(match.abonado || "").trim();
      if (!clave || !abonado) return;
      if (!keys.has(clave)) keys.set(clave, { abonados: new Set(), nombres: new Set() });
      keys.get(clave).abonados.add(abonado);
      const nombre = String(match.inquilino || match.nombre || "").trim();
      if (nombre) keys.get(clave).nombres.add(nombre);
    });
  });

  return Array.from(keys, ([clave, data]) => ({
    clave,
    abonados: Array.from(data.abonados),
    nombres: Array.from(data.nombres),
    total: data.abonados.size
  })).filter((item) => item.total > 1);
};

const servicesPattern =
  /\s*(?:Servicios:\s*)?(?:Agua|Alcant\.?|Alcantarillado|Barrido|Desechos|Recolec\.?|Recolecci[oó]n|Peligrosos)\s*:\s*(?:S[ií]|No)(?:\s*\|\s*(?:Agua|Alcant\.?|Alcantarillado|Barrido|Desechos|Recolec\.?|Recolecci[oó]n|Peligrosos)\s*:\s*(?:S[ií]|No)){1,4}/gi;

export const stripServicesFromDescription = (value = "") =>
  String(value).replace(servicesPattern, "").replace(/\s{2,}/g, " ").trim();
