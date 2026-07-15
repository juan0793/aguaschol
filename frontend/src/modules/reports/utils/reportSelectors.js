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
