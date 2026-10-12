// Vista "Operación" de Gerencia: arma cifras, estados y tablas a partir del snapshot.
// Solo usa datos que el sistema registra; si algo falta, el bloque lo dice en vez de inventarlo.
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const key = (value) => String(value || "").trim().toLowerCase();

// Cambio contra el mes anterior en porcentaje entero; null si no hay base para comparar.
export function changeVersus(current, previous) {
  if (previous == null || !Number.isFinite(Number(previous)) || Number(previous) === 0) return null;
  return Math.round(((num(current) - num(previous)) / num(previous)) * 100);
}

export function minutesSince(iso, now = Date.now()) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? Math.max(0, Math.round((now - time) / 60000)) : null;
}

export function sinceLabel(minutes) {
  if (minutes == null) return "Sin registro";
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Hace ${hours} h` : `Hace ${Math.floor(hours / 24)} d`;
}

export function buildManagerOverview(snapshot, now = Date.now()) {
  const { inspections = {}, deliveries = {}, fichas = {}, padron = {}, team = {} } = snapshot || {};
  const pendientes = [["ASIGNADA", "Asignadas", "#8db6e6", inspections.asignadas], ["EN_PROCESO", "En proceso", "#4f8bd8", inspections.en_proceso], ["SEGUIMIENTO", "En seguimiento", "#0b3f73", inspections.seguimiento]]
    .map(([id, label, color, value]) => ({ id, label, color, value: num(value) }));
  const totalPendientes = pendientes.reduce((sum, item) => sum + item.value, 0);
  const comparativo = deliveries.comparativo || {};

  const equipo = (team.tecnicos || [])
    .filter((person) => num(person.hoy) > 0)
    .map((person) => {
      const minutes = minutesSince(person.ultima, now);
      return { id: person.id, nombre: person.nombre || "Sin nombre", hoy: num(person.hoy), cerrados: num(person.finalizados), minutes, status: minutes != null && minutes <= 30 ? "now" : "today" };
    })
    .sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));

  const entregasPorBarrio = new Map((deliveries.por_barrio || []).map((row) => [key(row.barrio_nombre), row]));
  const moraTotal = num(padron.summary?.deuda?.total);
  const barrios = (padron.barrios || []).map((row) => {
    const entrega = entregasPorBarrio.get(key(row.barrio_colonia));
    return {
      barrio: row.barrio_colonia,
      abonados: num(row.total_registros),
      deudores: num(row.deuda?.deudores),
      mora: num(row.deuda?.total),
      share: moraTotal ? (num(row.deuda?.total) / moraTotal) * 100 : 0,
      asignadas: entrega ? num(entrega.asignadas) : null,
      entregadas: entrega ? num(entrega.entregadas) : null,
      efectividad: entrega ? num(entrega.efectividad) : null
    };
  }).sort((a, b) => b.mora - a.mora);

  return {
    kpis: {
      creadas: { value: num(inspections.creadas_mes), previous: inspections.creadas_mes_anterior ?? null, change: changeVersus(inspections.creadas_mes, inspections.creadas_mes_anterior) },
      finalizadas: { value: num(inspections.finalizadas_mes), previous: inspections.finalizadas_mes_anterior ?? null, change: changeVersus(inspections.finalizadas_mes, inspections.finalizadas_mes_anterior) },
      pendientes: { value: totalPendientes, oldestDays: inspections.mas_antigua_asignada_dias ?? null },
      efectividad: { value: num(deliveries.efectividad), entregadas: num(deliveries.entregadas), asignadas: num(deliveries.asignadas), points: comparativo.efectividad == null || !num(comparativo.asignadas) ? null : Math.round((num(deliveries.efectividad) - num(comparativo.efectividad)) * 10) / 10, vencidas: num(deliveries.vencidas) },
      fichas: { value: num(fichas.total) },
      equipo: { value: equipo.length, acciones: equipo.reduce((sum, person) => sum + person.hoy, 0) }
    },
    estados: { items: pendientes, total: totalPendientes },
    efectividadBarrios: (deliveries.por_barrio || [])
      .filter((row) => num(row.asignadas) > 0)
      .map((row) => ({ barrio: row.barrio_nombre || "Sin barrio", asignadas: num(row.asignadas), entregadas: num(row.entregadas), efectividad: num(row.efectividad) }))
      .sort((a, b) => b.asignadas - a.asignadas),
    equipo,
    barrios
  };
}
