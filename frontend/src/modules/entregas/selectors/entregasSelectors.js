// Selectors puros del modulo Control de Entregas.
// No hacen peticiones ni tocan el DOM: solo derivan datos ya cargados.

export const calculateDeliveryRate = (entregadas = 0, asignadas = 0) => {
  const base = Number(asignadas) || 0;
  if (base <= 0) return 0;
  return Math.round(((Number(entregadas) || 0) / base) * 10000) / 100;
};

export const sumLotes = (lotes = []) =>
  lotes.reduce(
    (totales, lote) => {
      const asignadas = Number(lote.total_asignadas) || 0;
      const sobrantes = Number(lote.total_sobrantes) || 0;
      return {
        lotes: totales.lotes + 1,
        asignadas: totales.asignadas + asignadas,
        sobrantes: totales.sobrantes + sobrantes,
        entregadas: totales.entregadas + Math.max(asignadas - sobrantes, 0),
        abiertos: totales.abiertos + (lote.estado === "ABIERTO" ? 1 : 0)
      };
    },
    { lotes: 0, asignadas: 0, sobrantes: 0, entregadas: 0, abiertos: 0 }
  );

const groupBy = (rows, getKey, getBase) => {
  const mapa = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!mapa.has(key)) mapa.set(key, getBase(row));
    const acumulado = mapa.get(key);
    const asignadas = Number(row.total_asignadas) || 0;
    const sobrantes = Number(row.total_sobrantes) || 0;
    acumulado.lotes += 1;
    acumulado.asignadas += asignadas;
    acumulado.sobrantes += sobrantes;
    acumulado.entregadas += Math.max(asignadas - sobrantes, 0);
  });
  return [...mapa.values()]
    .map((fila) => ({ ...fila, efectividad: calculateDeliveryRate(fila.entregadas, fila.asignadas) }))
    .sort((left, right) => right.asignadas - left.asignadas);
};

export const groupByResponsible = (lotes = []) =>
  groupBy(
    lotes,
    (lote) => String(lote.responsable_id),
    (lote) => ({
      responsable_id: lote.responsable_id,
      responsable_nombre: lote.responsable_nombre || "—",
      lotes: 0,
      asignadas: 0,
      sobrantes: 0,
      entregadas: 0
    })
  );

export const groupByNeighborhood = (lotes = []) =>
  groupBy(
    lotes,
    (lote) => String(lote.barrio_codigo || lote.barrio_nombre || ""),
    (lote) => ({
      barrio_codigo: lote.barrio_codigo || "",
      barrio_nombre: lote.barrio_nombre || "Sin barrio",
      lotes: 0,
      asignadas: 0,
      sobrantes: 0,
      entregadas: 0
    })
  );

export const groupByReason = (noEntregadas = []) => {
  const mapa = new Map();
  noEntregadas.forEach((item) => {
    const key = item.motivo || "OTRO";
    if (!mapa.has(key)) mapa.set(key, { motivo: key, motivo_etiqueta: item.motivo_etiqueta || key, total: 0 });
    mapa.get(key).total += 1;
  });
  const total = noEntregadas.length;
  return [...mapa.values()]
    .map((fila) => ({ ...fila, porcentaje: total ? Math.round((fila.total / total) * 1000) / 10 : 0 }))
    .sort((left, right) => right.total - left.total);
};

export const getAttentionIndicators = (noEntregadas = [], lotes = []) => {
  const pendientes = noEntregadas.filter((item) => item.estado === "PENDIENTE");
  return {
    pendientes: pendientes.length,
    mas_3_dias: pendientes.filter((item) => Number(item.dias_pendiente) > 3).length,
    mas_7_dias: pendientes.filter((item) => Number(item.dias_pendiente) > 7).length,
    multiples_intentos: pendientes.filter((item) => Number(item.intentos) >= 2).length,
    lotes_abiertos: lotes.filter((lote) => lote.estado === "ABIERTO").length
  };
};

// Escala util para las barras del grafico "entregadas vs no entregadas por día".
export const scaleSeries = (rows = [], keys = []) => {
  const max = Math.max(1, ...rows.flatMap((row) => keys.map((key) => Number(row[key]) || 0)));
  return rows.map((row) => ({
    ...row,
    _escala: Object.fromEntries(keys.map((key) => [key, Math.round(((Number(row[key]) || 0) / max) * 1000) / 10]))
  }));
};
