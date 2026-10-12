export const managerMonthRange = (month, today) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > today.slice(0, 7)) throw new Error("Selecciona un mes válido, hasta el mes actual.");
  const [year, number] = month.split("-").map(Number);
  if (year < 1000) throw new Error("Selecciona un año válido.");
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: month === today.slice(0, 7) ? today : `${month}-${last}` };
};

const count = (value) => {
  if (value == null || !Number.isFinite(Number(value))) throw new Error("El servidor no devolvió un indicador válido.");
  return Number(value);
};

export const buildManagerDashboardModel = (data, navigate) => {
  const { padron, meta, inspections, deliveries, fichas, gps, activity } = data;
  count(padron.summary.deuda?.total);
  if (![padron.barrios, inspections.carga_tecnicos, deliveries.por_dia, gps.groups, activity.items].every(Array.isArray)) throw new Error("El servidor no devolvió los datos de seguimiento completos.");
  [inspections.creadas_mes, inspections.finalizadas_mes, deliveries.entregadas, deliveries.pendientes].forEach(count);
  const points = gps.groups.reduce((sum, item) => sum + count(item.total), 0);
  const attention = [
    { key: "delivery-expired", count: count(deliveries.vencidas), title: "Documentos vencidos", detail: "En los lotes del período seleccionado", actionView: "entregas", icon: "warning", level: "Crítico" },
    { key: "delivery-open", count: count(deliveries.lotes_abiertos), title: "Lotes por cerrar", detail: "En los lotes del período seleccionado", actionView: "entregas", icon: "archive", level: "Atención" },
    { key: "inspection-followup", count: count(inspections.seguimiento), title: "Inspecciones en seguimiento", detail: "Carga pendiente actual, de todos los períodos", actionView: "inspecciones", icon: "activity", level: "Atención" }
  ].filter((item) => item.count > 0);
  return {
    navigate, canExport: false, hideDeadlines: true, onlineUsers: [],
    debtSummary: padron.summary.deuda, debtBarrios: padron.barrios,
    padronTotals: { records: count(padron.summary.total_records), barrios: count(padron.summary.total_barrios), updatedAt: meta.updated_at },
    metrics: [
      { key: "records", value: count(fichas.total), label: "Fichas activas", helper: "Total del sistema", icon: "records" },
      { key: "gps", value: points, label: "Puntos GPS", helper: "Total de las jornadas registradas", icon: "map", targetView: "fieldValidation" }
    ],
    attention,
    feed: activity.items.map((item) => ({ key: item.id, title: item.summary, detail: item.actor_name, targetView: "teamActivity", icon: "activity" })),
    quickActions: [["inspecciones", "activity", "Consultar inspecciones"], ["entregas", "archive", "Consultar entregas"], ["records", "records", "Ver fichas"], ["lookup", "search", "Buscar clave"], ["sigTerritorial", "map", "SIG Territorial"]]
  };
};
