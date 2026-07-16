export const filterAndSortBatches = (batches = [], { query = "", status = "", order = "newest" } = {}) => {
  const needle = query.trim().toLowerCase();
  const dateValue = (item) => new Date(item.fecha_recepcion || item.fecha_extraccion || 0).getTime() || 0;
  return batches
    .filter((item) => (!status || item.estado === status) && (!needle || `${item.codigo_lote} ${item.estado} ${item.fecha_recepcion || item.fecha_extraccion || ""}`.toLowerCase().includes(needle)))
    .sort((left, right) => order === "oldest" ? dateValue(left) - dateValue(right) : order === "code" ? String(left.codigo_lote).localeCompare(String(right.codigo_lote), "es") : dateValue(right) - dateValue(left));
};
